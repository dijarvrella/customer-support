import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, auditLog } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { USER_ROLES } from "@/lib/constants";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only it_admin can update users
    const currentRole = (session.user as Record<string, unknown>).role as string;
    if (currentRole !== "it_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();

    // Validate the target user exists
    const existing = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};

    // Validate and collect role update
    if (body.role !== undefined) {
      if (!USER_ROLES.includes(body.role)) {
        return NextResponse.json(
          { error: `Invalid role. Must be one of: ${USER_ROLES.join(", ")}` },
          { status: 400 }
        );
      }
      updates.role = body.role;
    }

    // Validate and collect department update
    if (body.department !== undefined) {
      updates.department = body.department;
    }

    // Validate and collect isActive update
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") {
        return NextResponse.json(
          { error: "isActive must be a boolean" },
          { status: 400 }
        );
      }
      updates.isActive = body.isActive;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(existing);
    }

    updates.updatedAt = new Date();

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        department: users.department,
        isActive: users.isActive,
      });

    // Audit log
    await db.insert(auditLog).values({
      eventType: "user.updated",
      entityType: "user",
      entityId: id,
      actorId: session.user.id,
      actorType: "user",
      action: "update",
      details: { changes: updates, previousValues: { role: existing.role, department: existing.department, isActive: existing.isActive } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/users/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
