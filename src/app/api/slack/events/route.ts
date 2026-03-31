import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  tickets,
  ticketComments,
  slackMessageLinks,
  auditLog,
  users,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { generateTicketNumber } from "@/lib/utils";
import { DEFAULT_SLA } from "@/lib/constants";
import crypto from "crypto";

function verifySlackSignature(
  signingSecret: string,
  requestBody: string,
  timestamp: string,
  signature: string
): boolean {
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp, 10) < fiveMinutesAgo) {
    return false; // Request too old
  }

  const sigBasestring = `v0:${timestamp}:${requestBody}`;
  const mySignature =
    "v0=" +
    crypto
      .createHmac("sha256", signingSecret)
      .update(sigBasestring, "utf8")
      .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(mySignature, "utf8"),
    Buffer.from(signature, "utf8")
  );
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    // URL verification challenge
    if (body.type === "url_verification") {
      return NextResponse.json({ challenge: body.challenge });
    }

    // Validate Slack signing secret if configured
    const signingSecret = process.env.SLACK_SIGNING_SECRET;
    if (signingSecret) {
      const timestamp = request.headers.get("x-slack-request-timestamp") || "";
      const signature = request.headers.get("x-slack-signature") || "";

      if (!verifySlackSignature(signingSecret, rawBody, timestamp, signature)) {
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
    }

    // Handle event callbacks
    if (body.type === "event_callback") {
      const event = body.event;

      if (event?.type === "message" && !event.subtype && !event.bot_id) {
        const { user: slackUserId, text, channel, ts, thread_ts } = event;

        // Monitored channels from env (comma-separated)
        const monitoredChannels = (
          process.env.SLACK_MONITORED_CHANNELS || ""
        ).split(",").filter(Boolean);

        // Only process messages from monitored channels (or all if not configured)
        if (monitoredChannels.length > 0 && !monitoredChannels.includes(channel)) {
          return NextResponse.json({ ok: true });
        }

        // Look up user by Slack ID
        let dbUser = await db.query.users.findFirst({
          where: eq(users.slackUserId, slackUserId),
        });

        // If no matching user, try to create a stub
        if (!dbUser) {
          const slackDisplayName =
            event.user_profile?.display_name ||
            event.user_profile?.real_name ||
            slackUserId;
          const slackEmail = event.user_profile?.email;

          // If we have an email, try to find the user by email first
          if (slackEmail) {
            dbUser = await db.query.users.findFirst({
              where: eq(users.email, slackEmail),
            });
            // Link the Slack ID to the existing user
            if (dbUser) {
              await db
                .update(users)
                .set({ slackUserId, slackDisplayName })
                .where(eq(users.id, dbUser.id));
            }
          }

          // Still no user, create a stub
          if (!dbUser) {
            const [stub] = await db
              .insert(users)
              .values({
                email: slackEmail || `slack-${slackUserId}@slack.local`,
                name: slackDisplayName,
                slackUserId,
                slackDisplayName,
                role: "end_user",
                isActive: true,
              })
              .returning();
            dbUser = stub;
          }
        }

        if (thread_ts && thread_ts !== ts) {
          // This is a thread reply -- check if the parent message is linked to a ticket
          const existingLink = await db.query.slackMessageLinks.findFirst({
            where: and(
              eq(slackMessageLinks.channelId, channel),
              eq(slackMessageLinks.messageTs, thread_ts)
            ),
          });

          if (existingLink) {
            // Add as a comment on the existing ticket
            const [comment] = await db
              .insert(ticketComments)
              .values({
                ticketId: existingLink.ticketId,
                authorId: dbUser.id,
                body: text || "(empty message)",
                isInternal: false,
                source: "slack",
              })
              .returning();

            // Store the thread reply link
            await db
              .insert(slackMessageLinks)
              .values({
                ticketId: existingLink.ticketId,
                channelId: channel,
                messageTs: ts,
                threadTs: thread_ts,
                slackUserId,
                slackDisplayName: dbUser.slackDisplayName || dbUser.name,
                originalText: text,
              })
              .onConflictDoNothing();

            // Check first response SLA
            const ticket = await db.query.tickets.findFirst({
              where: eq(tickets.id, existingLink.ticketId),
            });

            if (
              ticket &&
              !ticket.firstResponseAt &&
              dbUser.id !== ticket.requesterId
            ) {
              const now = new Date();
              await db
                .update(tickets)
                .set({
                  firstResponseAt: now,
                  slaResponseMet: ticket.slaResponseDue
                    ? now <= ticket.slaResponseDue
                    : null,
                  updatedAt: now,
                })
                .where(eq(tickets.id, existingLink.ticketId));
            }

            await db.insert(auditLog).values({
              eventType: "comment.created",
              entityType: "ticket",
              entityId: existingLink.ticketId,
              actorId: dbUser.id,
              actorType: "user",
              action: "comment",
              details: {
                commentId: comment.id,
                source: "slack",
                channelId: channel,
              },
            });
          }
        } else {
          // New top-level message -- create a new ticket
          const sla = DEFAULT_SLA.medium;
          const now = new Date();
          const ticketNumber = generateTicketNumber();

          const [ticket] = await db
            .insert(tickets)
            .values({
              ticketNumber,
              title: text
                ? text.length > 100
                  ? text.substring(0, 97) + "..."
                  : text
                : "Slack message",
              description: text || null,
              priority: "medium",
              requesterId: dbUser.id,
              source: "slack",
              slaResponseDue: new Date(
                now.getTime() + sla.responseMinutes * 60 * 1000
              ),
              slaResolutionDue: new Date(
                now.getTime() + sla.resolutionMinutes * 60 * 1000
              ),
            })
            .returning();

          // Store the Slack message link
          await db
            .insert(slackMessageLinks)
            .values({
              ticketId: ticket.id,
              channelId: channel,
              messageTs: ts,
              slackUserId,
              slackDisplayName: dbUser.slackDisplayName || dbUser.name,
              originalText: text,
            })
            .onConflictDoNothing();

          await db.insert(auditLog).values({
            eventType: "ticket.created",
            entityType: "ticket",
            entityId: ticket.id,
            actorId: dbUser.id,
            actorType: "user",
            action: "create",
            details: {
              ticketNumber: ticket.ticketNumber,
              source: "slack",
              channelId: channel,
              messageTs: ts,
            },
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/slack/events error:", error);
    // Always return 200 to Slack to prevent retries
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
