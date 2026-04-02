import type { WorkflowUiCategory } from "@/lib/workflow-approval-defaults";

export type MergedWorkflowApprovalRow = {
  categorySlug: string;
  requestTypeLabel: string;
  uiCategory: WorkflowUiCategory;
  includeEntraManager: boolean;
  includeEntraCiso: boolean;
  designatedApprovers: Array<{ email: string; name?: string; roleLabel?: string }>;
  notes: string;
};
