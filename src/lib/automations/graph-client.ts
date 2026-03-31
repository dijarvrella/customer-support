import { db } from "@/lib/db";
import { tenantOauthConfigs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// ─── Token Cache ───────────────────────────────────────────────────────────
interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

const tokenCache = new Map<string, CachedToken>();
const CACHE_KEY_DEFAULT = "__default__";
const TOKEN_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry

// ─── Credentials Resolver ──────────────────────────────────────────────────
interface GraphCredentials {
  clientId: string;
  clientSecret: string;
  tenantIdValue: string;
}

async function resolveCredentials(
  tenantId?: string
): Promise<GraphCredentials> {
  // Try tenant-specific OAuth config from the database
  if (tenantId) {
    const configs = await db
      .select({
        clientId: tenantOauthConfigs.clientId,
        clientSecret: tenantOauthConfigs.clientSecret,
        tenantIdValue: tenantOauthConfigs.tenantIdValue,
      })
      .from(tenantOauthConfigs)
      .where(
        and(
          eq(tenantOauthConfigs.tenantId, tenantId),
          eq(tenantOauthConfigs.provider, "microsoft-entra-id"),
          eq(tenantOauthConfigs.isActive, true)
        )
      )
      .limit(1);

    if (configs.length > 0 && configs[0].tenantIdValue) {
      return {
        clientId: configs[0].clientId,
        clientSecret: configs[0].clientSecret,
        tenantIdValue: configs[0].tenantIdValue,
      };
    }
  }

  // Fall back to environment variables
  const clientId = process.env.AZURE_AD_CLIENT_ID;
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
  const tenantIdValue = process.env.AZURE_AD_TENANT_ID;

  if (!clientId || !clientSecret || !tenantIdValue) {
    throw new Error(
      "Microsoft Graph credentials not configured. Set AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, and AZURE_AD_TENANT_ID environment variables or configure tenant OAuth in the database."
    );
  }

  return { clientId, clientSecret, tenantIdValue };
}

// ─── Token Acquisition ─────────────────────────────────────────────────────
export async function getGraphToken(tenantId?: string): Promise<string> {
  const cacheKey = tenantId || CACHE_KEY_DEFAULT;

  // Check cache
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + TOKEN_BUFFER_MS) {
    return cached.accessToken;
  }

  const creds = await resolveCredentials(tenantId);

  const tokenUrl = `https://login.microsoftonline.com/${creds.tenantIdValue}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to acquire Graph token: ${response.status} ${errorText}`
    );
  }

  const data = await response.json();
  const accessToken = data.access_token as string;
  const expiresIn = (data.expires_in as number) || 3600;

  tokenCache.set(cacheKey, {
    accessToken,
    expiresAt: Date.now() + expiresIn * 1000,
  });

  return accessToken;
}

// ─── Graph API Request Helper ──────────────────────────────────────────────
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export async function graphRequest(
  method: string,
  path: string,
  body?: Record<string, unknown> | null,
  tenantId?: string,
  extraHeaders?: Record<string, string>
): Promise<unknown> {
  const token = await getGraphToken(tenantId);

  const url = path.startsWith("http") ? path : `${GRAPH_BASE}${path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  const fetchOptions: RequestInit = { method, headers };
  if (body && (method === "POST" || method === "PATCH" || method === "PUT")) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);

  // 204 No Content — common for DELETE/PATCH success
  if (response.status === 204) {
    return { success: true };
  }

  if (!response.ok) {
    const errorText = await response.text();
    let errorJson: unknown;
    try {
      errorJson = JSON.parse(errorText);
    } catch {
      errorJson = errorText;
    }
    const err = new Error(
      `Graph API ${method} ${path} failed: ${response.status}`
    );
    (err as unknown as Record<string, unknown>).status = response.status;
    (err as unknown as Record<string, unknown>).graphError = errorJson;
    throw err;
  }

  // Some responses may be empty
  const text = await response.text();
  if (!text) return { success: true };

  return JSON.parse(text);
}
