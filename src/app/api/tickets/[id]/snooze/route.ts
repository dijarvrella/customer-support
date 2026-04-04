import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tickets } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import crypto from "crypto";

type RouteContext = { params: Promise<{ id: string }> };

const SNOOZE_DAYS = 7;

function snoozeUntil(): Date {
  const d = new Date();
  d.setDate(d.getDate() + SNOOZE_DAYS);
  return d;
}

export function generateSnoozeToken(ticketId: string): string {
  const secret =
    process.env.NEXTAUTH_SECRET || process.env.CRON_SECRET || "snooze-secret";
  return crypto.createHmac("sha256", secret).update(`snooze:${ticketId}`).digest("hex");
}

function validateSnoozeToken(ticketId: string, token: string): boolean {
  return generateSnoozeToken(ticketId) === token;
}

const PORTAL_URL = (
  process.env.NEXTAUTH_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
  "https://it-support.zimark.link"
).replace(/\/$/, "");

// GET — token-authenticated link clicked from email
export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const token = request.nextUrl.searchParams.get("token");

  if (!token || !validateSnoozeToken(id, token)) {
    return new NextResponse(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invalid link</title></head>
      <body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center;color:#0f172a;">
        <p style="font-size:18px;font-weight:600;">Invalid or expired link</p>
        <p style="color:#64748b;">This snooze link is not valid. Please use the link from your reminder email.</p>
        <a href="${PORTAL_URL}" style="color:#6366f1;">Go to portal</a>
      </body></html>`,
      { status: 400, headers: { "Content-Type": "text/html" } }
    );
  }

  const ticket = await db
    .select({ id: tickets.id, ticketNumber: tickets.ticketNumber, title: tickets.title })
    .from(tickets)
    .where(eq(tickets.id, id))
    .limit(1);

  if (!ticket[0]) {
    return new NextResponse("Ticket not found", { status: 404 });
  }

  const until = snoozeUntil();
  await db
    .update(tickets)
    .set({ reminderSnoozedUntil: until })
    .where(eq(tickets.id, id));

  const untilStr = until.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reminders silenced</title></head>
    <body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center;color:#0f172a;">
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:32px 24px;margin-bottom:24px;">
        <p style="font-size:22px;font-weight:700;margin:0 0 8px;">Reminders silenced</p>
        <p style="color:#475569;margin:0;">
          No more reminders for <strong>${ticket[0].ticketNumber} — ${ticket[0].title}</strong>
          until <strong>${untilStr}</strong>.
        </p>
      </div>
      <a href="${PORTAL_URL}/tickets/${id}" style="display:inline-block;padding:10px 24px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">View ticket</a>
    </body></html>`,
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}

// POST — session-authenticated from portal UI
export async function POST(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const role = (session.user as Record<string, unknown>).role as string;
  if (!["it_admin", "it_agent", "security", "hr"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ticket = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.id, id))
    .limit(1);

  if (!ticket[0]) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const until = snoozeUntil();
  await db
    .update(tickets)
    .set({ reminderSnoozedUntil: until })
    .where(eq(tickets.id, id));

  return NextResponse.json({ snoozedUntil: until.toISOString() });
}

// DELETE — unsnooze from portal UI
export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  await db
    .update(tickets)
    .set({ reminderSnoozedUntil: null })
    .where(eq(tickets.id, id));

  return NextResponse.json({ ok: true });
}
