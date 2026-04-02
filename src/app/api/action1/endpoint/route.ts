import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const BASE_URL =
  process.env.ACTION1_BASE_URL ?? "https://app.eu.action1.com/api/3.0";
const CLIENT_ID = process.env.ACTION1_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.ACTION1_CLIENT_SECRET ?? "";

// ── Token cache (per serverless cold-start) ──────────────────────────────────
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
    const body = await res.text().catch(() => "");
    throw new Error(`Action1 auth failed ${res.status}: ${body}`);
  }

  const data = await res.json();
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

// ── Typed fetch helper ────────────────────────────────────────────────────────
async function a1Get<T = unknown>(
  path: string,
  token: string
): Promise<T | null> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.warn(`Action1 GET ${path} → ${res.status}`);
    return null;
  }
  return res.json() as Promise<T>;
}

// ── GET /api/action1/endpoint?deviceName=LP-Zimark-Alesia ────────────────────
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deviceName = request.nextUrl.searchParams.get("deviceName");
    if (!deviceName) {
      return NextResponse.json(
        { error: "deviceName is required" },
        { status: 400 }
      );
    }

    if (!CLIENT_ID || !CLIENT_SECRET) {
      return NextResponse.json(
        {
          error:
            "Action1 credentials not configured. Add ACTION1_CLIENT_ID and ACTION1_CLIENT_SECRET to Vercel environment variables.",
        },
        { status: 503 }
      );
    }

    const token = await getToken();

    // ── 1. Get organisation ─────────────────────────────────────────────────
    const orgsData = await a1Get<{ count: number; results: { id: string; name: string }[] }>(
      "/orgs",
      token
    );
    if (!orgsData?.results?.length) {
      return NextResponse.json(
        { error: "No Action1 organisations found" },
        { status: 404 }
      );
    }
    const orgId = orgsData.results[0].id;

    // ── 2. Find endpoint by name (client-side match, no OData filter) ───────
    // Action1 paginates; fetch up to 200 to cover realistic fleet sizes.
    const nameLower = deviceName.toLowerCase();

    let endpoint: Record<string, unknown> | null = null;

    // Try page 1 with a generous page size first
    const page1 = await a1Get<{
      count: number;
      results: Record<string, unknown>[];
    }>(`/orgs/${orgId}/endpoints?pageSize=200&page=1`, token);

    if (page1?.results) {
      endpoint =
        page1.results.find(
          (e) =>
            String(e.name ?? "").toLowerCase() === nameLower ||
            String(e.computer_name ?? "").toLowerCase() === nameLower
        ) ?? null;

      // If not found in first page and there are more, keep fetching
      if (!endpoint && page1.count > 200) {
        let page = 2;
        while (!endpoint && (page - 1) * 200 < page1.count) {
          const pageN = await a1Get<{
            count: number;
            results: Record<string, unknown>[];
          }>(`/orgs/${orgId}/endpoints?pageSize=200&page=${page}`, token);
          if (!pageN?.results?.length) break;
          endpoint =
            pageN.results.find(
              (e) =>
                String(e.name ?? "").toLowerCase() === nameLower ||
                String(e.computer_name ?? "").toLowerCase() === nameLower
            ) ?? null;
          page++;
        }
      }
    }

    if (!endpoint) {
      // Return gracefully — device simply not managed by Action1
      return NextResponse.json({ endpoint: null, automationHistory: [] });
    }

    const endpointId = endpoint.id as string;

    // ── 3. Automation / policy-run history ──────────────────────────────────
    // Action1 REST API v3 paths tried in order:
    let automationHistory: Record<string, unknown>[] = [];

    const historyAttempts = [
      `/orgs/${orgId}/endpoints/${endpointId}/policies/runs`,
      `/orgs/${orgId}/endpoints/${endpointId}/policy_runs`,
      `/orgs/${orgId}/policies/runs?endpoint_id=${endpointId}`,
      `/orgs/${orgId}/reports/policy_runs?endpoint_id=${endpointId}&pageSize=50`,
    ];

    for (const path of historyAttempts) {
      const data = await a1Get<{
        count?: number;
        results?: Record<string, unknown>[];
      }>(path, token);
      if (data?.results) {
        automationHistory = data.results;
        break;
      }
    }

    return NextResponse.json({ endpoint, automationHistory, orgId });
  } catch (error) {
    console.error("GET /api/action1/endpoint error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch Action1 data",
      },
      { status: 500 }
    );
  }
}
