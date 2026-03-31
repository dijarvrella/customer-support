import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  tickets,
  ticketComments,
  ticketHistory,
  auditLog,
} from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, asc } from "drizzle-orm";

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

    // End users can only cancel their own tickets
    if (role === "end_user") {
      if (existing.requesterId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // End users can only update status to cancelled
      if (body.status && body.status !== "cancelled") {
        return NextResponse.json(
          { error: "End users can only cancel their tickets" },
          { status: 403 }
        );
      }
    }

    const allowedFields = ["status", "priority", "assigneeId", "queueId", "categorySlug"] as const;
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

    // Log history entries
    if (historyEntries.length > 0) {
      await db.insert(ticketHistory).values(historyEntries);
    }

    // Audit log
    await db.insert(auditLog).values({
      eventType: "ticket.updated",
      entityType: "ticket",
      entityId: id,
      actorId: session.user.id,
      actorType: "user",
      action: "update",
      details: { changes: updates },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/tickets/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
