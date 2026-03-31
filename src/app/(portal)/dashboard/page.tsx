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
import { Button } from "@/components/ui/button";
import {
  STATUS_LABELS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  PRIORITY_COLORS,
  type TicketStatus,
  type TicketPriority,
} from "@/lib/constants";
import { timeAgo } from "@/lib/utils";
import {
  TicketIcon,
  PlusCircle,
  CheckCircle,
  AlertTriangle,
  ClipboardCheck,
  ArrowRight,
  UserPlus,
  UserMinus,
  ShieldCheck,
  Monitor,
  Wrench,
  BookOpen,
} from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const role = (session.user as Record<string, unknown>).role as string;
  const userId = session.user.id as string;
  const isAgent = ["it_agent", "it_lead", "it_admin"].includes(role);
  const isHR = role === "hr";

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    openTicketsResult,
    createdTodayResult,
    resolvedTodayResult,
    slaBreachesResult,
    pendingApprovalsResult,
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(tickets)
      .where(
        isAgent
          ? sql`${tickets.status} NOT IN ('resolved', 'closed', 'cancelled')`
          : and(
              sql`${tickets.status} NOT IN ('resolved', 'closed', 'cancelled')`,
              eq(tickets.requesterId, userId)
            )
      ),
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
    db
      .select({ value: count() })
      .from(tickets)
      .where(
        isAgent
          ? and(eq(tickets.status, "resolved"), gte(tickets.resolvedAt, todayStart))
          : and(
              eq(tickets.status, "resolved"),
              gte(tickets.resolvedAt, todayStart),
              eq(tickets.requesterId, userId)
            )
      ),
    db
      .select({ value: count() })
      .from(tickets)
      .where(
        isAgent
          ? and(
              eq(tickets.slaResolutionMet, false),
              sql`${tickets.status} NOT IN ('resolved', 'closed', 'cancelled')`
            )
          : and(
              eq(tickets.slaResolutionMet, false),
              sql`${tickets.status} NOT IN ('resolved', 'closed', 'cancelled')`,
              eq(tickets.requesterId, userId)
            )
      ),
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
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .as("requester");

  const assignee = db
    .select({ id: users.id, name: users.name, email: users.email })
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
        ? sql`${tickets.status} NOT IN ('resolved', 'closed', 'cancelled')`
        : eq(tickets.requesterId, userId)
    )
    .orderBy(desc(tickets.createdAt))
    .limit(8);

  // Quick actions based on role
  const quickActions = [];

  // Everyone can submit a general ticket
  quickActions.push({
    label: "New IT Request",
    description: "Report an issue or request help",
    href: "/tickets/new",
    icon: PlusCircle,
    color: "bg-primary text-primary-foreground hover:bg-primary/90",
    primary: true,
  });

  if (isAgent || isHR || role === "it_admin") {
    quickActions.push({
      label: "Onboard Employee",
      description: "New hire setup",
      href: "/onboarding/new",
      icon: UserPlus,
      color: "bg-emerald-600 text-white hover:bg-emerald-700",
      primary: true,
    });
    quickActions.push({
      label: "Offboard Employee",
      description: "Employee departure",
      href: "/offboarding/new",
      icon: UserMinus,
      color: "bg-red-600 text-white hover:bg-red-700",
      primary: true,
    });
  }

  quickActions.push({
    label: "Request Access",
    description: "App or system access",
    href: "/tickets/new?type=grant-access",
    icon: ShieldCheck,
    color: "",
    primary: false,
  });
  quickActions.push({
    label: "Hardware Request",
    description: "Devices and peripherals",
    href: "/tickets/new?type=hardware-purchase",
    icon: Monitor,
    color: "",
    primary: false,
  });
  quickActions.push({
    label: "Browse Catalog",
    description: "All IT services",
    href: "/catalog",
    icon: BookOpen,
    color: "",
    primary: false,
  });

  const statCards = [
    { label: "Open Tickets", value: stats.openTickets, icon: TicketIcon, color: "text-blue-600", bg: "bg-blue-50", href: "/tickets" },
    { label: "Created Today", value: stats.createdToday, icon: PlusCircle, color: "text-indigo-600", bg: "bg-indigo-50", href: "/tickets" },
    { label: "Resolved Today", value: stats.resolvedToday, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50", href: "/tickets" },
    { label: "SLA Breaches", value: stats.slaBreaches, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", href: "/tickets" },
    { label: "Pending Approvals", value: stats.pendingApprovals, icon: ClipboardCheck, color: "text-amber-600", bg: "bg-amber-50", href: "/approvals" },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome + Primary CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {session.user.name?.split(" ")[0] || "User"}
          </h1>
          <p className="text-muted-foreground mt-1">
            How can we help you today?
          </p>
        </div>
        <Link href="/tickets/new">
          <Button size="lg" className="gap-2">
            <PlusCircle className="h-5 w-5" />
            New IT Request
          </Button>
        </Link>
      </div>

      {/* Quick Actions Grid */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Quick Actions</h2>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {quickActions.map((action) => (
            <Link key={action.label} href={action.href}>
              <Card className={`h-full transition-all hover:shadow-md cursor-pointer ${action.primary ? "border-2" : ""}`}>
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${action.primary ? action.color : "bg-muted"}`}>
                    <action.icon className={`h-5 w-5 ${action.primary ? "" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-tight">{action.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="hover:shadow-sm transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${stat.bg}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Pending Approvals Banner */}
      {stats.pendingApprovals > 0 && (
        <Link href="/approvals">
          <Card className="border-amber-200 bg-amber-50 hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ClipboardCheck className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-900">
                    {stats.pendingApprovals} approval{stats.pendingApprovals !== 1 ? "s" : ""} waiting for your review
                  </p>
                  <p className="text-sm text-amber-700">Click to review pending requests</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-amber-600" />
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Recent Tickets */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">
            {isAgent ? "Open Tickets" : "Your Recent Requests"}
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
              <p className="text-sm">No tickets yet</p>
              <Link href="/tickets/new">
                <Button variant="outline" size="sm" className="mt-3 gap-2">
                  <PlusCircle className="h-4 w-4" />
                  Submit your first request
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 pr-4 font-medium text-muted-foreground">Ticket</th>
                    <th className="pb-3 pr-4 font-medium text-muted-foreground hidden sm:table-cell">Status</th>
                    <th className="pb-3 pr-4 font-medium text-muted-foreground hidden md:table-cell">Priority</th>
                    <th className="pb-3 pr-4 font-medium text-muted-foreground hidden lg:table-cell">
                      {isAgent ? "Requester" : "Assigned To"}
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTicketsRaw.map((ticket) => (
                    <tr key={ticket.id} className="border-b last:border-0 hover:bg-accent/50">
                      <td className="py-3 pr-4">
                        <Link href={`/tickets/${ticket.id}`} className="hover:underline">
                          <span className="text-muted-foreground text-xs">{ticket.ticketNumber}</span>
                          <p className="font-medium truncate max-w-[250px]">{ticket.title}</p>
                        </Link>
                      </td>
                      <td className="py-3 pr-4 hidden sm:table-cell">
                        <Badge variant="outline" className={STATUS_COLORS[ticket.status as TicketStatus] || ""}>
                          {STATUS_LABELS[ticket.status as TicketStatus] || ticket.status}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 hidden md:table-cell">
                        <Badge variant="outline" className={PRIORITY_COLORS[ticket.priority as TicketPriority] || ""}>
                          {PRIORITY_LABELS[ticket.priority as TicketPriority] || ticket.priority}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 hidden lg:table-cell text-muted-foreground">
                        {isAgent ? ticket.requesterName || "Unknown" : ticket.assigneeName || "Unassigned"}
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
