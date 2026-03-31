import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";
import { graphRequest } from "./graph-client";

// ─── Types ─────────────────────────────────────────────────────────────────
export interface OffboardingStep {
  step: string;
  success: boolean;
  details: Record<string, unknown>;
  error?: string;
}

export interface OffboardingResult {
  success: boolean;
  steps: OffboardingStep[];
  disabledAt?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
async function logAuditStep(
  step: string,
  ticketId: string,
  actorId: string,
  details: Record<string, unknown>
) {
  try {
    await db.insert(auditLog).values({
      eventType: `automation.offboarding.${step}`,
      entityType: "ticket",
      entityId: ticketId,
      actorId,
      actorType: "automation",
      action: step,
      details,
    });
  } catch (err) {
    console.error(`Failed to write audit log for offboarding.${step}:`, err);
  }
}

// ─── Main Execution ────────────────────────────────────────────────────────
export async function executeOffboarding(
  ticketId: string,
  formData: Record<string, unknown>,
  actorId: string,
  tenantId?: string
): Promise<OffboardingResult> {
  const steps: OffboardingStep[] = [];
  let graphUserId: string | undefined;
  let disabledAt: string | undefined;

  const companyEmail = (formData.company_email as string) || "";

  // ── Step 1: Look up user ─────────────────────────────────────────────────
  try {
    const lookupResponse = (await graphRequest(
      "GET",
      `/users?$filter=userPrincipalName eq '${companyEmail}'&$select=id,displayName,userPrincipalName,accountEnabled`,
      null,
      tenantId
    )) as { value: Array<Record<string, unknown>> };

    const foundUsers = lookupResponse.value || [];

    if (foundUsers.length === 0) {
      steps.push({
        step: "lookup_user",
        success: false,
        details: { companyEmail },
        error: `User not found with UPN: ${companyEmail}`,
      });
      await logAuditStep("lookup_user", ticketId, actorId, {
        companyEmail,
        error: "User not found",
      });
      // Cannot continue without a user
      return { success: false, steps };
    }

    graphUserId = foundUsers[0].id as string;
    const displayName = foundUsers[0].displayName as string;

    steps.push({
      step: "lookup_user",
      success: true,
      details: { graphUserId, displayName, companyEmail },
    });

    await logAuditStep("lookup_user", ticketId, actorId, {
      companyEmail,
      graphUserId,
      displayName,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    steps.push({
      step: "lookup_user",
      success: false,
      details: { companyEmail },
      error,
    });
    await logAuditStep("lookup_user", ticketId, actorId, {
      companyEmail,
      error,
    });
    return { success: false, steps };
  }

  // ── Step 2: Disable account ──────────────────────────────────────────────
  try {
    await graphRequest(
      "PATCH",
      `/users/${graphUserId}`,
      { accountEnabled: false },
      tenantId
    );

    disabledAt = new Date().toISOString();

    steps.push({
      step: "disable_account",
      success: true,
      details: { graphUserId, disabledAt },
    });

    await logAuditStep("disable_account", ticketId, actorId, {
      graphUserId,
      disabledAt,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    steps.push({
      step: "disable_account",
      success: false,
      details: { graphUserId },
      error,
    });
    await logAuditStep("disable_account", ticketId, actorId, {
      graphUserId,
      error,
    });
  }

  // ── Step 3: Revoke all sessions ──────────────────────────────────────────
  try {
    await graphRequest(
      "POST",
      `/users/${graphUserId}/revokeSignInSessions`,
      null,
      tenantId,
      { "Content-Length": "0" }
    );

    steps.push({
      step: "revoke_sessions",
      success: true,
      details: { graphUserId },
    });

    await logAuditStep("revoke_sessions", ticketId, actorId, { graphUserId });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    steps.push({
      step: "revoke_sessions",
      success: false,
      details: { graphUserId },
      error,
    });
    await logAuditStep("revoke_sessions", ticketId, actorId, {
      graphUserId,
      error,
    });
  }

  // ── Step 4 & 5: Get licenses and remove them ────────────────────────────
  let licenseSkuIds: string[] = [];
  try {
    const licenseResponse = (await graphRequest(
      "GET",
      `/users/${graphUserId}/licenseDetails`,
      null,
      tenantId
    )) as { value: Array<Record<string, unknown>> };

    const licenses = licenseResponse.value || [];
    licenseSkuIds = licenses.map((l) => l.skuId as string);
    const licenseNames = licenses.map((l) => l.skuPartNumber as string);

    steps.push({
      step: "get_licenses",
      success: true,
      details: { count: licenses.length, licenseNames },
    });

    await logAuditStep("get_licenses", ticketId, actorId, {
      graphUserId,
      count: licenses.length,
      licenseNames,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    steps.push({
      step: "get_licenses",
      success: false,
      details: { graphUserId },
      error,
    });
    await logAuditStep("get_licenses", ticketId, actorId, {
      graphUserId,
      error,
    });
  }

  // Remove licenses
  if (licenseSkuIds.length > 0) {
    try {
      await graphRequest(
        "POST",
        `/users/${graphUserId}/assignLicense`,
        {
          addLicenses: [],
          removeLicenses: licenseSkuIds,
        },
        tenantId
      );

      steps.push({
        step: "remove_licenses",
        success: true,
        details: { removedCount: licenseSkuIds.length, skuIds: licenseSkuIds },
      });

      await logAuditStep("remove_licenses", ticketId, actorId, {
        graphUserId,
        removedCount: licenseSkuIds.length,
        skuIds: licenseSkuIds,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      steps.push({
        step: "remove_licenses",
        success: false,
        details: { graphUserId, skuIds: licenseSkuIds },
        error,
      });
      await logAuditStep("remove_licenses", ticketId, actorId, {
        graphUserId,
        error,
      });
    }
  } else {
    steps.push({
      step: "remove_licenses",
      success: true,
      details: { message: "No licenses to remove" },
    });
  }

  // ── Step 6 & 7: Get group memberships and remove from all groups ────────
  let groupMemberships: Array<{ id: string; displayName: string }> = [];
  try {
    const memberOfResponse = (await graphRequest(
      "GET",
      `/users/${graphUserId}/memberOf?$select=id,displayName,@odata.type`,
      null,
      tenantId
    )) as { value: Array<Record<string, unknown>> };

    const memberships = memberOfResponse.value || [];
    // Only process groups (not roles or other directory objects)
    groupMemberships = memberships
      .filter(
        (m) => (m["@odata.type"] as string) === "#microsoft.graph.group"
      )
      .map((m) => ({
        id: m.id as string,
        displayName: m.displayName as string,
      }));

    steps.push({
      step: "get_group_memberships",
      success: true,
      details: {
        groupCount: groupMemberships.length,
        groups: groupMemberships.map((g) => g.displayName),
      },
    });

    await logAuditStep("get_group_memberships", ticketId, actorId, {
      graphUserId,
      groupCount: groupMemberships.length,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    steps.push({
      step: "get_group_memberships",
      success: false,
      details: { graphUserId },
      error,
    });
    await logAuditStep("get_group_memberships", ticketId, actorId, {
      graphUserId,
      error,
    });
  }

  // Remove from all groups
  if (groupMemberships.length > 0) {
    const removeResults: Array<{
      groupId: string;
      groupName: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const group of groupMemberships) {
      try {
        await graphRequest(
          "DELETE",
          `/groups/${group.id}/members/${graphUserId}/$ref`,
          null,
          tenantId
        );
        removeResults.push({
          groupId: group.id,
          groupName: group.displayName,
          success: true,
        });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        removeResults.push({
          groupId: group.id,
          groupName: group.displayName,
          success: false,
          error,
        });
      }
    }

    const allRemoved = removeResults.every((r) => r.success);
    steps.push({
      step: "remove_from_groups",
      success: allRemoved,
      details: {
        attempted: groupMemberships.length,
        succeeded: removeResults.filter((r) => r.success).length,
        failed: removeResults.filter((r) => !r.success).length,
        results: removeResults,
      },
      error: allRemoved
        ? undefined
        : `Failed to remove from ${removeResults.filter((r) => !r.success).length} group(s)`,
    });

    await logAuditStep("remove_from_groups", ticketId, actorId, {
      graphUserId,
      attempted: groupMemberships.length,
      succeeded: removeResults.filter((r) => r.success).length,
    });
  } else {
    steps.push({
      step: "remove_from_groups",
      success: true,
      details: { message: "No group memberships to remove" },
    });
  }

  const allSucceeded = steps.every((s) => s.success);

  return {
    success: allSucceeded,
    steps,
    disabledAt,
  };
}
