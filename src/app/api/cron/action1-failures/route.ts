/**
 * Cron: auto-create tickets for failed Action1 automation runs.
 * Runs on a schedule (configured in vercel.json).
 * Deduplicates via a tag "action1-failure:{instanceId}" on each ticket.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tickets, users } from "@/lib/db/schema";
import { eq, like, or } from "drizzle-orm";
import { generateTicketNumber } from "@/lib/utils";
import { DEFAULT_SLA, type TicketPriority } from "@/lib/constants";
import { defaultQueueIdForCategorySlug } from "@/lib/tickets/devops-queue";

const CRON_SECRET = process.env.CRON_SECRET;

const BASE_URL =
  process.env.ACTION1_BASE_URL ?? "https://app.eu.action1.com/api/3.0";
const CLIENT_ID = process.env.ACTION1_CLIENT_ID ?? "";
const CLIENT_SECRET_VAL = process.env.ACTION1_CLIENT_SECRET ?? "";

// ── Action1 auth ──────────────────────────────────────────────────────────────
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
      client_secret: CLIENT_SECRET_VAL,
    }),
  });
  if (!res.ok) throw new Error(`Action1 auth failed: ${res.status}`);
  const data = await res.json();
  const token: string = data.access_token;
  const claims = JSON.parse(
    Buffer.from(token.split(".")[1], "base64").toString("utf8")
  ) as { name?: string };
  cachedToken = {
    value: token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    orgId: claims.name ?? "",
  };
  return { token, orgId: cachedToken.orgId };
}

async function a1Get<T>(path: string, token: string): Promise<T | null> {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

function normalizeDate(d: unknown): string | undefined {
  if (typeof d !== "string" || !d) return undefined;
  return d.replace(
    /^(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})$/,
    "$1T$2:$3:$4"
  );
}

interface A1Instance {
  id: string;
  name?: string;
  status?: string;
  start_time?: string;
  end_time?: string;
  endpoints?: { id: string }[];
  [key: string]: unknown;
}

interface A1Page<T> {
  items: T[];
  next_page?: string;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!CLIENT_ID || !CLIENT_SECRET_VAL) {
    return NextResponse.json(
      { error: "Action1 credentials not configured" },
      { status: 503 }
    );
  }

  try {
    const { token, orgId } = await getTokenAndOrg();

    // ── 1. Get all endpoints (for name lookup) ────────────────────────────────
    const endpointsPage = await a1Get<A1Page<{ id: string; name?: string; device_name?: string }>>(
      `/endpoints/managed/${orgId}?limit=200`,
      token
    );
    const endpointMap = new Map<string, string>();
    for (const ep of endpointsPage?.items ?? []) {
      endpointMap.set(ep.id, ep.name ?? ep.device_name ?? ep.id);
    }

    // ── 2. Fetch recent failed automation instances (last ~200) ───────────────
    const instancesData = await a1Get<A1Page<A1Instance>>(
      `/automations/instances/${orgId}?limit=200`,
      token
    );
    const failedInstances = (instancesData?.items ?? []).filter(
      (i) => i.status?.toLowerCase() === "error"
    );

    if (failedInstances.length === 0) {
      return NextResponse.json({ created: 0, message: "No failed automations" });
    }

    // ── 3. Resolve the system requester ──────────────────────────────────────
    // Prefer the Zimark Admin system account, fall back to dijar.v@zimark.io
    const systemUser = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(
        or(
          eq(users.email, "admin@zimark.io"),
          eq(users.email, "dijar.v@zimark.io")
        )
      )
      .limit(2);

    if (!systemUser.length) {
      return NextResponse.json(
        { error: "No system user found to create tickets" },
        { status: 500 }
      );
    }
    // Prefer admin@zimark.io over the fallback
    const systemRequesterId =
      systemUser.find((u) => u.email === "admin@zimark.io")?.id ??
      systemUser[0].id;

    const CONSOLE_BASE = "https://app.eu.action1.com/console";

    // ── 4. Deduplicate — check which instance IDs already have tickets ────────
    const now = new Date();
    let created = 0;

    for (const instance of failedInstances) {
      const dedupTag = `action1-failure:${instance.id}`;

      const existing = await db
        .select({ id: tickets.id })
        .from(tickets)
        .where(like(tickets.tags, `%${dedupTag}%`))
        .limit(1);

      if (existing.length > 0) continue; // already ticketed

      // Build title and description
      const deviceIds = instance.endpoints?.map((e) => e.id) ?? [];
      const deviceNames = deviceIds
        .map((id) => endpointMap.get(id) ?? id)
        .join(", ");
      const startedAt = normalizeDate(instance.start_time);
      const endedAt = normalizeDate(instance.end_time);

      // Action1 console deep-links
      const automationsUrl = `${CONSOLE_BASE}/automations?org=${orgId}`;
      const endpointUrls = deviceIds
        .map((id) => {
          const name = endpointMap.get(id) ?? id;
          return `[${name}](${CONSOLE_BASE}/endpoints?org=${orgId}&endpoint=${id})`;
        })
        .join(", ");

      const title = `[Action1] Automation failed: ${instance.name ?? instance.id}${deviceNames ? ` on ${deviceNames}` : ""}`;
      const description = [
        `**Automation:** [${instance.name ?? instance.id}](${automationsUrl})`,
        `**Status:** ${instance.status}`,
        deviceNames ? `**Device(s):** ${endpointUrls || deviceNames}` : null,
        startedAt ? `**Started:** ${new Date(startedAt).toLocaleString()}` : null,
        endedAt ? `**Ended:** ${new Date(endedAt).toLocaleString()}` : null,
        `**Action1 Instance ID:** \`${instance.id}\``,
        ``,
        `[→ Open Action1 Dashboard](${automationsUrl})`,
      ]
        .filter((l) => l !== null)
        .join("\n");

      const priority: TicketPriority = "high";
      const sla = DEFAULT_SLA[priority];
      const slaResponseDue = new Date(now.getTime() + sla.responseMinutes * 60 * 1000);
      const slaResolutionDue = new Date(now.getTime() + sla.resolutionMinutes * 60 * 1000);

      const ticketNumber = generateTicketNumber();
      const queueId = await defaultQueueIdForCategorySlug("hardware");

      // tags: visible "action1" label + dedup tag (comma-separated)
      const tags = `action1,${dedupTag}`;

      await db.insert(tickets).values({
        ticketNumber,
        title,
        description,
        priority,
        categorySlug: "hardware",
        requesterId: systemRequesterId,
        source: "system",
        tags,
        slaResponseDue,
        slaResolutionDue,
        queueId,
      });

      created++;
    }

    return NextResponse.json({
      created,
      checked: failedInstances.length,
      message: `Created ${created} ticket(s) for failed Action1 automations`,
    });
  } catch (error) {
    console.error("Action1 failure cron error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
