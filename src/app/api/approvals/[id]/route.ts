import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  approvals,
  tickets,
  ticketHistory,
  auditLog,
} from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { APPROVAL_DECISIONS } from "@/lib/constants";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { decision, comment } = body;

    if (!decision || !APPROVAL_DECISIONS.includes(decision)) {
      return NextResponse.json(
        { error: "Invalid decision. Must be one of: approved, rejected, more_info" },
        { status: 400 }
      );
    }

    // Fetch the approval and verify ownership
    const approval = await db.query.approvals.findFirst({
      where: and(eq(approvals.id, id), eq(approvals.approverId, session.user.id)),
    });

    if (!approval) {
      return NextResponse.json(
        { error: "Approval not found or not assigned to you" },
        { status: 404 }
      );
    }

    if (approval.status !== "pending") {
      return NextResponse.json(
        { error: "This approval has already been decided" },
        { status: 409 }
      );
    }

    // Update the approval record
    const [updatedApproval] = await db
      .update(approvals)
      .set({
        status: decision === "more_info" ? "pending" : decision,
        decision,
        comment: comment || null,
        decidedAt: new Date(),
      })
      .where(eq(approvals.id, id))
      .returning();

    // Check all approvals for this ticket to determine ticket status change
    const ticketId = approval.ticketId;
    const allApprovals = await db.query.approvals.findMany({
      where: eq(approvals.ticketId, ticketId),
    });

    let newTicketStatus: string | null = null;

    if (decision === "rejected") {
      // Any rejection cancels the ticket
      newTicketStatus = "cancelled";
    } else if (decision === "approved") {
      // Check if ALL approvals are now approved
      const allApproved = allApprovals.every(
        (a) => a.id === id ? true : a.status === "approved"
      );
      if (allApproved) {
        newTicketStatus = "in_progress";
      }
    }
    // "more_info" does not change ticket status

    if (newTicketStatus) {
      const ticket = await db.query.tickets.findFirst({
        where: eq(tickets.id, ticketId),
        columns: { status: true },
      });

      await db
        .update(tickets)
        .set({ status: newTicketStatus, updatedAt: new Date() })
        .where(eq(tickets.id, ticketId));

      // Log ticket status change in history
      await db.insert(ticketHistory).values({
        ticketId,
        actorId: session.user.id,
        fieldName: "status",
        oldValue: ticket?.status || "pending_approval",
        newValue: newTicketStatus,
        changeType: "approval",
      });
    }

    // Audit log
    await db.insert(auditLog).values({
      eventType: "approval.decided",
      entityType: "approval",
      entityId: id,
      actorId: session.user.id,
      actorType: "user",
      action: decision,
      details: {
        ticketId,
        decision,
        comment: comment || null,
        resultingTicketStatus: newTicketStatus,
      },
    });

    return NextResponse.json({
      approval: updatedApproval,
      ticketStatusChanged: newTicketStatus,
    });
  } catch (error) {
    console.error("POST /api/approvals/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
