import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { graphRequest } from "@/lib/automations/graph-client";

interface GraphUser {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  department: string | null;
}

interface GraphUsersResponse {
  value: GraphUser[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Consume params to satisfy Next.js 16 requirement
    await params;

    const { searchParams } = request.nextUrl;
    const q = searchParams.get("q");

    if (!q || q.trim().length < 2) {
      return NextResponse.json([]);
    }

    const sanitized = q.trim().replace(/"/g, "");

    const data = (await graphRequest(
      "GET",
      `/users?$search="displayName:${sanitized}"&$select=id,displayName,mail,userPrincipalName,department&$top=10`,
      null,
      undefined,
      { ConsistencyLevel: "eventual" }
    )) as GraphUsersResponse;

    const users = (data.value || []).map((u) => ({
      id: u.id,
      displayName: u.displayName,
      mail: u.mail,
      userPrincipalName: u.userPrincipalName,
      department: u.department,
    }));

    return NextResponse.json(users);
  } catch (error) {
    console.error("GET /api/groups/[id]/search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
