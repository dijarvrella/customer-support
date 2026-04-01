import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { graphRequest } from "@/lib/automations/graph-client";

interface GraphGroup {
  id: string;
  displayName: string;
  groupTypes: string[];
  membershipRule: string | null;
  membershipRuleProcessingState: string | null;
}

interface GraphGroupsResponse {
  value: GraphGroup[];
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as Record<string, unknown>).role as string;
    if (role !== "it_admin" && role !== "hr") {
      return NextResponse.json(
        { error: "Forbidden: requires it_admin or hr role" },
        { status: 403 }
      );
    }

    const data = (await graphRequest(
      "GET",
      "/groups?$select=id,displayName,groupTypes,membershipRule,membershipRuleProcessingState&$top=50"
    )) as GraphGroupsResponse;

    const groups = (data.value || []).map((g) => ({
      id: g.id,
      displayName: g.displayName,
      groupTypes: g.groupTypes,
      membershipRule: g.membershipRule,
      membershipRuleProcessingState: g.membershipRuleProcessingState,
      type:
        g.membershipRuleProcessingState === "On" ? "dynamic" : "assigned",
    }));

    return NextResponse.json(groups);
  } catch (error) {
    console.error("GET /api/groups error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
