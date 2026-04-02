import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMergedWorkflowApprovalConfigs } from "@/lib/workflow-approval-config";
import WorkflowsClient from "./workflows-client";

export default async function WorkflowsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const u = session.user as Record<string, unknown>;
  const role = (u.role as string) || "end_user";
  const canEdit =
    u.isGlobalAdmin === true || role === "it_admin" || role === "it_lead";

  const initialRows = await getMergedWorkflowApprovalConfigs();

  return <WorkflowsClient initialRows={initialRows} canEdit={canEdit} />;
}
