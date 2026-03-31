import { graphRequest } from "./graph-client";

export interface OrgMember {
  id: string;
  displayName: string;
  email: string;
  jobTitle: string | null;
  department: string | null;
}

/**
 * Get the direct manager of a user from Microsoft Entra ID.
 * Returns null if no manager is set.
 */
export async function getManager(
  userEmail: string,
  tenantId?: string
): Promise<OrgMember | null> {
  try {
    const user = (await graphRequest(
      "GET",
      `/users/${encodeURIComponent(userEmail)}/manager?$select=id,displayName,mail,userPrincipalName,jobTitle,department`,
      null,
      tenantId
    )) as any;

    if (user && !user.error) {
      return {
        id: user.id,
        displayName: user.displayName,
        email: user.mail || user.userPrincipalName,
        jobTitle: user.jobTitle || null,
        department: user.department || null,
      };
    }
  } catch {
    // No manager set or user not found
  }
  return null;
}

/**
 * Get direct reports of a user from Microsoft Entra ID.
 */
export async function getDirectReports(
  userEmail: string,
  tenantId?: string
): Promise<OrgMember[]> {
  try {
    const result = (await graphRequest(
      "GET",
      `/users/${encodeURIComponent(userEmail)}/directReports?$select=id,displayName,mail,userPrincipalName,jobTitle,department`,
      null,
      tenantId
    )) as any;

    if (result?.value) {
      return result.value.map((u: any) => ({
        id: u.id,
        displayName: u.displayName,
        email: u.mail || u.userPrincipalName,
        jobTitle: u.jobTitle || null,
        department: u.department || null,
      }));
    }
  } catch {
    // Failed to fetch
  }
  return [];
}

/**
 * Check if approverEmail is the direct manager of requesterEmail.
 */
export async function isManagerOf(
  approverEmail: string,
  requesterEmail: string,
  tenantId?: string
): Promise<boolean> {
  const manager = await getManager(requesterEmail, tenantId);
  if (!manager) return false;
  return manager.email.toLowerCase() === approverEmail.toLowerCase();
}

/**
 * Get the CISO for security-related approvals.
 * Looks for a user with "CISO" or "Chief Information Security Officer" job title,
 * or falls back to Benny Dana (known CISO).
 */
export async function getCISO(tenantId?: string): Promise<OrgMember | null> {
  try {
    // Search for CISO by job title
    const result = (await graphRequest(
      "GET",
      `/users?$filter=startswith(jobTitle,'CISO') or startswith(jobTitle,'Ciso')&$select=id,displayName,mail,userPrincipalName,jobTitle,department&$top=1`,
      null,
      tenantId
    )) as any;

    if (result?.value?.length > 0) {
      const u = result.value[0];
      return {
        id: u.id,
        displayName: u.displayName,
        email: u.mail || u.userPrincipalName,
        jobTitle: u.jobTitle || null,
        department: u.department || null,
      };
    }

    // Fallback: known CISO
    const benny = (await graphRequest(
      "GET",
      `/users/Benny.D@zimark.io?$select=id,displayName,mail,userPrincipalName,jobTitle,department`,
      null,
      tenantId
    )) as any;
    if (benny && !benny.error) {
      return {
        id: benny.id,
        displayName: benny.displayName,
        email: benny.mail || benny.userPrincipalName,
        jobTitle: benny.jobTitle || null,
        department: benny.department || null,
      };
    }
  } catch {
    // Failed
  }
  return null;
}

/**
 * Determine required approvers for a ticket based on type.
 * Returns array of { email, role } for each required approver.
 */
export async function getRequiredApprovers(
  requesterEmail: string,
  requestType: string,
  tenantId?: string
): Promise<Array<{ email: string; name: string; role: string }>> {
  const approvers: Array<{ email: string; name: string; role: string }> = [];

  // Manager approval for most request types
  const managerRequired = [
    "employee-onboarding",
    "employee-offboarding",
    "grant-access",
    "aws-iam",
    "aws-account-access",
    "hardware-purchase",
    "new-employee-kit",
    "software-install",
    "license-request",
  ];

  if (managerRequired.includes(requestType)) {
    const manager = await getManager(requesterEmail, tenantId);
    if (manager) {
      approvers.push({
        email: manager.email,
        name: manager.displayName,
        role: "manager",
      });
    }
  }

  // CISO approval for security-related requests
  const cisoRequired = [
    "firewall-change",
    "network-change",
    "aws-iam",
    "azure-change",
    "security-tool",
    "vpn-request",
  ];

  if (cisoRequired.includes(requestType)) {
    const ciso = await getCISO(tenantId);
    if (ciso) {
      // Don't add CISO if they're the requester
      if (ciso.email.toLowerCase() !== requesterEmail.toLowerCase()) {
        approvers.push({
          email: ciso.email,
          name: ciso.displayName,
          role: "ciso",
        });
      }
    }
  }

  return approvers;
}
