import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { graphRequest } from "@/lib/automations/graph-client";

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
    if (role !== "it_admin") {
      return NextResponse.json(
        { error: "Forbidden: requires it_admin role" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const tenantId = (session.user as Record<string, unknown>).tenantId as
      | string
      | undefined;

    const device = await graphRequest(
      "GET",
      `/deviceManagement/managedDevices/${id}`,
      null,
      tenantId
    );

    return NextResponse.json(device);
  } catch (error) {
    console.error("GET /api/devices/[id] error:", error);
    const status =
      (error as Record<string, unknown>).status === 404 ? 404 : 500;
    return NextResponse.json(
      {
        error:
          status === 404 ? "Device not found" : "Internal server error",
      },
      { status }
    );
  }
}
