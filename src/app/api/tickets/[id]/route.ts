import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  tickets,
  ticketComments,
  ticketHistory,
  auditLog,
  users,
} from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, asc } from "drizzle-orm";
import { sendTicketResolvedEmail, sendNewAssignmentEmail } from "@/lib/notifications/email";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, id),
      with: {
        requester: {
          columns: { id: true, name: true, email: true, image: true, department: true },
        },
        assignee: {
          columns: { id: true, name: true, email: true, image: true, department: true },
        },
        comments: {
          orderBy: [asc(ticketComments.createdAt)],
          with: {
            author: {
              columns: { id: true, name: true, email: true, image: true },
            },
          },
        },
        approvals: {
          with: {
            approver: {
              columns: { id: true, name: true, email: true, image: true },
            },
          },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // End users can only see their own tickets
    const role = (session.user as Record<string, unknown>).role as string;
    if (role === "end_user" && ticket.requesterId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Filter internal comments for end users
    if (role === "end_user") {
      ticket.comments = ticket.comments.filter((c) => !c.isInternal);
    }

    return NextResponse.json(ticket);
  } catch (error) {
    console.error("GET /api/tickets/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();

    // Only agents/admins can update tickets (except end users changing their own)
    const role = (session.user as Record<string, unknown>).role as string;

    const existing = await db.query.tickets.findFirst({
      where: eq(tickets.id, id),
    });

    if (!existing) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // End users: limited actions on their own tickets
    if (role === "end_user") {
      if (existing.requesterId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (body.status) {
        // End users can cancel, or reopen resolved tickets within 24h
        const isCancel = body.status === "cancelled";
        const isReopen =
          body.status === "in_progress" &&
          existing.status === "resolved" &&
          existing.resolvedAt &&
          new Date().getTime() - new Date(existing.resolvedAt).getTime() < 24 * 60 * 60 * 1000;

        if (!isCancel && !isReopen) {
          return NextResponse.json(
            { error: "You can only cancel or reopen recently resolved tickets" },
            { status: 403 }
          );
        }
      }
      // End users can also escalate (change priority)
      if (body.priority && !body.status) {
        // Allow priority escalation
      } else if (body.status) {
        // Already validated above
      } else {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const allowedFields = ["status", "priority", "assigneeId", "queueId", "categorySlug", "requesterId"] as const;
    type AllowedField = (typeof allowedFields)[number];
    const updates: Partial<Record<AllowedField, string | null>> = {};
    const historyEntries: {
      ticketId: string;
      actorId: string;
      fieldName: string;
      oldValue: string | null;
      newValue: string | null;
      changeType: string;
    }[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined && body[field] !== existing[field]) {
        updates[field] = body[field];
        historyEntries.push({
          ticketId: id,
          actorId: session.user.id,
          fieldName: field,
          oldValue: existing[field] as string | null,
          newValue: body[field] as string | null,
          changeType: "update",
        });
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(existing);
    }

    // Build the full set of fields to update
    const setValues: Record<string, any> = {
      ...updates,
      updatedAt: new Date(),
    };

    if (updates.status === "resolved") {
      setValues.resolvedAt = new Date();
      if (existing.slaResolutionDue) {
        setValues.slaResolutionMet = new Date() <= existing.slaResolutionDue;
      }
    }
    if (updates.status === "closed") {
      setValues.closedAt = new Date();
    }

    const [updated] = await db
      .update(tickets)
      .set(setValues)
      .where(eq(tickets.id, id))
      .returning();

    // Log history and audit in background (don't block response)
    const actorId = session.user!.id;
    const bgWork = async () => {
      try {
        if (historyEntries.length > 0) {
          await db.insert(ticketHistory).values(historyEntries);
        }
        await db.insert(auditLog).values({
          eventType: "ticket.updated",
          entityType: "ticket",
          entityId: id,
          actorId,
          actorType: "user",
          action: "update",
          details: { changes: updates },
        });
      } catch (err) {
        console.error("Background audit logging failed:", err);
      }
    };
    bgWork();

    // Email notifications based on what changed
    const portalUrl = `${request.nextUrl.origin}/tickets/${id}`;

    // Notify requester when ticket is resolved
    if (updates.status === "resolved" && existing.requesterId) {
      const requester = await db.select({ email: users.email }).from(users).where(eq(users.id, existing.requesterId)).limit(1);
      if (requester[0]?.email) {
        sendTicketResolvedEmail(requester[0].email, existing.ticketNumber, existing.title)
          .catch((err) => console.error("Resolved email failed:", err));
      }
    }

    // Notify assignee when ticket is assigned to them
    if (updates.assigneeId && updates.assigneeId !== existing.assigneeId) {
      const assignee = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, updates.assigneeId)).limit(1);
      if (assignee[0]?.email) {
        const requesterRecord = await db.select({ name: users.name }).from(users).where(eq(users.id, existing.requesterId)).limit(1);
        sendNewAssignmentEmail(assignee[0].email, assignee[0].name, existing.ticketNumber, existing.title, requesterRecord[0]?.name || "Someone", portalUrl)
          .catch((err) => console.error("Assignment email failed:", err));
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/tickets/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
