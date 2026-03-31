"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  GitBranch,
  Shield,
  UserCheck,
  Info,
  ArrowRight,
  Building2,
} from "lucide-react";
import Link from "next/link";

interface WorkflowRule {
  requestType: string;
  requiredApprovals: string;
  notes: string;
  category: "identity" | "security" | "cloud" | "hardware" | "software";
}

const workflowRules: WorkflowRule[] = [
  {
    requestType: "Employee Onboarding",
    requiredApprovals: "Direct Manager",
    notes: "Auto-detected from Entra ID",
    category: "identity",
  },
  {
    requestType: "Employee Offboarding",
    requiredApprovals: "Direct Manager",
    notes: "Auto-detected from Entra ID",
    category: "identity",
  },
  {
    requestType: "Access Requests",
    requiredApprovals: "Direct Manager",
    notes: "Auto-detected from Entra ID",
    category: "identity",
  },
  {
    requestType: "Firewall Change",
    requiredApprovals: "CISO (Benny Dana)",
    notes: "Security review required",
    category: "security",
  },
  {
    requestType: "Network Change",
    requiredApprovals: "CISO (Benny Dana)",
    notes: "Security review required",
    category: "security",
  },
  {
    requestType: "AWS IAM / Azure Change",
    requiredApprovals: "Direct Manager + CISO",
    notes: "Dual approval required",
    category: "cloud",
  },
  {
    requestType: "Hardware Purchase",
    requiredApprovals: "Direct Manager",
    notes: "Budget approval",
    category: "hardware",
  },
  {
    requestType: "Software Install",
    requiredApprovals: "Direct Manager",
    notes: "License approval",
    category: "software",
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  identity: "bg-blue-100 text-blue-800 border-blue-200",
  security: "bg-red-100 text-red-800 border-red-200",
  cloud: "bg-purple-100 text-purple-800 border-purple-200",
  hardware: "bg-amber-100 text-amber-800 border-amber-200",
  software: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const CATEGORY_LABELS: Record<string, string> = {
  identity: "Identity & Access",
  security: "Network & Security",
  cloud: "Cloud Infrastructure",
  hardware: "Hardware",
  software: "Software",
};

export default function WorkflowsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <GitBranch className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Approval Workflows
            </h1>
            <p className="text-muted-foreground">
              Transparency into who approves what and how the process works
            </p>
          </div>
        </div>
      </div>

      {/* Workflow Rules Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Approval Requirements by Request Type
          </CardTitle>
          <CardDescription>
            Each request type has specific approval requirements. Approvals are
            automatically routed to the right people.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Request Type
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Required Approvals
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {workflowRules.map((rule) => (
                  <tr
                    key={rule.requestType}
                    className="border-b last:border-0 hover:bg-accent/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">
                      {rule.requestType}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={CATEGORY_COLORS[rule.category] || ""}
                      >
                        {CATEGORY_LABELS[rule.category] || rule.category}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {rule.requiredApprovals.includes("+") ? (
                          rule.requiredApprovals.split(" + ").map((approver, i) => (
                            <span key={i} className="flex items-center gap-1">
                              {i > 0 && (
                                <span className="text-muted-foreground">+</span>
                              )}
                              <Badge variant="secondary">{approver}</Badge>
                            </span>
                          ))
                        ) : (
                          <Badge variant="secondary">
                            {rule.requiredApprovals}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {rule.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-blue-600" />
              Manager Detection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Your manager is auto-detected from the Microsoft organizational
              chart via Entra ID. This ensures approval requests are
              automatically routed to the correct person without manual
              configuration.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-red-600" />
              Security Reviews
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Security-sensitive requests (firewall changes, network changes,
              cloud IAM modifications) require CISO approval. These undergo
              additional security review to protect organizational
              infrastructure.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4 text-emerald-600" />
              Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              You can view and act on your pending approvals from the approvals
              page. Approvers are notified via email and Slack when a new
              request needs their attention.
            </p>
            <Link
              href="/approvals"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              View your pending approvals
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            How the Approval Process Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                1
              </span>
              <span>
                <strong className="text-foreground">Submit a request</strong>{" "}
                -- Create a ticket through the service catalog or directly.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                2
              </span>
              <span>
                <strong className="text-foreground">
                  Approvers are assigned automatically
                </strong>{" "}
                -- Based on the request type, the system routes the approval to
                the right people (your manager, the CISO, or both).
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                3
              </span>
              <span>
                <strong className="text-foreground">
                  Approvers review and decide
                </strong>{" "}
                -- Approvers can approve, reject, or request more information.
                Notifications are sent via email and Slack.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                4
              </span>
              <span>
                <strong className="text-foreground">
                  Ticket proceeds or is returned
                </strong>{" "}
                -- Once all required approvals are granted, the ticket moves
                forward. If rejected, you are notified with the reason.
              </span>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
