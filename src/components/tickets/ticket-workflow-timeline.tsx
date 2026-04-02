"use client";

import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_LABELS, type TicketStatus } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { CheckCircle2, Circle, CircleDot, XCircle } from "lucide-react";

type ApprovalLite = {
  id: string;
  status: string;
  decision: string | null;
  approver: { name: string; email: string };
  approverRole: string | null;
};

interface TicketWorkflowTimelineProps {
  status: string;
  createdAt: string;
  approvals: ApprovalLite[];
}

type StepState = "done" | "current" | "upcoming" | "skipped" | "blocked";

function stepRow(
  state: StepState,
  title: string,
  detail: string | null | undefined,
  showConnector: boolean
): ReactNode {
  const icon =
    state === "done" ? (
      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
    ) : state === "current" ? (
      <CircleDot className="h-5 w-5 text-amber-600 shrink-0" />
    ) : state === "blocked" ? (
      <XCircle className="h-5 w-5 text-destructive shrink-0" />
    ) : state === "skipped" ? (
      <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
    ) : (
      <Circle className="h-5 w-5 text-muted-foreground/35 shrink-0" />
    );

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center pt-0.5">
        {icon}
        {showConnector ? (
          <div className="w-px flex-1 min-h-[12px] bg-border mt-1" aria-hidden />
        ) : null}
      </div>
      <div className="pb-4 min-w-0">
        <p
          className={`text-sm font-medium ${
            state === "upcoming" || state === "skipped"
              ? "text-muted-foreground"
              : ""
          }`}
        >
          {title}
          {state === "skipped" && (
            <span className="font-normal text-muted-foreground"> — N/A</span>
          )}
        </p>
        {detail ? (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function TicketWorkflowTimeline({
  status,
  createdAt,
  approvals,
}: TicketWorkflowTimelineProps) {
  const terminal = ["resolved", "closed", "cancelled"].includes(status);
  const needsApproval =
    approvals.length > 0 || status === "pending_approval";
  const pendingList = approvals.filter((a) => a.status === "pending");
  const anyRejected = approvals.some(
    (a) => a.decision === "rejected" || a.status === "rejected"
  );
  const approvalComplete =
    needsApproval &&
    pendingList.length === 0 &&
    approvals.length > 0 &&
    !anyRejected;

  let stepApproval: StepState;
  let approvalDetail: string | null = null;

  if (!needsApproval) {
    stepApproval = "skipped";
  } else if (anyRejected || status === "cancelled") {
    stepApproval = "blocked";
    approvalDetail =
      anyRejected
        ? "This request was not approved. The ticket may be closed or cancelled."
        : null;
  } else if (pendingList.length > 0) {
    stepApproval = "current";
    const names = pendingList
      .map(
        (a) =>
          `${a.approver.name}${a.approverRole ? ` (${a.approverRole})` : ""}`
      )
      .join(", ");
    approvalDetail = `Waiting for: ${names}. They were notified by email (if mail is configured).`;
  } else if (status === "pending_approval" && approvals.length === 0) {
    stepApproval = "current";
    approvalDetail =
      "IT is routing this request to the right approver. You will see their name here once assigned.";
  } else if (approvalComplete || !["pending_approval"].includes(status)) {
    stepApproval = "done";
    approvalDetail = "All required approvals are in place.";
  } else {
    stepApproval = "current";
    approvalDetail = "Awaiting approval.";
  }

  const itActiveStatuses = [
    "new",
    "triaged",
    "in_progress",
    "pending_info",
    "pending_vendor",
  ];
  let stepIt: StepState;
  let itDetail: string | null = null;

  if (terminal && status !== "cancelled") {
    stepIt = "done";
    itDetail = `Last update: ${STATUS_LABELS[status as TicketStatus] || status}`;
  } else if (status === "cancelled") {
    stepIt = "blocked";
    itDetail = "This request was cancelled.";
  } else if (status === "pending_approval" || pendingList.length > 0) {
    stepIt = "upcoming";
    itDetail = "IT will start work after approval.";
  } else if (itActiveStatuses.includes(status)) {
    stepIt = "current";
    itDetail =
      STATUS_LABELS[status as TicketStatus] ||
      "The IT team is handling your request.";
  } else if (status === "resolved") {
    stepIt = "done";
  } else {
    stepIt = "current";
  }

  let stepDone: StepState;
  let doneDetail: string | null = null;
  if (status === "resolved" || status === "closed") {
    stepDone = "done";
    doneDetail =
      status === "closed"
        ? "Ticket closed."
        : "Marked resolved — you can reopen within 24 hours if something is still wrong.";
  } else if (status === "cancelled") {
    stepDone = "blocked";
    doneDetail = "No further action.";
  } else {
    stepDone = "upcoming";
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Where your request is</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-4">
          Submitted {formatDateTime(createdAt)}
        </p>
        <div className="-mt-1">
          {stepRow(
            "done",
            "Request received",
            "Your ticket is in the IT system.",
            true
          )}
          {stepRow(stepApproval, "Approval", approvalDetail, true)}
          {stepRow(stepIt, "Work in progress", itDetail, true)}
          {stepRow(stepDone, "Finished", doneDetail, false)}
        </div>
      </CardContent>
    </Card>
  );
}
