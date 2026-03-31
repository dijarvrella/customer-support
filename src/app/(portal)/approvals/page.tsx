"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  type TicketPriority,
} from "@/lib/constants";
import { formatDate, timeAgo } from "@/lib/utils";
import {
  CheckCircle,
  XCircle,
  MessageSquare,
  CheckSquare,
  Clock,
  Loader2,
  AlertTriangle,
} from "lucide-react";

interface PendingApproval {
  id: string;
  ticketId: string;
  approverRole: string | null;
  status: string;
  dueAt: string | null;
  createdAt: string;
  ticket: {
    id: string;
    ticketNumber: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    formType: string | null;
    formData: Record<string, unknown> | null;
    createdAt: string;
    requester: { id: string; name: string; email: string; image: string | null } | null;
  };
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  // Confirmation dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<string>("");
  const [dialogApprovalId, setDialogApprovalId] = useState<string>("");
  const [dialogComment, setDialogComment] = useState("");

  useEffect(() => {
    fetchApprovals();
  }, []);

  async function fetchApprovals() {
    try {
      const res = await fetch("/api/approvals");
      if (res.ok) {
        const data = await res.json();
        setApprovals(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  function openConfirmDialog(approvalId: string, action: string) {
    setDialogApprovalId(approvalId);
    setDialogAction(action);
    setDialogComment("");
    setDialogOpen(true);
  }

  async function handleConfirmedDecision() {
    setProcessing(dialogApprovalId);
    setDialogOpen(false);
    try {
      const res = await fetch(`/api/approvals/${dialogApprovalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: dialogAction,
          comment: dialogComment.trim() || null,
        }),
      });
      if (res.ok) {
        await fetchApprovals();
      }
    } catch {
      // silent
    } finally {
      setProcessing(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
            <CheckSquare className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Approvals</h1>
            <p className="text-muted-foreground">
              {approvals.length} pending approval
              {approvals.length !== 1 ? "s" : ""} requiring your attention
            </p>
          </div>
        </div>
      </div>

      {approvals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CheckCircle className="h-12 w-12 text-emerald-500/30 mb-4" />
            <p className="text-lg font-medium">No pending approvals</p>
            <p className="text-sm text-muted-foreground mt-1">
              You are all caught up!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {approvals.map((approval) => (
            <Card
              key={approval.id}
              className="hover:shadow-sm transition-shadow"
            >
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/tickets/${approval.ticket.id}`}
                        className="font-mono text-sm text-muted-foreground hover:underline"
                      >
                        {approval.ticket.ticketNumber}
                      </Link>
                      {approval.ticket.formType && (
                        <Badge variant="outline" className="capitalize text-xs">
                          {approval.ticket.formType.replace(/-/g, " ")}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={
                          PRIORITY_COLORS[
                            approval.ticket.priority as TicketPriority
                          ] || ""
                        }
                      >
                        {PRIORITY_LABELS[
                          approval.ticket.priority as TicketPriority
                        ] || approval.ticket.priority}
                      </Badge>
                    </div>
                    <Link
                      href={`/tickets/${approval.ticket.id}`}
                      className="text-lg font-semibold hover:underline block truncate"
                    >
                      {approval.ticket.title}
                    </Link>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                      <span>
                        Requested by{" "}
                        <strong>
                          {approval.ticket.requester?.name || "Unknown"}
                        </strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Submitted {timeAgo(approval.createdAt)}
                      </span>
                      {approval.dueAt && (
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Due {formatDate(approval.dueAt)}
                        </span>
                      )}
                      {approval.approverRole && (
                        <span>
                          Your role:{" "}
                          <strong className="capitalize">
                            {approval.approverRole}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() =>
                        openConfirmDialog(approval.id, "approved")
                      }
                      disabled={processing === approval.id}
                    >
                      {processing === approval.id ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      )}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        openConfirmDialog(approval.id, "rejected")
                      }
                      disabled={processing === approval.id}
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        openConfirmDialog(approval.id, "more_info")
                      }
                      disabled={processing === approval.id}
                    >
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Request Info
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === "approved"
                ? "Confirm Approval"
                : dialogAction === "rejected"
                  ? "Confirm Rejection"
                  : "Request More Information"}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === "approved"
                ? "Are you sure you want to approve this request? This action cannot be undone."
                : dialogAction === "rejected"
                  ? "Are you sure you want to reject this request? This action cannot be undone."
                  : "Request additional information from the requester before making a decision."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Comment (optional)</Label>
            <Textarea
              placeholder="Add a comment or reason..."
              value={dialogComment}
              onChange={(e) => setDialogComment(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={
                dialogAction === "rejected" ? "destructive" : "default"
              }
              onClick={handleConfirmedDecision}
            >
              {dialogAction === "approved"
                ? "Approve"
                : dialogAction === "rejected"
                  ? "Reject"
                  : "Request Info"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
