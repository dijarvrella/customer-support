import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

/** Case-insensitive lookup; creates a minimal portal user if missing (e.g. approver from Graph). */
export async function findOrCreateUserByEmail(
  email: string,
  name?: string
): Promise<{ id: string }> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`LOWER(${users.email}) = LOWER(${email})`)
    .limit(1);

  if (existing.length > 0) return existing[0];

  const [created] = await db
    .insert(users)
    .values({
      email: email.toLowerCase(),
      name: name || email.split("@")[0],
      role: "end_user",
      isActive: true,
    })
    .returning({ id: users.id });

  return created;
}
