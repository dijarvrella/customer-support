"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  STATUS_LABELS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  PRIORITY_COLORS,
  type TicketStatus,
  type TicketPriority,
} from "@/lib/constants";
import { formatDate, timeAgo } from "@/lib/utils";
import {
  Search,
  Ticket,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ShieldCheck,
} from "lucide-react";

interface TicketRow {
  id: string;
  ticketNumber: string;
  title: string;
  status: string;
  priority: string;
  tags?: string | null;
  createdAt: string;
  updatedAt: string;
  requester: { name: string; email: string } | null;
  assignee: { name: string; email: string } | null;
}

interface TicketResponse {
  data: TicketRow[];
  nextCursor: string | null;
  hasMore: boolean;
}

function hasIsoTag(tags: string | null | undefined): boolean {
  if (!tags) return false;
  return tags.toLowerCase().includes("iso");
}

export default function TicketsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewAll = searchParams.get("view") === "all";

  const [activeTab, setActiveTab] = useState<"my-tickets" | "approvals">(
    "my-tickets"
  );
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [hasApprovals, setHasApprovals] = useState(false);

  const pageSize = 20;

  // Check if user has any pending approvals (to decide whether to show the tab)
  useEffect(() => {
    async function checkApprovals() {
      try {
        const res = await fetch("/api/tickets?view=approvals&limit=1");
        if (res.ok) {
          const json: TicketResponse = await res.json();
          setHasApprovals(json.data.length > 0);
        }
      } catch {
        // Silently fail - just don't show the tab
      }
    }
    checkApprovals();
  }, []);

  const fetchTickets = useCallback(
    async (pageCursor: string | null) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", String(pageSize));
        params.set("sort", "created_at:desc");

        if (activeTab === "approvals") {
          params.set("view", "approvals");
        }

        if (statusFilter && statusFilter !== "all") {
          params.set("status", statusFilter);
        }
        if (priorityFilter && priorityFilter !== "all") {
          params.set("priority", priorityFilter);
        }
        if (searchQuery.trim()) {
          params.set("search", searchQuery.trim());
        }
        if (pageCursor) {
          params.set("cursor", pageCursor);
        }

        const res = await fetch(`/api/tickets?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch tickets");

        const json: TicketResponse = await res.json();
        setTickets(json.data);
        setHasMore(json.hasMore);
        setCursor(json.nextCursor);
      } catch (error) {
        console.error("Error fetching tickets:", error);
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, priorityFilter, searchQuery, activeTab]
  );

  // Fetch on filter or tab change
  useEffect(() => {
    setCursors([null]);
    setCurrentPage(0);
    fetchTickets(null);
  }, [fetchTickets]);

  function handleTabChange(value: string) {
    setActiveTab(value as "my-tickets" | "approvals");
  }

  function handleNextPage() {
    if (!cursor) return;
    const newCursors = [...cursors, cursor];
    setCursors(newCursors);
    setCurrentPage(currentPage + 1);
    fetchTickets(cursor);
  }

  function handlePrevPage() {
    if (currentPage <= 0) return;
    const newPage = currentPage - 1;
    setCurrentPage(newPage);
    fetchTickets(cursors[newPage]);
  }

  function handleRowClick(id: string) {
    router.push(`/tickets/${id}`);
  }

  const pageTitle =
    activeTab === "approvals"
      ? "Needs My Approval"
      : viewAll
        ? "All Tickets"
        : "My Tickets";

  const pageDescription =
    activeTab === "approvals"
      ? "Tickets awaiting your approval decision"
      : viewAll
        ? "View and manage all tickets in the system"
        : "Track your submitted support requests";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{pageTitle}</h1>
        <p className="text-muted-foreground mt-1">{pageDescription}</p>
      </div>

      {/* Tabs - shown when user has pending approvals */}
      {hasApprovals && (
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
        >
          <TabsList>
            <TabsTrigger value="my-tickets">My Tickets</TabsTrigger>
            <TabsTrigger value="approvals">
              Needs My Approval
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {TICKET_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {TICKET_PRIORITIES.map((priority) => (
              <SelectItem key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Ticket className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">
                {activeTab === "approvals"
                  ? "No tickets awaiting your approval"
                  : "No tickets found"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Ticket #
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Title
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">
                      Priority
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">
                      Requester
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">
                      Assigned To
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden xl:table-cell">
                      Created
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      onClick={() => handleRowClick(ticket.id)}
                      className="border-b last:border-0 hover:bg-accent/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {ticket.ticketNumber}
                      </td>
                      <td className="px-4 py-3 font-medium max-w-[250px] truncate">
                        <span className="flex items-center gap-1.5">
                          {ticket.title}
                          {hasIsoTag(ticket.tags) && (
                            <Badge
                              variant="outline"
                              className="bg-sky-50 text-sky-700 border-sky-200 text-[10px] px-1.5 py-0 leading-4 font-semibold shrink-0"
                            >
                              <ShieldCheck className="h-3 w-3 mr-0.5" />
                              ISO
                            </Badge>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
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
                      <td className="px-4 py-3 hidden md:table-cell">
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
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                        {ticket.requester?.name || "Unknown"}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                        {ticket.assignee?.name || "Unassigned"}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground text-xs">
                        {formatDate(ticket.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                        {timeAgo(ticket.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {tickets.length > 0 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Page {currentPage + 1}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={currentPage === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={!hasMore}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
