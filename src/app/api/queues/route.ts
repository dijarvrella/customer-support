import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { queues, teams } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const results = await db
      .select({
        id: queues.id,
        name: queues.name,
        description: queues.description,
        autoAssign: queues.autoAssign,
        assignmentStrategy: queues.assignmentStrategy,
        isActive: queues.isActive,
        teamId: queues.teamId,
        teamName: teams.name,
        createdAt: queues.createdAt,
      })
      .from(queues)
      .leftJoin(teams, eq(queues.teamId, teams.id))
      .orderBy(queues.name);

    return NextResponse.json(results);
  } catch (error) {
    console.error("GET /api/queues error:", error);
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

    const role = (session.user as Record<string, unknown>).role as string;
    if (role !== "it_admin") {
      return NextResponse.json(
        { error: "Forbidden: requires it_admin role" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, teamId, description, autoAssign, assignmentStrategy } = body;

    if (!name || !teamId) {
      return NextResponse.json(
        { error: "Name and teamId are required" },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(queues)
      .values({
        name,
        teamId,
        description: description || null,
        autoAssign: autoAssign ?? false,
        assignmentStrategy: assignmentStrategy || "manual",
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/queues error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
