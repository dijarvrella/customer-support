"use client";

import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  GitBranch,
  Shield,
  UserCheck,
  Info,
  ArrowRight,
  Building2,
  Pencil,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import type { MergedWorkflowApprovalRow } from "@/lib/workflow-approval-types";
import type { WorkflowUiCategory } from "@/lib/workflow-approval-defaults";

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

const UI_CATEGORY_OPTIONS: { value: WorkflowUiCategory; label: string }[] = [
  { value: "identity", label: "Identity & Access" },
  { value: "security", label: "Network & Security" },
  { value: "cloud", label: "Cloud Infrastructure" },
  { value: "hardware", label: "Hardware" },
  { value: "software", label: "Software" },
];

function approvalSummaryParts(row: MergedWorkflowApprovalRow): string[] {
  const parts: string[] = [];
  if (row.includeEntraManager) parts.push("Direct manager (Entra)");
  if (row.includeEntraCiso) parts.push("CISO (Entra)");
  for (const d of row.designatedApprovers) {
    const label = d.roleLabel?.trim();
    parts.push(label ? `${label}: ${d.email}` : d.email);
  }
  return parts;
}

type Designated = { email: string; name: string; roleLabel: string };

function rowToDraft(row: MergedWorkflowApprovalRow) {
  return {
    categorySlug: row.categorySlug,
    requestTypeLabel: row.requestTypeLabel,
    uiCategory: row.uiCategory,
    includeEntraManager: row.includeEntraManager,
    includeEntraCiso: row.includeEntraCiso,
    notes: row.notes,
    designatedApprovers: row.designatedApprovers.map((d) => ({
      email: d.email,
      name: d.name ?? "",
      roleLabel: d.roleLabel ?? "",
    })),
  };
}

export default function WorkflowsClient({
  initialRows,
  canEdit,
}: {
  initialRows: MergedWorkflowApprovalRow[];
  canEdit: boolean;
}) {
  const [rows, setRows] = useState(initialRows);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReturnType<typeof rowToDraft> | null>(
    null
  );

  const openEdit = useCallback((row: MergedWorkflowApprovalRow) => {
    setError(null);
    setDraft(rowToDraft(row));
    setDialogOpen(true);
  }, []);

  const addDesignated = useCallback(() => {
    setDraft((d) =>
      d
        ? {
            ...d,
            designatedApprovers: [
              ...d.designatedApprovers,
              { email: "", name: "", roleLabel: "" },
            ],
          }
        : d
    );
  }, []);

  const removeDesignated = useCallback((index: number) => {
    setDraft((d) =>
      d
        ? {
            ...d,
            designatedApprovers: d.designatedApprovers.filter((_, i) => i !== index),
          }
        : d
    );
  }, []);

  const updateDesignated = useCallback(
    (index: number, field: keyof Designated, value: string) => {
      setDraft((d) => {
        if (!d) return d;
        const next = [...d.designatedApprovers];
        next[index] = { ...next[index], [field]: value };
        return { ...d, designatedApprovers: next };
      });
    },
    []
  );

  const save = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/workflows/approval-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categorySlug: draft.categorySlug,
          requestTypeLabel: draft.requestTypeLabel,
          uiCategory: draft.uiCategory,
          includeEntraManager: draft.includeEntraManager,
          includeEntraCiso: draft.includeEntraCiso,
          notes: draft.notes,
          designatedApprovers: draft.designatedApprovers
            .filter((x) => x.email.trim())
            .map((x) => ({
              email: x.email.trim(),
              name: x.name.trim() || undefined,
              roleLabel: x.roleLabel.trim() || undefined,
            })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data.error as string) || "Save failed");
        return;
      }
      if (Array.isArray(data.rows)) {
        setRows(data.rows as MergedWorkflowApprovalRow[]);
      }
      setDialogOpen(false);
      setDraft(null);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }, [draft]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <GitBranch className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Approval workflows
            </h1>
            <p className="text-muted-foreground">
              Who approves each request type, and how routing combines Entra with
              named contacts
            </p>
          </div>
        </div>
      </div>

      <Card className="border-dashed bg-muted/25">
        <CardHeader className="py-4">
          <CardTitle className="text-base">HR onboarding &amp; offboarding</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Those tickets are filed after HR has already run hiring or exit
            approvals. This portal does{" "}
            <span className="font-medium text-foreground">not</span> add another
            automatic approval step for{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              employee-onboarding
            </code>{" "}
            or{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              employee-offboarding
            </code>
            . IT can still use &quot;Request approval&quot; on a specific ticket
            if you ever need a one-off sign-off.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Approval requirements by request type
          </CardTitle>
          <CardDescription>
            Settings here control automatic approval routing for new tickets.
            {canEdit
              ? " IT leads and admins can edit each row."
              : " Contact IT to change approvers."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Request type
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Required approvals
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">
                    Notes
                  </th>
                  {canEdit ? (
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground w-[100px]">
                      Actions
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const parts = approvalSummaryParts(row);
                  return (
                    <tr
                      key={row.categorySlug}
                      className="border-b last:border-0 hover:bg-accent/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium align-top">
                        {row.requestTypeLabel}
                        <div className="mt-1 font-mono text-[11px] text-muted-foreground font-normal">
                          {row.categorySlug}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Badge
                          variant="outline"
                          className={CATEGORY_COLORS[row.uiCategory] || ""}
                        >
                          {CATEGORY_LABELS[row.uiCategory] || row.uiCategory}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {parts.map((p, i) => (
                            <span key={i} className="flex items-center gap-1">
                              {i > 0 && (
                                <span className="text-muted-foreground">+</span>
                              )}
                              <Badge variant="secondary" className="font-normal">
                                {p}
                              </Badge>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell align-top max-w-md">
                        {row.notes}
                      </td>
                      {canEdit ? (
                        <td className="px-4 py-3 text-right align-top">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(row)}
                            className="gap-1"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-blue-600" />
              Entra manager
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              When enabled for a type, the requester&apos;s direct manager is
              looked up from Microsoft Entra. HR-led onboarding and offboarding
              default to designated approvers instead, so tickets are not routed
              to the wrong person.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-red-600" />
              CISO & security
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              When enabled, the CISO is resolved from Entra (job title search)
              with a known fallback. Combine with designated approvers for
              network or change-advisory contacts.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4 text-emerald-600" />
              Pending approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Act on items waiting for your decision. Approvers are notified by
              email when a ticket needs them.
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            How the approval process works
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
                through the service catalog or ticket create flow.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                2
              </span>
              <span>
                <strong className="text-foreground">Approvers are assigned</strong>{" "}
                from this table for types that need it (not HR onboarding or
                offboarding). Entra manager and/or CISO when toggled on, plus
                any designated approvers you configure.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                3
              </span>
              <span>
                <strong className="text-foreground">
                  Approvers review and decide
                </strong>
                — approve, reject, or request more information. IT can still add
                extra approval steps on a ticket when needed.
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
                after required approvals are complete.
              </span>
            </li>
          </ol>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit approval routing</DialogTitle>
            <DialogDescription>
              {draft?.requestTypeLabel} — changes apply to new tickets with this
              category.
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="wf-label">Display name</Label>
                <Input
                  id="wf-label"
                  value={draft.requestTypeLabel}
                  onChange={(e) =>
                    setDraft({ ...draft, requestTypeLabel: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wf-ui-cat">Table group</Label>
                <select
                  id="wf-ui-cat"
                  title="Table group"
                  aria-label="Table group"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={draft.uiCategory}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      uiCategory: e.target.value as WorkflowUiCategory,
                    })
                  }
                >
                  {UI_CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="wf-mgr">Direct manager (Entra)</Label>
                  <p className="text-xs text-muted-foreground">
                    Requester&apos;s manager from the org chart
                  </p>
                </div>
                <Switch
                  id="wf-mgr"
                  checked={draft.includeEntraManager}
                  onCheckedChange={(v) =>
                    setDraft({ ...draft, includeEntraManager: v })
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="wf-ciso">CISO (Entra)</Label>
                  <p className="text-xs text-muted-foreground">
                    Security officer lookup + fallback
                  </p>
                </div>
                <Switch
                  id="wf-ciso"
                  checked={draft.includeEntraCiso}
                  onCheckedChange={(v) =>
                    setDraft({ ...draft, includeEntraCiso: v })
                  }
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Designated approvers</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={addDesignated}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Always notified for this type (in addition to Entra-based
                  approvers). Use for HR leads, app owners, or backup reviewers.
                </p>
                <div className="space-y-3">
                  {draft.designatedApprovers.map((d, i) => (
                    <div
                      key={i}
                      className="rounded-md border p-3 space-y-2 relative"
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1 h-8 w-8 text-muted-foreground"
                        onClick={() => removeDesignated(i)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Input
                        placeholder="email@company.com"
                        value={d.email}
                        onChange={(e) =>
                          updateDesignated(i, "email", e.target.value)
                        }
                        className="pr-10"
                      />
                      <Input
                        placeholder="Display name (optional)"
                        value={d.name}
                        onChange={(e) =>
                          updateDesignated(i, "name", e.target.value)
                        }
                      />
                      <Input
                        placeholder="Label e.g. HR lead (optional)"
                        value={d.roleLabel}
                        onChange={(e) =>
                          updateDesignated(i, "roleLabel", e.target.value)
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wf-notes">Notes (shown on this page)</Label>
                <Textarea
                  id="wf-notes"
                  rows={3}
                  value={draft.notes}
                  onChange={(e) =>
                    setDraft({ ...draft, notes: e.target.value })
                  }
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
