import { db } from "@/lib/db";
import { workflowApprovalConfigs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getManager, getCISO, getRequiredApprovers } from "@/lib/automations/org-chart";
import { workflowRegistryEntry } from "@/lib/workflow-approval-defaults";

/**
 * Resolves approvers for a ticket category using DB workflow config merged with registry defaults,
 * then Entra (manager / CISO) plus designated emails.
 */
export async function resolveCategoryApprovers(
  requesterEmail: string,
  categorySlug: string,
  tenantId?: string | null
): Promise<Array<{ email: string; name: string; role: string }>> {
  const registry = workflowRegistryEntry(categorySlug);

  const [row] = await db
    .select()
    .from(workflowApprovalConfigs)
    .where(eq(workflowApprovalConfigs.categorySlug, categorySlug))
    .limit(1);

  if (!registry) {
    return getRequiredApprovers(requesterEmail, categorySlug, tenantId ?? undefined);
  }

  const useMgr =
    row?.includeEntraManager ?? registry.defaultIncludeEntraManager;
  const useCiso = row?.includeEntraCiso ?? registry.defaultIncludeEntraCiso;
  const designated = row?.designatedApprovers ?? [];

  const approvers: Array<{ email: string; name: string; role: string }> = [];
  const seen = new Set<string>();

  const push = (email: string, name: string, role: string) => {
    const k = email.trim().toLowerCase();
    if (!k || seen.has(k)) return;
    seen.add(k);
    approvers.push({ email: k, name: name || k, role });
  };

  const reqLower = requesterEmail.trim().toLowerCase();

  if (useMgr) {
    const manager = await getManager(requesterEmail, tenantId ?? undefined);
    if (manager?.email) {
      push(manager.email, manager.displayName, "manager");
    }
  }

  if (useCiso) {
    const ciso = await getCISO(tenantId ?? undefined);
    if (ciso?.email && ciso.email.toLowerCase() !== reqLower) {
      push(ciso.email, ciso.displayName, "ciso");
    }
  }

  for (const d of designated) {
    const em = d.email?.trim();
    if (!em) continue;
    push(em, d.name || em.split("@")[0] || em, d.roleLabel?.trim() || "designated");
  }

  return approvers;
}
