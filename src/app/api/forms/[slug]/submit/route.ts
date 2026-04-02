import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tickets, approvals, auditLog, users } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";
import { generateTicketNumber } from "@/lib/utils";
import { DEFAULT_SLA, type TicketPriority } from "@/lib/constants";
import { getRequiredApprovers } from "@/lib/automations/org-chart";
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

async function findOrCreateUser(
  email: string,
  name?: string
): Promise<{ id: string }> {
  // Case-insensitive lookup
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`LOWER(${users.email}) = LOWER(${email})`)
    .limit(1);

  if (existing.length > 0) return existing[0];

  // Create stub user
  const [created] = await db
    .insert(users)
    .values({
      email: email.toLowerCase(),
      name: name || email.split("@")[0],
      role: "end_user",
      isActive: true,
    })
    .returning({ id: users.id });

  return created;
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

    // Determine if approval is needed
    const approvalRequired = [
      "employee-onboarding",
      "employee-offboarding",
      "grant-access",
      "revoke-access",
      "aws-iam",
      "aws-account-access",
      "firewall-change",
      "network-change",
      "azure-change",
      "hardware-purchase",
      "new-employee-kit",
      "security-tool",
    ].includes(slug);

    const ticketNumber = generateTicketNumber();

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
        status: approvalRequired ? "pending_approval" : "new",
        slaResponseDue,
        slaResolutionDue,
      })
      .returning();

    // Auto-create approval records from Microsoft org chart
    if (approvalRequired) {
      const requesterEmail = session.user.email || "";

      try {
        // Fetch required approvers from org chart
        const orgApprovers = await getRequiredApprovers(requesterEmail, slug);

        for (const approverInfo of orgApprovers) {
          const approverUser = await findOrCreateUser(
            approverInfo.email,
            approverInfo.name
          );
          await db.insert(approvals).values({
            ticketId: ticket.id,
            approverId: approverUser.id,
            approverRole: approverInfo.role,
            status: "pending",
          });
        }

        // If no org approvers found, fall back to form-provided supervisor
        if (orgApprovers.length === 0) {
          const supervisorEmail =
            (data.supervisor_email as string) ||
            (data.supervisorEmail as string) ||
            (data.manager_email as string) ||
            (data.managerEmail as string);

          if (supervisorEmail) {
            const supervisorName =
              (data.supervisor_name as string) ||
              (data.supervisorName as string) ||
              supervisorEmail.split("@")[0];

            const approverUser = await findOrCreateUser(
              supervisorEmail,
              supervisorName
            );
            await db.insert(approvals).values({
              ticketId: ticket.id,
              approverId: approverUser.id,
              approverRole: "manager",
              status: "pending",
            });
          }
        }
      } catch (err) {
        console.error("Error creating approvals from org chart:", err);
        // Fall back to form supervisor
        const supervisorEmail =
          (data.supervisor_email as string) ||
          (data.manager_email as string);
        if (supervisorEmail) {
          const approverUser = await findOrCreateUser(supervisorEmail);
          await db.insert(approvals).values({
            ticketId: ticket.id,
            approverId: approverUser.id,
            approverRole: "manager",
            status: "pending",
          });
        }
      }
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
    const requesterEmail = session.user.email;

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

    if (approvalRequired) {
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
