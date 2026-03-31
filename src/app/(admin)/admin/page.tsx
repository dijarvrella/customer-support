import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, tickets, queues, teams } from "@/lib/db/schema";
import { count, sql } from "drizzle-orm";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Users,
  Settings,
  Inbox,
  BarChart3,
  Shield,
  Wrench,
  Ticket,
  UserCheck,
} from "lucide-react";
import Link from "next/link";

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Fetch system stats
  const [
    totalUsersResult,
    activeUsersResult,
    totalTicketsResult,
    openTicketsResult,
  ] = await Promise.all([
    db.select({ value: count() }).from(users),
    db
      .select({ value: count() })
      .from(users)
      .where(sql`${users.isActive} = true`),
    db.select({ value: count() }).from(tickets),
    db
      .select({ value: count() })
      .from(tickets)
      .where(
        sql`${tickets.status} NOT IN ('resolved', 'closed', 'cancelled')`
      ),
  ]);

  const stats = [
    {
      label: "Total Users",
      value: totalUsersResult[0]?.value ?? 0,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Active Users",
      value: activeUsersResult[0]?.value ?? 0,
      icon: UserCheck,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Total Tickets",
      value: totalTicketsResult[0]?.value ?? 0,
      icon: Ticket,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      label: "Open Tickets",
      value: openTicketsResult[0]?.value ?? 0,
      icon: BarChart3,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  const adminCards = [
    {
      title: "User Management",
      description: "Manage user accounts, roles, and permissions",
      icon: Users,
      href: "/admin/users",
    },
    {
      title: "Queue Management",
      description: "Configure teams, queues, and assignment rules",
      icon: Inbox,
      href: "/admin/queues",
    },
    {
      title: "System Settings",
      description: "Branding, SLA policies, and notifications",
      icon: Settings,
      href: "/admin/settings",
    },
    {
      title: "Reports",
      description: "View dashboards and export reports",
      icon: BarChart3,
      href: "/dashboard",
    },
    {
      title: "Security & Audit",
      description: "Audit logs, compliance, and legal holds",
      icon: Shield,
      href: "/admin/audit",
    },
    {
      title: "Integrations",
      description: "Slack, Microsoft, AWS connections",
      icon: Wrench,
      href: "/admin/integrations",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Administration</h1>
        <p className="text-muted-foreground mt-1">
          System configuration and management
        </p>
      </div>

      {/* Stats overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
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

      {/* Admin section links */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {adminCards.map((card) => (
          <Link key={card.title} href={card.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <card.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{card.title}</CardTitle>
                    <CardDescription className="text-xs">
                      {card.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
