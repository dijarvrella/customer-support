import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  approvals,
  tickets,
  users,
  auditLog,
  ticketHistory,
} from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { sendApprovalRequestEmail } from "@/lib/notifications/email";
import { userCanRequestTicketApproval } from "@/lib/constants";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const u = session.user as Record<string, unknown>;
    const role = (u.role as string) || "end_user";
    const isGlobalAdmin = u.isGlobalAdmin === true;
    if (!userCanRequestTicketApproval(role, { isGlobalAdmin })) {
      return NextResponse.json(
        { error: "Forbidden: IT or security role required" },
        { status: 403 }
      );
    }

    const { id: ticketId } = await context.params;
    const body = await request.json();
    const approverId = body.approverId as string | undefined;
    const approverRole =
      (body.approverRole as string | undefined)?.trim() || "approver";

    if (!approverId) {
      return NextResponse.json(
        { error: "approverId is required" },
        { status: 400 }
      );
    }

    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, ticketId),
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Any ticket type (category, form, source) may get an IT-driven approval.
    // Only terminal records are frozen; resolved can be pulled back for sign-off.
    if (["closed", "cancelled"].includes(ticket.status)) {
      return NextResponse.json(
        {
          error: "Cannot add approvals to closed or cancelled tickets",
        },
        { status: 400 }
      );
    }

    const approver = await db.query.users.findFirst({
      where: eq(users.id, approverId),
      columns: { id: true, name: true, email: true },
    });

    if (!approver?.email) {
      return NextResponse.json(
        { error: "Approver not found or has no email" },
        { status: 404 }
      );
    }

    const duplicate = await db.query.approvals.findFirst({
      where: and(
        eq(approvals.ticketId, ticketId),
        eq(approvals.approverId, approverId),
        eq(approvals.status, "pending")
      ),
    });

    if (duplicate) {
      return NextResponse.json(
        { error: "This user already has a pending approval on this ticket" },
        { status: 409 }
      );
    }

    const [row] = await db
      .insert(approvals)
      .values({
        ticketId,
        approverId,
        approverRole,
        status: "pending",
      })
      .returning();

    if (ticket.status !== "pending_approval") {
      const setVals: {
        status: string;
        updatedAt: Date;
        resolvedAt?: null;
      } = {
        status: "pending_approval",
        updatedAt: new Date(),
      };
      if (ticket.resolvedAt) {
        setVals.resolvedAt = null;
      }
      await db.update(tickets).set(setVals).where(eq(tickets.id, ticketId));

      await db.insert(ticketHistory).values({
        ticketId,
        actorId: session.user.id,
        fieldName: "status",
        oldValue: ticket.status,
        newValue: "pending_approval",
        changeType: "it_approval_request",
      });
      if (ticket.resolvedAt) {
        await db.insert(ticketHistory).values({
          ticketId,
          actorId: session.user.id,
          fieldName: "resolvedAt",
          oldValue: ticket.resolvedAt.toISOString(),
          newValue: null,
          changeType: "it_approval_request",
        });
      }
    }

    await db.insert(auditLog).values({
      eventType: "approval.requested",
      entityType: "ticket",
      entityId: ticketId,
      actorId: session.user.id,
      actorType: "user",
      action: "add_approver",
      details: {
        approvalId: row.id,
        approverId,
        approverRole,
      },
    });

    const portalUrl = `${request.nextUrl.origin}/tickets/${ticketId}`;
    const requester = await db.query.users.findFirst({
      where: eq(users.id, ticket.requesterId),
      columns: { name: true },
    });

    sendApprovalRequestEmail(
      approver.email,
      approver.name || approver.email,
      ticket.ticketNumber,
      ticket.title,
      requester?.name || "A colleague",
      portalUrl
    ).catch((err) =>
      console.error("IT-initiated approval email failed:", err)
    );

    return NextResponse.json({ approval: row }, { status: 201 });
  } catch (error) {
    console.error("POST /api/tickets/[id]/approvals error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
