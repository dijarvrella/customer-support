import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tickets, auditLog, users, ticketComments, approvals } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, desc, asc, and, or, like, lt, inArray } from "drizzle-orm";
import { generateTicketNumber } from "@/lib/utils";
import { DEFAULT_SLA, type TicketPriority } from "@/lib/constants";
import {
  sendTicketCreatedEmail,
  sendTicketAssignedEmail,
  sendNewAssignmentEmail,
  sendApprovalRequestEmail,
} from "@/lib/notifications/email";
import { createApprovalsForCategoryTicket } from "@/lib/tickets/create-approvals-for-category";
import {
  autoAssignNewTicketToTeam,
  defaultQueueIdForCategorySlug,
} from "@/lib/tickets/devops-queue";

// Security-related category slugs visible to CISO / security role
const SECURITY_CATEGORIES = [
  "firewall-change",
  "network-change",
  "vpn-request",
  "security-tool",
  "aws-iam",
  "aws-account-access",
  "azure-change",
];

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
    const view = searchParams.get("view");
    const sort = searchParams.get("sort") || "created_at:desc";
    const cursor = searchParams.get("cursor");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

    const role = (session.user as Record<string, unknown>).role as string;

    // ── Special view: approvals ────────────────────────────────────────
    // Returns only tickets where the current user has a pending approval
    if (view === "approvals") {
      const pendingApprovalTicketIds = await db
        .select({ ticketId: approvals.ticketId })
        .from(approvals)
        .where(
          and(
            eq(approvals.approverId, session.user.id),
            eq(approvals.status, "pending")
          )
        );

      const ticketIds = pendingApprovalTicketIds.map((a) => a.ticketId);

      if (ticketIds.length === 0) {
        return NextResponse.json({ data: [], nextCursor: null, hasMore: false });
      }

      const approvalConditions: ReturnType<typeof eq>[] = [
        inArray(tickets.id, ticketIds),
      ];

      // Apply standard filters on top
      if (status) approvalConditions.push(eq(tickets.status, status));
      if (priority) approvalConditions.push(eq(tickets.priority, priority));
      if (search) {
        approvalConditions.push(
          or(
            like(tickets.title, `%${search}%`),
            like(tickets.description, `%${search}%`)
          )!
        );
      }
      if (cursor) {
        approvalConditions.push(lt(tickets.createdAt, new Date(cursor)));
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
        .where(and(...approvalConditions))
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
    }

    // ── Standard ticket listing with role-based scoping ────────────────
    const conditions: ReturnType<typeof eq>[] = [];

    if (role === "end_user") {
      // End users can only see their own tickets
      conditions.push(eq(tickets.requesterId, session.user.id));
    } else if (role === "security") {
      // CISO / Security role: own tickets + security category tickets + tickets where they are an approver
      const approverTicketIds = await db
        .select({ ticketId: approvals.ticketId })
        .from(approvals)
        .where(eq(approvals.approverId, session.user.id));

      const approverIds = approverTicketIds.map((a) => a.ticketId);

      const securityOr = [
        eq(tickets.requesterId, session.user.id),
        inArray(tickets.categorySlug, SECURITY_CATEGORIES),
      ];

      if (approverIds.length > 0) {
        securityOr.push(inArray(tickets.id, approverIds));
      }

      conditions.push(or(...securityOr)!);
    } else if (role === "approver" || role === "hr") {
      // Managers / approvers: own tickets + tickets where they are an approver
      const approverTicketIds = await db
        .select({ ticketId: approvals.ticketId })
        .from(approvals)
        .where(eq(approvals.approverId, session.user.id));

      const approverIds = approverTicketIds.map((a) => a.ticketId);

      if (approverIds.length > 0) {
        conditions.push(
          or(
            eq(tickets.requesterId, session.user.id),
            inArray(tickets.id, approverIds)
          )!
        );
      } else {
        conditions.push(eq(tickets.requesterId, session.user.id));
      }
    }
    // it_agent, it_lead, it_admin, auditor see all tickets (no requester filter)

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
    const queueId = await defaultQueueIdForCategorySlug(
      categorySlug || null
    );

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
        queueId,
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

    const requesterEmailForApprovals = session.user.email || "";
    const tenantIdForApprovals = (session.user as Record<string, unknown>)
      .tenantId as string | null | undefined;

    const approvalsCreatedCount = await createApprovalsForCategoryTicket({
      ticketId: created.id,
      categorySlug: categorySlug || null,
      requesterEmail: requesterEmailForApprovals,
      formData: (formData as Record<string, unknown> | null) || null,
      tenantId: tenantIdForApprovals,
    });

    // Auto-assignment: DevOps team for cloud infra categories, else IT Operations
    try {
      const assigned = await autoAssignNewTicketToTeam({
        ticketId: created.id,
        categorySlug: categorySlug || null,
        approvalsCreatedCount,
      });
      if (assigned) {
        created.assigneeId = assigned.assigneeId;
        created.status = assigned.status;
      }
    } catch (autoAssignError) {
      console.error("Auto-assignment failed:", autoAssignError);
    }

    if (approvalsCreatedCount > 0 && created.status === "new") {
      await db
        .update(tickets)
        .set({ status: "pending_approval", updatedAt: new Date() })
        .where(eq(tickets.id, created.id));
      created.status = "pending_approval";
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
      sendTicketCreatedEmail(requesterEmail, created.ticketNumber, created.title, portalUrl)
        .catch((err) => console.error("Ticket created email failed:", err));

      if (approvalsCreatedCount > 0) {
        const pendingForTicket = await db.query.approvals.findMany({
          where: eq(approvals.ticketId, created.id),
          with: {
            approver: { columns: { name: true, email: true } },
          },
        });

        const emailedApprovers = new Set<string>();
        for (const row of pendingForTicket) {
          if (row.status !== "pending") continue;
          const to = row.approver.email?.trim().toLowerCase();
          if (!to || emailedApprovers.has(to)) continue;
          emailedApprovers.add(to);
          sendApprovalRequestEmail(
            to,
            row.approver.name || to,
            created.ticketNumber,
            created.title,
            session.user.name || session.user.email || "A colleague",
            portalUrl
          ).catch((err) =>
            console.error(
              `Ticket create: approval request email failed (${to}):`,
              err
            )
          );
        }
      }

      if (created.assigneeId) {
        // Look up assignee for notification
        const assigneeRecord = await db
          .select({ name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, created.assigneeId))
          .limit(1);

        const assigneeName = assigneeRecord[0]?.name || "an IT team member";
        const assigneeEmail = assigneeRecord[0]?.email;

        // Notify requester that their ticket was assigned
        sendTicketAssignedEmail(requesterEmail, created.ticketNumber, created.title, assigneeName)
          .catch((err) => console.error("Ticket assigned email failed:", err));

        // Notify the assignee about their new ticket
        if (assigneeEmail) {
          sendNewAssignmentEmail(assigneeEmail, assigneeName, created.ticketNumber, created.title, session.user.name || "Someone", portalUrl)
            .catch((err) => console.error("New assignment email failed:", err));
        }
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
