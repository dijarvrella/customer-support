import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenantOauthConfigs } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; configId: string }> }
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

    const { id, configId } = await params;
    const body = await request.json();

    const allowedFields = [
      "provider",
      "clientId",
      "clientSecret",
      "tenantIdValue",
      "issuer",
      "additionalConfig",
      "isActive",
    ] as const;

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    updates.updatedAt = new Date();

    const [updated] = await db
      .update(tenantOauthConfigs)
      .set(updates)
      .where(
        and(
          eq(tenantOauthConfigs.id, configId),
          eq(tenantOauthConfigs.tenantId, id)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "OAuth config not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/tenants/[id]/oauth/[configId] error:", error);

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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; configId: string }> }
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

    const { id, configId } = await params;

    const [deleted] = await db
      .delete(tenantOauthConfigs)
      .where(
        and(
          eq(tenantOauthConfigs.id, configId),
          eq(tenantOauthConfigs.tenantId, id)
        )
      )
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: "OAuth config not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "OAuth config deleted" });
  } catch (error) {
    console.error("DELETE /api/tenants/[id]/oauth/[configId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
