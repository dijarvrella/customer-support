import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tickets, ticketComments, auditLog, users } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, asc } from "drizzle-orm";
import { sendTicketCommentEmail } from "@/lib/notifications/email";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const role = (session.user as Record<string, unknown>).role as string;

    // Verify ticket exists and user has access
    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, id),
      columns: { id: true, requesterId: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    if (role === "end_user" && ticket.requesterId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const comments = await db.query.ticketComments.findMany({
      where: eq(ticketComments.ticketId, id),
      orderBy: [asc(ticketComments.createdAt)],
      with: {
        author: {
          columns: { id: true, name: true, email: true, image: true },
        },
      },
    });

    // Filter out internal comments for end users
    const filtered =
      role === "end_user"
        ? comments.filter((c) => !c.isInternal)
        : comments;

    return NextResponse.json(filtered);
  } catch (error) {
    console.error("GET /api/tickets/[id]/comments error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { body: commentBody, isInternal } = body;

    if (!commentBody || !commentBody.trim()) {
      return NextResponse.json(
        { error: "Comment body is required" },
        { status: 400 }
      );
    }

    // Verify ticket exists
    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, id),
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // End users cannot post internal comments
    const role = (session.user as Record<string, unknown>).role as string;
    if (role === "end_user" && ticket.requesterId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [comment] = await db
      .insert(ticketComments)
      .values({
        ticketId: id,
        authorId: session.user.id,
        body: commentBody.trim(),
        isInternal: role === "end_user" ? false : isInternal || false,
        source: "portal",
      })
      .returning();

    // If this is the first non-requester comment, set firstResponseAt and check SLA
    if (!ticket.firstResponseAt && session.user.id !== ticket.requesterId) {
      const now = new Date();
      const slaResponseMet = ticket.slaResponseDue
        ? now <= ticket.slaResponseDue
        : null;

      await db
        .update(tickets)
        .set({
          firstResponseAt: now,
          slaResponseMet,
          updatedAt: now,
        })
        .where(eq(tickets.id, id));
    } else {
      // Still update the ticket's updatedAt
      await db
        .update(tickets)
        .set({ updatedAt: new Date() })
        .where(eq(tickets.id, id));
    }

    // Audit log
    await db.insert(auditLog).values({
      eventType: "comment.created",
      entityType: "ticket",
      entityId: id,
      actorId: session.user.id,
      actorType: "user",
      action: "comment",
      details: {
        commentId: comment.id,
        isInternal: comment.isInternal,
      },
    });

    // Return comment with author info
    const commentWithAuthor = await db.query.ticketComments.findFirst({
      where: eq(ticketComments.id, comment.id),
      with: {
        author: {
          columns: { id: true, name: true, email: true, image: true },
        },
      },
    });

    // Send email notification for non-internal comments to the requester (fire-and-forget)
    if (!comment.isInternal && session.user.id !== ticket.requesterId) {
      const requesterUser = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, ticket.requesterId))
        .limit(1);

      const requesterEmail = requesterUser[0]?.email;
      if (requesterEmail) {
        const commenterName = session.user.name || "IT Support";
        sendTicketCommentEmail(
          requesterEmail,
          ticket.ticketNumber,
          ticket.title,
          commenterName,
          commentBody.trim()
        ).catch(() => {});
      }
    }

    return NextResponse.json(commentWithAuthor, { status: 201 });
  } catch (error) {
    console.error("POST /api/tickets/[id]/comments error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
