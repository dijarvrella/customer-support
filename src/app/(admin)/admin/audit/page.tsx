"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Shield, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface AuditEntry {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string | null;
  actorId: string | null;
  actorType: string | null;
  actor: { name: string | null; email: string | null } | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

interface AuditResponse {
  data: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}

function getEventBadgeClass(eventType: string): string {
  if (eventType.startsWith("automation.")) {
    return "bg-purple-100 text-purple-800 border-purple-200";
  }
  if (eventType.startsWith("ticket.")) {
    return "bg-blue-100 text-blue-800 border-blue-200";
  }
  if (eventType.startsWith("approval.")) {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  return "bg-gray-100 text-gray-800 border-gray-200";
}

function truncateJson(obj: Record<string, unknown> | null, maxLen = 80): string {
  if (!obj) return "-";
  const str = JSON.stringify(obj);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "...";
}

export default function AuditLogPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const [eventType, setEventType] = useState(searchParams.get("eventType") || "");
  const [entityType, setEntityType] = useState(searchParams.get("entityType") || "all");
  const [entityId, setEntityId] = useState(searchParams.get("entityId") || "");
  const [actorType, setActorType] = useState(searchParams.get("actorType") || "user");
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") || "");
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const pageSize = 25;

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (eventType) params.set("eventType", eventType);
      if (entityType && entityType !== "all") params.set("entityType", entityType);
      if (entityId) params.set("entityId", entityId);
      if (actorType && actorType !== "all") params.set("actorType", actorType);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/audit?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      const json = await res.json();
      // API returns { data, nextCursor, hasMore } (cursor-based), not { total }
      const items: AuditEntry[] = Array.isArray(json) ? json : (json.data ?? []);
      setEntries(items);
      setTotal(items.length);
    } catch {
      setEntries([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, eventType, entityType, entityId, actorType, dateFrom, dateTo]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (eventType) params.set("eventType", eventType);
    if (entityType && entityType !== "all") params.set("entityType", entityType);
    if (entityId) params.set("entityId", entityId);
    if (actorType && actorType !== "all") params.set("actorType", actorType);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    const qs = params.toString();
    router.replace(`/admin/audit${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [page, eventType, entityType, entityId, actorType, dateFrom, dateTo, router]);

  const totalPages = Math.ceil(total / pageSize);

  function handleFilter() {
    setPage(1);
  }

  function handleClearFilters() {
    setEventType("");
    setEntityType("all");
    setEntityId("");
    setActorType("user");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Event Type
              </label>
              <Input
                placeholder="e.g. ticket.created"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-48"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Entity Type
              </label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="ticket">Ticket</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="workflow">Workflow</SelectItem>
                  <SelectItem value="config">Config</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Actor Type
              </label>
              <Select value={actorType} onValueChange={setActorType}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="automation">Automation</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                From
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                To
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
              />
            </div>

            <Button size="sm" onClick={handleFilter}>
              Apply
            </Button>
            <Button size="sm" variant="outline" onClick={handleClearFilters}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {loading ? "Loading..." : `${total} entries found`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              No audit log entries found
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[170px]">Timestamp</TableHead>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead className="hidden lg:table-cell">Details</TableHead>
                    <TableHead className="hidden md:table-cell w-[120px]">IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <>
                      <TableRow
                        key={entry.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() =>
                          setExpandedRow(
                            expandedRow === entry.id ? null : entry.id
                          )
                        }
                      >
                        <TableCell className="text-xs font-mono">
                          {formatDateTime(entry.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={getEventBadgeClass(entry.eventType)}
                          >
                            {entry.eventType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {entry.entityType}
                          {entry.entityId && (
                            <span className="text-xs text-muted-foreground ml-1 font-mono">
                              {entry.entityId.slice(0, 8)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {entry.actor?.name || entry.actor?.email || (entry.actorType === "automation" ? "Automation" : entry.actorType === "system" ? "System" : entry.actorId ? entry.actorId.slice(0, 8) : "-")}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs font-mono text-muted-foreground max-w-[250px] truncate">
                          {truncateJson(entry.details)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs font-mono text-muted-foreground">
                          {entry.ipAddress || "-"}
                        </TableCell>
                      </TableRow>
                      {expandedRow === entry.id && (
                        <TableRow key={`${entry.id}-details`}>
                          <TableCell colSpan={6} className="bg-muted/30">
                            <div className="p-3">
                              <p className="text-xs font-medium text-muted-foreground mb-1">
                                Full Details
                              </p>
                              <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-background rounded p-3 border max-h-64 overflow-auto">
                                {entry.details
                                  ? JSON.stringify(entry.details, null, 2)
                                  : "No details"}
                              </pre>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
