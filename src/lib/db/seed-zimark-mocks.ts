/**
 * Optional demo data for the Zimark tenant (safe for demos).
 *
 * - Does not call Graph/automation APIs — only inserts DB rows.
 * - Offboarding example uses a fictional person and @example.com email so
 *   running "Run Offboarding Automation" would target a non-production UPN
 *   (still avoid clicking it on shared demos).
 * - Pending-approval tickets include approval rows here only to demo the UI; real
 *   tickets get approvals from the portal form (org chart / supervisor) or when
 *   IT uses "Request approval from…" on the ticket.
 *
 * Usage: DATABASE_URL=... npx tsx src/lib/db/seed-zimark-mocks.ts
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const db = drizzle(neon(connectionString), { schema });

function genTicketNum(): string {
  return `IT-2026${Math.floor(10000 + Math.random() * 89999)}`;
}

function daysAgo(d: number): Date {
  const x = new Date();
  x.setDate(x.getDate() - d);
  return x;
}

function hoursAgo(h: number): Date {
  const x = new Date();
  x.setHours(x.getHours() - h);
  return x;
}

async function userIdByEmail(email: string): Promise<string | undefined> {
  const row = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(sql`LOWER(${schema.users.email}) = LOWER(${email})`)
    .limit(1);
  return row[0]?.id;
}

async function main() {
  const dijar = await userIdByEmail("dijar.v@zimark.io");
  const rron = await userIdByEmail("rron.b@zimark.io");
  const arbnor = await userIdByEmail("arbnor.m@zimark.io");

  if (!dijar || !rron) {
    console.error("Need dijar.v@zimark.io and rron.b@zimark.io in users. Run db:seed first.");
    process.exit(1);
  }

  type MockRow = {
    ticketNumber: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    categorySlug: string;
    requesterId: string;
    assigneeId: string | null;
    source: string;
    formType: string | null;
    formData: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
    resolvedAt?: Date | null;
    closedAt?: Date | null;
    firstResponseAt?: Date | null;
    slaResponseDue?: Date | null;
    slaResolutionDue?: Date | null;
    /** Create approval row(s) so "Pending approval" shows who must approve */
    pendingApprovers?: { userId: string; role: string }[];
    /** After insert: add this internal comment */
    internalNote?: string;
  };

  const onboardingNum = genTicketNum();

  const rows: MockRow[] = [
    {
      ticketNumber: onboardingNum,
      title: "Onboarding: Keith Wellborn (US Sales)",
      description:
        "New employee onboarding request for Keith Wellborn joining the US Sales team. Start date: April 7, 2026.\n\nRequested: Dell Latitude Kit, Microsoft 365 Business Premium, Slack, AWS VPN Client, HubSpot access.",
      status: "in_progress",
      priority: "high",
      categorySlug: "employee-onboarding",
      requesterId: dijar,
      assigneeId: rron,
      source: "portal",
      formType: "employee-onboarding",
      formData: {
        first_name: "Keith",
        last_name: "Wellborn",
        department: "bizdev",
        job_title: "Sales Director US",
        employment_type: "full_time",
        start_date: "2026-04-07",
        kit_type: "dell_latitude",
        license_type: "business_premium",
        supervisor_email: "Hilla.HM@zimark.io",
      },
      createdAt: daysAgo(3),
      updatedAt: hoursAgo(4),
      slaResponseDue: daysAgo(2.9),
      slaResolutionDue: daysAgo(1),
      internalNote:
        "Entra account created. Waiting for license assignment - checking available seats.",
    },
    {
      ticketNumber: genTicketNum(),
      title: "Offboarding: Contractor — Taylor Sample (demo)",
      description:
        "Fictional end-of-contract offboarding for demo only. Last working day: March 31, 2026.\n\nMailbox: Convert to shared mailbox. OneDrive: Transfer to manager. Device return: shipping label sent.\n\nCompany email below is fake (@example.com) — safe for mock data.",
      status: "in_progress",
      priority: "high",
      categorySlug: "employee-offboarding",
      requesterId: dijar,
      assigneeId: dijar,
      source: "portal",
      formType: "employee-offboarding",
      formData: {
        first_name: "Taylor",
        last_name: "Sample",
        company_email: "taylor.sample.contractor@example.com",
        termination_type: "end_of_contract",
        last_working_day: "2026-03-31",
        mailbox_action: "shared_mailbox",
        device_return_required: true,
      },
      createdAt: daysAgo(5),
      updatedAt: hoursAgo(2),
    },
    {
      ticketNumber: genTicketNum(),
      title: "Grant Access: AWS Console — Inbar Senesh",
      description:
        "Inbar Senesh needs read-write access to the staging AWS account for the new microservices project. Duration: 90 days.",
      status: "pending_approval",
      priority: "medium",
      categorySlug: "grant-access",
      requesterId: dijar,
      assigneeId: rron,
      source: "portal",
      formType: null,
      formData: {
        system: "AWS Console - Staging Account",
        access_level: "read-write",
        justification: "Microservices project development",
        duration: "90_days",
      },
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
      pendingApprovers: arbnor
        ? [{ userId: arbnor, role: "security" }]
        : [{ userId: rron, role: "it_admin" }],
    },
    {
      ticketNumber: genTicketNum(),
      title: "Open port 8443 from dev VPC to production API gateway",
      description:
        "Benny asked to open port 8443/TCP from the dev VPC (10.0.3.0/24) to the production API gateway (10.0.1.50) for the new service mesh deployment. Needed by end of week.",
      status: "pending_approval",
      priority: "medium",
      categorySlug: "firewall-change",
      requesterId: dijar,
      assigneeId: rron,
      source: "slack",
      formType: null,
      formData: {
        source_ip: "10.0.3.0/24",
        destination_ip: "10.0.1.50",
        port: "8443/TCP",
        direction: "outbound",
        justification: "Service mesh deployment",
      },
      createdAt: daysAgo(2),
      updatedAt: daysAgo(1),
      pendingApprovers: [{ userId: rron, role: "it_lead" }],
    },
  ];

  let created = 0;

  for (const t of rows) {
    try {
      const [inserted] = await db
        .insert(schema.tickets)
        .values({
          ticketNumber: t.ticketNumber,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          categorySlug: t.categorySlug,
          requesterId: t.requesterId,
          assigneeId: t.assigneeId,
          source: t.source,
          formType: t.formType,
          formData: t.formData,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          resolvedAt: t.resolvedAt ?? null,
          closedAt: t.closedAt ?? null,
          firstResponseAt: t.firstResponseAt ?? null,
          slaResponseDue: t.slaResponseDue ?? null,
          slaResolutionDue: t.slaResolutionDue ?? null,
        })
        .onConflictDoNothing({ target: schema.tickets.ticketNumber })
        .returning({ id: schema.tickets.id });

      if (!inserted) {
        console.log("  Skip (exists):", t.ticketNumber);
        continue;
      }

      created++;

      if (t.pendingApprovers) {
        for (const a of t.pendingApprovers) {
          await db.insert(schema.approvals).values({
            ticketId: inserted.id,
            approverId: a.userId,
            approverRole: a.role,
            status: "pending",
          });
        }
      }

      await db.insert(schema.ticketComments).values({
        ticketId: inserted.id,
        authorId: rron,
        body: "Looking into this now. Will update shortly.",
        isInternal: false,
        source: "portal",
      });

      if (t.internalNote) {
        await db.insert(schema.ticketComments).values({
          ticketId: inserted.id,
          authorId: rron,
          body: t.internalNote,
          isInternal: true,
          source: "portal",
        });
      }

      console.log("  Created:", t.ticketNumber, t.title.slice(0, 48));
    } catch (e) {
      console.error("  Failed:", t.title, e);
    }
  }

  console.log(`\nInserted ${created} new mock ticket(s).`);
  process.exit(0);
}

main();
