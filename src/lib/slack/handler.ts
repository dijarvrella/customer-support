import crypto from "crypto";
import { db } from "@/lib/db";
import {
  tickets,
  ticketComments,
  slackMessageLinks,
  users,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { generateTicketNumber } from "@/lib/utils";

// ─── VERIFY SLACK SIGNATURE ────────────────────────────────────────────────

/**
 * Verify a Slack request signature using HMAC-SHA256.
 * See: https://api.slack.com/authentication/verifying-requests-from-slack
 */
export function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  body: string,
  signature: string
): boolean {
  // Reject requests older than 5 minutes to prevent replay attacks
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 60 * 5) {
    return false;
  }

  const sigBaseString = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac("sha256", signingSecret);
  hmac.update(sigBaseString);
  const computedSignature = `v0=${hmac.digest("hex")}`;

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computedSignature, "utf8"),
      Buffer.from(signature, "utf8")
    );
  } catch {
    return false;
  }
}

// ─── RESOLVE SLACK USER ────────────────────────────────────────────────────

/**
 * Look up a Slack user in the internal users table.
 * First tries matching by slack_user_id, then falls back to email.
 * Returns the internal user ID or null if not found.
 */
export async function resolveSlackUser(
  slackUserId: string,
  slackEmail?: string,
  slackName?: string
): Promise<string | null> {
  // First, try to find by Slack user ID
  const bySlackId = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.slackUserId, slackUserId))
    .limit(1);

  if (bySlackId.length > 0) {
    return bySlackId[0].id;
  }

  // Fall back to email lookup
  if (slackEmail) {
    const byEmail = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, slackEmail))
      .limit(1);

    if (byEmail.length > 0) {
      // Update the user's Slack info for future lookups
      await db
        .update(users)
        .set({
          slackUserId,
          slackDisplayName: slackName ?? null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, byEmail[0].id));

      return byEmail[0].id;
    }
  }

  return null;
}

// ─── SHOULD IGNORE MESSAGE ─────────────────────────────────────────────────

/**
 * Determine if a Slack event should be ignored.
 * Ignores bot messages, message edits, deletions, and system messages.
 */
export function shouldIgnoreMessage(event: Record<string, unknown>): boolean {
  // Ignore bot messages
  if (event.bot_id || event.bot_profile) {
    return true;
  }

  // Ignore message subtypes that are not actual user messages
  const ignoredSubtypes = [
    "bot_message",
    "message_changed",
    "message_deleted",
    "channel_join",
    "channel_leave",
    "channel_topic",
    "channel_purpose",
    "channel_name",
    "channel_archive",
    "channel_unarchive",
    "group_join",
    "group_leave",
    "pinned_item",
    "unpinned_item",
    "file_share", // optional: handle file_share separately if desired
    "me_message",
    "thread_broadcast",
  ];

  if (event.subtype && ignoredSubtypes.includes(event.subtype as string)) {
    return true;
  }

  // Ignore messages without text
  if (!event.text || (event.text as string).trim().length === 0) {
    return true;
  }

  // Ignore messages without a user (system messages)
  if (!event.user) {
    return true;
  }

  return false;
}

// ─── HANDLE SLACK MESSAGE ──────────────────────────────────────────────────

interface SlackEvent {
  user: string;
  text: string;
  channel: string;
  ts: string;
  thread_ts?: string;
  files?: unknown[];
}

interface HandleResult {
  ticketId?: string;
  ticketNumber?: string;
  action: "created" | "commented" | "ignored";
}

/**
 * Handle a new message from a monitored Slack channel.
 *
 * - If the message is a thread reply matching an existing ticket's Slack link,
 *   add it as a comment on that ticket.
 * - If it's a top-level message, create a new ticket from it.
 * - Returns the action taken and ticket info.
 */
export async function handleSlackMessage(
  event: SlackEvent
): Promise<HandleResult> {
  const { user: slackUserId, text, channel, ts, thread_ts } = event;

  // Resolve the Slack user to an internal user
  const userId = await resolveSlackUser(slackUserId);

  // If the message is a thread reply, check if the parent maps to a ticket
  if (thread_ts) {
    const existingLink = await db
      .select({
        ticketId: slackMessageLinks.ticketId,
      })
      .from(slackMessageLinks)
      .where(
        and(
          eq(slackMessageLinks.channelId, channel),
          eq(slackMessageLinks.messageTs, thread_ts)
        )
      )
      .limit(1);

    if (existingLink.length > 0) {
      const ticketId = existingLink[0].ticketId;

      // We need either an internal user or we track it as a Slack comment
      if (userId) {
        await db.insert(ticketComments).values({
          ticketId,
          authorId: userId,
          body: text,
          isInternal: false,
          source: "slack",
        });
      } else {
        // If we can't resolve the user, still record the comment
        // using a system-level approach: find or skip
        // For now, we'll just ignore comments from unknown users
        return { ticketId, action: "ignored" };
      }

      // Also record this thread reply in slack_message_links
      await db
        .insert(slackMessageLinks)
        .values({
          ticketId,
          channelId: channel,
          messageTs: ts,
          threadTs: thread_ts,
          slackUserId,
          originalText: text,
        })
        .onConflictDoNothing();

      // Fetch the ticket number for the response
      const ticket = await db
        .select({ ticketNumber: tickets.ticketNumber })
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);

      return {
        ticketId,
        ticketNumber: ticket[0]?.ticketNumber,
        action: "commented",
      };
    }
  }

  // Top-level message (or thread reply with no matching ticket): create a new ticket
  if (!userId) {
    // Cannot create a ticket without a known requester
    return { action: "ignored" };
  }

  const ticketNumber = generateTicketNumber();

  // Derive a title from the message text (first 100 chars, first line)
  const firstLine = text.split("\n")[0];
  const title =
    firstLine.length > 100 ? firstLine.substring(0, 97) + "..." : firstLine;

  const [newTicket] = await db
    .insert(tickets)
    .values({
      ticketNumber,
      title,
      description: text,
      status: "new",
      priority: "medium",
      requesterId: userId,
      source: "slack",
    })
    .returning({ id: tickets.id });

  // Link the Slack message to the ticket
  await db
    .insert(slackMessageLinks)
    .values({
      ticketId: newTicket.id,
      channelId: channel,
      messageTs: ts,
      threadTs: thread_ts ?? null,
      slackUserId,
      originalText: text,
    })
    .onConflictDoNothing();

  return {
    ticketId: newTicket.id,
    ticketNumber,
    action: "created",
  };
}
