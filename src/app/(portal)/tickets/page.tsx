"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Bot,
  X,
  UserPlus,
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

function hasAction1Tag(tags: string | null | undefined): boolean {
  if (!tags) return false;
  return tags.toLowerCase().includes("action1");
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

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Assign dialog state for bulk assign
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<
    Array<{ id: string; name: string; email: string }>
  >([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

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
    setSelectedIds(new Set());
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
    setSelectedIds(new Set());
    fetchTickets(cursor);
  }

  function handlePrevPage() {
    if (currentPage <= 0) return;
    const newPage = currentPage - 1;
    setCurrentPage(newPage);
    setSelectedIds(new Set());
    fetchTickets(cursors[newPage]);
  }

  function handleRowClick(id: string) {
    router.push(`/tickets/${id}`);
  }

  // --- Bulk selection helpers ---

  function toggleSelectAll() {
    if (selectedIds.size === tickets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tickets.map((t) => t.id)));
    }
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // --- Bulk actions ---

  async function handleBulkStatusChange(newStatus: string) {
    if (selectedIds.size === 0 || bulkActionLoading) return;
    setBulkActionLoading(true);
    try {
      const results = await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/tickets/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus }),
          })
        )
      );
      const failCount = results.filter((r) => !r.ok).length;
      if (failCount > 0) {
        console.error(`${failCount} ticket(s) failed to update status`);
      }
    } catch (error) {
      console.error("Bulk status change error:", error);
    } finally {
      setBulkActionLoading(false);
      setSelectedIds(new Set());
      fetchTickets(cursors[currentPage]);
    }
  }

  async function searchUsers(query: string) {
    if (query.length < 2) {
      setUserResults([]);
      return;
    }
    setSearchingUsers(true);
    try {
      const res = await fetch(
        `/api/users?search=${encodeURIComponent(query)}&limit=10`
      );
      if (res.ok) {
        const data = await res.json();
        setUserResults(
          data.map((u: any) => ({ id: u.id, name: u.name, email: u.email }))
        );
      }
    } finally {
      setSearchingUsers(false);
    }
  }

  async function handleBulkAssign(userId: string) {
    if (selectedIds.size === 0 || bulkActionLoading) return;
    setBulkActionLoading(true);
    try {
      const results = await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/tickets/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assigneeId: userId }),
          })
        )
      );
      const failCount = results.filter((r) => !r.ok).length;
      if (failCount > 0) {
        console.error(`${failCount} ticket(s) failed to reassign`);
      }
    } catch (error) {
      console.error("Bulk assign error:", error);
    } finally {
      setBulkActionLoading(false);
      setBulkAssignDialogOpen(false);
      setUserSearch("");
      setUserResults([]);
      setSelectedIds(new Set());
      fetchTickets(cursors[currentPage]);
    }
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

  const allSelected = tickets.length > 0 && selectedIds.size === tickets.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < tickets.length;

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

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 rounded-lg border bg-background p-3 shadow-sm">
          {bulkActionLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Updating {selectedIds.size} ticket{selectedIds.size !== 1 && "s"}...
            </div>
          ) : (
            <>
              <span className="text-sm font-medium">
                {selectedIds.size} ticket{selectedIds.size !== 1 && "s"} selected
              </span>

              <Select
                value=""
                onValueChange={(value) => {
                  if (value) handleBulkStatusChange(value);
                }}
              >
                <SelectTrigger className="w-[180px] h-8 text-sm">
                  <SelectValue placeholder="Change Status" />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkAssignDialogOpen(true)}
              >
                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                Assign To
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Cancel Selection
              </Button>
            </>
          )}
        </div>
      )}

      {/* Bulk Assign Dialog */}
      <Dialog
        open={bulkAssignDialogOpen}
        onOpenChange={(open) => {
          setBulkAssignDialogOpen(open);
          if (!open) {
            setUserSearch("");
            setUserResults([]);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign {selectedIds.size} Ticket{selectedIds.size !== 1 && "s"}</DialogTitle>
            <DialogDescription>
              Search for a user to assign the selected tickets to
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Search by name or email..."
              value={userSearch}
              onChange={(e) => {
                setUserSearch(e.target.value);
                searchUsers(e.target.value);
              }}
            />
            {searchingUsers && (
              <p className="text-xs text-muted-foreground">Searching...</p>
            )}
            <div className="max-h-48 overflow-y-auto space-y-1">
              {userResults.map((u) => (
                <button
                  type="button"
                  key={u.id}
                  onClick={() => handleBulkAssign(u.id)}
                  disabled={bulkActionLoading}
                  className="w-full text-left p-2 rounded-md hover:bg-accent flex items-center justify-between text-sm"
                >
                  <span className="font-medium">{u.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {u.email}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                    <th className="px-4 py-3 w-10" aria-label="Select">
                      <Checkbox
                        checked={allSelected ? true : someSelected ? "indeterminate" : false}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all tickets"
                      />
                    </th>
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
                      className={`border-b last:border-0 hover:bg-accent/50 cursor-pointer transition-colors ${
                        selectedIds.has(ticket.id) ? "bg-accent/30" : ""
                      }`}
                    >
                      <td
                        className="px-4 py-3 w-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={selectedIds.has(ticket.id)}
                          onCheckedChange={() => toggleSelectOne(ticket.id)}
                          aria-label={`Select ticket ${ticket.ticketNumber}`}
                        />
                      </td>
                      <td
                        className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap"
                        onClick={() => handleRowClick(ticket.id)}
                      >
                        {ticket.ticketNumber}
                      </td>
                      <td
                        className="px-4 py-3 font-medium max-w-[250px] truncate"
                        onClick={() => handleRowClick(ticket.id)}
                      >
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
                          {hasAction1Tag(ticket.tags) && (
                            <Badge
                              variant="outline"
                              className="bg-orange-50 text-orange-700 border-orange-200 text-[10px] px-1.5 py-0 leading-4 font-semibold shrink-0"
                            >
                              <Bot className="h-3 w-3 mr-0.5" />
                              Action1
                            </Badge>
                          )}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3 hidden sm:table-cell"
                        onClick={() => handleRowClick(ticket.id)}
                      >
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
                      <td
                        className="px-4 py-3 hidden md:table-cell"
                        onClick={() => handleRowClick(ticket.id)}
                      >
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
                      <td
                        className="px-4 py-3 hidden lg:table-cell text-muted-foreground"
                        onClick={() => handleRowClick(ticket.id)}
                      >
                        {ticket.requester?.name || "Unknown"}
                      </td>
                      <td
                        className="px-4 py-3 hidden lg:table-cell text-muted-foreground"
                        onClick={() => handleRowClick(ticket.id)}
                      >
                        {ticket.assignee?.name || "Unassigned"}
                      </td>
                      <td
                        className="px-4 py-3 hidden xl:table-cell text-muted-foreground text-xs"
                        onClick={() => handleRowClick(ticket.id)}
                      >
                        {formatDate(ticket.createdAt)}
                      </td>
                      <td
                        className="px-4 py-3 text-right text-muted-foreground text-xs"
                        onClick={() => handleRowClick(ticket.id)}
                      >
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
