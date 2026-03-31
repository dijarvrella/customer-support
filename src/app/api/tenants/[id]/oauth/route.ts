import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenants, tenantOauthConfigs } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as Record<string, unknown>;
    if (user.role !== "it_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Verify tenant exists
    const [tenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, id));

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const configs = await db
      .select()
      .from(tenantOauthConfigs)
      .where(eq(tenantOauthConfigs.tenantId, id))
      .orderBy(desc(tenantOauthConfigs.createdAt));

    return NextResponse.json(configs);
  } catch (error) {
    console.error("GET /api/tenants/[id]/oauth error:", error);
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

    const user = session.user as Record<string, unknown>;
    if (user.role !== "it_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Verify tenant exists
    const [tenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, id));

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await request.json();
    const { provider, clientId, clientSecret, tenantIdValue, issuer } = body;

    if (!provider || !clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Provider, clientId, and clientSecret are required" },
        { status: 400 }
      );
    }

    const [config] = await db
      .insert(tenantOauthConfigs)
      .values({
        tenantId: id,
        provider,
        clientId,
        clientSecret,
        tenantIdValue: tenantIdValue || null,
        issuer: issuer || null,
      })
      .returning();

    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    console.error("POST /api/tenants/[id]/oauth error:", error);

    const message = error instanceof Error ? error.message : "";
    if (message.includes("unique") || message.includes("duplicate")) {
      return NextResponse.json(
        { error: "An OAuth config for this provider already exists for this tenant" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
