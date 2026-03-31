export const TICKET_STATUSES = [
  "new",
  "triaged",
  "in_progress",
  "pending_approval",
  "pending_info",
  "pending_vendor",
  "resolved",
  "closed",
  "cancelled",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ["critical", "high", "medium", "low"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_SOURCES = ["portal", "slack", "api", "email"] as const;
export type TicketSource = (typeof TICKET_SOURCES)[number];

export const USER_ROLES = [
  "end_user",
  "it_agent",
  "it_lead",
  "it_admin",
  "approver",
  "hr",
  "security",
  "auditor",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const APPROVAL_DECISIONS = [
  "approved",
  "rejected",
  "more_info",
] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

export const WORKFLOW_TASK_TYPES = [
  "approval",
  "manual",
  "automated",
  "notification",
] as const;

export const WORKFLOW_TASK_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "failed",
  "skipped",
  "cancelled",
] as const;

export const STATUS_LABELS: Record<TicketStatus, string> = {
  new: "New",
  triaged: "Triaged",
  in_progress: "In Progress",
  pending_approval: "Pending Approval",
  pending_info: "Pending Info",
  pending_vendor: "Pending Vendor",
  resolved: "Resolved",
  closed: "Closed",
  cancelled: "Cancelled",
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-green-100 text-green-800 border-green-200",
};

export const STATUS_COLORS: Record<TicketStatus, string> = {
  new: "bg-blue-100 text-blue-800 border-blue-200",
  triaged: "bg-indigo-100 text-indigo-800 border-indigo-200",
  in_progress: "bg-purple-100 text-purple-800 border-purple-200",
  pending_approval: "bg-amber-100 text-amber-800 border-amber-200",
  pending_info: "bg-amber-100 text-amber-800 border-amber-200",
  pending_vendor: "bg-amber-100 text-amber-800 border-amber-200",
  resolved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  closed: "bg-gray-100 text-gray-800 border-gray-200",
  cancelled: "bg-gray-100 text-gray-500 border-gray-200",
};

export const SERVICE_CATALOG = [
  {
    id: "identity-access",
    name: "Identity & Access",
    icon: "Shield",
    items: [
      { slug: "employee-onboarding", name: "Employee Onboarding", form: true },
      { slug: "employee-offboarding", name: "Employee Offboarding", form: true },
      { slug: "grant-access", name: "Grant Access Request", form: true },
      { slug: "revoke-access", name: "Revoke Access Request", form: true },
      { slug: "password-reset", name: "Password Reset / Account Unlock" },
      { slug: "mfa-reset", name: "MFA Reset" },
      { slug: "service-account", name: "Service Account Request", form: true },
    ],
  },
  {
    id: "microsoft-azure",
    name: "Microsoft 365 & Azure",
    icon: "Cloud",
    items: [
      { slug: "azure-change", name: "Azure / Entra ID Change", form: true },
      { slug: "m365-license", name: "M365 License Assignment" },
      { slug: "shared-mailbox", name: "Shared Mailbox / Distribution List" },
      { slug: "teams-sharepoint", name: "Teams / SharePoint Request" },
    ],
  },
  {
    id: "aws",
    name: "AWS",
    icon: "Server",
    items: [
      { slug: "aws-iam", name: "AWS IAM Role / Policy Change", form: true },
      { slug: "aws-account-access", name: "AWS Account Access Request", form: true },
      { slug: "aws-vpn", name: "AWS VPN Access" },
    ],
  },
  {
    id: "network-security",
    name: "Network & Security",
    icon: "Lock",
    items: [
      { slug: "network-change", name: "Network Change Request", form: true },
      { slug: "firewall-change", name: "Firewall Rule Change", form: true },
      { slug: "vpn-request", name: "VPN Access Request" },
      { slug: "dns-change", name: "DNS Change Request" },
      { slug: "security-tool", name: "Security Tool Provisioning" },
    ],
  },
  {
    id: "hardware",
    name: "Hardware & Devices",
    icon: "Monitor",
    items: [
      { slug: "new-employee-kit", name: "New Employee Kit", form: true },
      { slug: "hardware-purchase", name: "Hardware Purchase Request" },
      { slug: "device-replacement", name: "Device Replacement / Repair" },
      { slug: "peripheral-request", name: "Peripheral Request" },
      { slug: "device-return", name: "Device Return / Decommission" },
    ],
  },
  {
    id: "software",
    name: "Software & Applications",
    icon: "Package",
    items: [
      { slug: "software-install", name: "Software Installation Request" },
      { slug: "app-access", name: "Application Access Request" },
      { slug: "license-request", name: "License Request" },
    ],
  },
  {
    id: "general-it",
    name: "General IT Support",
    icon: "Wrench",
    items: [
      { slug: "troubleshooting", name: "Troubleshooting / Break-Fix" },
      { slug: "how-to", name: "How-To / Guidance" },
      { slug: "performance-issue", name: "Performance Issue" },
      { slug: "other", name: "Other / Miscellaneous" },
    ],
  },
  {
    id: "hr-it",
    name: "HR-IT",
    icon: "Users",
    items: [
      { slug: "department-transfer", name: "Department Transfer" },
      { slug: "job-title-change", name: "Job Title Change" },
      { slug: "name-change", name: "Name Change" },
    ],
  },
] as const;

export const DEFAULT_SLA: Record<
  TicketPriority,
  { responseMinutes: number; resolutionMinutes: number }
> = {
  critical: { responseMinutes: 15, resolutionMinutes: 240 },
  high: { responseMinutes: 60, resolutionMinutes: 480 },
  medium: { responseMinutes: 240, resolutionMinutes: 1440 * 3 },
  low: { responseMinutes: 480, resolutionMinutes: 1440 * 5 },
};
