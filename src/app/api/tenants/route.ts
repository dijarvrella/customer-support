import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as Record<string, unknown>;
    if (user.role !== "it_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await db
      .select()
      .from(tenants)
      .orderBy(desc(tenants.createdAt));

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/tenants error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as Record<string, unknown>;
    if (user.role !== "it_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, slug, domain, logoUrl, primaryColor, supportEmail } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: "Name and slug are required" },
        { status: 400 }
      );
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: "Slug must only contain lowercase letters, numbers, and hyphens" },
        { status: 400 }
      );
    }

    const [tenant] = await db
      .insert(tenants)
      .values({
        name,
        slug,
        domain: domain || null,
        logoUrl: logoUrl || null,
        primaryColor: primaryColor || null,
        supportEmail: supportEmail || null,
      })
      .returning();

    return NextResponse.json(tenant, { status: 201 });
  } catch (error) {
    console.error("POST /api/tenants error:", error);

    // Handle unique constraint violations
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
