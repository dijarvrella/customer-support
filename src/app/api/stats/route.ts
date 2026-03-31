import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tickets, approvals } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, and, sql, count, notInArray, gte, isNotNull } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const closedStatuses = ["closed", "cancelled", "resolved"];

    // Run all queries in parallel
    const [
      openTicketsResult,
      ticketsByStatusResult,
      ticketsByPriorityResult,
      createdTodayResult,
      resolvedTodayResult,
      avgResolutionResult,
      slaBreachResult,
      pendingApprovalsResult,
    ] = await Promise.all([
      // Total open tickets
      db
        .select({ count: count() })
        .from(tickets)
        .where(notInArray(tickets.status, closedStatuses)),

      // Tickets by status
      db
        .select({
          status: tickets.status,
          count: count(),
        })
        .from(tickets)
        .groupBy(tickets.status),

      // Tickets by priority
      db
        .select({
          priority: tickets.priority,
          count: count(),
        })
        .from(tickets)
        .where(notInArray(tickets.status, closedStatuses))
        .groupBy(tickets.priority),

      // Tickets created today
      db
        .select({ count: count() })
        .from(tickets)
        .where(gte(tickets.createdAt, startOfToday)),

      // Tickets resolved today
      db
        .select({ count: count() })
        .from(tickets)
        .where(
          and(
            eq(tickets.status, "resolved"),
            gte(tickets.resolvedAt, startOfToday)
          )
        ),

      // Average resolution time (last 30 days)
      db
        .select({
          avgMinutes: sql<number>`
            AVG(
              EXTRACT(EPOCH FROM (${tickets.resolvedAt} - ${tickets.createdAt})) / 60
            )
          `.as("avg_minutes"),
        })
        .from(tickets)
        .where(
          and(
            isNotNull(tickets.resolvedAt),
            gte(tickets.resolvedAt, thirtyDaysAgo)
          )
        ),

      // SLA breach count
      db
        .select({ count: count() })
        .from(tickets)
        .where(eq(tickets.slaResolutionMet, false)),

      // Pending approvals for current user
      db
        .select({ count: count() })
        .from(approvals)
        .where(
          and(
            eq(approvals.approverId, session.user.id),
            eq(approvals.status, "pending")
          )
        ),
    ]);

    // Format tickets by status as a record
    const byStatus: Record<string, number> = {};
    for (const row of ticketsByStatusResult) {
      byStatus[row.status] = row.count;
    }

    // Format tickets by priority as a record
    const byPriority: Record<string, number> = {};
    for (const row of ticketsByPriorityResult) {
      byPriority[row.priority] = row.count;
    }

    const avgResolutionMinutes = avgResolutionResult[0]?.avgMinutes
      ? Math.round(avgResolutionResult[0].avgMinutes)
      : null;

    return NextResponse.json({
      openTickets: openTicketsResult[0]?.count ?? 0,
      ticketsByStatus: byStatus,
      ticketsByPriority: byPriority,
      createdToday: createdTodayResult[0]?.count ?? 0,
      resolvedToday: resolvedTodayResult[0]?.count ?? 0,
      avgResolutionMinutes,
      slaBreachCount: slaBreachResult[0]?.count ?? 0,
      pendingApprovals: pendingApprovalsResult[0]?.count ?? 0,
    });
  } catch (error) {
    console.error("GET /api/stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
