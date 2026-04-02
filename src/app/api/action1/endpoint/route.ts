import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const BASE_URL =
  process.env.ACTION1_BASE_URL ?? "https://app.eu.action1.com/api/3.0";
const CLIENT_ID = process.env.ACTION1_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.ACTION1_CLIENT_SECRET ?? "";

// ── Token cache (per serverless cold-start) ──────────────────────────────────
let cachedToken: { value: string; expiresAt: number; orgId: string } | null =
  null;

async function getTokenAndOrg(): Promise<{ token: string; orgId: string }> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) {
    return { token: cachedToken.value, orgId: cachedToken.orgId };
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
  const token: string = data.access_token;

  // Org ID lives in the JWT `name` claim
  const payloadB64 = token.split(".")[1];
  const claims = JSON.parse(
    Buffer.from(payloadB64, "base64").toString("utf8")
  ) as { name?: string };
  const orgId = claims.name ?? "";

  cachedToken = {
    value: token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    orgId,
  };
  return { token, orgId };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
interface A1Page<T> {
  items: T[];
  total_items: string;
  next_page: string;
}

async function a1Get<T = unknown>(
  pathOrUrl: string,
  token: string
): Promise<T | null> {
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `${BASE_URL}${pathOrUrl}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) {
    console.warn(`Action1 GET ${pathOrUrl} → ${res.status}`);
    return null;
  }
  return res.json() as Promise<T>;
}

// Convert Action1 date "2026-04-01_17-07-48" → ISO "2026-04-01T17:07:48"
function normalizeDate(d: unknown): string | undefined {
  if (typeof d !== "string" || !d) return undefined;
  return d.replace(
    /^(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})$/,
    "$1T$2:$3:$4"
  );
}

type RawRecord = Record<string, unknown>;

// Discover the installed-software report ID from the Software Inventory category
async function getInstalledSoftwareReportId(
  orgId: string,
  token: string
): Promise<string | null> {
  const cats = await a1Get<A1Page<RawRecord>>(
    `/reports/${orgId}/cat_sw/children`,
    token
  );
  const report = cats?.items?.find(
    (i) =>
      typeof i.id === "string" && i.id.startsWith("installed_software")
  );
  return report ? (report.id as string) : null;
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

    const { token, orgId } = await getTokenAndOrg();
    const nameLower = deviceName.toLowerCase();

    // ── 1. Find endpoint by name (follow next_page) ─────────────────────────
    let endpoint: RawRecord | null = null;
    let nextUrl: string | null = `/endpoints/managed/${orgId}?limit=200`;

    while (nextUrl && !endpoint) {
      const page: A1Page<RawRecord> | null =
        await a1Get<A1Page<RawRecord>>(nextUrl, token);
      if (!page?.items?.length) break;
      endpoint =
        page.items.find(
          (e) =>
            String(e.name ?? "").toLowerCase() === nameLower ||
            String(e.device_name ?? "").toLowerCase() === nameLower
        ) ?? null;
      nextUrl = page.next_page || null;
    }

    if (!endpoint) {
      return NextResponse.json({ endpoint: null, automationHistory: [] });
    }

    // ── 2. Normalise endpoint fields for the UI ──────────────────────────────
    const groups = (
      endpoint.group_membership as { name: string }[] | undefined
    )?.map((g) => g.name) ?? [];

    const normalizedEndpoint = {
      ...endpoint,
      user_name: String(endpoint.user ?? "").split("\\").pop() ?? "",
      os_name: endpoint.OS,
      reboot_required:
        String(endpoint.reboot_required ?? "No").toLowerCase() === "yes",
      endpoint_groups: groups,
      last_seen: normalizeDate(endpoint.last_seen),
    };

    const endpointId = endpoint.id as string;

    // ── 3. Fetch all detail data in parallel ─────────────────────────────────
    const [histData, missingUpdatesData, vulnsData, swReportId] =
      await Promise.all([
        a1Get<A1Page<RawRecord>>(
          `/automations/instances/${orgId}?endpoint_id=${endpointId}&limit=50`,
          token
        ),
        a1Get<A1Page<RawRecord>>(
          `/endpoints/managed/${orgId}/${endpointId}/missing-updates?limit=200`,
          token
        ),
        a1Get<{ items: RawRecord[] }>(
          `/vulnerabilities/${orgId}?endpoint_id=${endpointId}&limit=200`,
          token
        ),
        getInstalledSoftwareReportId(orgId, token),
      ]);

    // Installed software requires the report ID discovered above
    let installedSoftwareData: A1Page<RawRecord> | null = null;
    if (swReportId) {
      installedSoftwareData = await a1Get<A1Page<RawRecord>>(
        `/reportdata/${orgId}/${swReportId}/data?endpoint_id=${endpointId}&limit=200`,
        token
      );
    }

    const automationHistory = (histData?.items ?? []).map((run) => ({
      ...run,
      started_at: normalizeDate(run.start_time),
      finished_at: normalizeDate(run.end_time),
    }));

    const missingUpdates = (missingUpdatesData?.items ?? []).map((u) => ({
      id: u.id,
      name: u.name,
      platform: u.platform,
      status: u.status,
    }));

    const vulnerabilities = (vulnsData?.items ?? []).map((v) => ({
      cve_id: v.cve_id,
      cvss_score: v.cvss_score,
      remediation_status: v.remediation_status,
      remediation_deadline: normalizeDate(v.remediation_deadline as string),
      software_name: (
        v.software as { product_name: string }[] | undefined
      )?.[0]?.product_name,
      cisa_kev: v.cisa_kev,
    }));

    const installedSoftware = (installedSoftwareData?.items ?? []).map(
      (item) => ({
        name: (item.fields as { Name?: string } | undefined)?.Name ?? "",
      })
    );

    return NextResponse.json({
      endpoint: normalizedEndpoint,
      automationHistory,
      missingUpdates,
      vulnerabilities,
      installedSoftware,
      orgId,
    });
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
