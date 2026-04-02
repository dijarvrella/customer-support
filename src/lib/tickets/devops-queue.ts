import { db } from "@/lib/db";
import { queues, teams, teamMemberships, users, tickets, ticketHistory } from "@/lib/db/schema";
import { eq, and, sql, count } from "drizzle-orm";
import { categorySlugUsesDevopsQueue } from "@/lib/constants";

const DEVOPS_QUEUE_NAME = "DevOps";
const IT_OPS_TEAM_NAME = "IT Operations";
const DEVOPS_TEAM_NAME = "DevOps";

/** Queue row named "DevOps", if present (seed / admin-created). */
export async function findDevopsQueueId(): Promise<string | null> {
  const [q] = await db
    .select({ id: queues.id })
    .from(queues)
    .where(eq(queues.name, DEVOPS_QUEUE_NAME))
    .limit(1);
  return q?.id ?? null;
}

export async function defaultQueueIdForCategorySlug(
  categorySlug: string | null | undefined
): Promise<string | null> {
  if (!categorySlugUsesDevopsQueue(categorySlug)) return null;
  return findDevopsQueueId();
}

/**
 * Round-robin assign to members of DevOps or IT Operations based on category.
 * Returns updated assignee/status when assignment ran; otherwise null.
 */
export async function autoAssignNewTicketToTeam(opts: {
  ticketId: string;
  categorySlug: string | null;
  approvalsCreatedCount: number;
}): Promise<{ assigneeId: string; status: string } | null> {
  const teamName = categorySlugUsesDevopsQueue(opts.categorySlug)
    ? DEVOPS_TEAM_NAME
    : IT_OPS_TEAM_NAME;

  const teamRow = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.name, teamName))
    .limit(1);

  if (teamRow.length === 0) return null;

  const teamId = teamRow[0].id;

  const members = await db
    .select({
      userId: teamMemberships.userId,
    })
    .from(teamMemberships)
    .innerJoin(users, eq(teamMemberships.userId, users.id))
    .where(and(eq(teamMemberships.teamId, teamId), eq(users.isActive, true)));

  if (members.length === 0) return null;

  const openStatuses = [
    "new",
    "triaged",
    "in_progress",
    "pending_info",
    "pending_vendor",
  ];
  const memberIds = members.map((m) => m.userId);

  const ticketCounts = await db
    .select({
      assigneeId: tickets.assigneeId,
      ticketCount: count(tickets.id),
    })
    .from(tickets)
    .where(
      and(
        sql`${tickets.assigneeId} IN (${sql.join(
          memberIds.map((id) => sql`${id}`),
          sql`, `
        )})`,
        sql`${tickets.status} IN (${sql.join(
          openStatuses.map((s) => sql`${s}`),
          sql`, `
        )})`
      )
    )
    .groupBy(tickets.assigneeId);

  const countMap = new Map<string, number>();
  for (const tc of ticketCounts) {
    if (tc.assigneeId) {
      countMap.set(tc.assigneeId, Number(tc.ticketCount));
    }
  }

  let bestMember = members[0];
  let bestCount = countMap.get(members[0].userId) ?? 0;
  for (const m of members) {
    const c = countMap.get(m.userId) ?? 0;
    if (c < bestCount) {
      bestCount = c;
      bestMember = m;
    }
  }

  const statusAfterAssign =
    opts.approvalsCreatedCount > 0 ? "pending_approval" : "triaged";

  await db
    .update(tickets)
    .set({
      assigneeId: bestMember.userId,
      status: statusAfterAssign,
    })
    .where(eq(tickets.id, opts.ticketId));

  await db.insert(ticketHistory).values({
    ticketId: opts.ticketId,
    actorId: null,
    fieldName: "assigneeId",
    oldValue: null,
    newValue: bestMember.userId,
    changeType: "auto_assignment",
  });

  await db.insert(ticketHistory).values({
    ticketId: opts.ticketId,
    actorId: null,
    fieldName: "status",
    oldValue: "new",
    newValue: statusAfterAssign,
    changeType: "auto_assignment",
  });

  return {
    assigneeId: bestMember.userId,
    status: statusAfterAssign,
  };
}
