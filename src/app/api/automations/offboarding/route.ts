import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tickets, ticketComments } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { executeOffboarding } from "@/lib/automations/offboarding";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as Record<string, unknown>).role as string;
    if (!["it_admin", "hr", "security"].includes(role)) {
      return NextResponse.json(
        { error: "Forbidden: requires it_admin, hr, or security role" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { ticketId } = body as { ticketId?: string };

    if (!ticketId) {
      return NextResponse.json(
        { error: "ticketId is required" },
        { status: 400 }
      );
    }

    // Load the ticket
    const ticketRows = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (ticketRows.length === 0) {
      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 }
      );
    }

    const ticket = ticketRows[0];

    if (ticket.formType !== "employee-offboarding") {
      return NextResponse.json(
        { error: "Ticket is not an employee-offboarding form" },
        { status: 400 }
      );
    }

    if (!ticket.formData) {
      return NextResponse.json(
        { error: "Ticket has no form data" },
        { status: 400 }
      );
    }

    const formData = ticket.formData as Record<string, unknown>;
    const tenantId = ticket.tenantId || undefined;

    // Execute the offboarding automation
    const result = await executeOffboarding(
      ticketId,
      formData,
      session.user.id,
      tenantId
    );

    // Update ticket status to in_progress
    await db
      .update(tickets)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(eq(tickets.id, ticketId));

    // Add automation result as a comment
    function summariseOffboardingStep(s: (typeof result.steps)[number]): string {
      if (s.error) return s.error;
      const d = s.details;
      switch (s.step) {
        case "lookup_user":
          return `Found **${d.displayName}** (${d.companyEmail})`;
        case "disable_account": {
          const at = d.disabledAt ? new Date(d.disabledAt as string).toLocaleString() : "";
          return `Account disabled${at ? ` at ${at}` : ""}`;
        }
        case "revoke_sessions":
          return `All active sessions invalidated`;
        case "get_licenses": {
          const names = (d.licenseNames as string[]) || [];
          return `Found ${d.count} license(s)${names.length ? `: ${names.join(", ")}` : ""}`;
        }
        case "remove_licenses":
          return (d.message as string) || `Removed ${d.removedCount} license(s)`;
        case "get_group_memberships": {
          const groups = (d.groups as string[]) || [];
          return `Found ${d.groupCount} group(s)${groups.length ? `: ${groups.join(", ")}` : ""}`;
        }
        case "remove_from_groups":
          if (d.message) return d.message as string;
          return `Removed from ${d.succeeded}/${d.attempted} group(s)${d.failed ? ` — ${d.failed} failed` : ""}`;
        default:
          return Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(", ");
      }
    }

    const stepsReport = result.steps
      .map((s) => `${s.success ? "✅" : "❌"} **${s.step}**: ${summariseOffboardingStep(s)}`)
      .join("\n");

    const commentBody = [
      `**Offboarding Automation ${result.success ? "Completed" : "Completed with Errors"}**`,
      "",
      result.disabledAt
        ? `**Account disabled at:** ${new Date(result.disabledAt).toLocaleString()}`
        : "",
      "",
      "**Steps:**",
      stepsReport,
    ]
      .filter(Boolean)
      .join("\n");

    await db.insert(ticketComments).values({
      ticketId,
      authorId: session.user.id,
      body: commentBody,
      isInternal: true,
      source: "automation",
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/automations/offboarding error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
