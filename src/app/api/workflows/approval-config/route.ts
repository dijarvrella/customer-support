import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workflowApprovalConfigs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getMergedWorkflowApprovalConfigs } from "@/lib/workflow-approval-config";
import { workflowRegistryEntry } from "@/lib/workflow-approval-defaults";
import type { WorkflowUiCategory } from "@/lib/workflow-approval-defaults";

function canEditWorkflowConfig(session: { user?: unknown }): boolean {
  if (!session.user) return false;
  const u = session.user as Record<string, unknown>;
  const role = (u.role as string) || "end_user";
  if (u.isGlobalAdmin === true) return true;
  return role === "it_admin" || role === "it_lead";
}

const UI_CATEGORIES: WorkflowUiCategory[] = [
  "identity",
  "security",
  "cloud",
  "hardware",
  "software",
];

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await getMergedWorkflowApprovalConfigs();
  return NextResponse.json({ rows });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canEditWorkflowConfig(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const categorySlug = typeof b.categorySlug === "string" ? b.categorySlug : "";
  const reg = workflowRegistryEntry(categorySlug);
  if (!reg) {
    return NextResponse.json({ error: "Unknown category slug" }, { status: 400 });
  }

  const includeEntraManager = Boolean(b.includeEntraManager);
  const includeEntraCiso = Boolean(b.includeEntraCiso);
  const rawDesignated = Array.isArray(b.designatedApprovers)
    ? b.designatedApprovers
    : [];

  if (rawDesignated.length > 20) {
    return NextResponse.json(
      { error: "Too many designated approvers" },
      { status: 400 }
    );
  }

  const designatedApprovers: Array<{
    email: string;
    name?: string;
    roleLabel?: string;
  }> = [];

  for (const item of rawDesignated) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const email = typeof o.email === "string" ? o.email.trim() : "";
    if (!email) continue;
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: `Invalid email: ${email}` },
        { status: 400 }
      );
    }
    designatedApprovers.push({
      email: email.toLowerCase(),
      name: typeof o.name === "string" ? o.name.trim() || undefined : undefined,
      roleLabel:
        typeof o.roleLabel === "string" ? o.roleLabel.trim() || undefined : undefined,
    });
  }

  if (!includeEntraManager && !includeEntraCiso && designatedApprovers.length === 0) {
    return NextResponse.json(
      {
        error:
          "Choose at least one of: manager from Entra, CISO from Entra, or one designated approver.",
      },
      { status: 400 }
    );
  }

  const requestTypeLabel =
    typeof b.requestTypeLabel === "string" && b.requestTypeLabel.trim()
      ? b.requestTypeLabel.trim().slice(0, 255)
      : reg.requestTypeLabel;

  let uiCategory: WorkflowUiCategory = reg.uiCategory;
  if (typeof b.uiCategory === "string" && UI_CATEGORIES.includes(b.uiCategory as WorkflowUiCategory)) {
    uiCategory = b.uiCategory as WorkflowUiCategory;
  }

  const notes =
    typeof b.notes === "string" ? b.notes.trim().slice(0, 2000) : "";

  const payload = {
    categorySlug,
    requestTypeLabel,
    uiCategory,
    includeEntraManager,
    includeEntraCiso,
    designatedApprovers,
    notes: notes || null,
    updatedAt: new Date(),
  };

  try {
    const [existing] = await db
      .select({ id: workflowApprovalConfigs.id })
      .from(workflowApprovalConfigs)
      .where(eq(workflowApprovalConfigs.categorySlug, categorySlug))
      .limit(1);

    if (existing) {
      await db
        .update(workflowApprovalConfigs)
        .set(payload)
        .where(eq(workflowApprovalConfigs.id, existing.id));
    } else {
      await db.insert(workflowApprovalConfigs).values(payload);
    }

    const rows = await getMergedWorkflowApprovalConfigs();
    return NextResponse.json({ ok: true, rows });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const missingTable =
      /does not exist|relation|workflow_approval_configs/i.test(msg);
    console.error("[workflow] PUT approval-config:", e);
    return NextResponse.json(
      {
        error: missingTable
          ? "Workflow settings need the database table workflow_approval_configs. From the repo run: npm run db:push (with DATABASE_URL set to this environment), then redeploy or try again."
          : "Failed to save workflow settings.",
      },
      { status: missingTable ? 503 : 500 }
    );
  }
}
