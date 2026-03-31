import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tickets, auditLog, users } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, desc, asc, and, or, like, lt } from "drizzle-orm";
import { generateTicketNumber } from "@/lib/utils";
import { DEFAULT_SLA, type TicketPriority } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const assigneeId = searchParams.get("assigneeId");
    const requesterId = searchParams.get("requesterId");
    const queueId = searchParams.get("queueId");
    const search = searchParams.get("search");
    const source = searchParams.get("source");
    const sort = searchParams.get("sort") || "created_at:desc";
    const cursor = searchParams.get("cursor");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

    const role = (session.user as Record<string, unknown>).role as string;

    const conditions: ReturnType<typeof eq>[] = [];

    // End users can only see their own tickets
    if (role === "end_user") {
      conditions.push(eq(tickets.requesterId, session.user.id));
    }

    if (status) {
      conditions.push(eq(tickets.status, status));
    }
    if (priority) {
      conditions.push(eq(tickets.priority, priority));
    }
    if (assigneeId) {
      conditions.push(eq(tickets.assigneeId, assigneeId));
    }
    if (requesterId) {
      conditions.push(eq(tickets.requesterId, requesterId));
    }
    if (queueId) {
      conditions.push(eq(tickets.queueId, queueId));
    }
    if (source) {
      conditions.push(eq(tickets.source, source));
    }
    if (search) {
      conditions.push(
        or(
          like(tickets.title, `%${search}%`),
          like(tickets.description, `%${search}%`)
        )!
      );
    }
    if (cursor) {
      conditions.push(lt(tickets.createdAt, new Date(cursor)));
    }

    const [sortField, sortDir] = sort.split(":");
    const sortColumn =
      sortField === "updated_at"
        ? tickets.updatedAt
        : sortField === "priority"
          ? tickets.priority
          : sortField === "status"
            ? tickets.status
            : tickets.createdAt;
    const sortOrder = sortDir === "asc" ? asc(sortColumn) : desc(sortColumn);

    const requester = db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      })
      .from(users)
      .as("requester");

    const assignee = db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      })
      .from(users)
      .as("assignee");

    const results = await db
      .select({
        ticket: tickets,
        requesterName: requester.name,
        requesterEmail: requester.email,
        requesterImage: requester.image,
        assigneeName: assignee.name,
        assigneeEmail: assignee.email,
        assigneeImage: assignee.image,
      })
      .from(tickets)
      .leftJoin(requester, eq(tickets.requesterId, requester.id))
      .leftJoin(assignee, eq(tickets.assigneeId, assignee.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sortOrder)
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const data = results.slice(0, limit).map((r) => ({
      ...r.ticket,
      requester: {
        name: r.requesterName,
        email: r.requesterEmail,
        image: r.requesterImage,
      },
      assignee: r.assigneeName
        ? {
            name: r.assigneeName,
            email: r.assigneeEmail,
            image: r.assigneeImage,
          }
        : null,
    }));

    const nextCursor = hasMore
      ? data[data.length - 1]?.createdAt?.toISOString()
      : null;

    return NextResponse.json({ data, nextCursor, hasMore });
  } catch (error) {
    console.error("GET /api/tickets error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, priority, categorySlug, source, formData, formType, tags } = body;

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const ticketPriority = (priority || "medium") as TicketPriority;
    const sla = DEFAULT_SLA[ticketPriority];
    const now = new Date();
    const slaResponseDue = new Date(now.getTime() + sla.responseMinutes * 60 * 1000);
    const slaResolutionDue = new Date(now.getTime() + sla.resolutionMinutes * 60 * 1000);

    const ticketNumber = generateTicketNumber();

    const [created] = await db
      .insert(tickets)
      .values({
        ticketNumber,
        title,
        description: description || null,
        priority: ticketPriority,
        categorySlug: categorySlug || null,
        requesterId: session.user.id,
        source: source || "portal",
        formData: formData || null,
        formType: formType || null,
        tags: tags ? (Array.isArray(tags) ? tags.join(",") : tags) : null,
        slaResponseDue,
        slaResolutionDue,
      })
      .returning();

    // Audit log
    await db.insert(auditLog).values({
      eventType: "ticket.created",
      entityType: "ticket",
      entityId: created.id,
      actorId: session.user.id,
      actorType: "user",
      action: "create",
      details: {
        ticketNumber: created.ticketNumber,
        title: created.title,
        priority: created.priority,
        source: created.source,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/tickets error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
