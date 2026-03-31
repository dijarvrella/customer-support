import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, teams, teamMemberships, queues } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    // Verify user exists
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
      columns: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get queues via team_memberships -> teams -> queues
    const result = await db
      .select({
        queueId: queues.id,
        queueName: queues.name,
        teamId: teams.id,
        teamName: teams.name,
        membershipRole: teamMemberships.role,
      })
      .from(teamMemberships)
      .innerJoin(teams, eq(teamMemberships.teamId, teams.id))
      .innerJoin(queues, eq(queues.teamId, teams.id))
      .where(eq(teamMemberships.userId, id));

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/users/[id]/queues error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only it_admin can manage queue memberships
    const currentRole = (session.user as Record<string, unknown>).role as string;
    if (currentRole !== "it_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();

    if (!body.queueId) {
      return NextResponse.json(
        { error: "queueId is required" },
        { status: 400 }
      );
    }

    // Verify user exists
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
      columns: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Find the queue and its team
    const queue = await db.query.queues.findFirst({
      where: eq(queues.id, body.queueId),
    });

    if (!queue) {
      return NextResponse.json({ error: "Queue not found" }, { status: 404 });
    }

    // Check if user is already a member of this team
    const existingMembership = await db
      .select()
      .from(teamMemberships)
      .where(
        and(
          eq(teamMemberships.teamId, queue.teamId),
          eq(teamMemberships.userId, id)
        )
      );

    if (existingMembership.length > 0) {
      return NextResponse.json(
        { error: "User is already a member of this queue's team" },
        { status: 409 }
      );
    }

    // Add user to the queue's team
    const [membership] = await db
      .insert(teamMemberships)
      .values({
        teamId: queue.teamId,
        userId: id,
        role: "member",
      })
      .returning();

    return NextResponse.json(membership, { status: 201 });
  } catch (error) {
    console.error("POST /api/users/[id]/queues error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only it_admin can manage queue memberships
    const currentRole = (session.user as Record<string, unknown>).role as string;
    if (currentRole !== "it_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();

    if (!body.queueId) {
      return NextResponse.json(
        { error: "queueId is required" },
        { status: 400 }
      );
    }

    // Find the queue and its team
    const queue = await db.query.queues.findFirst({
      where: eq(queues.id, body.queueId),
    });

    if (!queue) {
      return NextResponse.json({ error: "Queue not found" }, { status: 404 });
    }

    // Remove user from the queue's team
    const deleted = await db
      .delete(teamMemberships)
      .where(
        and(
          eq(teamMemberships.teamId, queue.teamId),
          eq(teamMemberships.userId, id)
        )
      )
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: "User is not a member of this queue's team" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/users/[id]/queues error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
