import { CATEGORY_SLUGS_REQUIRING_APPROVAL } from "@/lib/constants";

export type WorkflowUiCategory =
  | "identity"
  | "security"
  | "cloud"
  | "hardware"
  | "software";

export interface WorkflowApprovalRegistryEntry {
  categorySlug: string;
  requestTypeLabel: string;
  uiCategory: WorkflowUiCategory;
  defaultIncludeEntraManager: boolean;
  defaultIncludeEntraCiso: boolean;
  defaultNotes: string;
}

/** Default routing before any DB overrides. */
const REGISTRY_BY_SLUG: Record<string, Omit<WorkflowApprovalRegistryEntry, "categorySlug">> = {
  "grant-access": {
    requestTypeLabel: "Grant access",
    uiCategory: "identity",
    defaultIncludeEntraManager: true,
    defaultIncludeEntraCiso: false,
    defaultNotes:
      "Requester's direct manager is resolved from Entra. Add designated people for app owners or second-line approval if needed.",
  },
  "revoke-access": {
    requestTypeLabel: "Revoke access",
    uiCategory: "identity",
    defaultIncludeEntraManager: true,
    defaultIncludeEntraCiso: false,
    defaultNotes:
      "Manager from Entra by default; add designated approvers when revocation must be signed off by a specific role.",
  },
  "aws-iam": {
    requestTypeLabel: "AWS IAM / account access",
    uiCategory: "cloud",
    defaultIncludeEntraManager: true,
    defaultIncludeEntraCiso: true,
    defaultNotes:
      "Dual path: requester's manager plus CISO (Entra). New tickets go to the DevOps queue and round-robin to the DevOps team.",
  },
  "aws-account-access": {
    requestTypeLabel: "AWS account access",
    uiCategory: "cloud",
    defaultIncludeEntraManager: true,
    defaultIncludeEntraCiso: false,
    defaultNotes:
      "Manager from Entra by default. Routed to the DevOps queue for Nico/Dijar; enable CISO or add designated approvers if policy requires.",
  },
  "firewall-change": {
    requestTypeLabel: "Firewall change",
    uiCategory: "security",
    defaultIncludeEntraManager: false,
    defaultIncludeEntraCiso: true,
    defaultNotes: "CISO (or Entra CISO role lookup) by default. Add designated network/security owners as needed.",
  },
  "network-change": {
    requestTypeLabel: "Network change",
    uiCategory: "security",
    defaultIncludeEntraManager: false,
    defaultIncludeEntraCiso: true,
    defaultNotes: "CISO review by default; add designated approvers for change advisory or infrastructure leads.",
  },
  "azure-change": {
    requestTypeLabel: "Azure change",
    uiCategory: "cloud",
    defaultIncludeEntraManager: false,
    defaultIncludeEntraCiso: true,
    defaultNotes:
      "CISO path by default. Tickets are placed in the DevOps queue for the cloud team; add named approvers or enable manager as needed.",
  },
  "hardware-purchase": {
    requestTypeLabel: "Hardware purchase",
    uiCategory: "hardware",
    defaultIncludeEntraManager: true,
    defaultIncludeEntraCiso: false,
    defaultNotes: "Budget sign-off: requester's manager from Entra unless you replace with designated finance/procurement contacts.",
  },
  "new-employee-kit": {
    requestTypeLabel: "New employee kit",
    uiCategory: "hardware",
    defaultIncludeEntraManager: true,
    defaultIncludeEntraCiso: false,
    defaultNotes:
      "Usually the hiring manager (Entra) requests kit for their hire. Switch off Entra manager and use only designated approvers if HR always submits.",
  },
  "security-tool": {
    requestTypeLabel: "Security tool",
    uiCategory: "security",
    defaultIncludeEntraManager: false,
    defaultIncludeEntraCiso: true,
    defaultNotes: "Security review via CISO lookup; add tool owners as designated approvers.",
  },
  "software-install": {
    requestTypeLabel: "Software installation",
    uiCategory: "software",
    defaultIncludeEntraManager: true,
    defaultIncludeEntraCiso: false,
    defaultNotes: "Requester's manager approves license / appropriateness; add app owner emails if required.",
  },
  "license-request": {
    requestTypeLabel: "License request",
    uiCategory: "software",
    defaultIncludeEntraManager: true,
    defaultIncludeEntraCiso: false,
    defaultNotes: "Manager from Entra by default; add procurement or license admin as designated approvers.",
  },
};

function assertFullRegistry(): void {
  for (const slug of CATEGORY_SLUGS_REQUIRING_APPROVAL) {
    if (!REGISTRY_BY_SLUG[slug]) {
      throw new Error(`Missing workflow registry entry for category slug: ${slug}`);
    }
  }
}

assertFullRegistry();

export const WORKFLOW_APPROVAL_REGISTRY: WorkflowApprovalRegistryEntry[] =
  CATEGORY_SLUGS_REQUIRING_APPROVAL.map((slug) => ({
    categorySlug: slug,
    ...REGISTRY_BY_SLUG[slug],
  }));

export function workflowRegistryEntry(
  categorySlug: string
): WorkflowApprovalRegistryEntry | undefined {
  return WORKFLOW_APPROVAL_REGISTRY.find((r) => r.categorySlug === categorySlug);
}
