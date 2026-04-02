import { db } from "@/lib/db";
import { workflowApprovalConfigs } from "@/lib/db/schema";
import { WORKFLOW_APPROVAL_REGISTRY } from "@/lib/workflow-approval-defaults";
import type { WorkflowUiCategory } from "@/lib/workflow-approval-defaults";
import type { MergedWorkflowApprovalRow } from "@/lib/workflow-approval-types";

export type { MergedWorkflowApprovalRow };

async function loadWorkflowApprovalConfigRows(): Promise<
  (typeof workflowApprovalConfigs.$inferSelect)[]
> {
  try {
    return await db.select().from(workflowApprovalConfigs);
  } catch (err) {
    console.error(
      "[workflow] workflow_approval_configs query failed — table missing? Run `npm run db:push` against this database:",
      err
    );
    return [];
  }
}

export async function getMergedWorkflowApprovalConfigs(): Promise<
  MergedWorkflowApprovalRow[]
> {
  const rows = await loadWorkflowApprovalConfigRows();
  const bySlug = new Map(rows.map((r) => [r.categorySlug, r]));

  return WORKFLOW_APPROVAL_REGISTRY.map((reg) => {
    const r = bySlug.get(reg.categorySlug);
    return {
      categorySlug: reg.categorySlug,
      requestTypeLabel: r?.requestTypeLabel ?? reg.requestTypeLabel,
      uiCategory: (r?.uiCategory as WorkflowUiCategory) ?? reg.uiCategory,
      includeEntraManager:
        r?.includeEntraManager ?? reg.defaultIncludeEntraManager,
      includeEntraCiso: r?.includeEntraCiso ?? reg.defaultIncludeEntraCiso,
      designatedApprovers: Array.isArray(r?.designatedApprovers)
        ? r.designatedApprovers
        : [],
      notes: (r?.notes ?? reg.defaultNotes) || "",
    };
  });
}
