import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenants, tenantOauthConfigs } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";

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

    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, id));

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const oauthConfigs = await db
      .select()
      .from(tenantOauthConfigs)
      .where(eq(tenantOauthConfigs.tenantId, id));

    return NextResponse.json({ ...tenant, oauthConfigs });
  } catch (error) {
    console.error("GET /api/tenants/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const body = await request.json();

    // Only allow updating specific fields
    const allowedFields = [
      "name",
      "slug",
      "domain",
      "logoUrl",
      "primaryColor",
      "supportEmail",
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

    // Validate slug format if being updated
    if (updates.slug && !/^[a-z0-9-]+$/.test(updates.slug as string)) {
      return NextResponse.json(
        { error: "Slug must only contain lowercase letters, numbers, and hyphens" },
        { status: 400 }
      );
    }

    updates.updatedAt = new Date();

    const [updated] = await db
      .update(tenants)
      .set(updates)
      .where(eq(tenants.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/tenants/[id] error:", error);

    const message = error instanceof Error ? error.message : "";
    if (message.includes("unique") || message.includes("duplicate")) {
      return NextResponse.json(
        { error: "A tenant with that name or slug already exists" },
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

    // Soft delete - set isActive to false
    const [updated] = await db
      .update(tenants)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Tenant deactivated", tenant: updated });
  } catch (error) {
    console.error("DELETE /api/tenants/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
