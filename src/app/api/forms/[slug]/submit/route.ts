import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tickets, approvals, auditLog, users } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { generateTicketNumber } from "@/lib/utils";
import { DEFAULT_SLA, type TicketPriority } from "@/lib/constants";

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

    const needsApproval =
      slug === "employee-onboarding" ||
      slug === "employee-offboarding" ||
      slug === "grant-access" ||
      slug === "revoke-access";

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
        status: needsApproval ? "pending_approval" : "new",
        slaResponseDue,
        slaResolutionDue,
      })
      .returning();

    // Auto-create approval records for onboarding/offboarding
    if (needsApproval) {
      const supervisorEmail =
        (data.supervisor_email as string) ||
        (data.supervisorEmail as string) ||
        (data.manager_email as string) ||
        (data.managerEmail as string);

      if (supervisorEmail) {
        // Look up the manager/supervisor user, create a stub if not found
        let approver = await db.query.users.findFirst({
          where: eq(users.email, supervisorEmail),
        });

        if (!approver) {
          // Create a stub user for the approver
          const supervisorName =
            (data.supervisor_name as string) ||
            (data.supervisorName as string) ||
            (data.manager_name as string) ||
            (data.managerName as string) ||
            supervisorEmail.split("@")[0];

          const [stubUser] = await db
            .insert(users)
            .values({
              email: supervisorEmail,
              name: supervisorName,
              role: "approver",
              isActive: true,
            })
            .returning();
          approver = stubUser;
        }

        await db.insert(approvals).values({
          ticketId: ticket.id,
          approverId: approver.id,
          approverRole: "manager",
          status: "pending",
        });
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
        needsApproval,
      },
    });

    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    console.error("POST /api/forms/[slug]/submit error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
