import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tickets, users, ticketComments, notifications } from "@/lib/db/schema";
import { eq, and, sql, lt, desc, notInArray } from "drizzle-orm";
import { Resend } from "resend";

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET;

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "IT Support <onboarding@resend.dev>";
const PORTAL_URL =
  process.env.NEXTAUTH_URL || "https://it-support.zimark.link";

async function createNotification(
  userId: string,
  ticketId: string,
  type: string,
  title: string,
  body: string
) {
  try {
    await db.insert(notifications).values({
      userId,
      ticketId,
      type,
      title,
      body,
      link: `/tickets/${ticketId}`,
    });
  } catch {
    // silent
  }
}

function emailWrap(content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1a1a2e;">
<div style="background:#1a1a2e;padding:16px 24px;border-radius:8px 8px 0 0;"><span style="color:#fff;font-weight:700;font-size:18px;">Zimark ITSM</span></div>
<div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px;">${content}</div>
<p style="color:#94a3b8;font-size:12px;margin-top:16px;">This is an automated reminder from Zimark IT Support Portal.</p>
</body></html>`;
}

interface ReminderResult {
  assigneeReminders: number;
  requesterFollowUps: number;
  slaWarnings: number;
  errors: string[];
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resend = getResend();
  if (!resend) {
    return NextResponse.json({ error: "Email not configured" }, { status: 500 });
  }

  const result: ReminderResult = {
    assigneeReminders: 0,
    requesterFollowUps: 0,
    slaWarnings: 0,
    errors: [],
  };

  const now = new Date();

  try {
    // ─── 1. ASSIGNEE REMINDERS ──────────────────────────────────────────
    // Tickets assigned but no activity in 24+ hours
    const staleAssigned = await db
      .select({
        ticketId: tickets.id,
        ticketNumber: tickets.ticketNumber,
        title: tickets.title,
        priority: tickets.priority,
        status: tickets.status,
        updatedAt: tickets.updatedAt,
        assigneeId: tickets.assigneeId,
        assigneeName: sql<string>`(SELECT name FROM users WHERE id = ${tickets.assigneeId})`,
        assigneeEmail: sql<string>`(SELECT email FROM users WHERE id = ${tickets.assigneeId})`,
        requesterName: sql<string>`(SELECT name FROM users WHERE id = ${tickets.requesterId})`,
      })
      .from(tickets)
      .where(
        and(
          sql`${tickets.status} IN ('new', 'triaged', 'in_progress')`,
          sql`${tickets.assigneeId} IS NOT NULL`,
          sql`${tickets.updatedAt} < NOW() - INTERVAL '24 hours'`
        )
      )
      .limit(50);

    for (const ticket of staleAssigned) {
      if (!ticket.assigneeEmail) continue;

      const hoursStale = Math.round(
        (now.getTime() - new Date(ticket.updatedAt).getTime()) / (1000 * 60 * 60)
      );

      const urgency =
        ticket.priority === "critical"
          ? "URGENT"
          : ticket.priority === "high"
          ? "High Priority"
          : "Reminder";

      try {
        // In-app notification
        if (ticket.assigneeId) {
          await createNotification(
            ticket.assigneeId as string,
            ticket.ticketId,
            "reminder",
            `Ticket ${ticket.ticketNumber} needs attention`,
            `No updates for ${hoursStale} hours. ${ticket.requesterName || "A user"} is waiting for a response.`
          );
        }

        await resend.emails.send({
          from: FROM_EMAIL,
          to: ticket.assigneeEmail,
          subject: `[${urgency}] Ticket ${ticket.ticketNumber} needs attention (${hoursStale}h without update)`,
          html: emailWrap(`
            <h2 style="margin:0 0 8px;">Ticket Requires Your Attention</h2>
            <p style="color:#64748b;margin:0 0 16px;">This ticket has had no updates for <strong>${hoursStale} hours</strong>.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;width:120px;">Ticket</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">${ticket.ticketNumber}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;">Title</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${ticket.title}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;">Priority</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-transform:capitalize;">${ticket.priority}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;">Reported by</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${ticket.requesterName || "Unknown"}</td></tr>
              <tr><td style="padding:8px;color:#64748b;">Last updated</td><td style="padding:8px;">${hoursStale} hours ago</td></tr>
            </table>
            <p>Please review and update the ticket with your progress or resolution.</p>
            <a href="${PORTAL_URL}/tickets/${ticket.ticketId}" style="display:inline-block;background:#1a1a2e;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;margin-top:8px;">View Ticket</a>
          `),
        });
        result.assigneeReminders++;
      } catch (err: any) {
        result.errors.push(`Assignee reminder for ${ticket.ticketNumber}: ${err.message}`);
      }
    }

    // ─── 2. REQUESTER FOLLOW-UPS ────────────────────────────────────────
    // Tickets resolved 48+ hours ago that haven't been closed - ask requester to confirm
    const resolvedPending = await db
      .select({
        ticketId: tickets.id,
        ticketNumber: tickets.ticketNumber,
        title: tickets.title,
        resolvedAt: tickets.resolvedAt,
        requesterEmail: sql<string>`(SELECT email FROM users WHERE id = ${tickets.requesterId})`,
        requesterName: sql<string>`(SELECT name FROM users WHERE id = ${tickets.requesterId})`,
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.status, "resolved"),
          sql`${tickets.resolvedAt} IS NOT NULL`,
          sql`${tickets.resolvedAt} < NOW() - INTERVAL '48 hours'`
        )
      )
      .limit(30);

    for (const ticket of resolvedPending) {
      if (!ticket.requesterEmail) continue;

      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: ticket.requesterEmail,
          subject: `Is your issue resolved? - ${ticket.ticketNumber}`,
          html: emailWrap(`
            <h2 style="margin:0 0 8px;">Follow-up: Is Your Issue Resolved?</h2>
            <p>Hi ${ticket.requesterName || "there"},</p>
            <p>Your ticket <strong>${ticket.ticketNumber} - ${ticket.title}</strong> was marked as resolved. We'd like to confirm everything is working as expected.</p>
            <p>If the issue is fixed, no action is needed - the ticket will close automatically.</p>
            <p>If you're still experiencing problems, please reply or reopen the ticket:</p>
            <a href="${PORTAL_URL}/tickets/${ticket.ticketId}" style="display:inline-block;background:#1a1a2e;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;margin-top:8px;">View Ticket</a>
          `),
        });
        result.requesterFollowUps++;
      } catch (err: any) {
        result.errors.push(`Follow-up for ${ticket.ticketNumber}: ${err.message}`);
      }
    }

    // ─── 3. SLA BREACH WARNINGS ─────────────────────────────────────────
    // Tickets approaching SLA deadline (within 2 hours) - warn assignee
    const slaAtRisk = await db
      .select({
        ticketId: tickets.id,
        ticketNumber: tickets.ticketNumber,
        title: tickets.title,
        priority: tickets.priority,
        slaResolutionDue: tickets.slaResolutionDue,
        assigneeEmail: sql<string>`(SELECT email FROM users WHERE id = ${tickets.assigneeId})`,
        assigneeName: sql<string>`(SELECT name FROM users WHERE id = ${tickets.assigneeId})`,
      })
      .from(tickets)
      .where(
        and(
          sql`${tickets.status} IN ('new', 'triaged', 'in_progress', 'pending_info')`,
          sql`${tickets.slaResolutionDue} IS NOT NULL`,
          sql`${tickets.slaResolutionDue} > NOW()`,
          sql`${tickets.slaResolutionDue} < NOW() + INTERVAL '2 hours'`,
          sql`${tickets.slaResolutionMet} IS NULL`
        )
      )
      .limit(20);

    for (const ticket of slaAtRisk) {
      if (!ticket.assigneeEmail) continue;

      const minutesLeft = Math.round(
        (new Date(ticket.slaResolutionDue!).getTime() - now.getTime()) / (1000 * 60)
      );

      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: ticket.assigneeEmail,
          subject: `SLA WARNING: ${ticket.ticketNumber} due in ${minutesLeft} minutes`,
          html: emailWrap(`
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px 16px;margin-bottom:16px;">
              <strong style="color:#dc2626;">SLA Breach Warning</strong>
              <p style="color:#991b1b;margin:4px 0 0;">This ticket's resolution deadline is in <strong>${minutesLeft} minutes</strong>.</p>
            </div>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;width:120px;">Ticket</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">${ticket.ticketNumber}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;">Title</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${ticket.title}</td></tr>
              <tr><td style="padding:8px;color:#64748b;">Priority</td><td style="padding:8px;text-transform:capitalize;font-weight:600;color:#dc2626;">${ticket.priority}</td></tr>
            </table>
            <p>Please resolve or update this ticket immediately to avoid an SLA breach.</p>
            <a href="${PORTAL_URL}/tickets/${ticket.ticketId}" style="display:inline-block;background:#dc2626;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;margin-top:8px;">View Ticket Now</a>
          `),
        });
        result.slaWarnings++;
      } catch (err: any) {
        result.errors.push(`SLA warning for ${ticket.ticketNumber}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors.push(`Global error: ${err.message}`);
  }

  console.log(
    `Reminders sent: ${result.assigneeReminders} assignee, ${result.requesterFollowUps} follow-up, ${result.slaWarnings} SLA warnings`
  );

  return NextResponse.json(result);
}
