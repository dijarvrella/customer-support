import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tickets, ticketComments } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { executeOnboarding } from "@/lib/automations/onboarding";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as Record<string, unknown>).role as string;
    if (!["it_admin", "hr"].includes(role)) {
      return NextResponse.json(
        { error: "Forbidden: requires it_admin or hr role" },
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

    if (ticket.formType !== "employee-onboarding") {
      return NextResponse.json(
        { error: "Ticket is not an employee-onboarding form" },
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

    // Execute the onboarding automation
    const result = await executeOnboarding(
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
    function summariseOnboardingStep(s: (typeof result.steps)[number]): string {
      if (s.error) return s.error;
      const d = s.details;
      switch (s.step) {
        case "create_user":
          return `Created **${d.userPrincipalName}** — display name: ${d.displayName}`;
        case "assign_license":
          return `Assigned license **${d.licenseName}**`;
        case "add_to_group":
          return `Added to group **"${d.groupName}"**`;
        case "add_to_zimark_general":
          return `Added to group **"${d.groupName}"**`;
        case "set_manager":
          return `Manager set to **${d.managerEmail}**`;
        default:
          return Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(", ");
      }
    }

    const stepsReport = result.steps
      .map((s) => `${s.success ? "✅" : "❌"} **${s.step}**: ${summariseOnboardingStep(s)}`)
      .join("\n");

    const commentBody = [
      `**Onboarding Automation ${result.success ? "Completed" : "Completed with Errors"}**`,
      "",
      result.userPrincipalName ? `**User:** ${result.userPrincipalName}` : "",
      result.licenseName ? `**License:** ${result.licenseName}` : "",
      result.tempPassword
        ? `**Temp Password:** \`${result.tempPassword}\` (user must change on first sign-in)`
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
    console.error("POST /api/automations/onboarding error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
