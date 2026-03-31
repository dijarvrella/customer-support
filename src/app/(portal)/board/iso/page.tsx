"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  STATUS_LABELS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  type TicketStatus,
  type TicketPriority,
} from "@/lib/constants";
import { timeAgo } from "@/lib/utils";
import {
  ShieldCheck,
  ArrowLeft,
  Clock,
  User,
  CheckCircle2,
  AlertTriangle,
  Circle,
} from "lucide-react";

interface IsoTicket {
  id: string;
  ticketNumber: string;
  title: string;
  status: string;
  priority: string;
  tags: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: { name: string; email: string } | null;
}

function getQuarter(dateStr: string): string {
  const d = new Date(dateStr);
  const q = Math.ceil((d.getMonth() + 1) / 3);
  return `Q${q} ${d.getFullYear()}`;
}

function statusIcon(status: string) {
  if (status === "closed" || status === "resolved")
    return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "in_progress")
    return <Clock className="h-4 w-4 text-blue-500" />;
  if (status.startsWith("pending"))
    return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <Circle className="h-4 w-4 text-gray-400" />;
}

export default function IsoBoardPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<IsoTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    async function fetchIsoTickets() {
      setLoading(true);
      try {
        const res = await fetch("/api/tickets?limit=200&view=all");
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        // Filter to ISO tickets only
        const isoTickets = (json.data || []).filter(
          (t: IsoTicket) => t.tags && t.tags.toLowerCase().includes("iso")
        );
        setTickets(isoTickets);
      } catch {
        console.error("Failed to load ISO tickets");
      } finally {
        setLoading(false);
      }
    }
    fetchIsoTickets();
  }, []);

  // Group by quarter
  const quarters = useMemo(() => {
    const map = new Map<string, IsoTicket[]>();
    tickets.forEach((t) => {
      const q = getQuarter(t.createdAt);
      if (!map.has(q)) map.set(q, []);
      map.get(q)!.push(t);
    });
    // Sort quarters descending
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [tickets]);

  // Stats
  const stats = useMemo(() => {
    const total = tickets.length;
    const completed = tickets.filter(
      (t) => t.status === "closed" || t.status === "resolved"
    ).length;
    const inProgress = tickets.filter(
      (t) => t.status === "in_progress"
    ).length;
    const open = total - completed - inProgress;
    return { total, completed, inProgress, open };
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    if (activeTab === "all") return tickets;
    if (activeTab === "open")
      return tickets.filter(
        (t) => !["closed", "resolved", "cancelled"].includes(t.status)
      );
    if (activeTab === "completed")
      return tickets.filter((t) =>
        ["closed", "resolved"].includes(t.status)
      );
    return tickets;
  }, [tickets, activeTab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/board"
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-sky-600" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                ISO 27001 Compliance Board
              </h1>
              <p className="text-sm text-muted-foreground">
                ISMS & IT Security Compliance Tracking
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-3xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Controls</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-3xl font-bold text-emerald-600">
              {stats.completed}
            </p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-3xl font-bold text-blue-600">
              {stats.inProgress}
            </p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-3xl font-bold text-amber-600">{stats.open}</p>
            <p className="text-xs text-muted-foreground">Open</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress bar */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Compliance Progress</span>
            <span className="text-sm text-muted-foreground">
              {stats.total > 0
                ? Math.round((stats.completed / stats.total) * 100)
                : 0}
              %
            </span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{
                width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%`,
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All ({tickets.length})</TabsTrigger>
          <TabsTrigger value="open">Open ({stats.open + stats.inProgress})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({stats.completed})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {quarters.map(([quarter, qTickets]) => {
            const visible = qTickets.filter((t) =>
              filteredTickets.some((ft) => ft.id === t.id)
            );
            if (visible.length === 0) return null;
            return (
              <div key={quarter} className="mb-6">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {quarter}
                  <Badge variant="outline">{visible.length}</Badge>
                </h3>
                <div className="space-y-2">
                  {visible.map((ticket) => (
                    <Card
                      key={ticket.id}
                      className="hover:shadow-sm transition-shadow cursor-pointer"
                      onClick={() => router.push(`/tickets/${ticket.id}`)}
                    >
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="shrink-0">
                          {statusIcon(ticket.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-mono text-muted-foreground">
                              {ticket.ticketNumber}
                            </span>
                            <Badge
                              variant="outline"
                              className={
                                PRIORITY_COLORS[
                                  ticket.priority as TicketPriority
                                ] || ""
                              }
                            >
                              {PRIORITY_LABELS[
                                ticket.priority as TicketPriority
                              ] || ticket.priority}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="bg-sky-50 text-sky-700 border-sky-200"
                            >
                              ISO
                            </Badge>
                          </div>
                          <p className="text-sm font-medium truncate">
                            {ticket.title}
                          </p>
                        </div>
                        <div className="shrink-0 text-right hidden sm:block">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {ticket.assignee?.name || "Unassigned"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {timeAgo(ticket.updatedAt)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
