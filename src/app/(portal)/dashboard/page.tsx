import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tickets, approvals, users } from "@/lib/db/schema";
import { eq, and, gte, desc, count, sql } from "drizzle-orm";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  STATUS_LABELS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  PRIORITY_COLORS,
  type TicketStatus,
  type TicketPriority,
} from "@/lib/constants";
import { formatDate, timeAgo } from "@/lib/utils";
import {
  TicketIcon,
  PlusCircle,
  CheckCircle,
  AlertTriangle,
  ClipboardCheck,
  ArrowRight,
} from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const role = (session.user as Record<string, unknown>).role as string;
  const userId = session.user.id as string;
  const isAgent = ["it_agent", "it_lead", "it_admin"].includes(role);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Fetch stats in parallel
  const [
    openTicketsResult,
    createdTodayResult,
    resolvedTodayResult,
    slaBreachesResult,
    pendingApprovalsResult,
  ] = await Promise.all([
    // Open tickets
    db
      .select({ value: count() })
      .from(tickets)
      .where(
        isAgent
          ? and(
              sql`${tickets.status} NOT IN ('resolved', 'closed', 'cancelled')`,
              eq(tickets.assigneeId, userId)
            )
          : and(
              sql`${tickets.status} NOT IN ('resolved', 'closed', 'cancelled')`,
              eq(tickets.requesterId, userId)
            )
      ),
    // Created today
    db
      .select({ value: count() })
      .from(tickets)
      .where(
        isAgent
          ? gte(tickets.createdAt, todayStart)
          : and(
              gte(tickets.createdAt, todayStart),
              eq(tickets.requesterId, userId)
            )
      ),
    // Resolved today
    db
      .select({ value: count() })
      .from(tickets)
      .where(
        isAgent
          ? and(
              gte(tickets.resolvedAt, todayStart),
              eq(tickets.assigneeId, userId)
            )
          : and(
              gte(tickets.resolvedAt, todayStart),
              eq(tickets.requesterId, userId)
            )
      ),
    // SLA breaches
    db
      .select({ value: count() })
      .from(tickets)
      .where(
        isAgent
          ? and(
              eq(tickets.slaResolutionMet, false),
              sql`${tickets.status} NOT IN ('resolved', 'closed', 'cancelled')`,
              eq(tickets.assigneeId, userId)
            )
          : and(
              eq(tickets.slaResolutionMet, false),
              sql`${tickets.status} NOT IN ('resolved', 'closed', 'cancelled')`,
              eq(tickets.requesterId, userId)
            )
      ),
    // Pending approvals
    db
      .select({ value: count() })
      .from(approvals)
      .where(
        and(eq(approvals.approverId, userId), eq(approvals.status, "pending"))
      ),
  ]);

  const stats = {
    openTickets: openTicketsResult[0]?.value ?? 0,
    createdToday: createdTodayResult[0]?.value ?? 0,
    resolvedToday: resolvedTodayResult[0]?.value ?? 0,
    slaBreaches: slaBreachesResult[0]?.value ?? 0,
    pendingApprovals: pendingApprovalsResult[0]?.value ?? 0,
  };

  // Fetch recent tickets
  const requester = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .as("requester");

  const assignee = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .as("assignee");

  const recentTicketsRaw = await db
    .select({
      id: tickets.id,
      ticketNumber: tickets.ticketNumber,
      title: tickets.title,
      status: tickets.status,
      priority: tickets.priority,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
      requesterName: requester.name,
      assigneeName: assignee.name,
    })
    .from(tickets)
    .leftJoin(requester, eq(tickets.requesterId, requester.id))
    .leftJoin(assignee, eq(tickets.assigneeId, assignee.id))
    .where(
      isAgent
        ? eq(tickets.assigneeId, userId)
        : eq(tickets.requesterId, userId)
    )
    .orderBy(desc(tickets.createdAt))
    .limit(10);

  const statCards = [
    {
      label: "Open Tickets",
      value: stats.openTickets,
      icon: TicketIcon,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Created Today",
      value: stats.createdToday,
      icon: PlusCircle,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      label: "Resolved Today",
      value: stats.resolvedToday,
      icon: CheckCircle,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "SLA Breaches",
      value: stats.slaBreaches,
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      label: "Pending Approvals",
      value: stats.pendingApprovals,
      icon: ClipboardCheck,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {session.user.name?.split(" ")[0] || "User"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isAgent
            ? "Here is an overview of your assigned tickets and activity."
            : "Here is an overview of your support requests."}
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${stat.bg}`}
                >
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Tickets */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">
            {isAgent ? "Assigned to You" : "Your Recent Tickets"}
          </CardTitle>
          <Link
            href="/tickets"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {recentTicketsRaw.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TicketIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No tickets found</p>
              <Link
                href="/tickets/new"
                className="text-sm text-primary hover:underline mt-1 inline-block"
              >
                Create your first ticket
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 pr-4 font-medium text-muted-foreground">
                      Ticket
                    </th>
                    <th className="pb-3 pr-4 font-medium text-muted-foreground hidden sm:table-cell">
                      Status
                    </th>
                    <th className="pb-3 pr-4 font-medium text-muted-foreground hidden md:table-cell">
                      Priority
                    </th>
                    <th className="pb-3 pr-4 font-medium text-muted-foreground hidden lg:table-cell">
                      {isAgent ? "Requester" : "Assigned To"}
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentTicketsRaw.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className="border-b last:border-0 hover:bg-accent/50"
                    >
                      <td className="py-3 pr-4">
                        <Link
                          href={`/tickets/${ticket.id}`}
                          className="hover:underline"
                        >
                          <span className="text-muted-foreground text-xs">
                            {ticket.ticketNumber}
                          </span>
                          <p className="font-medium truncate max-w-[250px]">
                            {ticket.title}
                          </p>
                        </Link>
                      </td>
                      <td className="py-3 pr-4 hidden sm:table-cell">
                        <Badge
                          variant="outline"
                          className={
                            STATUS_COLORS[ticket.status as TicketStatus] || ""
                          }
                        >
                          {STATUS_LABELS[ticket.status as TicketStatus] ||
                            ticket.status}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 hidden md:table-cell">
                        <Badge
                          variant="outline"
                          className={
                            PRIORITY_COLORS[ticket.priority as TicketPriority] ||
                            ""
                          }
                        >
                          {PRIORITY_LABELS[ticket.priority as TicketPriority] ||
                            ticket.priority}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 hidden lg:table-cell text-muted-foreground">
                        {isAgent
                          ? ticket.requesterName || "Unknown"
                          : ticket.assigneeName || "Unassigned"}
                      </td>
                      <td className="py-3 text-right text-muted-foreground text-xs">
                        {ticket.updatedAt ? timeAgo(ticket.updatedAt) : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
