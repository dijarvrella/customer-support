import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditLog, users } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, and, desc, gte, lte, lt, sql, ilike } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as Record<string, unknown>).role as string;
    if (role !== "it_admin") {
      return NextResponse.json(
        { error: "Forbidden: requires it_admin role" },
        { status: 403 }
      );
    }

    const { searchParams } = request.nextUrl;
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");
    const eventType = searchParams.get("eventType");
    const actorId = searchParams.get("actorId");
    const actorType = searchParams.get("actorType");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10),
      200
    );
    const cursor = searchParams.get("cursor");

    const conditions: ReturnType<typeof eq>[] = [];

    if (entityType) {
      conditions.push(ilike(auditLog.entityType, entityType));
    }
    if (entityId) {
      conditions.push(eq(auditLog.entityId, entityId));
    }
    if (eventType) {
      conditions.push(ilike(auditLog.eventType, `%${eventType}%`));
    }
    if (actorId) {
      conditions.push(eq(auditLog.actorId, actorId));
    }
    if (actorType) {
      conditions.push(eq(auditLog.actorType, actorType));
    }
    if (from) {
      conditions.push(gte(auditLog.createdAt, new Date(from)));
    }
    if (to) {
      conditions.push(lte(auditLog.createdAt, new Date(to)));
    }
    if (cursor) {
      // Cursor-based pagination: entries older than cursor timestamp
      conditions.push(lt(auditLog.createdAt, new Date(cursor)));
    }

    const actor = db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      })
      .from(users)
      .as("actor");

    const results = await db
      .select({
        id: auditLog.id,
        eventType: auditLog.eventType,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        actorId: auditLog.actorId,
        actorType: auditLog.actorType,
        action: auditLog.action,
        details: auditLog.details,
        ipAddress: auditLog.ipAddress,
        createdAt: auditLog.createdAt,
        actorName: actor.name,
        actorEmail: actor.email,
        actorImage: actor.image,
      })
      .from(auditLog)
      .leftJoin(actor, eq(auditLog.actorId, actor.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const data = results.slice(0, limit).map((r) => ({
      id: r.id,
      eventType: r.eventType,
      entityType: r.entityType,
      entityId: r.entityId,
      actorId: r.actorId,
      actorType: r.actorType,
      action: r.action,
      details: r.details,
      ipAddress: r.ipAddress,
      createdAt: r.createdAt,
      actor: r.actorName
        ? { name: r.actorName, email: r.actorEmail, image: r.actorImage }
        : null,
    }));

    const nextCursor = hasMore
      ? data[data.length - 1]?.createdAt?.toISOString()
      : null;

    return NextResponse.json({ data, nextCursor, hasMore });
  } catch (error) {
    console.error("GET /api/audit error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
