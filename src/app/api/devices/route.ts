import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { graphRequest } from "@/lib/automations/graph-client";

interface ManagedDevice {
  id: string;
  deviceName: string;
  operatingSystem: string;
  osVersion: string;
  complianceState: string;
  lastSyncDateTime: string;
  userDisplayName: string;
  userPrincipalName: string;
  model: string;
  manufacturer: string;
  serialNumber: string;
  managedDeviceOwnerType: string;
  enrolledDateTime: string;
  deviceRegistrationState: string;
}

interface GraphDevicesResponse {
  value: ManagedDevice[];
}

export async function GET(request: NextRequest) {
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

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search");
    const os = searchParams.get("os");
    const compliance = searchParams.get("compliance");

    const tenantId = (session.user as Record<string, unknown>).tenantId as
      | string
      | undefined;

    const selectFields = [
      "id",
      "deviceName",
      "operatingSystem",
      "osVersion",
      "complianceState",
      "lastSyncDateTime",
      "userDisplayName",
      "userPrincipalName",
      "model",
      "manufacturer",
      "serialNumber",
      "managedDeviceOwnerType",
      "enrolledDateTime",
      "deviceRegistrationState",
    ].join(",");

    const data = (await graphRequest(
      "GET",
      `/deviceManagement/managedDevices?$select=${selectFields}&$top=100`,
      null,
      tenantId
    )) as GraphDevicesResponse;

    let devices = data.value || [];

    // Filter by operating system
    if (os) {
      devices = devices.filter(
        (d) => d.operatingSystem?.toLowerCase() === os.toLowerCase()
      );
    }

    // Filter by compliance state
    if (compliance) {
      devices = devices.filter(
        (d) => d.complianceState?.toLowerCase() === compliance.toLowerCase()
      );
    }

    // Filter by search term (device name or user display name)
    if (search) {
      const term = search.toLowerCase();
      devices = devices.filter(
        (d) =>
          d.deviceName?.toLowerCase().includes(term) ||
          d.userDisplayName?.toLowerCase().includes(term)
      );
    }

    return NextResponse.json(devices);
  } catch (error) {
    console.error("GET /api/devices error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
