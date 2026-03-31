"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  LayoutGrid,
  Filter,
  Search,
  User,
  Clock,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  TICKET_PRIORITIES,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  STATUS_LABELS,
  type TicketStatus,
  type TicketPriority,
} from "@/lib/constants";
import { timeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";

// --- Types ---

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

// --- Board column definitions ---

interface BoardColumn {
  key: string;
  label: string;
  statuses: TicketStatus[];
  borderColor: string;
}

const BOARD_COLUMNS: BoardColumn[] = [
  {
    key: "new",
    label: "New",
    statuses: ["new", "triaged"],
    borderColor: "border-blue-500",
  },
  {
    key: "in_progress",
    label: "In Progress",
    statuses: ["in_progress"],
    borderColor: "border-purple-500",
  },
  {
    key: "blocked",
    label: "Blocked",
    statuses: ["pending_approval", "pending_info", "pending_vendor"],
    borderColor: "border-amber-500",
  },
  {
    key: "resolved",
    label: "Resolved",
    statuses: ["resolved"],
    borderColor: "border-emerald-500",
  },
  {
    key: "closed",
    label: "Closed",
    statuses: ["closed", "cancelled"],
    borderColor: "border-gray-400",
  },
];

const PRIORITY_BORDER_COLORS: Record<string, string> = {
  critical: "border-l-red-500",
  high: "border-l-orange-500",
  medium: "border-l-yellow-500",
  low: "border-l-green-500",
};

// --- Component ---

export default function BoardPage() {
  const router = useRouter();

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [myTickets, setMyTickets] = useState(false);
  const [priorityFilters, setPriorityFilters] = useState<Set<string>>(
    new Set()
  );
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);

  // Fetch tickets
  useEffect(() => {
    async function fetchTickets() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", "200");
        if (!myTickets) {
          params.set("view", "all");
        }
        const res = await fetch(`/api/tickets?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch tickets");
        const json: TicketResponse = await res.json();
        setTickets(json.data);
      } catch (error) {
        console.error("Error fetching tickets:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchTickets();
  }, [myTickets]);

  // Filter tickets (exclude ISO tickets from main board)
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      // Exclude ISO tickets - they have their own board
      if (ticket.tags && ticket.tags.toLowerCase().includes("iso")) {
        return false;
      }
      if (
        priorityFilters.size > 0 &&
        !priorityFilters.has(ticket.priority)
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = ticket.title.toLowerCase().includes(q);
        const matchesNumber = ticket.ticketNumber.toLowerCase().includes(q);
        const matchesAssignee = ticket.assignee?.name
          ?.toLowerCase()
          .includes(q);
        if (!matchesTitle && !matchesNumber && !matchesAssignee) {
          return false;
        }
      }
      return true;
    });
  }, [tickets, searchQuery, priorityFilters]);

  // Group tickets by board column
  const columnTickets = useMemo(() => {
    const grouped: Record<string, TicketRow[]> = {};
    for (const col of BOARD_COLUMNS) {
      grouped[col.key] = [];
    }
    for (const ticket of filteredTickets) {
      for (const col of BOARD_COLUMNS) {
        if (col.statuses.includes(ticket.status as TicketStatus)) {
          grouped[col.key].push(ticket);
          break;
        }
      }
    }
    return grouped;
  }, [filteredTickets]);

  function togglePriority(priority: string) {
    setPriorityFilters((prev) => {
      const next = new Set(prev);
      if (next.has(priority)) {
        next.delete(priority);
      } else {
        next.add(priority);
      }
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <LayoutGrid className="h-6 w-6" />
            IT Support Board
          </h1>
          <p className="text-muted-foreground mt-1">
            Visual overview of ticket statuses
          </p>
        </div>
        <Link href="/board/iso">
          <Button variant="outline" size="sm" className="gap-2">
            <ShieldCheck className="h-4 w-4 text-sky-600" />
            ISO 27001 Board
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* My Tickets / All Tickets toggle */}
        <div className="flex gap-1 rounded-lg border p-1">
          <Button
            variant={myTickets ? "default" : "ghost"}
            size="sm"
            onClick={() => setMyTickets(true)}
            className="text-xs"
          >
            <User className="h-3.5 w-3.5 mr-1.5" />
            My Tickets
          </Button>
          <Button
            variant={!myTickets ? "default" : "ghost"}
            size="sm"
            onClick={() => setMyTickets(false)}
            className="text-xs"
          >
            All Tickets
          </Button>
        </div>

        {/* Priority filter */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPriorityMenu(!showPriorityMenu)}
            className="text-xs"
          >
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            Priority
            {priorityFilters.size > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-4 min-w-[16px] text-[10px] px-1">
                {priorityFilters.size}
              </Badge>
            )}
          </Button>
          {showPriorityMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowPriorityMenu(false)}
              />
              <div className="absolute top-full mt-1 right-0 z-20 w-48 rounded-lg border bg-popover p-2 shadow-md">
                {TICKET_PRIORITIES.map((priority) => (
                  <label
                    key={priority}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={priorityFilters.has(priority)}
                      onChange={() => togglePriority(priority)}
                      className="rounded border-muted-foreground"
                    />
                    <Badge
                      variant="outline"
                      className={cn("text-xs", PRIORITY_COLORS[priority])}
                    >
                      {PRIORITY_LABELS[priority]}
                    </Badge>
                  </label>
                ))}
                {priorityFilters.size > 0 && (
                  <>
                    <Separator className="my-1" />
                    <button
                      onClick={() => setPriorityFilters(new Set())}
                      className="w-full text-left px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent rounded-md"
                    >
                      Clear filters
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Board */}
      {loading ? (
        <BoardSkeleton />
      ) : (
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-4 min-w-max">
            {BOARD_COLUMNS.map((column) => {
              const items = columnTickets[column.key] || [];
              return (
                <div
                  key={column.key}
                  className="flex flex-col w-[300px] min-w-[280px] shrink-0"
                >
                  {/* Column header */}
                  <div
                    className={cn(
                      "border-t-4 rounded-t-lg bg-muted/50 px-4 py-3 flex items-center justify-between",
                      column.borderColor
                    )}
                  >
                    <h3 className="text-sm font-semibold">{column.label}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {items.length}
                    </Badge>
                  </div>

                  {/* Column body */}
                  <div className="flex-1 space-y-2 bg-muted/20 rounded-b-lg p-2 min-h-[200px]">
                    {items.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">
                        No tickets
                      </p>
                    ) : (
                      items.map((ticket) => (
                        <TicketCard
                          key={ticket.id}
                          ticket={ticket}
                          onClick={() => router.push(`/tickets/${ticket.id}`)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
    </div>
  );
}

// --- Ticket card ---

function TicketCard({
  ticket,
  onClick,
}: {
  ticket: TicketRow;
  onClick: () => void;
}) {
  const priorityBorder =
    PRIORITY_BORDER_COLORS[ticket.priority] || "border-l-gray-300";

  return (
    <Card
      onClick={onClick}
      className={cn(
        "border-l-4 cursor-pointer transition-all hover:shadow-md hover:bg-accent/30",
        priorityBorder
      )}
    >
      <CardContent className="p-3 space-y-2">
        {/* Ticket number */}
        <p className="font-mono text-[11px] text-muted-foreground">
          {ticket.ticketNumber}
        </p>

        {/* Title */}
        <p className="text-sm font-medium leading-snug line-clamp-2">
          {ticket.title}
        </p>

        {/* Meta row */}
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-1.5 py-0",
              PRIORITY_COLORS[ticket.priority as TicketPriority] || ""
            )}
          >
            {PRIORITY_LABELS[ticket.priority as TicketPriority] ||
              ticket.priority}
          </Badge>

          {/* Status sub-label for grouped columns */}
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {STATUS_LABELS[ticket.status as TicketStatus] || ticket.status}
          </Badge>
        </div>

        {/* Assignee and time */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1 truncate">
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {ticket.assignee?.name || "Unassigned"}
            </span>
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <Clock className="h-3 w-3" />
            {timeAgo(ticket.updatedAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Loading skeleton ---

function BoardSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {BOARD_COLUMNS.map((column) => (
        <div
          key={column.key}
          className="flex flex-col w-[300px] min-w-[280px] shrink-0"
        >
          <div
            className={cn(
              "border-t-4 rounded-t-lg bg-muted/50 px-4 py-3 flex items-center justify-between",
              column.borderColor
            )}
          >
            <div className="h-4 w-20 bg-muted rounded animate-pulse" />
            <div className="h-5 w-6 bg-muted rounded animate-pulse" />
          </div>
          <div className="flex-1 space-y-2 bg-muted/20 rounded-b-lg p-2 min-h-[200px]">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-lg border bg-card p-3 space-y-2"
              >
                <div className="h-3 w-16 bg-muted rounded animate-pulse" />
                <div className="h-4 w-full bg-muted rounded animate-pulse" />
                <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
                <div className="flex justify-between">
                  <div className="h-3 w-16 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-12 bg-muted rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
