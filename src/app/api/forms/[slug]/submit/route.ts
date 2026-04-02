import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tickets, approvals, auditLog } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { generateTicketNumber } from "@/lib/utils";
import {
  DEFAULT_SLA,
  type TicketPriority,
  categorySlugRequiresApproval,
} from "@/lib/constants";
import { createApprovalsForCategoryTicket } from "@/lib/tickets/create-approvals-for-category";
import {
  autoAssignNewTicketToTeam,
  defaultQueueIdForCategorySlug,
} from "@/lib/tickets/devops-queue";
import {
  sendTicketCreatedEmail,
  sendApprovalRequestEmail,
} from "@/lib/notifications/email";

type RouteContext = { params: Promise<{ slug: string }> };

function generateTitle(slug: string, data: Record<string, unknown>): string {
  const name =
    data.employee_name ||
    data.employeeName ||
    data.full_name ||
    data.fullName ||
    data.name ||
    [data.first_name || data.firstName, data.last_name || data.lastName]
      .filter(Boolean)
      .join(" ");

  const nameStr = name ? String(name) : "Unknown";

  const slugTitles: Record<string, string> = {
    "employee-onboarding": "Onboarding",
    "employee-offboarding": "Offboarding",
    "grant-access": "Grant Access",
    "revoke-access": "Revoke Access",
    "azure-change": "Azure/Entra Change",
    "aws-iam": "AWS IAM Change",
    "aws-account-access": "AWS Account Access",
    "network-change": "Network Change",
    "firewall-change": "Firewall Change",
    "new-employee-kit": "New Employee Kit",
    "service-account": "Service Account",
    "department-transfer": "Department Transfer",
  };

  const prefix = slugTitles[slug] || slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return `${prefix}: ${nameStr}`;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await context.params;
    const body = await request.json();
    const { data } = body;

    if (!data || typeof data !== "object") {
      return NextResponse.json(
        { error: "Form data is required" },
        { status: 400 }
      );
    }

    const title = generateTitle(slug, data);
    const priority: TicketPriority = (data.priority as TicketPriority) || "medium";
    const sla = DEFAULT_SLA[priority];
    const now = new Date();
    const slaResponseDue = new Date(now.getTime() + sla.responseMinutes * 60 * 1000);
    const slaResolutionDue = new Date(now.getTime() + sla.resolutionMinutes * 60 * 1000);

    const approvalRequired = categorySlugRequiresApproval(slug);

    const ticketNumber = generateTicketNumber();
    const queueId = await defaultQueueIdForCategorySlug(slug);

    const [ticket] = await db
      .insert(tickets)
      .values({
        ticketNumber,
        title,
        description: data.description
          ? String(data.description)
          : `Form submission: ${slug}`,
        priority,
        categorySlug: slug,
        requesterId: session.user.id,
        source: "portal",
        formData: data,
        formType: slug,
        status: "new",
        slaResponseDue,
        slaResolutionDue,
        queueId,
      })
      .returning();

    const requesterEmail = session.user.email || "";
    const tenantId = (session.user as Record<string, unknown>).tenantId as
      | string
      | null
      | undefined;

    let approvalsCount = 0;
    if (approvalRequired) {
      approvalsCount = await createApprovalsForCategoryTicket({
        ticketId: ticket.id,
        categorySlug: slug,
        requesterEmail,
        formData: data as Record<string, unknown>,
        tenantId,
      });
      if (approvalsCount > 0) {
        await db
          .update(tickets)
          .set({ status: "pending_approval", updatedAt: new Date() })
          .where(eq(tickets.id, ticket.id));
        ticket.status = "pending_approval";
      }
    }

    try {
      const assigned = await autoAssignNewTicketToTeam({
        ticketId: ticket.id,
        categorySlug: slug,
        approvalsCreatedCount: approvalsCount,
      });
      if (assigned) {
        ticket.assigneeId = assigned.assigneeId;
        ticket.status = assigned.status;
      }
    } catch (autoAssignError) {
      console.error("Form submit: auto-assignment failed:", autoAssignError);
    }

    // Audit log
    await db.insert(auditLog).values({
      eventType: "ticket.created",
      entityType: "ticket",
      entityId: ticket.id,
      actorId: session.user.id,
      actorType: "user",
      action: "create",
      details: {
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        formType: slug,
        approvalRequired,
      },
    });

    const portalUrl = `${request.nextUrl.origin}/tickets/${ticket.id}`;

    if (requesterEmail) {
      sendTicketCreatedEmail(
        requesterEmail,
        ticket.ticketNumber,
        ticket.title,
        portalUrl
      ).catch((err) =>
        console.error("Form submit: ticket created email failed:", err)
      );
    }

    if (approvalsCount > 0) {
      const pendingForTicket = await db.query.approvals.findMany({
        where: eq(approvals.ticketId, ticket.id),
        with: {
          approver: { columns: { name: true, email: true } },
        },
      });

      const emailed = new Set<string>();
      for (const row of pendingForTicket) {
        if (row.status !== "pending") continue;
        const to = row.approver.email?.trim().toLowerCase();
        if (!to || emailed.has(to)) continue;
        emailed.add(to);
        sendApprovalRequestEmail(
          to,
          row.approver.name || to,
          ticket.ticketNumber,
          ticket.title,
          session.user.name || session.user.email || "A colleague",
          portalUrl
        ).catch((err) =>
          console.error(
            `Form submit: approval request email failed (${to}):`,
            err
          )
        );
      }
    }

    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    console.error("POST /api/forms/[slug]/submit error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
