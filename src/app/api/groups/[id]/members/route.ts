import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { graphRequest } from "@/lib/automations/graph-client";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";

interface GraphMember {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  jobTitle: string | null;
  department: string | null;
}

interface GraphMembersResponse {
  value: GraphMember[];
}

export async function GET(
  _request: NextRequest,
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

    const { id } = await params;

    const data = (await graphRequest(
      "GET",
      `/groups/${id}/members?$select=id,displayName,mail,userPrincipalName,jobTitle,department&$top=100`
    )) as GraphMembersResponse;

    const members = (data.value || []).map((m) => ({
      id: m.id,
      displayName: m.displayName,
      mail: m.mail,
      userPrincipalName: m.userPrincipalName,
      jobTitle: m.jobTitle,
      department: m.department,
    }));

    return NextResponse.json(members);
  } catch (error) {
    console.error("GET /api/groups/[id]/members error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
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

    const { id } = await params;
    const body = await request.json();
    const { userId } = body as { userId: string };

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    await graphRequest("POST", `/groups/${id}/members/$ref`, {
      "@odata.id": `https://graph.microsoft.com/v1.0/directoryObjects/${userId}`,
    });

    // Audit log
    try {
      await db.insert(auditLog).values({
        eventType: "group.member_added",
        entityType: "group",
        entityId: id,
        actorId: session.user.id,
        actorType: "user",
        action: "add_member",
        details: { userId, groupId: id },
      });
    } catch (err) {
      console.error("Failed to write audit log for group member add:", err);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/groups/[id]/members error:", error);
    const status =
      (error as Record<string, unknown>).status === 400 ? 400 : 500;
    return NextResponse.json(
      { error: status === 400 ? "Member already in group or invalid user" : "Internal server error" },
      { status }
    );
  }
}

export async function DELETE(
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

    const { id } = await params;
    const body = await request.json();
    const { userId } = body as { userId: string };

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    await graphRequest("DELETE", `/groups/${id}/members/${userId}/$ref`);

    // Audit log
    try {
      await db.insert(auditLog).values({
        eventType: "group.member_removed",
        entityType: "group",
        entityId: id,
        actorId: session.user.id,
        actorType: "user",
        action: "remove_member",
        details: { userId, groupId: id },
      });
    } catch (err) {
      console.error("Failed to write audit log for group member remove:", err);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/groups/[id]/members error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
