import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// ─── DATABASE CONNECTION ───────────────────────────────────────────────────

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL environment variable is not set.");
  console.error("Make sure your .env file is loaded or the variable is exported.");
  process.exit(1);
}

const sql = neon(connectionString);
const db = drizzle(sql, { schema });

// ─── FIXED IDS ─────────────────────────────────────────────────────────────

const USER_IDS = {
  admin: "00000000-0000-0000-0000-000000000001",
  agent: "00000000-0000-0000-0000-000000000002",
  user: "00000000-0000-0000-0000-000000000003",
  hr: "00000000-0000-0000-0000-000000000004",
  security: "00000000-0000-0000-0000-000000000005",
};

const TEAM_IDS = {
  itOps: "10000000-0000-0000-0000-000000000001",
  security: "10000000-0000-0000-0000-000000000002",
  devOps: "10000000-0000-0000-0000-000000000003",
};

const QUEUE_IDS = {
  generalIT: "20000000-0000-0000-0000-000000000001",
  security: "20000000-0000-0000-0000-000000000002",
  devOps: "20000000-0000-0000-0000-000000000003",
};

/** Zimark DevOps members (queue round-robin) */
const ZIMAR_DIJAR_ID = "b0000000-0000-0000-0000-000000000001";
const ZIMAR_NICO_ID = "b0000000-0000-0000-0000-000000000004";

const CATEGORY_IDS = {
  generalIT: "30000000-0000-0000-0000-000000000001",
  identityAccess: "30000000-0000-0000-0000-000000000002",
  hardware: "30000000-0000-0000-0000-000000000003",
};

const TICKET_IDS = {
  t1: "40000000-0000-0000-0000-000000000001",
  t2: "40000000-0000-0000-0000-000000000002",
  t3: "40000000-0000-0000-0000-000000000003",
  t4: "40000000-0000-0000-0000-000000000004",
  t5: "40000000-0000-0000-0000-000000000005",
  t6: "40000000-0000-0000-0000-000000000006",
  t7: "40000000-0000-0000-0000-000000000007",
  t8: "40000000-0000-0000-0000-000000000008",
  t9: "40000000-0000-0000-0000-000000000009",
  t10: "40000000-0000-0000-0000-000000000010",
};

const TENANT_IDS = {
  zimark: "a0000000-0000-0000-0000-000000000001",
  demo: "a0000000-0000-0000-0000-000000000002",
};

// ─── SEED FUNCTIONS ────────────────────────────────────────────────────────

async function seedTenants() {
  console.log("Seeding tenants...");
  await db
    .insert(schema.tenants)
    .values([
      {
        id: TENANT_IDS.zimark,
        name: "Zimark",
        slug: "zimark",
        domain: "zimark.link",
        logoUrl: "/logo.svg",
        primaryColor: "222.2 47.4% 11.2%",
        supportEmail: "it-support@zimark.com",
        isActive: true,
      },
      {
        id: TENANT_IDS.demo,
        name: "Demo Company",
        slug: "demo",
        domain: "demo-company.com",
        logoUrl: "/logo-icon.svg",
        primaryColor: "262.1 83.3% 57.8%",
        supportEmail: "support@demo-company.com",
        isActive: true,
      },
    ])
    .onConflictDoNothing();
  console.log("  Tenants seeded.");
}

async function seedUsers() {
  console.log("Seeding users...");
  await db
    .insert(schema.users)
    .values([
      {
        id: USER_IDS.admin,
        email: "admin@demo-company.com",
        name: "Demo IT Admin",
        role: "it_admin",
        department: "IT",
        jobTitle: "IT Administrator",
        tenantId: TENANT_IDS.demo,
        isActive: true,
      },
      {
        id: USER_IDS.agent,
        email: "agent@demo-company.com",
        name: "Demo IT Agent",
        role: "it_agent",
        department: "IT",
        jobTitle: "IT Support Agent",
        tenantId: TENANT_IDS.demo,
        isActive: true,
      },
      {
        id: USER_IDS.user,
        email: "user@demo-company.com",
        name: "John Employee",
        role: "end_user",
        department: "R&D",
        jobTitle: "Software Engineer",
        tenantId: TENANT_IDS.demo,
        isActive: true,
      },
      {
        id: USER_IDS.hr,
        email: "hr@demo-company.com",
        name: "Sarah HR",
        role: "hr",
        department: "HR",
        jobTitle: "HR Manager",
        tenantId: TENANT_IDS.demo,
        isActive: true,
      },
      {
        id: USER_IDS.security,
        email: "security@demo-company.com",
        name: "Security Reviewer",
        role: "security",
        department: "Security",
        jobTitle: "Security Analyst",
        tenantId: TENANT_IDS.demo,
        isActive: true,
      },
      {
        id: "00000000-0000-0000-0000-000000000099",
        email: "admin@zimark.io",
        name: "Zimark Admin",
        role: "it_admin",
        department: "IT",
        jobTitle: "Support Administrator",
        tenantId: TENANT_IDS.zimark,
        isActive: true,
      },
      // Zimark tenant admins
      {
        id: "b0000000-0000-0000-0000-000000000001",
        email: "dijar.v@zimark.io",
        name: "Dijar V.",
        role: "it_admin",
        department: "IT",
        jobTitle: "IT Administrator",
        tenantId: TENANT_IDS.zimark,
        isActive: true,
      },
      {
        id: "b0000000-0000-0000-0000-000000000002",
        email: "rron.b@zimark.io",
        name: "Rron B.",
        role: "it_admin",
        department: "IT",
        jobTitle: "IT Administrator",
        tenantId: TENANT_IDS.zimark,
        isActive: true,
      },
      {
        id: "b0000000-0000-0000-0000-000000000003",
        email: "arbnor.m@zimark.io",
        name: "Arbnor M.",
        role: "it_admin",
        department: "IT",
        jobTitle: "IT Administrator",
        tenantId: TENANT_IDS.zimark,
        isActive: true,
      },
      {
        id: ZIMAR_NICO_ID,
        email: "nico.aroyo@zimark.io",
        name: "Nico Aroyo",
        role: "it_agent",
        department: "Engineering",
        jobTitle: "DevOps Engineer",
        tenantId: TENANT_IDS.zimark,
        isActive: true,
      },
      // Global admin
      {
        id: "c0000000-0000-0000-0000-000000000001",
        email: "dijar@digitaldisruptor.tech",
        name: "Dijar (Global Admin)",
        role: "it_admin",
        department: "Platform",
        jobTitle: "Global Administrator",
        isActive: true,
      },
    ])
    .onConflictDoNothing();
  console.log("  Users seeded.");
}

async function seedTeams() {
  console.log("Seeding teams...");
  await db
    .insert(schema.teams)
    .values([
      {
        id: TEAM_IDS.itOps,
        name: "IT Operations",
        description: "General IT operations and support team",
        leadId: USER_IDS.admin,
        isActive: true,
      },
      {
        id: TEAM_IDS.security,
        name: "Security",
        description: "Information security team",
        leadId: USER_IDS.security,
        isActive: true,
      },
      {
        id: TEAM_IDS.devOps,
        name: "DevOps",
        description:
          "Cloud infrastructure (AWS, Azure) — owns the DevOps queue; Nico & Dijar",
        leadId: ZIMAR_DIJAR_ID,
        tenantId: TENANT_IDS.zimark,
        isActive: true,
      },
    ])
    .onConflictDoNothing();
  console.log("  Teams seeded.");
}

async function seedQueues() {
  console.log("Seeding queues...");
  await db
    .insert(schema.queues)
    .values([
      {
        id: QUEUE_IDS.generalIT,
        name: "General IT",
        teamId: TEAM_IDS.itOps,
        description: "General IT support queue",
        autoAssign: false,
        assignmentStrategy: "manual",
        isActive: true,
      },
      {
        id: QUEUE_IDS.security,
        name: "Security",
        teamId: TEAM_IDS.security,
        description: "Security-related requests and reviews",
        autoAssign: false,
        assignmentStrategy: "manual",
        isActive: true,
      },
      {
        id: QUEUE_IDS.devOps,
        name: "DevOps",
        teamId: TEAM_IDS.devOps,
        description:
          "AWS IAM, Azure/Entra changes, and cloud infra — auto-routed from those request types",
        tenantId: TENANT_IDS.zimark,
        autoAssign: false,
        assignmentStrategy: "manual",
        isActive: true,
      },
    ])
    .onConflictDoNothing();
  console.log("  Queues seeded.");
}

async function seedTeamMemberships() {
  console.log("Seeding team memberships...");
  await db.insert(schema.teamMemberships).values([
    {
      teamId: TEAM_IDS.devOps,
      userId: ZIMAR_DIJAR_ID,
      role: "member",
    },
    {
      teamId: TEAM_IDS.devOps,
      userId: ZIMAR_NICO_ID,
      role: "member",
    },
  ]);
  console.log("  Team memberships seeded.");
}

async function seedCategories() {
  console.log("Seeding categories...");
  await db
    .insert(schema.categories)
    .values([
      {
        id: CATEGORY_IDS.generalIT,
        name: "General IT Support",
        slug: "general-it",
        description: "General IT support and troubleshooting",
        defaultQueueId: QUEUE_IDS.generalIT,
        isActive: true,
        displayOrder: 1,
      },
      {
        id: CATEGORY_IDS.identityAccess,
        name: "Identity & Access",
        slug: "identity-access",
        description: "Identity management and access requests",
        defaultQueueId: QUEUE_IDS.generalIT,
        isActive: true,
        displayOrder: 2,
      },
      {
        id: CATEGORY_IDS.hardware,
        name: "Hardware & Devices",
        slug: "hardware",
        description: "Hardware requests, repairs, and provisioning",
        defaultQueueId: QUEUE_IDS.generalIT,
        isActive: true,
        displayOrder: 3,
      },
    ])
    .onConflictDoNothing();
  console.log("  Categories seeded.");
}

async function seedTickets() {
  console.log("Seeding tickets...");
  await db
    .insert(schema.tickets)
    .values([
      // 1. Laptop not connecting to WiFi
      {
        id: TICKET_IDS.t1,
        ticketNumber: "IT-202600001",
        title: "Laptop not connecting to WiFi",
        description:
          "My Dell laptop stopped connecting to the office WiFi network since this morning. I've tried restarting the laptop and forgetting/reconnecting to the network but it still won't connect. Other devices on the same network work fine.",
        status: "in_progress",
        priority: "medium",
        categorySlug: "general-it",
        requesterId: USER_IDS.user,
        assigneeId: USER_IDS.agent,
        queueId: QUEUE_IDS.generalIT,
        source: "portal",
        createdAt: daysAgo(5),
        updatedAt: daysAgo(3),
      },
      // 2. Need access to Salesforce
      {
        id: TICKET_IDS.t2,
        ticketNumber: "IT-202600002",
        title: "Need access to Salesforce",
        description:
          "I need access to the Salesforce CRM platform for my new role on the BizDev team. My manager has approved this request verbally.",
        status: "pending_approval",
        priority: "medium",
        categorySlug: "identity-access",
        requesterId: USER_IDS.user,
        queueId: QUEUE_IDS.generalIT,
        source: "portal",
        createdAt: daysAgo(3),
        updatedAt: daysAgo(2),
      },
      // 3. Onboarding: Alice Williams
      {
        id: TICKET_IDS.t3,
        ticketNumber: "IT-202600003",
        title: "Onboarding: Alice Williams",
        description:
          "New employee onboarding request for Alice Williams joining the R&D department.",
        status: "in_progress",
        priority: "high",
        categorySlug: "identity-access",
        requesterId: USER_IDS.hr,
        assigneeId: USER_IDS.agent,
        queueId: QUEUE_IDS.generalIT,
        source: "portal",
        formType: "employee-onboarding",
        formData: {
          first_name: "Alice",
          last_name: "Williams",
          personal_email: "alice.williams@gmail.com",
          personal_phone: "+1-555-0142",
          job_title: "Senior Software Engineer",
          department: "rnd",
          employment_type: "full_time",
          legal_entity: "Zimark Inc.",
          office_location: "hq",
          time_zone: "America/New_York",
          start_date: "2026-04-14",
          supervisor_name: "John Employee",
          supervisor_email: "user@company.com",
          role_template: "engineering_standard",
          additional_apps: ["slack", "microsoft_365", "notion", "vscode", "git"],
          aws_access_required: true,
          aws_role: "developer_rw",
          vpn_access: true,
          kit_type: "macbook_pro",
          peripherals: ["headphones_mic", "monitor", "keyboard", "mouse"],
        },
        createdAt: daysAgo(4),
        updatedAt: daysAgo(1),
      },
      // 4. VPN connection dropping
      {
        id: TICKET_IDS.t4,
        ticketNumber: "IT-202600004",
        title: "VPN connection dropping",
        description:
          "The AWS VPN client keeps disconnecting every 10-15 minutes. This started after the latest client update. I'm running macOS 15 with the latest VPN client version.",
        status: "new",
        priority: "high",
        categorySlug: "general-it",
        requesterId: USER_IDS.user,
        queueId: QUEUE_IDS.generalIT,
        source: "portal",
        createdAt: daysAgo(1),
        updatedAt: daysAgo(1),
      },
      // 5. Request new monitor
      {
        id: TICKET_IDS.t5,
        ticketNumber: "IT-202600005",
        title: "Request new monitor",
        description:
          "I'd like to request a second external monitor for my workstation. My current setup only has one monitor and I need dual screens for development work.",
        status: "new",
        priority: "low",
        categorySlug: "hardware",
        requesterId: USER_IDS.user,
        queueId: QUEUE_IDS.generalIT,
        source: "portal",
        createdAt: daysAgo(2),
        updatedAt: daysAgo(2),
      },
      // 6. Password reset for shared account
      {
        id: TICKET_IDS.t6,
        ticketNumber: "IT-202600006",
        title: "Password reset for shared account",
        description:
          "The shared service account for our CI/CD pipeline (devops-ci@company.com) needs a password reset. The current password appears to have expired.",
        status: "resolved",
        priority: "medium",
        categorySlug: "identity-access",
        requesterId: USER_IDS.user,
        assigneeId: USER_IDS.agent,
        queueId: QUEUE_IDS.generalIT,
        source: "portal",
        resolvedAt: daysAgo(1),
        createdAt: daysAgo(7),
        updatedAt: daysAgo(1),
      },
      // 7. Firewall rule change for staging
      {
        id: TICKET_IDS.t7,
        ticketNumber: "IT-202600007",
        title: "Firewall rule change for staging",
        description:
          "We need a firewall rule change to allow traffic from our staging environment (10.0.2.0/24) to the new API gateway on port 8443. This is needed for the upcoming release testing.",
        status: "pending_approval",
        priority: "medium",
        categorySlug: "general-it",
        requesterId: USER_IDS.agent,
        queueId: QUEUE_IDS.security,
        source: "portal",
        createdAt: daysAgo(3),
        updatedAt: daysAgo(2),
      },
      // 8. Offboarding: Bob Miller
      {
        id: TICKET_IDS.t8,
        ticketNumber: "IT-202600008",
        title: "Offboarding: Bob Miller",
        description:
          "Employee offboarding request for Bob Miller. Involuntary termination - immediate account disable required.",
        status: "in_progress",
        priority: "critical",
        categorySlug: "identity-access",
        requesterId: USER_IDS.hr,
        assigneeId: USER_IDS.admin,
        queueId: QUEUE_IDS.generalIT,
        source: "portal",
        formType: "employee-offboarding",
        formData: {
          first_name: "Bob",
          last_name: "Miller",
          company_email: "bob.miller@company.com",
          job_title: "Sales Manager",
          department: "bizdev",
          office_location: "HQ",
          termination_type: "involuntary",
          last_working_day: "2026-03-31",
          termination_effective_date: "2026-03-31",
          immediate_disable: true,
          supervisor_name: "Sarah HR",
          supervisor_email: "hr@company.com",
          hr_contact_email: "hr@company.com",
          mailbox_action: "shared_mailbox",
          onedrive_action: "transfer_manager",
          device_return_required: true,
          device_return_method: "in_office",
          legal_hold: false,
          privileged_account: false,
          high_risk: true,
        },
        legalHold: false,
        createdAt: daysAgo(1),
        updatedAt: hoursAgo(2),
      },
      // 9. Install VS Code on workstation
      {
        id: TICKET_IDS.t9,
        ticketNumber: "IT-202600009",
        title: "Install VS Code on workstation",
        description:
          "Please install Visual Studio Code on my workstation (WS-1042). I need it for a new project starting next week.",
        status: "closed",
        priority: "low",
        categorySlug: "general-it",
        requesterId: USER_IDS.user,
        assigneeId: USER_IDS.agent,
        queueId: QUEUE_IDS.generalIT,
        source: "portal",
        resolvedAt: daysAgo(5),
        closedAt: daysAgo(4),
        createdAt: daysAgo(10),
        updatedAt: daysAgo(4),
      },
      // 10. AWS IAM role request
      {
        id: TICKET_IDS.t10,
        ticketNumber: "IT-202600010",
        title: "AWS IAM role request",
        description:
          "I need a new IAM role created in the production AWS account with read-write access to S3 and DynamoDB for the data pipeline project. The role should have the trust policy for our ECS tasks.",
        status: "pending_approval",
        priority: "high",
        categorySlug: "identity-access",
        requesterId: USER_IDS.user,
        queueId: QUEUE_IDS.security,
        source: "portal",
        createdAt: daysAgo(2),
        updatedAt: daysAgo(1),
      },
    ])
    .onConflictDoNothing();
  console.log("  Tickets seeded.");
}

async function seedComments() {
  console.log("Seeding comments...");
  await db
    .insert(schema.ticketComments)
    .values([
      // Comments on ticket 1 (Laptop WiFi)
      {
        ticketId: TICKET_IDS.t1,
        authorId: USER_IDS.agent,
        body: "Hi John, I've checked the DHCP logs and it looks like your laptop's MAC address was blocked by the network access control policy. I've whitelisted it now. Can you try reconnecting?",
        isInternal: false,
        source: "portal",
        createdAt: daysAgo(4),
      },
      {
        ticketId: TICKET_IDS.t1,
        authorId: USER_IDS.user,
        body: "Thanks! I tried reconnecting but it's still not working. I get an 'Unable to obtain IP address' error.",
        isInternal: false,
        source: "portal",
        createdAt: daysAgo(4),
      },
      {
        ticketId: TICKET_IDS.t1,
        authorId: USER_IDS.agent,
        body: "Internal note: Escalating to network team. The MAC whitelist change may take up to 30 minutes to propagate across all APs.",
        isInternal: true,
        source: "portal",
        createdAt: daysAgo(3),
      },
      // Comments on ticket 3 (Onboarding)
      {
        ticketId: TICKET_IDS.t3,
        authorId: USER_IDS.agent,
        body: "Onboarding checklist started:\n- [x] Entra ID account created\n- [x] Microsoft 365 license assigned\n- [ ] Slack invite sent\n- [ ] AWS IAM role created\n- [ ] VPN access provisioned\n- [ ] MacBook Pro ordered\n- [ ] Peripherals ordered",
        isInternal: false,
        source: "portal",
        createdAt: daysAgo(3),
      },
      {
        ticketId: TICKET_IDS.t3,
        authorId: USER_IDS.hr,
        body: "The start date has been confirmed as April 14th. Please ensure the laptop and peripherals are shipped by April 10th. Alice will be working remotely for the first week.",
        isInternal: false,
        source: "portal",
        createdAt: daysAgo(2),
      },
    ])
    .onConflictDoNothing();
  console.log("  Comments seeded.");
}

async function seedApprovals() {
  console.log("Seeding approvals...");
  await db
    .insert(schema.approvals)
    .values([
      // Approval on ticket 2 (Salesforce access) - manager approval
      {
        ticketId: TICKET_IDS.t2,
        approverId: USER_IDS.admin,
        approverRole: "it_admin",
        status: "pending",
        dueAt: daysFromNow(3),
        createdAt: daysAgo(2),
      },
      // Approval on ticket 7 (Firewall rule change) - security approval
      {
        ticketId: TICKET_IDS.t7,
        approverId: USER_IDS.security,
        approverRole: "security",
        status: "pending",
        dueAt: daysFromNow(2),
        createdAt: daysAgo(2),
      },
      // Approval on ticket 10 (AWS IAM role) - security + admin approvals
      {
        ticketId: TICKET_IDS.t10,
        approverId: USER_IDS.security,
        approverRole: "security",
        status: "pending",
        dueAt: daysFromNow(3),
        createdAt: daysAgo(1),
      },
      {
        ticketId: TICKET_IDS.t10,
        approverId: USER_IDS.admin,
        approverRole: "it_admin",
        status: "pending",
        dueAt: daysFromNow(3),
        createdAt: daysAgo(1),
      },
    ])
    .onConflictDoNothing();
  console.log("  Approvals seeded.");
}

async function seedAuditLog() {
  console.log("Seeding audit log...");
  await db
    .insert(schema.auditLog)
    .values([
      {
        eventType: "ticket.created",
        entityType: "ticket",
        entityId: TICKET_IDS.t1,
        actorId: USER_IDS.user,
        actorType: "user",
        action: "create",
        details: { title: "Laptop not connecting to WiFi", priority: "medium" },
        createdAt: daysAgo(5),
      },
      {
        eventType: "ticket.assigned",
        entityType: "ticket",
        entityId: TICKET_IDS.t1,
        actorId: USER_IDS.admin,
        actorType: "user",
        action: "update",
        details: { field: "assigneeId", newValue: USER_IDS.agent },
        createdAt: daysAgo(5),
      },
      {
        eventType: "ticket.status_changed",
        entityType: "ticket",
        entityId: TICKET_IDS.t1,
        actorId: USER_IDS.agent,
        actorType: "user",
        action: "update",
        details: { field: "status", oldValue: "new", newValue: "in_progress" },
        createdAt: daysAgo(4),
      },
      {
        eventType: "ticket.created",
        entityType: "ticket",
        entityId: TICKET_IDS.t3,
        actorId: USER_IDS.hr,
        actorType: "user",
        action: "create",
        details: {
          title: "Onboarding: Alice Williams",
          priority: "high",
          formType: "employee-onboarding",
        },
        createdAt: daysAgo(4),
      },
      {
        eventType: "ticket.created",
        entityType: "ticket",
        entityId: TICKET_IDS.t8,
        actorId: USER_IDS.hr,
        actorType: "user",
        action: "create",
        details: {
          title: "Offboarding: Bob Miller",
          priority: "critical",
          formType: "employee-offboarding",
        },
        createdAt: daysAgo(1),
      },
      {
        eventType: "user.login",
        entityType: "user",
        entityId: USER_IDS.admin,
        actorId: USER_IDS.admin,
        actorType: "user",
        action: "login",
        details: { method: "credentials" },
        ipAddress: "192.168.1.100",
        createdAt: hoursAgo(6),
      },
      {
        eventType: "approval.requested",
        entityType: "approval",
        entityId: TICKET_IDS.t10,
        actorId: USER_IDS.user,
        actorType: "user",
        action: "create",
        details: { ticketTitle: "AWS IAM role request", approvers: ["security", "it_admin"] },
        createdAt: daysAgo(1),
      },
    ])
    .onConflictDoNothing();
  console.log("  Audit log seeded.");
}

// ─── HELPERS ───────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function hoursAgo(n: number): Date {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

// ─── MAIN ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("Starting seed...\n");

  try {
    await seedTenants();
    await seedUsers();
    await seedTeams();
    await seedQueues();
    await seedTeamMemberships();
    await seedCategories();
    await seedTickets();
    await seedComments();
    await seedApprovals();
    await seedAuditLog();

    console.log("\nSeed completed successfully!");
  } catch (error) {
    console.error("\nSeed failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

main();
