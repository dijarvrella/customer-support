import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
  unique,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ─── TENANTS ───────────────────────────────────────────────────────────────
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  domain: varchar("domain", { length: 255 }),
  logoUrl: varchar("logo_url", { length: 1000 }),
  primaryColor: varchar("primary_color", { length: 64 }),
  supportEmail: varchar("support_email", { length: 255 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── TENANT OAUTH CONFIGS ──────────────────────────────────────────────────
export const tenantOauthConfigs = pgTable(
  "tenant_oauth_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    provider: varchar("provider", { length: 64 }).notNull(),
    clientId: varchar("client_id", { length: 255 }).notNull(),
    clientSecret: varchar("client_secret", { length: 500 }).notNull(),
    tenantIdValue: varchar("tenant_id_value", { length: 255 }),
    issuer: varchar("issuer", { length: 500 }),
    additionalConfig: jsonb("additional_config"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_tenant_oauth_tenant").on(table.tenantId),
    unique("uq_tenant_oauth_provider").on(table.tenantId, table.provider),
  ]
);

// ─── USERS ──────────────────────────────────────────────────────────────────
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    password: varchar("password", { length: 255 }), // hashed, null for SSO-only
    image: varchar("image", { length: 1000 }),
    entraObjectId: varchar("entra_object_id", { length: 255 }).unique(),
    slackUserId: varchar("slack_user_id", { length: 64 }),
    slackDisplayName: varchar("slack_display_name", { length: 255 }),
    department: varchar("department", { length: 128 }),
    jobTitle: varchar("job_title", { length: 255 }),
    managerId: uuid("manager_id"),
    officeLocation: varchar("office_location", { length: 255 }),
    phone: varchar("phone", { length: 64 }),
    role: varchar("role", { length: 32 }).notNull().default("end_user"),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_users_email").on(table.email),
    index("idx_users_role").on(table.role),
    index("idx_users_slack").on(table.slackUserId),
    index("idx_users_tenant").on(table.tenantId),
  ]
);

// ─── TEAMS ──────────────────────────────────────────────────────────────────
export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    name: varchar("name", { length: 128 }).notNull().unique(),
    description: text("description"),
    leadId: uuid("lead_id").references(() => users.id),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("idx_teams_tenant").on(table.tenantId)]
);

export const teamMemberships = pgTable("team_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  role: varchar("role", { length: 32 }).notNull().default("member"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── QUEUES ─────────────────────────────────────────────────────────────────
export const queues = pgTable(
  "queues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    name: varchar("name", { length: 128 }).notNull().unique(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),
    description: text("description"),
    autoAssign: boolean("auto_assign").notNull().default(false),
    assignmentStrategy: varchar("assignment_strategy", { length: 32 }).default(
      "manual"
    ),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("idx_queues_tenant").on(table.tenantId)]
);

// ─── CATEGORIES ─────────────────────────────────────────────────────────────
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    name: varchar("name", { length: 128 }).notNull(),
    slug: varchar("slug", { length: 128 }).notNull().unique(),
    description: text("description"),
    parentId: uuid("parent_id"),
    defaultQueueId: uuid("default_queue_id").references(() => queues.id),
    isActive: boolean("is_active").notNull().default(true),
    displayOrder: integer("display_order").default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("idx_categories_tenant").on(table.tenantId)]
);

// ─── TICKETS ────────────────────────────────────────────────────────────────
export const tickets = pgTable(
  "tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    ticketNumber: varchar("ticket_number", { length: 20 }).notNull().unique(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 32 }).notNull().default("new"),
    priority: varchar("priority", { length: 16 }).notNull().default("medium"),
    categorySlug: varchar("category_slug", { length: 128 }),
    requesterId: uuid("requester_id")
      .notNull()
      .references(() => users.id),
    assigneeId: uuid("assignee_id").references(() => users.id),
    queueId: uuid("queue_id").references(() => queues.id),
    source: varchar("source", { length: 32 }).notNull().default("portal"),
    formData: jsonb("form_data"),
    formType: varchar("form_type", { length: 64 }),
    tags: text("tags"),
    slaResponseDue: timestamp("sla_response_due"),
    slaResolutionDue: timestamp("sla_resolution_due"),
    slaResponseMet: boolean("sla_response_met"),
    slaResolutionMet: boolean("sla_resolution_met"),
    firstResponseAt: timestamp("first_response_at"),
    resolvedAt: timestamp("resolved_at"),
    closedAt: timestamp("closed_at"),
    legalHold: boolean("legal_hold").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_tickets_number").on(table.ticketNumber),
    index("idx_tickets_status").on(table.status),
    index("idx_tickets_priority").on(table.priority),
    index("idx_tickets_requester").on(table.requesterId),
    index("idx_tickets_assignee").on(table.assigneeId),
    index("idx_tickets_queue").on(table.queueId),
    index("idx_tickets_created").on(table.createdAt),
    index("idx_tickets_tenant").on(table.tenantId),
  ]
);

// ─── TICKET COMMENTS ────────────────────────────────────────────────────────
export const ticketComments = pgTable(
  "ticket_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    isInternal: boolean("is_internal").notNull().default(false),
    source: varchar("source", { length: 32 }).default("portal"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("idx_comments_ticket").on(table.ticketId)]
);

// ─── TICKET HISTORY ─────────────────────────────────────────────────────────
export const ticketHistory = pgTable(
  "ticket_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id),
    fieldName: varchar("field_name", { length: 128 }).notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    changeType: varchar("change_type", { length: 32 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("idx_history_ticket").on(table.ticketId)]
);

// ─── APPROVALS ──────────────────────────────────────────────────────────────
export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    approverId: uuid("approver_id")
      .notNull()
      .references(() => users.id),
    approverRole: varchar("approver_role", { length: 64 }),
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    decision: varchar("decision", { length: 16 }),
    comment: text("comment"),
    decidedAt: timestamp("decided_at"),
    dueAt: timestamp("due_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_approvals_ticket").on(table.ticketId),
    index("idx_approvals_approver").on(table.approverId),
    index("idx_approvals_status").on(table.status),
  ]
);

// ─── WORKFLOW APPROVAL CONFIG (per category: Entra flags + designated emails) ─
export const workflowApprovalConfigs = pgTable(
  "workflow_approval_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categorySlug: varchar("category_slug", { length: 128 }).notNull().unique(),
    requestTypeLabel: varchar("request_type_label", { length: 255 }).notNull(),
    uiCategory: varchar("ui_category", { length: 32 }).notNull().default("identity"),
    includeEntraManager: boolean("include_entra_manager").notNull().default(true),
    includeEntraCiso: boolean("include_entra_ciso").notNull().default(false),
    designatedApprovers: jsonb("designated_approvers")
      .$type<Array<{ email: string; name?: string; roleLabel?: string }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    notes: text("notes"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("idx_workflow_approval_slug").on(table.categorySlug)]
);

// ─── SLACK MESSAGE LINKS ────────────────────────────────────────────────────
export const slackMessageLinks = pgTable(
  "slack_message_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    channelId: varchar("channel_id", { length: 64 }).notNull(),
    channelName: varchar("channel_name", { length: 128 }),
    messageTs: varchar("message_ts", { length: 64 }).notNull(),
    threadTs: varchar("thread_ts", { length: 64 }),
    slackUserId: varchar("slack_user_id", { length: 64 }).notNull(),
    slackDisplayName: varchar("slack_display_name", { length: 255 }),
    slackUserEmail: varchar("slack_user_email", { length: 255 }),
    originalText: text("original_text"),
    permalink: varchar("permalink", { length: 1000 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_slack_ticket").on(table.ticketId),
    uniqueIndex("idx_slack_channel_ts").on(table.channelId, table.messageTs),
  ]
);

// ─── AUDIT LOG ──────────────────────────────────────────────────────────────
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    entityType: varchar("entity_type", { length: 64 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    actorId: uuid("actor_id").references(() => users.id),
    actorType: varchar("actor_type", { length: 32 }).default("user"),
    action: varchar("action", { length: 64 }).notNull(),
    details: jsonb("details"),
    ipAddress: varchar("ip_address", { length: 45 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_audit_entity").on(table.entityType, table.entityId),
    index("idx_audit_actor").on(table.actorId),
    index("idx_audit_created").on(table.createdAt),
  ]
);

// ─── IN-APP NOTIFICATIONS ───────────────────────────────────────────────────
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    ticketId: uuid("ticket_id").references(() => tickets.id),
    type: varchar("type", { length: 64 }).notNull(), // reminder, sla_warning, approval_needed, status_change, comment
    title: varchar("title", { length: 500 }).notNull(),
    body: text("body"),
    isRead: boolean("is_read").notNull().default(false),
    link: varchar("link", { length: 500 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_notifications_user").on(table.userId),
    index("idx_notifications_read").on(table.userId, table.isRead),
  ]
);

// ─── RELATIONS ──────────────────────────────────────────────────────────────
export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  tickets: many(tickets),
  oauthConfigs: many(tenantOauthConfigs),
}));

export const tenantOauthConfigsRelations = relations(
  tenantOauthConfigs,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [tenantOauthConfigs.tenantId],
      references: [tenants.id],
    }),
  })
);

export const usersRelations = relations(users, ({ many, one }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  requestedTickets: many(tickets, { relationName: "requester" }),
  assignedTickets: many(tickets, { relationName: "assignee" }),
  comments: many(ticketComments),
  approvals: many(approvals),
  manager: one(users, {
    fields: [users.managerId],
    references: [users.id],
    relationName: "manager",
  }),
}));

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [tickets.tenantId],
    references: [tenants.id],
  }),
  requester: one(users, {
    fields: [tickets.requesterId],
    references: [users.id],
    relationName: "requester",
  }),
  assignee: one(users, {
    fields: [tickets.assigneeId],
    references: [users.id],
    relationName: "assignee",
  }),
  queue: one(queues, {
    fields: [tickets.queueId],
    references: [queues.id],
  }),
  comments: many(ticketComments),
  history: many(ticketHistory),
  approvals: many(approvals),
  slackLinks: many(slackMessageLinks),
}));

export const ticketCommentsRelations = relations(ticketComments, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketComments.ticketId],
    references: [tickets.id],
  }),
  author: one(users, {
    fields: [ticketComments.authorId],
    references: [users.id],
  }),
}));

export const approvalsRelations = relations(approvals, ({ one }) => ({
  ticket: one(tickets, {
    fields: [approvals.ticketId],
    references: [tickets.id],
  }),
  approver: one(users, {
    fields: [approvals.approverId],
    references: [users.id],
  }),
}));

export const queuesRelations = relations(queues, ({ one, many }) => ({
  team: one(teams, {
    fields: [queues.teamId],
    references: [teams.id],
  }),
  tickets: many(tickets),
}));
