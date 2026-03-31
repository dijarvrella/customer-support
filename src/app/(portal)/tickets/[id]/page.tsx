"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  STATUS_LABELS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  PRIORITY_COLORS,
  type TicketStatus,
  type TicketPriority,
} from "@/lib/constants";
import { formatDateTime, timeAgo } from "@/lib/utils";
import {
  ArrowLeft,
  Loader2,
  Send,
  User,
  Clock,
  Tag,
  Building2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  MessageSquare,
  Lock,
  UserPlus,
  FileText,
  Shield,
} from "lucide-react";
import { AutomationActions } from "@/components/tickets/automation-actions";

interface TicketDetail {
  id: string;
  ticketNumber: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  categorySlug: string | null;
  formType: string | null;
  formData: Record<string, unknown> | null;
  source: string;
  slaResponseDue: string | null;
  slaResolutionDue: string | null;
  slaResponseMet: boolean | null;
  slaResolutionMet: boolean | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  requester: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    department: string | null;
  } | null;
  assignee: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    department: string | null;
  } | null;
  comments: {
    id: string;
    body: string;
    isInternal: boolean;
    source: string | null;
    createdAt: string;
    author: {
      id: string;
      name: string;
      email: string;
      image: string | null;
    };
  }[];
  approvals: {
    id: string;
    status: string;
    decision: string | null;
    comment: string | null;
    approverRole: string | null;
    dueAt: string | null;
    decidedAt: string | null;
    createdAt: string;
    approver: {
      id: string;
      name: string;
      email: string;
      image: string | null;
    };
  }[];
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  new: ["triaged", "in_progress", "cancelled"],
  triaged: ["in_progress", "pending_info", "cancelled"],
  in_progress: [
    "pending_approval",
    "pending_info",
    "pending_vendor",
    "resolved",
    "cancelled",
  ],
  pending_approval: ["in_progress", "resolved", "cancelled"],
  pending_info: ["in_progress", "cancelled"],
  pending_vendor: ["in_progress", "cancelled"],
  resolved: ["closed", "in_progress"],
  closed: [],
  cancelled: [],
};

export default function TicketDetailPage() {
  const params = useParams();
  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [commentBody, setCommentBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [changingStatus, setChangingStatus] = useState<string | null>(null);

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  const [requesterDialogOpen, setRequesterDialogOpen] = useState(false);
  const [requesterSearch, setRequesterSearch] = useState("");
  const [requesterResults, setRequesterResults] = useState<Array<{ id: string; name: string; email: string }>>([]);

  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalDecision, setApprovalDecision] = useState<string>("");
  const [approvalComment, setApprovalComment] = useState("");
  const [submittingApproval, setSubmittingApproval] = useState(false);

  const [currentUser, setCurrentUser] = useState<{
    id: string;
    role: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((session) => {
        if (session?.user) {
          setCurrentUser({
            id: session.user.id,
            role: session.user.role || "end_user",
          });
        }
      })
      .catch(() => {});
  }, []);

  const isAgent =
    currentUser &&
    ["it_agent", "it_lead", "it_admin"].includes(currentUser.role);

  const fetchTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("Ticket not found");
        if (res.status === 403) throw new Error("Access denied");
        throw new Error("Failed to load ticket");
      }
      const data: TicketDetail = await res.json();
      setTicket(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;

    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: commentBody.trim(),
          isInternal,
        }),
      });
      if (!res.ok) throw new Error("Failed to add comment");
      setCommentBody("");
      setIsInternal(false);
      await fetchTicket();
    } catch {
      // silent
    } finally {
      setSubmittingComment(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (changingStatus) return; // Prevent double-click
    setChangingStatus(newStatus);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error("Status update failed:", err);
      }
      await fetchTicket();
    } catch (err) {
      console.error("Status change error:", err);
    } finally {
      setChangingStatus(null);
    }
  }

  async function searchUsers(query: string, target: "assign" | "requester") {
    if (query.length < 2) {
      target === "assign" ? setUserResults([]) : setRequesterResults([]);
      return;
    }
    setSearchingUsers(true);
    try {
      const res = await fetch(`/api/users?search=${encodeURIComponent(query)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        const results = data.map((u: any) => ({ id: u.id, name: u.name, email: u.email }));
        target === "assign" ? setUserResults(results) : setRequesterResults(results);
      }
    } finally {
      setSearchingUsers(false);
    }
  }

  async function handleAssignToUser(userId: string) {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId: userId }),
      });
      if (!res.ok) throw new Error("Failed to assign ticket");
      setAssignDialogOpen(false);
      setUserSearch("");
      setUserResults([]);
      await fetchTicket();
    } catch {
      // silent
    }
  }

  async function handleChangeRequester(userId: string) {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterId: userId }),
      });
      if (!res.ok) throw new Error("Failed to change requester");
      setRequesterDialogOpen(false);
      setRequesterSearch("");
      setRequesterResults([]);
      await fetchTicket();
    } catch {
      // silent
    }
  }

  async function handleApprovalDecision() {
    if (!approvalDecision) return;
    setSubmittingApproval(true);
    try {
      const pendingApproval = ticket?.approvals.find(
        (a) => a.status === "pending" && a.approver.id === currentUser?.id
      );
      if (!pendingApproval) return;

      const res = await fetch(`/api/approvals/${pendingApproval.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: approvalDecision,
          comment: approvalComment.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to submit approval decision");

      setApprovalDialogOpen(false);
      setApprovalDecision("");
      setApprovalComment("");
      await fetchTicket();
    } catch {
      // silent
    } finally {
      setSubmittingApproval(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-destructive opacity-60" />
        <p className="text-lg font-medium">{error || "Ticket not found"}</p>
        <Link
          href="/tickets"
          className="text-sm text-primary hover:underline mt-2 inline-block"
        >
          Back to tickets
        </Link>
      </div>
    );
  }

  const nextStatuses = STATUS_TRANSITIONS[ticket.status] || [];
  const pendingApprovalForUser = ticket.approvals.find(
    (a) => a.status === "pending" && a.approver.id === currentUser?.id
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <Link
        href="/tickets"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to tickets
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-mono text-muted-foreground">
              {ticket.ticketNumber}
            </span>
            <Badge
              variant="outline"
              className={STATUS_COLORS[ticket.status as TicketStatus] || ""}
            >
              {STATUS_LABELS[ticket.status as TicketStatus] || ticket.status}
            </Badge>
            <Badge
              variant="outline"
              className={
                PRIORITY_COLORS[ticket.priority as TicketPriority] || ""
              }
            >
              {PRIORITY_LABELS[ticket.priority as TicketPriority] ||
                ticket.priority}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{ticket.title}</h1>
        </div>

        {isAgent && nextStatuses.length > 0 && (
          <div className="flex flex-wrap gap-2 shrink-0">
            {nextStatuses.map((status) => (
              <Button
                key={status}
                variant="outline"
                size="sm"
                disabled={changingStatus !== null}
                onClick={() => handleStatusChange(status)}
              >
                {changingStatus === status && (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                )}
                {STATUS_LABELS[status as TicketStatus] || status}
              </Button>
            ))}

            <Dialog open={assignDialogOpen} onOpenChange={(open) => { setAssignDialogOpen(open); if (!open) { setUserSearch(""); setUserResults([]); } }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <UserPlus className="h-3 w-3 mr-1" />
                  Assign
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign Ticket</DialogTitle>
                  <DialogDescription>
                    Search for a user to assign this ticket to
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <Button variant="outline" className="w-full" onClick={() => handleAssignToUser(currentUser?.id || "")}>
                    Assign to Me
                  </Button>
                  <Separator />
                  <Input
                    placeholder="Search by name or email..."
                    value={userSearch}
                    onChange={(e) => { setUserSearch(e.target.value); searchUsers(e.target.value, "assign"); }}
                  />
                  {searchingUsers && <p className="text-xs text-muted-foreground">Searching...</p>}
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {userResults.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => handleAssignToUser(u.id)}
                        className="w-full text-left p-2 rounded-md hover:bg-accent flex items-center justify-between text-sm"
                      >
                        <span className="font-medium">{u.name}</span>
                        <span className="text-xs text-muted-foreground">{u.email}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {ticket.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {ticket.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Form Data */}
          {ticket.formData && Object.keys(ticket.formData).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Request Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(ticket.formData).map(([key, value]) => {
                    if (value === null || value === undefined || value === "")
                      return null;
                    const displayKey = key
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase());
                    const displayValue = Array.isArray(value)
                      ? value.join(", ")
                      : typeof value === "boolean"
                        ? value
                          ? "Yes"
                          : "No"
                        : String(value);
                    return (
                      <div key={key} className="space-y-1">
                        <dt className="text-xs font-medium text-muted-foreground">
                          {displayKey}
                        </dt>
                        <dd className="text-sm">{displayValue}</dd>
                      </div>
                    );
                  })}
                </dl>
              </CardContent>
            </Card>
          )}

          {/* Approvals */}
          {ticket.approvals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Approvals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {ticket.approvals.map((approval) => (
                  <div
                    key={approval.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <div className="mt-0.5">
                      {approval.status === "pending" ? (
                        <Clock className="h-4 w-4 text-amber-500" />
                      ) : approval.decision === "approved" ? (
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">
                          {approval.approver.name}
                        </span>
                        {approval.approverRole && (
                          <span className="text-xs text-muted-foreground">
                            ({approval.approverRole})
                          </span>
                        )}
                        <Badge
                          variant="outline"
                          className={
                            approval.status === "pending"
                              ? "bg-amber-100 text-amber-800 border-amber-200"
                              : approval.decision === "approved"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : "bg-red-100 text-red-800 border-red-200"
                          }
                        >
                          {approval.status === "pending"
                            ? "Pending"
                            : approval.decision === "approved"
                              ? "Approved"
                              : approval.decision === "rejected"
                                ? "Rejected"
                                : "More Info Requested"}
                        </Badge>
                      </div>
                      {approval.comment && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {approval.comment}
                        </p>
                      )}
                      {approval.dueAt && approval.status === "pending" && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Due: {formatDateTime(approval.dueAt)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {pendingApprovalForUser && (
                  <div className="pt-3 border-t">
                    <Dialog
                      open={approvalDialogOpen}
                      onOpenChange={setApprovalDialogOpen}
                    >
                      <div className="flex gap-2">
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            onClick={() => {
                              setApprovalDecision("approved");
                              setApprovalDialogOpen(true);
                            }}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Approve
                          </Button>
                        </DialogTrigger>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setApprovalDecision("rejected");
                            setApprovalDialogOpen(true);
                          }}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Reject
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setApprovalDecision("more_info");
                            setApprovalDialogOpen(true);
                          }}
                        >
                          Request Info
                        </Button>
                      </div>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>
                            {approvalDecision === "approved"
                              ? "Confirm Approval"
                              : approvalDecision === "rejected"
                                ? "Confirm Rejection"
                                : "Request More Information"}
                          </DialogTitle>
                          <DialogDescription>
                            {approvalDecision === "approved"
                              ? "Are you sure you want to approve this request?"
                              : approvalDecision === "rejected"
                                ? "Are you sure you want to reject this request?"
                                : "Request additional information from the requester."}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2">
                          <Label>Comment (optional)</Label>
                          <Textarea
                            placeholder="Add a comment..."
                            value={approvalComment}
                            onChange={(e) =>
                              setApprovalComment(e.target.value)
                            }
                            rows={3}
                          />
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setApprovalDialogOpen(false);
                              setApprovalDecision("");
                              setApprovalComment("");
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant={
                              approvalDecision === "rejected"
                                ? "destructive"
                                : "default"
                            }
                            onClick={handleApprovalDecision}
                            disabled={submittingApproval}
                          >
                            {submittingApproval && (
                              <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            )}
                            Confirm
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Automation Actions */}
          <AutomationActions
            ticketId={ticket.id}
            formType={ticket.formType}
            status={ticket.status}
            userRole={currentUser?.role || "end_user"}
          />

          {/* Audit Log Link */}
          {currentUser?.role === "it_admin" && (
            <div className="flex items-center">
              <Link
                href={`/admin/audit?entityId=${ticket.id}&entityType=ticket`}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Shield className="h-3.5 w-3.5" />
                View Audit Log
              </Link>
            </div>
          )}

          {/* Comments / Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Activity ({ticket.comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ticket.comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No comments yet
                </p>
              ) : (
                <div className="space-y-4">
                  {ticket.comments.map((comment) => (
                    <div
                      key={comment.id}
                      className={`rounded-lg p-4 ${
                        comment.isInternal
                          ? "bg-amber-50 border border-amber-200"
                          : "bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                          <User className="h-3 w-3 text-primary" />
                        </div>
                        <span className="text-sm font-medium">
                          {comment.author.name}
                        </span>
                        {comment.isInternal && (
                          <Badge
                            variant="outline"
                            className="bg-amber-100 text-amber-800 border-amber-200 text-xs"
                          >
                            <Lock className="h-2.5 w-2.5 mr-1" />
                            Internal
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {timeAgo(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed pl-8">
                        {comment.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t pt-4">
              <form onSubmit={handleAddComment} className="w-full space-y-3">
                <Textarea
                  placeholder="Add a comment..."
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  rows={3}
                />
                <div className="flex items-center justify-between">
                  <div>
                    {isAgent && (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="internal"
                          checked={isInternal}
                          onCheckedChange={(checked) =>
                            setIsInternal(checked === true)
                          }
                        />
                        <Label
                          htmlFor="internal"
                          className="text-sm text-muted-foreground cursor-pointer"
                        >
                          Internal note (not visible to requester)
                        </Label>
                      </div>
                    )}
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!commentBody.trim() || submittingComment}
                  >
                    {submittingComment ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Send className="h-4 w-4 mr-1" />
                    )}
                    Send
                  </Button>
                </div>
              </form>
            </CardFooter>
          </Card>
        </div>

        {/* Info Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Requester
                  {isAgent && (
                    <Dialog open={requesterDialogOpen} onOpenChange={(open) => { setRequesterDialogOpen(open); if (!open) { setRequesterSearch(""); setRequesterResults([]); } }}>
                      <DialogTrigger asChild>
                        <button type="button" className="text-primary hover:underline text-xs ml-1">(change)</button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Change Requester</DialogTitle>
                          <DialogDescription>Search for the correct requester</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3">
                          <Input
                            placeholder="Search by name or email..."
                            value={requesterSearch}
                            onChange={(e) => { setRequesterSearch(e.target.value); searchUsers(e.target.value, "requester"); }}
                          />
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {requesterResults.map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => handleChangeRequester(u.id)}
                                className="w-full text-left p-2 rounded-md hover:bg-accent flex items-center justify-between text-sm"
                              >
                                <span className="font-medium">{u.name}</span>
                                <span className="text-xs text-muted-foreground">{u.email}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </p>
                <p className="text-sm font-medium">
                  {ticket.requester?.name || "Unknown"}
                </p>
                {ticket.requester?.email && (
                  <p className="text-xs text-muted-foreground">
                    {ticket.requester.email}
                  </p>
                )}
                {ticket.requester?.department && (
                  <p className="text-xs text-muted-foreground">
                    {ticket.requester.department}
                  </p>
                )}
              </div>

              <Separator />

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <UserPlus className="h-3 w-3" />
                  Assigned To
                  {isAgent && (
                    <button type="button" onClick={() => setAssignDialogOpen(true)} className="text-primary hover:underline text-xs ml-1">(change)</button>
                  )}
                </p>
                <p className="text-sm">
                  {ticket.assignee?.name || (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </p>
                {ticket.assignee?.email && (
                  <p className="text-xs text-muted-foreground">
                    {ticket.assignee.email}
                  </p>
                )}
              </div>

              <Separator />

              {ticket.categorySlug && (
                <>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      Category
                    </p>
                    <p className="text-sm">
                      {ticket.categorySlug
                        .replace(/-/g, " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase())}
                    </p>
                  </div>
                  <Separator />
                </>
              )}

              {ticket.formType && (
                <>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Form Type
                    </p>
                    <p className="text-sm capitalize">
                      {ticket.formType.replace(/-/g, " ")}
                    </p>
                  </div>
                  <Separator />
                </>
              )}

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  Source
                </p>
                <p className="text-sm capitalize">{ticket.source}</p>
              </div>

              <Separator />

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Created
                </p>
                <p className="text-sm">{formatDateTime(ticket.createdAt)}</p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Updated
                </p>
                <p className="text-sm">{formatDateTime(ticket.updatedAt)}</p>
              </div>

              {ticket.resolvedAt && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Resolved
                  </p>
                  <p className="text-sm">
                    {formatDateTime(ticket.resolvedAt)}
                  </p>
                </div>
              )}

              {ticket.closedAt && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Closed
                  </p>
                  <p className="text-sm">
                    {formatDateTime(ticket.closedAt)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SLA */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">SLA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Response SLA
                </p>
                {ticket.slaResponseDue ? (
                  <div className="flex items-center gap-2">
                    {ticket.slaResponseMet === true ? (
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                    ) : ticket.slaResponseMet === false ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 text-amber-500" />
                    )}
                    <span className="text-sm">
                      {ticket.slaResponseMet === true
                        ? "Met"
                        : ticket.slaResponseMet === false
                          ? "Breached"
                          : `Due ${formatDateTime(ticket.slaResponseDue)}`}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">N/A</p>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Resolution SLA
                </p>
                {ticket.slaResolutionDue ? (
                  <div className="flex items-center gap-2">
                    {ticket.slaResolutionMet === true ? (
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                    ) : ticket.slaResolutionMet === false ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 text-amber-500" />
                    )}
                    <span className="text-sm">
                      {ticket.slaResolutionMet === true
                        ? "Met"
                        : ticket.slaResolutionMet === false
                          ? "Breached"
                          : `Due ${formatDateTime(ticket.slaResolutionDue)}`}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">N/A</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
