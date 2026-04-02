import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  approvals,
  tickets,
  users,
  auditLog,
  ticketHistory,
} from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { sendApprovalRequestEmail } from "@/lib/notifications/email";
import { userCanRequestTicketApproval } from "@/lib/constants";
import { getManager, getCISO } from "@/lib/automations/org-chart";
import { findOrCreateUserByEmail } from "@/lib/db/find-or-create-user";

type RouteContext = { params: Promise<{ id: string }> };

type Routing = "manual" | "requester_manager" | "security_ciso";

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const u = session.user as Record<string, unknown>;
    const role = (u.role as string) || "end_user";
    const isGlobalAdmin = u.isGlobalAdmin === true;
    if (!userCanRequestTicketApproval(role, { isGlobalAdmin })) {
      return NextResponse.json(
        { error: "Forbidden: IT or security role required" },
        { status: 403 }
      );
    }

    const { id: ticketId } = await context.params;
    const body = await request.json();
    const routing = body.routing as Routing | undefined;
    const approverIdBody = body.approverId as string | undefined;
    const approverRoleManual = (body.approverRole as string | undefined)
      ?.trim()
      .slice(0, 64);

    if (
      !routing ||
      !["manual", "requester_manager", "security_ciso"].includes(routing)
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid or missing routing. Use "manual", "requester_manager", or "security_ciso".',
        },
        { status: 400 }
      );
    }

    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, ticketId),
      with: {
        requester: { columns: { email: true, name: true } },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    if (["closed", "cancelled"].includes(ticket.status)) {
      return NextResponse.json(
        {
          error: "Cannot add approvals to closed or cancelled tickets",
        },
        { status: 400 }
      );
    }

    const tenantId = ticket.tenantId || undefined;
    let resolvedApproverId: string;
    let approverRole: string;

    if (routing === "requester_manager") {
      const reqEmail = ticket.requester?.email;
      if (!reqEmail) {
        return NextResponse.json(
          {
            error: "This ticket has no requester email; use manual routing.",
            code: "NO_REQUESTER_EMAIL",
          },
          { status: 400 }
        );
      }
      const manager = await getManager(reqEmail, tenantId);
      if (!manager?.email) {
        return NextResponse.json(
          {
            error:
              "No manager is set for this requester in Microsoft Entra (or Graph is unavailable).",
            code: "MANAGER_NOT_FOUND",
          },
          { status: 422 }
        );
      }
      const urow = await findOrCreateUserByEmail(
        manager.email,
        manager.displayName
      );
      resolvedApproverId = urow.id;
      approverRole = "manager";
    } else if (routing === "security_ciso") {
      const ciso = await getCISO(tenantId);
      if (!ciso?.email) {
        return NextResponse.json(
          {
            error:
              "Could not resolve a security lead (CISO) from the directory.",
            code: "CISO_NOT_FOUND",
          },
          { status: 422 }
        );
      }
      if (
        ticket.requester?.email &&
        ciso.email.toLowerCase() === ticket.requester.email.toLowerCase()
      ) {
        return NextResponse.json(
          {
            error:
              "The requester is the security lead; use manual routing to pick someone else.",
          },
          { status: 400 }
        );
      }
      const urow = await findOrCreateUserByEmail(
        ciso.email,
        ciso.displayName
      );
      resolvedApproverId = urow.id;
      approverRole = "security";
    } else {
      if (!approverIdBody) {
        return NextResponse.json(
          {
            error: "approverId is required when routing is manual",
          },
          { status: 400 }
        );
      }
      resolvedApproverId = approverIdBody;
      approverRole = approverRoleManual || "approver";
    }

    const approver = await db.query.users.findFirst({
      where: eq(users.id, resolvedApproverId),
      columns: { id: true, name: true, email: true },
    });

    if (!approver?.email) {
      return NextResponse.json(
        { error: "Approver not found or has no email" },
        { status: 404 }
      );
    }

    const duplicate = await db.query.approvals.findFirst({
      where: and(
        eq(approvals.ticketId, ticketId),
        eq(approvals.approverId, resolvedApproverId),
        eq(approvals.status, "pending")
      ),
    });

    if (duplicate) {
      return NextResponse.json(
        { error: "This user already has a pending approval on this ticket" },
        { status: 409 }
      );
    }

    const [row] = await db
      .insert(approvals)
      .values({
        ticketId,
        approverId: resolvedApproverId,
        approverRole,
        status: "pending",
      })
      .returning();

    if (ticket.status !== "pending_approval") {
      const setVals: {
        status: string;
        updatedAt: Date;
        resolvedAt?: null;
      } = {
        status: "pending_approval",
        updatedAt: new Date(),
      };
      if (ticket.resolvedAt) {
        setVals.resolvedAt = null;
      }
      await db.update(tickets).set(setVals).where(eq(tickets.id, ticketId));

      await db.insert(ticketHistory).values({
        ticketId,
        actorId: session.user.id,
        fieldName: "status",
        oldValue: ticket.status,
        newValue: "pending_approval",
        changeType: "it_approval_request",
      });
      if (ticket.resolvedAt) {
        await db.insert(ticketHistory).values({
          ticketId,
          actorId: session.user.id,
          fieldName: "resolvedAt",
          oldValue: ticket.resolvedAt.toISOString(),
          newValue: null,
          changeType: "it_approval_request",
        });
      }
    }

    await db.insert(auditLog).values({
      eventType: "approval.requested",
      entityType: "ticket",
      entityId: ticketId,
      actorId: session.user.id,
      actorType: "user",
      action: "add_approver",
      details: {
        approvalId: row.id,
        approverId: resolvedApproverId,
        approverRole,
        routing,
      },
    });

    const portalUrl = `${request.nextUrl.origin}/tickets/${ticketId}`;
    const requester = await db.query.users.findFirst({
      where: eq(users.id, ticket.requesterId),
      columns: { name: true },
    });

    sendApprovalRequestEmail(
      approver.email,
      approver.name || approver.email,
      ticket.ticketNumber,
      ticket.title,
      requester?.name || "A colleague",
      portalUrl
    ).catch((err) =>
      console.error("IT-initiated approval email failed:", err)
    );

    return NextResponse.json({ approval: row }, { status: 201 });
  } catch (error) {
    console.error("POST /api/tickets/[id]/approvals error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
