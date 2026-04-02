import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/lib/db/schema";
import { eq, sql, or, ilike } from "drizzle-orm";

function parseDatabaseUrlFromFile(filePath: string): string | undefined {
  if (!existsSync(filePath)) return undefined;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^DATABASE_URL=(.*)$/);
    if (!m) continue;
    let v = m[1].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    return v;
  }
  return undefined;
}

/** True for example .env lines that are not real Neon hosts. */
function isTemplateDatabaseUrl(url: string): boolean {
  const u = url.toLowerCase();
  if (u.includes("placeholder")) return true;
  if (u.includes("user:password@")) return true;
  if (/\/\/user:/.test(u) && u.includes("@host")) return true;
  return false;
}

/**
 * Resolution order:
 * 1. DATABASE_URL from the shell (e.g. `DATABASE_URL=... npm run db:update-nico`) if not a template
 * 2. `.env` then `.env.local` (Next-style: local wins)
 */
function resolveDatabaseUrl(): string | undefined {
  const shell = process.env.DATABASE_URL?.trim();
  if (shell && !isTemplateDatabaseUrl(shell)) return shell;

  let fromFiles: string | undefined;
  for (const name of [".env", ".env.local"]) {
    const parsed = parseDatabaseUrlFromFile(resolve(process.cwd(), name));
    if (parsed) fromFiles = parsed;
  }

  if (fromFiles && !isTemplateDatabaseUrl(fromFiles)) return fromFiles;

  return undefined;
}

const connectionString = resolveDatabaseUrl();
if (!connectionString) {
  console.error(`
Could not find a real DATABASE_URL.

Your .env still looks like a template (e.g. host "placeholder" or user:password@host).

Do one of the following:

  A) In Neon: Project → Branch → Connection string → copy "psql" or URI.
     Put it in .env.local (recommended) or .env:

     DATABASE_URL="postgresql://neondb_owner:....@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require"

  B) One-off without saving to disk:

     DATABASE_URL="postgresql://..." npm run db:update-nico
`);
  process.exit(1);
}

const db = drizzle(neon(connectionString), { schema });

const NICO_SEED_ID = "b0000000-0000-0000-0000-000000000004";
const newEmail = "nico.aroyo@zimark.io";
const newName = "Nico Aroyo";

async function main() {
  const byId = await db
    .update(schema.users)
    .set({
      email: newEmail,
      name: newName,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, NICO_SEED_ID))
    .returning({ id: schema.users.id, email: schema.users.email, name: schema.users.name });

  if (byId.length > 0) {
    console.log("Updated user by seed id:", byId[0]);
    return;
  }

  const byOldPlaceholder = await db
    .update(schema.users)
    .set({
      email: newEmail,
      name: newName,
      updatedAt: new Date(),
    })
    .where(eq(sql`lower(${schema.users.email})`, "nico@zimark.io"))
    .returning({ id: schema.users.id, email: schema.users.email, name: schema.users.name });

  if (byOldPlaceholder.length > 0) {
    console.log("Updated user by previous email nico@zimark.io:", byOldPlaceholder[0]);
    return;
  }

  const byRealEmail = await db
    .update(schema.users)
    .set({
      email: newEmail,
      name: newName,
      updatedAt: new Date(),
    })
    .where(eq(sql`lower(${schema.users.email})`, newEmail.toLowerCase()))
    .returning({ id: schema.users.id, email: schema.users.email, name: schema.users.name });

  if (byRealEmail.length > 0) {
    console.log("Nico already uses nico.aroyo@zimark.io — refreshed name / updatedAt:", byRealEmail[0]);
    return;
  }

  const hints = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
    })
    .from(schema.users)
    .where(
      or(
        ilike(schema.users.email, "%nico%"),
        ilike(schema.users.email, "%aroyo%")
      )
    )
    .limit(20);

  console.error(`
No user matched:
  • id ${NICO_SEED_ID} (only exists after a full db:seed with fixed UUIDs), or
  • email nico@zimark.io (old placeholder), or
  • email nico.aroyo@zimark.io

So either Nico has never been created in this database, or his email is spelled differently.
`);

  if (hints.length > 0) {
    console.error("Users whose email contains “nico” or “aroyo” (check these):");
    for (const h of hints) {
      console.error(`  ${h.id}  ${h.email}  (${h.name})`);
    }
  } else {
    console.error(
      "No matching hints. Next steps: run `npm run db:seed` (if you use seed users), or have Nico sign in once (SSO creates the user), then add him to the DevOps team / team_memberships in the DB or admin UI."
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
