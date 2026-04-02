import { db } from "@/lib/db";
import { approvals } from "@/lib/db/schema";
import { categorySlugRequiresApproval } from "@/lib/constants";
import { resolveCategoryApprovers } from "@/lib/workflow-approval-resolve";
import { findOrCreateUserByEmail } from "@/lib/db/find-or-create-user";

/**
 * Inserts pending approval rows from Entra manager/CISO rules + supervisor form fields.
 * If Graph/supervisor yield nobody, uses FALLBACK_APPROVER_EMAIL when set (e.g. staging).
 */
export async function createApprovalsForCategoryTicket(params: {
  ticketId: string;
  categorySlug: string | null;
  requesterEmail: string;
  formData: Record<string, unknown> | null;
  tenantId?: string | null;
}): Promise<number> {
  const slug = params.categorySlug;
  if (!categorySlugRequiresApproval(slug)) return 0;

  const data = params.formData || {};
  let created = 0;

  try {
    const orgApprovers = await resolveCategoryApprovers(
      params.requesterEmail,
      slug!,
      params.tenantId ?? undefined
    );

    for (const approverInfo of orgApprovers) {
      const approverUser = await findOrCreateUserByEmail(
        approverInfo.email,
        approverInfo.name
      );
      await db.insert(approvals).values({
        ticketId: params.ticketId,
        approverId: approverUser.id,
        approverRole: approverInfo.role,
        status: "pending",
      });
      created++;
    }

    if (orgApprovers.length === 0) {
      const supervisorEmail =
        (data.supervisor_email as string) ||
        (data.supervisorEmail as string) ||
        (data.manager_email as string) ||
        (data.managerEmail as string);

      if (supervisorEmail) {
        const supervisorName =
          (data.supervisor_name as string) ||
          (data.supervisorName as string) ||
          supervisorEmail.split("@")[0];

        const approverUser = await findOrCreateUserByEmail(
          supervisorEmail,
          supervisorName
        );
        await db.insert(approvals).values({
          ticketId: params.ticketId,
          approverId: approverUser.id,
          approverRole: "manager",
          status: "pending",
        });
        created++;
      }
    }
  } catch (err) {
    console.error("createApprovalsForCategoryTicket (primary path):", err);
    const supervisorEmail =
      (data.supervisor_email as string) ||
      (data.manager_email as string);
    if (supervisorEmail) {
      const approverUser = await findOrCreateUserByEmail(supervisorEmail);
      await db.insert(approvals).values({
        ticketId: params.ticketId,
        approverId: approverUser.id,
        approverRole: "manager",
        status: "pending",
      });
      created++;
    }
  }

  if (created === 0 && process.env.FALLBACK_APPROVER_EMAIL?.trim()) {
    const email = process.env.FALLBACK_APPROVER_EMAIL.trim();
    const u = await findOrCreateUserByEmail(
      email,
      process.env.FALLBACK_APPROVER_NAME || "Fallback approver"
    );
    await db.insert(approvals).values({
      ticketId: params.ticketId,
      approverId: u.id,
      approverRole: "fallback",
      status: "pending",
    });
    created++;
  }

  return created;
}
