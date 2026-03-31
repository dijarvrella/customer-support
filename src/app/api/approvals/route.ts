import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { approvals } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pendingApprovals = await db.query.approvals.findMany({
      where: and(
        eq(approvals.approverId, session.user.id),
        eq(approvals.status, "pending")
      ),
      with: {
        ticket: {
          columns: {
            id: true,
            ticketNumber: true,
            title: true,
            description: true,
            status: true,
            priority: true,
            formType: true,
            formData: true,
            createdAt: true,
          },
          with: {
            requester: {
              columns: { id: true, name: true, email: true, image: true },
            },
          },
        },
      },
    });

    return NextResponse.json(pendingApprovals);
  } catch (error) {
    console.error("GET /api/approvals error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
