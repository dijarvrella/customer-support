import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tickets, auditLog, users, teams, teamMemberships, ticketComments, ticketHistory } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, desc, asc, and, or, like, lt, sql, count } from "drizzle-orm";
import { generateTicketNumber } from "@/lib/utils";
import { DEFAULT_SLA, type TicketPriority } from "@/lib/constants";
import { sendTicketCreatedEmail, sendTicketAssignedEmail } from "@/lib/notifications/email";

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

    // Auto-assignment: round-robin across IT Operations team
    try {
      const itOpsTeam = await db
        .select({ id: teams.id })
        .from(teams)
        .where(eq(teams.name, "IT Operations"))
        .limit(1);

      if (itOpsTeam.length > 0) {
        const teamId = itOpsTeam[0].id;

        // Get all active members of the IT Operations team
        const members = await db
          .select({
            userId: teamMemberships.userId,
            userName: users.name,
          })
          .from(teamMemberships)
          .innerJoin(users, eq(teamMemberships.userId, users.id))
          .where(
            and(
              eq(teamMemberships.teamId, teamId),
              eq(users.isActive, true)
            )
          );

        if (members.length > 0) {
          // Round-robin: count open tickets per member, assign to one with fewest
          const openStatuses = ["new", "triaged", "in_progress", "pending_info", "pending_vendor"];
          const memberIds = members.map((m) => m.userId);

          const ticketCounts = await db
            .select({
              assigneeId: tickets.assigneeId,
              ticketCount: count(tickets.id),
            })
            .from(tickets)
            .where(
              and(
                sql`${tickets.assigneeId} IN (${sql.join(memberIds.map(id => sql`${id}`), sql`, `)})`,
                sql`${tickets.status} IN (${sql.join(openStatuses.map(s => sql`${s}`), sql`, `)})`
              )
            )
            .groupBy(tickets.assigneeId);

          const countMap = new Map<string, number>();
          for (const tc of ticketCounts) {
            if (tc.assigneeId) {
              countMap.set(tc.assigneeId, Number(tc.ticketCount));
            }
          }

          // Find member with fewest open tickets
          let bestMember = members[0];
          let bestCount = countMap.get(members[0].userId) ?? 0;
          for (const m of members) {
            const c = countMap.get(m.userId) ?? 0;
            if (c < bestCount) {
              bestCount = c;
              bestMember = m;
            }
          }

          // Update the ticket with assignee
          await db
            .update(tickets)
            .set({ assigneeId: bestMember.userId, status: "triaged" })
            .where(eq(tickets.id, created.id));

          // Log the auto-assignment to ticket_history
          await db.insert(ticketHistory).values({
            ticketId: created.id,
            actorId: null,
            fieldName: "assigneeId",
            oldValue: null,
            newValue: bestMember.userId,
            changeType: "auto_assignment",
          });

          await db.insert(ticketHistory).values({
            ticketId: created.id,
            actorId: null,
            fieldName: "status",
            oldValue: "new",
            newValue: "triaged",
            changeType: "auto_assignment",
          });

          // Update the created object to reflect changes
          created.assigneeId = bestMember.userId;
          created.status = "triaged";
        }
      }
    } catch (autoAssignError) {
      // Auto-assignment is best-effort; log but don't fail the ticket creation
      console.error("Auto-assignment failed:", autoAssignError);
    }

    // Auto-reply comment
    try {
      await db.insert(ticketComments).values({
        ticketId: created.id,
        authorId: session.user.id,
        body: "Thank you for submitting your request. Our IT team has received your ticket and will review it shortly. You'll be notified of any updates.",
        isInternal: false,
        source: "system",
      });
    } catch (commentError) {
      console.error("Auto-reply comment failed:", commentError);
    }

    // Send email notifications (fire-and-forget)
    const requesterEmail = session.user.email;
    const portalUrl = `${request.nextUrl.origin}/tickets/${created.id}`;

    if (requesterEmail) {
      sendTicketCreatedEmail(requesterEmail, created.ticketNumber, created.title, portalUrl).catch(() => {});

      if (created.assigneeId) {
        // Look up assignee name for the notification
        const assigneeRecord = await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, created.assigneeId))
          .limit(1);

        const assigneeName = assigneeRecord[0]?.name || "an IT team member";
        sendTicketAssignedEmail(requesterEmail, created.ticketNumber, created.title, assigneeName).catch(() => {});
      }
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/tickets error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
