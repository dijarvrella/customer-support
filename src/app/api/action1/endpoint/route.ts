import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const BASE_URL = process.env.ACTION1_BASE_URL ?? "https://app.eu.action1.com/api/3.0";
const CLIENT_ID = process.env.ACTION1_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.ACTION1_CLIENT_SECRET ?? "";

// Simple in-memory token cache (per cold start)
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) {
    return cachedToken.value;
  }

  const res = await fetch(`${BASE_URL}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    throw new Error(`Action1 auth failed: ${res.status}`);
  }

  const data = await res.json();
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

async function action1Fetch(path: string, token: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

// GET /api/action1/endpoint?deviceName=LP-Zimark-Alesia
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deviceName = request.nextUrl.searchParams.get("deviceName");
    if (!deviceName) {
      return NextResponse.json({ error: "deviceName is required" }, { status: 400 });
    }

    if (!CLIENT_ID || !CLIENT_SECRET) {
      return NextResponse.json({ error: "Action1 credentials not configured" }, { status: 503 });
    }

    const token = await getToken();

    // Get the first org
    const orgsData = await action1Fetch("/orgs", token);
    if (!orgsData?.results?.length) {
      return NextResponse.json({ error: "No Action1 organizations found" }, { status: 404 });
    }
    const orgId: string = orgsData.results[0].id;

    // Search for the endpoint by name (case-insensitive contains match)
    const endpointsData = await action1Fetch(
      `/orgs/${orgId}/endpoints?$filter=name eq '${encodeURIComponent(deviceName)}'`,
      token
    );

    // Fallback: list all and match manually if filter isn't supported
    let endpoint = endpointsData?.results?.find(
      (e: { name: string }) => e.name?.toLowerCase() === deviceName.toLowerCase()
    );

    if (!endpoint && endpointsData?.results?.length) {
      endpoint = endpointsData.results[0];
    }

    if (!endpoint) {
      // Try fetching all endpoints and do client-side match
      const allEndpoints = await action1Fetch(`/orgs/${orgId}/endpoints`, token);
      endpoint = allEndpoints?.results?.find(
        (e: { name: string }) => e.name?.toLowerCase() === deviceName.toLowerCase()
      );
    }

    if (!endpoint) {
      return NextResponse.json({ endpoint: null, automationHistory: [] });
    }

    // Get automation/policy run history for this endpoint
    let automationHistory: unknown[] = [];
    const historyData = await action1Fetch(
      `/orgs/${orgId}/endpoints/${endpoint.id}/policy_results`,
      token
    );
    if (historyData?.results) {
      automationHistory = historyData.results;
    } else {
      // Alternative path
      const alt = await action1Fetch(
        `/orgs/${orgId}/reports/policy_runs?endpoint_id=${endpoint.id}`,
        token
      );
      if (alt?.results) {
        automationHistory = alt.results;
      }
    }

    return NextResponse.json({ endpoint, automationHistory, orgId });
  } catch (error) {
    console.error("GET /api/action1/endpoint error:", error);
    return NextResponse.json({ error: "Failed to fetch Action1 data" }, { status: 500 });
  }
}
