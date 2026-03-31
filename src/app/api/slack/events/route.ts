import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  tickets,
  ticketComments,
  slackMessageLinks,
  auditLog,
  users,
} from "@/lib/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { generateTicketNumber } from "@/lib/utils";
import { DEFAULT_SLA } from "@/lib/constants";
import crypto from "crypto";

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const PORTAL_URL = process.env.NEXTAUTH_URL || "https://it-support.zimark.link";
const DEDUP_WINDOW_SECONDS = 60; // Messages within 60s from same user merge into one ticket

// ─── Slack API helpers ──────────────────────────────────────────────────────

async function slackApi(method: string, body?: Record<string, any>) {
  if (!SLACK_BOT_TOKEN) return null;
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return data.ok ? data : null;
}

async function getSlackUserInfo(slackUserId: string): Promise<{
  name: string;
  email: string | null;
  realName: string | null;
}> {
  const data = await slackApi("users.info", { user: slackUserId });
  if (data?.user) {
    return {
      name: data.user.real_name || data.user.profile?.display_name || slackUserId,
      email: data.user.profile?.email || null,
      realName: data.user.real_name || null,
    };
  }
  return { name: slackUserId, email: null, realName: null };
}

async function postSlackReply(channel: string, threadTs: string, text: string) {
  return slackApi("chat.postMessage", {
    channel,
    thread_ts: threadTs,
    text,
  });
}

function stripBotMentions(text: string): string {
  // Remove <@UBOTID> mentions
  return text.replace(/<@[A-Z0-9]+>/g, "").trim();
}

// ─── Signature verification ─────────────────────────────────────────────────

function verifySlackSignature(
  signingSecret: string,
  requestBody: string,
  timestamp: string,
  signature: string
): boolean {
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp, 10) < fiveMinutesAgo) return false;

  const sigBasestring = `v0:${timestamp}:${requestBody}`;
  const mySignature =
    "v0=" +
    crypto.createHmac("sha256", signingSecret).update(sigBasestring, "utf8").digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(mySignature, "utf8"),
    Buffer.from(signature, "utf8")
  );
}

// ─── Resolve Slack user to DB user ──────────────────────────────────────────

async function resolveSlackUser(slackUserId: string) {
  // 1. Check if already linked
  let dbUser = await db.query.users.findFirst({
    where: eq(users.slackUserId, slackUserId),
  });
  if (dbUser) return dbUser;

  // 2. Fetch real info from Slack API
  const slackInfo = await getSlackUserInfo(slackUserId);

  // 3. Match by email (case-insensitive)
  if (slackInfo.email) {
    dbUser = await db.query.users.findFirst({
      where: sql`LOWER(${users.email}) = LOWER(${slackInfo.email})`,
    });
    if (dbUser) {
      // Link Slack ID to existing user
      await db
        .update(users)
        .set({
          slackUserId,
          slackDisplayName: slackInfo.name,
          updatedAt: new Date(),
        })
        .where(eq(users.id, dbUser.id));
      return dbUser;
    }
  }

  // 4. Create new user with real info
  const [newUser] = await db
    .insert(users)
    .values({
      email: slackInfo.email || `slack-${slackUserId}@slack.local`,
      name: slackInfo.name,
      slackUserId,
      slackDisplayName: slackInfo.name,
      role: "end_user",
      isActive: true,
    })
    .onConflictDoNothing()
    .returning();

  if (newUser) return newUser;

  // 5. Conflict - find the existing record
  const existing = await db.query.users.findFirst({
    where: sql`LOWER(${users.email}) = LOWER(${slackInfo.email || `slack-${slackUserId}@slack.local`})`,
  });
  if (existing) {
    await db
      .update(users)
      .set({ slackUserId, slackDisplayName: slackInfo.name, updatedAt: new Date() })
      .where(eq(users.id, existing.id));
    return existing;
  }

  // Last resort fallback
  return { id: slackUserId, name: slackInfo.name, email: slackInfo.email };
}

// ─── Main handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    // URL verification challenge
    if (body.type === "url_verification") {
      return NextResponse.json({ challenge: body.challenge });
    }

    // Validate signature
    const signingSecret = process.env.SLACK_SIGNING_SECRET;
    if (signingSecret) {
      const timestamp = request.headers.get("x-slack-request-timestamp") || "";
      const signature = request.headers.get("x-slack-signature") || "";
      if (!verifySlackSignature(signingSecret, rawBody, timestamp, signature)) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    if (body.type === "event_callback") {
      const event = body.event;

      // Only handle real user messages (no bots, no subtypes like join/leave)
      if (event?.type === "message" && !event.subtype && !event.bot_id) {
        const { user: slackUserId, text: rawText, channel, ts, thread_ts } = event;
        const text = stripBotMentions(rawText || "");

        if (!text) return NextResponse.json({ ok: true });

        // Resolve user identity via Slack API
        const dbUser = await resolveSlackUser(slackUserId);

        if (thread_ts && thread_ts !== ts) {
          // ─── THREAD REPLY → Add as ticket comment ──────────────────────
          const existingLink = await db.query.slackMessageLinks.findFirst({
            where: and(
              eq(slackMessageLinks.channelId, channel),
              eq(slackMessageLinks.messageTs, thread_ts)
            ),
          });

          if (existingLink) {
            await db.insert(ticketComments).values({
              ticketId: existingLink.ticketId,
              authorId: dbUser.id,
              body: text,
              isInternal: false,
              source: "slack",
            });

            await db
              .insert(slackMessageLinks)
              .values({
                ticketId: existingLink.ticketId,
                channelId: channel,
                messageTs: ts,
                threadTs: thread_ts,
                slackUserId,
                slackDisplayName: dbUser.name,
                originalText: text,
              })
              .onConflictDoNothing();

            // Check first response SLA
            const ticket = await db.query.tickets.findFirst({
              where: eq(tickets.id, existingLink.ticketId),
            });
            if (ticket && !ticket.firstResponseAt && dbUser.id !== ticket.requesterId) {
              const now = new Date();
              await db
                .update(tickets)
                .set({
                  firstResponseAt: now,
                  slaResponseMet: ticket.slaResponseDue ? now <= ticket.slaResponseDue : null,
                  updatedAt: now,
                })
                .where(eq(tickets.id, existingLink.ticketId));
            }
          }
        } else {
          // ─── NEW MESSAGE → Check dedup, then create ticket ─────────────

          // Dedup: check if same user sent a message in the last N seconds
          const recentLink = await db
            .select({
              ticketId: slackMessageLinks.ticketId,
              messageTs: slackMessageLinks.messageTs,
            })
            .from(slackMessageLinks)
            .where(
              and(
                eq(slackMessageLinks.channelId, channel),
                eq(slackMessageLinks.slackUserId, slackUserId),
                sql`${slackMessageLinks.createdAt} > NOW() - INTERVAL '${sql.raw(String(DEDUP_WINDOW_SECONDS))} seconds'`
              )
            )
            .orderBy(desc(slackMessageLinks.createdAt))
            .limit(1);

          if (recentLink.length > 0) {
            // Merge: append to the recent ticket as a comment instead of creating new
            const existingTicketId = recentLink[0].ticketId;
            await db.insert(ticketComments).values({
              ticketId: existingTicketId,
              authorId: dbUser.id,
              body: text,
              isInternal: false,
              source: "slack",
            });

            // Also append to the ticket description
            const existingTicket = await db.query.tickets.findFirst({
              where: eq(tickets.id, existingTicketId),
            });
            if (existingTicket) {
              await db
                .update(tickets)
                .set({
                  description: (existingTicket.description || "") + "\n\n" + text,
                  updatedAt: new Date(),
                })
                .where(eq(tickets.id, existingTicketId));
            }

            // Store message link
            await db
              .insert(slackMessageLinks)
              .values({
                ticketId: existingTicketId,
                channelId: channel,
                messageTs: ts,
                slackUserId,
                slackDisplayName: dbUser.name,
                originalText: text,
              })
              .onConflictDoNothing();

            return NextResponse.json({ ok: true });
          }

          // Create new ticket
          const sla = DEFAULT_SLA.medium;
          const now = new Date();
          const ticketNumber = generateTicketNumber();
          const title = text.length > 100 ? text.substring(0, 97) + "..." : text;

          const [ticket] = await db
            .insert(tickets)
            .values({
              ticketNumber,
              title,
              description: text,
              priority: "medium",
              requesterId: dbUser.id,
              source: "slack",
              slaResponseDue: new Date(now.getTime() + sla.responseMinutes * 60 * 1000),
              slaResolutionDue: new Date(now.getTime() + sla.resolutionMinutes * 60 * 1000),
            })
            .returning();

          // Store message link
          await db
            .insert(slackMessageLinks)
            .values({
              ticketId: ticket.id,
              channelId: channel,
              messageTs: ts,
              slackUserId,
              slackDisplayName: dbUser.name,
              originalText: text,
            })
            .onConflictDoNothing();

          // Audit log
          await db.insert(auditLog).values({
            eventType: "ticket.created",
            entityType: "ticket",
            entityId: ticket.id,
            actorId: dbUser.id,
            actorType: "user",
            action: "create",
            details: { ticketNumber, source: "slack", channelId: channel },
          });

          // Reply in Slack thread with ticket confirmation
          await postSlackReply(
            channel,
            ts,
            `:white_check_mark: *Ticket ${ticketNumber} created*\n` +
              `Your request has been received and assigned to the IT team.\n` +
              `Track it here: ${PORTAL_URL}/tickets/${ticket.id}\n` +
              `Priority: Medium | SLA: Response within 4 hours`
          );
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/slack/events error:", error);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
