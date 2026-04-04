import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tickets, users, ticketComments, notifications } from "@/lib/db/schema";
import { eq, and, sql, lt, desc, notInArray } from "drizzle-orm";
import { Resend } from "resend";
import { emailLayout, ticketLink, escapeHtml } from "@/lib/notifications/email";
import { generateSnoozeToken } from "@/app/api/tickets/[id]/snooze/route";

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET;

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "Zimark IT Support <notifications@zimark.io>";
const PORTAL_URL = (
  process.env.NEXTAUTH_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
  "https://it-support.zimark.link"
).replace(/\/$/, "");

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
    // Tickets assigned but no activity in 24+ hours, and no reminder sent in last 72 hours
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
          sql`${tickets.updatedAt} < NOW() - INTERVAL '24 hours'`,
          sql`(${tickets.reminderSnoozedUntil} IS NULL OR ${tickets.reminderSnoozedUntil} < NOW())`,
          sql`NOT EXISTS (
            SELECT 1 FROM notifications
            WHERE ticket_id = ${tickets.id}
              AND type = 'reminder'
              AND created_at > NOW() - INTERVAL '72 hours'
          )`
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

        const snoozeToken = generateSnoozeToken(ticket.ticketId);
        const snoozeUrl = `${PORTAL_URL}/api/tickets/${ticket.ticketId}/snooze?token=${snoozeToken}`;

        await resend.emails.send({
          from: FROM_EMAIL,
          to: ticket.assigneeEmail,
          subject: `[${urgency}] Ticket ${ticket.ticketNumber} needs attention (${hoursStale}h without update)`,
          html: emailLayout(`
            <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#0f172a;text-align:center;line-height:1.3;">Ticket requires your attention</h2>
            <p style="margin:0 0 16px;font-size:15px;color:#475569;text-align:center;line-height:1.55;">This ticket has had no updates for <strong>${hoursStale} hours</strong>.</p>
            <div style="display:inline-block;text-align:left;margin:0 auto 8px;max-width:100%;">
            <table role="presentation" style="width:100%;max-width:420px;border-collapse:collapse;margin:8px 0 16px;">
              <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;width:120px;">Ticket</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">${escapeHtml(ticket.ticketNumber)}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;">Title</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(ticket.title)}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;">Priority</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-transform:capitalize;">${escapeHtml(ticket.priority)}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;">Reported by</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(ticket.requesterName || "Unknown")}</td></tr>
              <tr><td style="padding:8px;color:#64748b;">Last updated</td><td style="padding:8px;">${hoursStale} hours ago</td></tr>
            </table>
            </div>
            <p style="margin:0 0 8px;font-size:15px;color:#475569;text-align:center;line-height:1.55;">Please review and update the ticket with your progress or resolution.</p>
            ${ticketLink(`${PORTAL_URL}/tickets/${ticket.ticketId}`, "View Ticket")}
            <p style="margin:16px 0 0;text-align:center;">
              <a href="${snoozeUrl}" style="font-size:13px;color:#94a3b8;text-decoration:underline;">Silence reminders for 7 days</a>
            </p>
          `),
        });
        result.assigneeReminders++;
      } catch (err: any) {
        result.errors.push(`Assignee reminder for ${ticket.ticketNumber}: ${err.message}`);
      }
    }

    // ─── 2. REQUESTER FOLLOW-UPS ────────────────────────────────────────
    // Tickets resolved 48+ hours ago that haven't been closed - ask requester to confirm
    // Throttled to once per 7 days per ticket
    const resolvedPending = await db
      .select({
        ticketId: tickets.id,
        ticketNumber: tickets.ticketNumber,
        title: tickets.title,
        resolvedAt: tickets.resolvedAt,
        requesterId: tickets.requesterId,
        requesterEmail: sql<string>`(SELECT email FROM users WHERE id = ${tickets.requesterId})`,
        requesterName: sql<string>`(SELECT name FROM users WHERE id = ${tickets.requesterId})`,
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.status, "resolved"),
          sql`${tickets.resolvedAt} IS NOT NULL`,
          sql`${tickets.resolvedAt} < NOW() - INTERVAL '48 hours'`,
          sql`NOT EXISTS (
            SELECT 1 FROM notifications
            WHERE ticket_id = ${tickets.id}
              AND type = 'requester_followup'
              AND created_at > NOW() - INTERVAL '7 days'
          )`
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
          html: emailLayout(`
            <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#0f172a;text-align:center;line-height:1.3;">Follow-up: is your issue resolved?</h2>
            <p style="margin:0 0 12px;font-size:15px;color:#475569;text-align:center;line-height:1.55;">Hi ${escapeHtml(ticket.requesterName || "there")},</p>
            <p style="margin:0 0 12px;font-size:15px;color:#475569;text-align:center;line-height:1.55;">Your ticket <strong style="color:#0f172a;">${escapeHtml(ticket.ticketNumber)} — ${escapeHtml(ticket.title)}</strong> was marked as resolved. We'd like to confirm everything is working as expected.</p>
            <p style="margin:0 0 12px;font-size:15px;color:#475569;text-align:center;line-height:1.55;">If the issue is fixed, no action is needed — the ticket will close automatically.</p>
            <p style="margin:0 0 8px;font-size:15px;color:#475569;text-align:center;line-height:1.55;">If you're still experiencing problems, please reply or reopen the ticket.</p>
            ${ticketLink(`${PORTAL_URL}/tickets/${ticket.ticketId}`, "View Ticket")}
          `),
        });

        // Record so we don't follow up again for 7 days
        if (ticket.requesterId) {
          await createNotification(
            ticket.requesterId as string,
            ticket.ticketId,
            "requester_followup",
            `Follow-up sent for ${ticket.ticketNumber}`,
            `Confirmation email sent to requester.`
          );
        }

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
          html: emailLayout(`
            <div style="display:inline-block;text-align:center;max-width:100%;margin:0 auto 16px;">
              <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 18px;">
                <strong style="color:#dc2626;font-size:15px;">SLA breach warning</strong>
                <p style="color:#991b1b;margin:6px 0 0;font-size:15px;text-align:center;line-height:1.5;">This ticket's resolution deadline is in <strong>${minutesLeft} minutes</strong>.</p>
              </div>
            </div>
            <div style="display:inline-block;text-align:left;margin:0 auto 8px;max-width:100%;">
            <table role="presentation" style="width:100%;max-width:420px;border-collapse:collapse;margin:8px 0 16px;">
              <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;width:120px;">Ticket</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">${escapeHtml(ticket.ticketNumber)}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;">Title</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(ticket.title)}</td></tr>
              <tr><td style="padding:8px;color:#64748b;">Priority</td><td style="padding:8px;text-transform:capitalize;font-weight:600;color:#dc2626;">${escapeHtml(ticket.priority)}</td></tr>
            </table>
            </div>
            <p style="margin:0 0 8px;font-size:15px;color:#475569;text-align:center;line-height:1.55;">Please resolve or update this ticket immediately to avoid an SLA breach.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;">
              <tr>
                <td align="center" style="padding:0;">
                  <a href="${PORTAL_URL}/tickets/${ticket.ticketId}" style="display:inline-block;padding:12px 28px;background-color:#dc2626;color:#ffffff !important;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">View ticket now</a>
                </td>
              </tr>
            </table>
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
