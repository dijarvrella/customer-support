import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";
import { graphRequest } from "./graph-client";
import crypto from "crypto";

// ─── Types ─────────────────────────────────────────────────────────────────
export interface OnboardingStep {
  step: string;
  success: boolean;
  details: Record<string, unknown>;
  error?: string;
}

export interface OnboardingResult {
  success: boolean;
  userId?: string;
  userPrincipalName?: string;
  tempPassword?: string;
  licenseName?: string;
  steps: OnboardingStep[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function generateTempPassword(): string {
  // 16-char password: uppercase, lowercase, digits, special
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const special = "!@#$%&*";
  let password = "";
  const bytes = crypto.randomBytes(16);
  for (let i = 0; i < 14; i++) {
    password += chars[bytes[i] % chars.length];
  }
  // Ensure at least one special char and digit
  password += special[bytes[14] % special.length];
  password += String(bytes[15] % 10);
  return password;
}

async function logAuditStep(
  step: string,
  ticketId: string,
  actorId: string,
  details: Record<string, unknown>
) {
  try {
    await db.insert(auditLog).values({
      eventType: `automation.onboarding.${step}`,
      entityType: "ticket",
      entityId: ticketId,
      actorId,
      actorType: "automation",
      action: step,
      details,
    });
  } catch (err) {
    console.error(`Failed to write audit log for onboarding.${step}:`, err);
  }
}

// ─── License type mapping from form selection to SKU part numbers ──────────
const LICENSE_TYPE_MAP: Record<string, string[]> = {
  business_premium: ["SPB", "O365_BUSINESS_PREMIUM"],
  business_standard: ["O365_BUSINESS_PREMIUM", "SMB_BUSINESS"],
  exchange_only: ["EXCHANGESTANDARD", "EXCHANGEDESKLESS"],
};

// Default fallback order if no license type selected
const PREFERRED_SKUS = [
  "SPB",
  "O365_BUSINESS_PREMIUM",
  "EXCHANGESTANDARD",
];

// ─── Main Execution ────────────────────────────────────────────────────────
export async function executeOnboarding(
  ticketId: string,
  formData: Record<string, unknown>,
  actorId: string,
  tenantId?: string
): Promise<OnboardingResult> {
  const steps: OnboardingStep[] = [];
  let userId: string | undefined;
  let userPrincipalName: string | undefined;
  let tempPassword: string | undefined;
  let licenseName: string | undefined;

  const firstName = (formData.first_name as string) || "";
  const lastName = (formData.last_name as string) || "";
  const department = (formData.department as string) || "";
  const jobTitle = (formData.job_title as string) || "";
  const officeLocation = (formData.office_location as string) || "";
  const domain = (formData.domain as string) || "zimark.io";

  // ── Step 1: Create user in Entra ID ──────────────────────────────────────
  try {
    tempPassword = generateTempPassword();
    const mailNickname = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
    userPrincipalName = `${mailNickname}@${domain}`;

    const userPayload = {
      displayName: `${firstName} ${lastName}`,
      givenName: firstName,
      surname: lastName,
      mailNickname,
      userPrincipalName,
      department: department || undefined,
      jobTitle: jobTitle || undefined,
      officeLocation: officeLocation || undefined,
      passwordProfile: {
        password: tempPassword,
        forceChangePasswordNextSignIn: true,
      },
      accountEnabled: true,
      usageLocation: "US",
    };

    const result = (await graphRequest(
      "POST",
      "/users",
      userPayload,
      tenantId
    )) as Record<string, unknown>;

    userId = result.id as string;

    const stepResult: OnboardingStep = {
      step: "create_user",
      success: true,
      details: {
        userId,
        userPrincipalName,
        displayName: userPayload.displayName,
      },
    };
    steps.push(stepResult);

    await logAuditStep("create_user", ticketId, actorId, {
      input: {
        displayName: userPayload.displayName,
        userPrincipalName,
        department,
        jobTitle,
      },
      output: { userId },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    steps.push({
      step: "create_user",
      success: false,
      details: { userPrincipalName },
      error,
    });
    await logAuditStep("create_user", ticketId, actorId, {
      input: { firstName, lastName, domain },
      error,
    });
  }

  // ── Step 2: Assign license ───────────────────────────────────────────────
  if (userId) {
    try {
      const skusResponse = (await graphRequest(
        "GET",
        "/subscribedSkus",
        null,
        tenantId
      )) as { value: Array<Record<string, unknown>> };

      const skus = skusResponse.value || [];

      // Find the best available license based on form selection
      let chosenSku: Record<string, unknown> | undefined;
      const selectedLicenseType = formData.license_type as string | undefined;
      const preferredSkuList = selectedLicenseType && LICENSE_TYPE_MAP[selectedLicenseType]
        ? LICENSE_TYPE_MAP[selectedLicenseType]
        : PREFERRED_SKUS;

      // Try preferred SKUs first (based on HR's selection)
      for (const preferred of preferredSkuList) {
        chosenSku = skus.find((sku) => {
          const partNumber = sku.skuPartNumber as string;
          const prepaid = sku.prepaidUnits as Record<string, number>;
          const consumed = sku.consumedUnits as number;
          const available = (prepaid?.enabled || 0) - (consumed || 0);
          return partNumber === preferred && available > 0;
        });
        if (chosenSku) break;
      }

      // Fall back to any SKU with available seats
      if (!chosenSku) {
        chosenSku = skus.find((sku) => {
          const prepaid = sku.prepaidUnits as Record<string, number>;
          const consumed = sku.consumedUnits as number;
          const available = (prepaid?.enabled || 0) - (consumed || 0);
          return available > 0;
        });
      }

      if (chosenSku) {
        const skuId = chosenSku.skuId as string;
        licenseName = chosenSku.skuPartNumber as string;

        await graphRequest(
          "POST",
          `/users/${userId}/assignLicense`,
          {
            addLicenses: [{ skuId, disabledPlans: [] }],
            removeLicenses: [],
          },
          tenantId
        );

        steps.push({
          step: "assign_license",
          success: true,
          details: { skuId, licenseName },
        });

        await logAuditStep("assign_license", ticketId, actorId, {
          userId,
          skuId,
          licenseName,
        });
      } else {
        steps.push({
          step: "assign_license",
          success: false,
          details: { availableSkus: skus.length },
          error: "No licenses with available seats found",
        });
        await logAuditStep("assign_license", ticketId, actorId, {
          userId,
          error: "No licenses with available seats found",
        });
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      steps.push({
        step: "assign_license",
        success: false,
        details: { userId },
        error,
      });
      await logAuditStep("assign_license", ticketId, actorId, {
        userId,
        error,
      });
    }
  }

  // ── Step 3: Add to department group ──────────────────────────────────────
  if (userId && department) {
    try {
      const groupsResponse = (await graphRequest(
        "GET",
        `/groups?$filter=displayName eq '${department}'&$top=1`,
        null,
        tenantId
      )) as { value: Array<Record<string, unknown>> };

      const groups = groupsResponse.value || [];

      if (groups.length > 0) {
        const groupId = groups[0].id as string;
        const groupName = groups[0].displayName as string;

        await graphRequest(
          "POST",
          `/groups/${groupId}/members/$ref`,
          {
            "@odata.id": `https://graph.microsoft.com/v1.0/directoryObjects/${userId}`,
          },
          tenantId
        );

        steps.push({
          step: "add_to_group",
          success: true,
          details: { groupId, groupName },
        });

        await logAuditStep("add_to_group", ticketId, actorId, {
          userId,
          groupId,
          groupName,
        });
      } else {
        steps.push({
          step: "add_to_group",
          success: false,
          details: { department },
          error: `No group matching department "${department}" found`,
        });
        await logAuditStep("add_to_group", ticketId, actorId, {
          userId,
          department,
          error: `No group matching department "${department}" found`,
        });
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      steps.push({
        step: "add_to_group",
        success: false,
        details: { userId, department },
        error,
      });
      await logAuditStep("add_to_group", ticketId, actorId, {
        userId,
        department,
        error,
      });
    }
  }

  const allSucceeded = steps.every((s) => s.success);

  return {
    success: allSucceeded,
    userId,
    userPrincipalName,
    tempPassword,
    licenseName,
    steps,
  };
}
