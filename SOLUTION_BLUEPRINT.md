# IT Support Ticketing System - Solution Blueprint

**Document Version:** 1.0
**Date:** 2026-03-31
**Classification:** Internal - Engineering
**Project Codename:** Zimark ITSM

---

## Table of Contents

- [A. Executive Summary](#a-executive-summary)
- [B. Functional Requirements](#b-functional-requirements)
- [C. Non-Functional Requirements](#c-non-functional-requirements)
- [D. User Roles and Permissions](#d-user-roles-and-permissions)
- [E. Data Model](#e-data-model)
- [F. Ticket Taxonomy](#f-ticket-taxonomy)
- [G. Request Workflows](#g-request-workflows)
- [H. Onboarding Workflow Design](#h-onboarding-workflow-design)
- [I. Offboarding Workflow Design](#i-offboarding-workflow-design)
- [J. Slack Integration Design](#j-slack-integration-design)
- [K. SSO Design](#k-sso-design)
- [L. Automation Framework](#l-automation-framework)
- [M. Integration Architecture](#m-integration-architecture)
- [N. Admin and Operations Design](#n-admin-and-operations-design)
- [O. Reporting and Dashboards](#o-reporting-and-dashboards)
- [P. Security and Compliance](#p-security-and-compliance)
- [Q. API Design](#q-api-design)
- [R. Recommended Architecture](#r-recommended-architecture)
- [S. Suggested Technology Stack](#s-suggested-technology-stack)
- [T. Phased Delivery Plan](#t-phased-delivery-plan)
- [U. Risks and Design Tradeoffs](#u-risks-and-design-tradeoffs)
- [V. Sample User Journeys](#v-sample-user-journeys)
- [W. Additional Guidance](#w-additional-guidance)

---

## A. Executive Summary

### Purpose

This document defines the complete solution blueprint for an internal IT Support Ticketing System (ITSM platform) designed to serve IT, Security, IAM, Infrastructure, Network, Workplace, and HR-IT teams. The system replaces ad-hoc request handling (email, Slack DMs, spreadsheets) with a structured, auditable, and progressively automated service management platform.

### Goals

1. **Unified request intake** - a single portal and Slack channel for all IT service requests
2. **Structured workflows** - deterministic, auditable paths for every request type from intake through closure
3. **Onboarding/offboarding automation** - reduce new hire provisioning from days to hours, and offboarding from an error-prone checklist to a reliable orchestrated workflow
4. **Approval governance** - multi-level, role-aware approvals with escalation and delegation
5. **Strong auditability** - immutable audit trail for every action, supporting SOX, GDPR, and internal compliance
6. **Slack-native experience** - employees request help where they already work; tickets are created, tracked, and updated without leaving Slack
7. **Enterprise SSO** - Microsoft Entra ID integration so every portal user authenticates via corporate identity
8. **Extensible service catalog** - new request types, forms, and workflows added through configuration, not code changes

### Why This Architecture

We recommend a **modular monolith** deployed as a single application with clearly separated internal modules (ticketing, workflow, forms, integrations, automation). This is the right choice because:

- An internal ITSM platform serves hundreds of users, not millions - microservices add operational complexity without proportional benefit at this scale
- A monolith with clean module boundaries can be decomposed later if a module needs independent scaling
- It simplifies deployment, debugging, transactional integrity, and the development team's cognitive load
- The workflow engine and automation connectors are internal modules with well-defined interfaces, making future extraction straightforward

### Major Capabilities

| Capability | Description |
|---|---|
| Web Portal | Self-service portal with SSO, role-based views, service catalog, ticket submission, and tracking |
| Ticketing Engine | Full lifecycle management with SLA, priority, assignment, queues, comments, attachments |
| Forms Engine | Dynamic, schema-driven forms for structured request types |
| Workflow Engine | State machine-based orchestration with approval gates, parallel tasks, and conditional branching |
| Slack Integration | Channel-based intake, slash commands, interactive modals, thread-linked ticket updates |
| Automation Engine | Connector-based execution of provisioning/deprovisioning actions with human-in-the-loop gates |
| Identity & SSO | Microsoft Entra ID OIDC integration with group-based RBAC |
| Audit & Compliance | Immutable event log, change history, evidence collection, retention policies |
| Reporting | Real-time dashboards for SLA, queue health, automation metrics, onboarding/offboarding KPIs |

---

## B. Functional Requirements

### B.1 Portal

| ID | Requirement |
|---|---|
| PRT-001 | Self-service web portal accessible to all employees via SSO |
| PRT-002 | Service catalog landing page with categorized request types |
| PRT-003 | "My Requests" view showing tickets submitted by the current user |
| PRT-004 | Ticket detail view with status timeline, comments, and attachments |
| PRT-005 | Role-based navigation: end users see service catalog + their tickets; agents see queues + assigned tickets |
| PRT-006 | Global search across tickets, requesters, and knowledge base |
| PRT-007 | Responsive design supporting desktop and tablet browsers |
| PRT-008 | Accessibility compliance (WCAG 2.1 AA) |
| PRT-009 | Notification preferences management per user |
| PRT-010 | Branding customization (logo, colors, footer) |

### B.2 Ticketing

| ID | Requirement |
|---|---|
| TKT-001 | Create tickets via portal form submission, Slack intake, API, or email (future) |
| TKT-002 | Assign tickets to individual agents or team queues |
| TKT-003 | Priority levels: Critical, High, Medium, Low |
| TKT-004 | SLA enforcement with response time and resolution time targets per priority and category |
| TKT-005 | Status lifecycle: New -> Triaged -> In Progress -> Pending (subtypes) -> Resolved -> Closed |
| TKT-006 | Category / subcategory classification |
| TKT-007 | Public comments (visible to requester) and internal notes (agent-only) |
| TKT-008 | File attachments (up to 25 MB per file, configurable) |
| TKT-009 | Requester identity captured and linked to employee record |
| TKT-010 | Watchers / CC list for ticket notifications |
| TKT-011 | Related tickets / parent-child linking |
| TKT-012 | Merge duplicate tickets |
| TKT-013 | Escalation rules (time-based, priority-based, manual) |
| TKT-014 | Custom fields per ticket type |
| TKT-015 | Bulk actions (assign, close, re-categorize) for agents |
| TKT-016 | Complete change history with before/after values |
| TKT-017 | Immutable audit log per ticket |
| TKT-018 | Configurable auto-close after X days in Resolved state with no requester response |
| TKT-019 | Satisfaction survey on ticket closure |

### B.3 Forms

| ID | Requirement |
|---|---|
| FRM-001 | Schema-driven form definitions stored as JSON |
| FRM-002 | Field types: text, textarea, select, multi-select, radio, checkbox, date, datetime, email, phone, file upload, user picker, conditional |
| FRM-003 | Conditional field visibility (show field X when field Y = value) |
| FRM-004 | Required field validation |
| FRM-005 | Default values and placeholder text |
| FRM-006 | Section grouping with headers |
| FRM-007 | Form versioning - published forms are immutable; new versions can be drafted |
| FRM-008 | Form preview mode |
| FRM-009 | Form submissions create tickets with structured data stored alongside the ticket |
| FRM-010 | Admin form builder UI |
| FRM-011 | Form templates for onboarding, offboarding, access request, etc. |

### B.4 Workflow Engine

| ID | Requirement |
|---|---|
| WFL-001 | State machine engine supporting sequential, parallel, and conditional task execution |
| WFL-002 | Workflow definitions stored as versioned configuration (YAML/JSON) |
| WFL-003 | Workflow templates per request type |
| WFL-004 | Task assignment to roles, teams, or specific users |
| WFL-005 | Task dependencies (task B cannot start until task A completes) |
| WFL-006 | Approval steps as first-class workflow nodes |
| WFL-007 | Timer-based transitions (auto-escalate after X hours) |
| WFL-008 | Conditional branching based on form data or previous task outcomes |
| WFL-009 | Human-in-the-loop checkpoints for high-risk automation steps |
| WFL-010 | Workflow visualization showing current state and completed steps |
| WFL-011 | Ability to pause, resume, cancel, or restart workflows |
| WFL-012 | Workflow execution logging with timestamps and actor identity |

### B.5 Approvals

| ID | Requirement |
|---|---|
| APR-001 | Single-approver and multi-approver workflows |
| APR-002 | Sequential approval chains (A must approve before B is asked) |
| APR-003 | Parallel approvals (A and B are asked simultaneously, both must approve) |
| APR-004 | Approval delegation (approver can delegate to another user) |
| APR-005 | Approval timeout with escalation to next-level approver |
| APR-006 | Approve / reject / request more info actions |
| APR-007 | Approval via portal, email link, or Slack interactive message |
| APR-008 | Approver determined dynamically based on: requester's manager, department, request type, or specific role |
| APR-009 | Approval decisions recorded with timestamp, actor, and optional comment |
| APR-010 | Re-approval required if form data changes after initial submission |
| APR-011 | Approval matrix configuration per request type |

### B.6 Slack Integration

| ID | Requirement |
|---|---|
| SLK-001 | Designated Slack channel(s) monitored for incoming IT requests |
| SLK-002 | Automatic ticket creation from channel messages |
| SLK-003 | Capture: Slack user ID, display name, email, channel, timestamp, message text |
| SLK-004 | Thread replies on existing ticket threads treated as ticket comments |
| SLK-005 | Acknowledgment message posted to Slack thread upon ticket creation |
| SLK-006 | Status updates posted to original Slack thread when ticket status changes |
| SLK-007 | Slash command `/it-help` to open a structured request modal |
| SLK-008 | Slash command `/ticket <ID>` to look up ticket status |
| SLK-009 | Message shortcut "Create IT Ticket" for any message |
| SLK-010 | Interactive approval buttons in Slack DMs to approvers |
| SLK-011 | Deduplication: messages within N seconds of each other from same user treated as single request |
| SLK-012 | Bot does not create tickets from its own messages or other bots |
| SLK-013 | Slack user identity mapped to corporate identity via email |
| SLK-014 | File attachments from Slack messages included in ticket |
| SLK-015 | Emoji reactions (e.g., checkmark) used as lightweight status signals |

### B.7 Identity / SSO

| ID | Requirement |
|---|---|
| IDN-001 | Microsoft Entra ID OIDC integration for portal authentication |
| IDN-002 | Group-based role mapping (Entra group -> application role) |
| IDN-003 | Just-In-Time (JIT) user provisioning on first login |
| IDN-004 | Session management with configurable timeout |
| IDN-005 | MFA enforcement delegated to Entra ID conditional access policies |
| IDN-006 | API authentication via OAuth 2.0 bearer tokens or API keys for service accounts |
| IDN-007 | SCIM provisioning endpoint for automated user sync (optional, Phase 4+) |

### B.8 Notifications

| ID | Requirement |
|---|---|
| NTF-001 | Email notifications for ticket creation, assignment, status change, comments, approvals |
| NTF-002 | Slack DM notifications for assigned agents and approvers |
| NTF-003 | In-app notification center with read/unread state |
| NTF-004 | Notification templates configurable per event type |
| NTF-005 | Notification preferences: per-user opt-in/opt-out by channel and event type |
| NTF-006 | Digest mode: batch low-priority notifications into periodic summaries |
| NTF-007 | Escalation notifications to team leads and managers |

### B.9 Reporting

| ID | Requirement |
|---|---|
| RPT-001 | Real-time dashboards for ticket volume, SLA, queue health |
| RPT-002 | Historical trend reports (weekly, monthly, quarterly) |
| RPT-003 | Onboarding/offboarding turnaround time reports |
| RPT-004 | Approval bottleneck analysis |
| RPT-005 | Automation success/failure rate reports |
| RPT-006 | Agent workload and utilization reports |
| RPT-007 | Export to CSV/PDF |
| RPT-008 | Scheduled report delivery via email |
| RPT-009 | Custom report builder with filters |

### B.10 Audit / Compliance

| ID | Requirement |
|---|---|
| AUD-001 | Immutable audit log for every ticket action (create, update, assign, approve, close) |
| AUD-002 | Audit log entries include: timestamp, actor, action, before/after values, IP address |
| AUD-003 | Separate audit stream for admin actions (config changes, role assignments) |
| AUD-004 | Audit log export for compliance review |
| AUD-005 | Retention policy enforcement (configurable per data type) |
| AUD-006 | Legal hold flag prevents deletion of ticket and associated data |
| AUD-007 | Evidence collection: automation execution logs linked to tickets |
| AUD-008 | Access audit: log every data access, not just mutations |

### B.11 Automations

| ID | Requirement |
|---|---|
| AUT-001 | Automation actions: create user, assign license, add to group, send notification, create task, call external API |
| AUT-002 | Automation triggers: form submission approved, ticket status change, schedule, manual |
| AUT-003 | Approval-gated automations: high-risk actions require explicit approval before execution |
| AUT-004 | Automation execution logging with input/output/error capture |
| AUT-005 | Retry logic with configurable backoff for transient failures |
| AUT-006 | Idempotency: re-running an automation step does not create duplicate resources |
| AUT-007 | Rollback actions defined per automation step for failure recovery |
| AUT-008 | Dry-run mode for testing automations |
| AUT-009 | Connector framework for Microsoft Graph, AWS IAM, Slack API, etc. |
| AUT-010 | Automation templates for common patterns (onboarding, offboarding, access grant/revoke) |

### B.12 Admin Console

| ID | Requirement |
|---|---|
| ADM-001 | Workflow editor (visual or YAML-based) |
| ADM-002 | Form builder with drag-and-drop fields |
| ADM-003 | Category and subcategory management |
| ADM-004 | SLA policy configuration |
| ADM-005 | Team and queue management |
| ADM-006 | User and role management |
| ADM-007 | Automation template management |
| ADM-008 | Integration credentials and connection management |
| ADM-009 | Notification template editor |
| ADM-010 | System health dashboard |
| ADM-011 | Feature flags for progressive rollout |
| ADM-012 | Secrets management (encrypted storage for API keys, client secrets) |

---

## C. Non-Functional Requirements

### C.1 Security

| Requirement | Target |
|---|---|
| Authentication | OIDC via Microsoft Entra ID; no local passwords |
| Authorization | RBAC with least-privilege defaults |
| Transport encryption | TLS 1.3 for all HTTP; TLS for database connections |
| Data at rest encryption | AES-256 for database, file storage, and backups |
| Secrets management | Encrypted vault (AWS Secrets Manager, Azure Key Vault, or HashiCorp Vault) |
| Input validation | Server-side validation on all endpoints; parameterized queries |
| CSRF protection | Anti-CSRF tokens on all state-changing requests |
| Rate limiting | Per-user and per-IP rate limits on API endpoints |
| Dependency scanning | Automated CVE scanning in CI pipeline |
| Penetration testing | Annual third-party pentest |

### C.2 Scalability

| Requirement | Target |
|---|---|
| Concurrent portal users | 500+ simultaneous users |
| Ticket volume | 50,000+ tickets/year |
| Slack message throughput | 100 messages/minute sustained |
| Automation execution | 200 concurrent workflow tasks |
| Horizontal scaling | Stateless application tier behind load balancer |
| Database scaling | Read replicas for reporting; connection pooling |

### C.3 Availability

| Requirement | Target |
|---|---|
| Uptime SLA | 99.9% during business hours (8am-8pm local) |
| Planned maintenance | Off-hours with advance notification |
| Failover | Automated health checks and restart; multi-AZ database |
| Degraded mode | Portal remains functional if automation engine is down; tickets queue for later processing |

### C.4 Performance

| Requirement | Target |
|---|---|
| Portal page load | < 2 seconds (P95) |
| Ticket creation API | < 500ms (P95) |
| Search results | < 1 second for full-text search (P95) |
| Slack acknowledgment | < 3 seconds from message to bot reply |
| Automation step execution | < 30 seconds per individual step |
| Dashboard rendering | < 3 seconds |

### C.5 Observability

| Requirement | Detail |
|---|---|
| Structured logging | JSON logs with correlation IDs per request |
| Metrics | RED metrics (rate, errors, duration) for all services |
| Tracing | Distributed tracing across workflow execution steps |
| Alerting | PagerDuty/Slack alerts for error rate spikes, SLA breaches, automation failures |
| Health checks | `/health` and `/ready` endpoints for orchestration |

### C.6 Data Retention

| Data Type | Retention |
|---|---|
| Active tickets | Indefinite while open |
| Closed tickets | 7 years (configurable per compliance requirement) |
| Audit logs | 7 years minimum |
| Automation execution logs | 3 years |
| File attachments | Follows parent ticket retention |
| Slack message cache | 1 year (Slack is source of truth) |
| Session data | 24 hours after expiry |
| Legal hold data | Retained until hold is explicitly released |

### C.7 Disaster Recovery

| Requirement | Target |
|---|---|
| RPO (Recovery Point Objective) | 1 hour (continuous database backup) |
| RTO (Recovery Time Objective) | 4 hours |
| Backup strategy | Automated daily snapshots + continuous WAL archiving |
| Cross-region backup | Backups replicated to secondary region |
| DR testing | Quarterly restore drill |

### C.8 Compliance Considerations

- SOX: full audit trail for access changes, approval evidence, segregation of duties
- GDPR: data minimization, right to deletion (except where legal hold applies), data processing records
- HIPAA: if applicable, PHI handling in tickets with additional encryption and access controls
- Internal policy: all privileged access changes require documented approval

### C.9 Extensibility

- New request types added via form schema + workflow template, no code changes
- New automation connectors added via plugin interface
- Webhook-based event publishing for external system consumption
- REST API covering all major operations for third-party integration

### C.10 Maintainability

- Modular codebase with clear domain boundaries
- Comprehensive test coverage: unit (>80%), integration (>60%), E2E (critical paths)
- Database migrations versioned and reversible
- Feature flags for safe rollout of new capabilities
- Documentation: API docs (OpenAPI), runbook, architecture decision records (ADRs)

---

## D. User Roles and Permissions

### D.1 Role Definitions

| Role | Description |
|---|---|
| **End User** | Any employee. Can submit requests, view own tickets, add comments on own tickets. |
| **IT Agent** | IT team member. Can view queue tickets, triage, assign, work, resolve, close tickets in their queue(s). |
| **IT Lead** | Senior IT agent. Agent permissions + reassign across queues, manage team members, view team reports. |
| **IT Admin** | Full system administrator. All permissions including config, workflow, form, SLA, integration management. |
| **Approver** | Dynamically assigned (manager, HR, security). Can approve/reject requests assigned for their approval. |
| **HR / People Ops** | Access to onboarding/offboarding tickets. Can submit onboarding/offboarding forms. View HR-relevant reports. |
| **Security Reviewer** | Access to security-sensitive tickets (access requests, firewall, offboarding). Can approve/reject security-gated steps. |
| **Auditor** | Read-only access to all tickets, audit logs, reports, and compliance data. Cannot modify anything. |

### D.2 Permission Matrix

| Permission | End User | IT Agent | IT Lead | IT Admin | Approver | HR/People Ops | Security Reviewer | Auditor |
|---|---|---|---|---|---|---|---|---|
| Submit request | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No |
| View own tickets | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No |
| View queue tickets | No | Own queue | All queues | All | No | HR queue | Security queue | All (read-only) |
| Triage / assign | No | Own queue | All queues | All | No | HR queue | Security queue | No |
| Add public comment | Own tickets | Assigned | Assigned | All | Approval tickets | HR tickets | Security tickets | No |
| Add internal note | No | Yes | Yes | Yes | No | Yes | Yes | No |
| Change status | No | Yes | Yes | Yes | No | Limited | Limited | No |
| Approve / reject | No | No | No | No | Yes | Yes (HR approvals) | Yes (sec approvals) | No |
| View audit logs | No | No | Own queue | All | No | No | No | All |
| View reports | No | Own queue | All queues | All | No | HR reports | Security reports | All |
| Manage config | No | No | No | Yes | No | No | No | No |
| Manage workflows | No | No | No | Yes | No | No | No | No |
| Manage forms | No | No | No | Yes | No | No | No | No |
| Manage integrations | No | No | No | Yes | No | No | No | No |
| Manage users/roles | No | No | No | Yes | No | No | No | No |
| Export data | No | No | Yes | Yes | No | No | No | Yes |
| Legal hold management | No | No | No | Yes | No | No | Yes | Yes (view only) |

### D.3 Role Assignment

- Roles are mapped from Microsoft Entra ID groups
- A user can hold multiple roles (e.g., IT Agent + Approver)
- The Approver role is context-sensitive: a user becomes an approver for a specific ticket when the workflow designates them
- JIT provisioning creates users with the End User role by default; additional roles assigned via group membership

---

## E. Data Model

### E.1 Entity Relationship Overview

```
Users ──────────┐
                 │ 1:N
Employees ───────┼──── Tickets ────── TicketComments
                 │      │    │          TicketAttachments
                 │      │    │          TicketHistory
                 │      │    │
                 │      │    └──── FormSubmissions ──── FormSubmissionData
                 │      │
                 │      ├──── WorkflowInstances ──── WorkflowTasks
                 │      │                              │
                 │      │                              └── ApprovalDecisions
                 │      │
                 │      ├──── AutomationRuns ──── AutomationStepLogs
                 │      │
                 │      ├──── SlackMessageLinks
                 │      │
                 │      └──── AuditLogEntries
                 │
Teams ──────────── TeamMemberships
                 │
Queues ──────────┘

FormDefinitions ──── FormFieldDefinitions
WorkflowDefinitions ──── WorkflowStepDefinitions
TicketTypes ──── Categories ──── Subcategories
SLAPolicies
Applications ──── AccessEntitlements
Assets / Devices
NotificationEvents
IntegrationConfigs
KnowledgeBaseArticles
```

### E.2 Core Entity Definitions

#### Users

```
users
├── id                  UUID (PK)
├── email               VARCHAR(255) UNIQUE NOT NULL
├── display_name        VARCHAR(255) NOT NULL
├── entra_object_id     VARCHAR(255) UNIQUE  -- Microsoft Entra ID object ID
├── slack_user_id       VARCHAR(64)          -- Slack member ID
├── slack_display_name  VARCHAR(255)
├── department          VARCHAR(128)
├── job_title           VARCHAR(255)
├── manager_id          UUID (FK -> users)
├── office_location     VARCHAR(255)
├── phone               VARCHAR(64)
├── roles               JSONB                -- cached role list
├── is_active           BOOLEAN DEFAULT true
├── last_login_at       TIMESTAMP
├── created_at          TIMESTAMP NOT NULL
├── updated_at          TIMESTAMP NOT NULL
└── INDEX: email, entra_object_id, slack_user_id
```

#### Tickets

```
tickets
├── id                  UUID (PK)
├── ticket_number       VARCHAR(20) UNIQUE NOT NULL  -- human-readable: IT-20260001
├── ticket_type_id      UUID (FK -> ticket_types)
├── category_id         UUID (FK -> categories)
├── subcategory_id      UUID (FK -> subcategories) NULLABLE
├── title               VARCHAR(500) NOT NULL
├── description         TEXT
├── status              VARCHAR(32) NOT NULL  -- enum
├── priority            VARCHAR(16) NOT NULL  -- Critical/High/Medium/Low
├── severity            VARCHAR(16)           -- S1/S2/S3/S4
├── requester_id        UUID (FK -> users) NOT NULL
├── assignee_id         UUID (FK -> users) NULLABLE
├── queue_id            UUID (FK -> queues) NULLABLE
├── form_submission_id  UUID (FK -> form_submissions) NULLABLE
├── parent_ticket_id    UUID (FK -> tickets) NULLABLE
├── source              VARCHAR(32) NOT NULL  -- portal/slack/api/email
├── sla_policy_id       UUID (FK -> sla_policies)
├── sla_response_due    TIMESTAMP
├── sla_resolution_due  TIMESTAMP
├── sla_response_met    BOOLEAN
├── sla_resolution_met  BOOLEAN
├── first_response_at   TIMESTAMP
├── resolved_at         TIMESTAMP
├── closed_at           TIMESTAMP
├── tags                TEXT[]
├── custom_fields       JSONB
├── legal_hold          BOOLEAN DEFAULT false
├── created_at          TIMESTAMP NOT NULL
├── updated_at          TIMESTAMP NOT NULL
└── INDEXES: ticket_number, status, priority, requester_id, assignee_id, queue_id, created_at
```

#### Ticket Comments

```
ticket_comments
├── id                  UUID (PK)
├── ticket_id           UUID (FK -> tickets) NOT NULL
├── author_id           UUID (FK -> users) NOT NULL
├── body                TEXT NOT NULL
├── is_internal         BOOLEAN DEFAULT false  -- internal note vs public comment
├── source              VARCHAR(32)            -- portal/slack/api/email
├── slack_message_ts    VARCHAR(64)            -- if from Slack thread
├── created_at          TIMESTAMP NOT NULL
├── updated_at          TIMESTAMP NOT NULL
└── INDEX: ticket_id, created_at
```

#### Ticket Attachments

```
ticket_attachments
├── id                  UUID (PK)
├── ticket_id           UUID (FK -> tickets) NOT NULL
├── comment_id          UUID (FK -> ticket_comments) NULLABLE
├── file_name           VARCHAR(500) NOT NULL
├── file_size           BIGINT NOT NULL
├── content_type        VARCHAR(255)
├── storage_key         VARCHAR(1000) NOT NULL  -- S3/blob key
├── uploaded_by         UUID (FK -> users) NOT NULL
├── source              VARCHAR(32)              -- portal/slack
├── created_at          TIMESTAMP NOT NULL
└── INDEX: ticket_id
```

#### Ticket History (Change Log)

```
ticket_history
├── id                  UUID (PK)
├── ticket_id           UUID (FK -> tickets) NOT NULL
├── actor_id            UUID (FK -> users) NOT NULL
├── field_name          VARCHAR(128) NOT NULL
├── old_value           TEXT
├── new_value           TEXT
├── change_type         VARCHAR(32)  -- field_change/status_change/assignment/comment/attachment
├── created_at          TIMESTAMP NOT NULL
└── INDEX: ticket_id, created_at
```

#### Ticket Types

```
ticket_types
├── id                  UUID (PK)
├── name                VARCHAR(128) NOT NULL UNIQUE  -- "Employee Onboarding"
├── slug                VARCHAR(128) NOT NULL UNIQUE  -- "employee-onboarding"
├── description         TEXT
├── form_definition_id  UUID (FK -> form_definitions) NULLABLE
├── workflow_def_id     UUID (FK -> workflow_definitions) NULLABLE
├── default_queue_id    UUID (FK -> queues)
├── default_priority    VARCHAR(16)
├── approval_required   BOOLEAN DEFAULT false
├── sla_policy_id       UUID (FK -> sla_policies)
├── is_active           BOOLEAN DEFAULT true
├── display_order       INTEGER
├── icon                VARCHAR(64)
├── created_at          TIMESTAMP NOT NULL
├── updated_at          TIMESTAMP NOT NULL
```

#### Categories and Subcategories

```
categories
├── id                  UUID (PK)
├── name                VARCHAR(128) NOT NULL
├── slug                VARCHAR(128) NOT NULL UNIQUE
├── description         TEXT
├── parent_id           UUID (FK -> categories) NULLABLE  -- self-referential for subcategories
├── default_queue_id    UUID (FK -> queues)
├── is_active           BOOLEAN DEFAULT true
├── display_order       INTEGER
├── created_at          TIMESTAMP NOT NULL
```

#### Form Definitions

```
form_definitions
├── id                  UUID (PK)
├── name                VARCHAR(255) NOT NULL
├── slug                VARCHAR(128) NOT NULL
├── version             INTEGER NOT NULL DEFAULT 1
├── status              VARCHAR(16)  -- draft/published/archived
├── schema              JSONB NOT NULL  -- complete form schema
├── created_by          UUID (FK -> users)
├── created_at          TIMESTAMP NOT NULL
├── updated_at          TIMESTAMP NOT NULL
├── published_at        TIMESTAMP
└── UNIQUE: slug, version
```

#### Form Submissions

```
form_submissions
├── id                  UUID (PK)
├── form_definition_id  UUID (FK -> form_definitions) NOT NULL
├── ticket_id           UUID (FK -> tickets) NOT NULL
├── submitted_by        UUID (FK -> users) NOT NULL
├── data                JSONB NOT NULL  -- submitted form values
├── version             INTEGER NOT NULL
├── created_at          TIMESTAMP NOT NULL
```

#### Workflow Definitions

```
workflow_definitions
├── id                  UUID (PK)
├── name                VARCHAR(255) NOT NULL
├── slug                VARCHAR(128) NOT NULL
├── version             INTEGER NOT NULL DEFAULT 1
├── status              VARCHAR(16)  -- draft/published/archived
├── definition          JSONB NOT NULL  -- state machine definition
├── created_by          UUID (FK -> users)
├── created_at          TIMESTAMP NOT NULL
├── updated_at          TIMESTAMP NOT NULL
└── UNIQUE: slug, version
```

#### Workflow Instances

```
workflow_instances
├── id                  UUID (PK)
├── workflow_def_id     UUID (FK -> workflow_definitions) NOT NULL
├── ticket_id           UUID (FK -> tickets) NOT NULL
├── status              VARCHAR(32)  -- running/paused/completed/failed/cancelled
├── current_step        VARCHAR(128)
├── context             JSONB  -- runtime data passed between steps
├── started_at          TIMESTAMP NOT NULL
├── completed_at        TIMESTAMP
├── error               TEXT
└── INDEX: ticket_id, status
```

#### Workflow Tasks

```
workflow_tasks
├── id                  UUID (PK)
├── workflow_instance_id UUID (FK -> workflow_instances) NOT NULL
├── step_name           VARCHAR(128) NOT NULL
├── task_type           VARCHAR(32)  -- approval/manual/automated/notification
├── status              VARCHAR(32)  -- pending/in_progress/completed/failed/skipped/cancelled
├── assigned_to         UUID (FK -> users) NULLABLE
├── assigned_role       VARCHAR(64) NULLABLE
├── input_data          JSONB
├── output_data         JSONB
├── due_at              TIMESTAMP
├── started_at          TIMESTAMP
├── completed_at        TIMESTAMP
├── completed_by        UUID (FK -> users) NULLABLE
├── error               TEXT
├── created_at          TIMESTAMP NOT NULL
└── INDEX: workflow_instance_id, status, assigned_to
```

#### Approval Decisions

```
approval_decisions
├── id                  UUID (PK)
├── workflow_task_id    UUID (FK -> workflow_tasks) NOT NULL
├── ticket_id           UUID (FK -> tickets) NOT NULL
├── approver_id         UUID (FK -> users) NOT NULL
├── decision            VARCHAR(16) NOT NULL  -- approved/rejected/more_info
├── comment             TEXT
├── delegated_from      UUID (FK -> users) NULLABLE
├── decided_at          TIMESTAMP NOT NULL
├── created_at          TIMESTAMP NOT NULL
└── INDEX: ticket_id, approver_id
```

#### Automation Runs

```
automation_runs
├── id                  UUID (PK)
├── ticket_id           UUID (FK -> tickets) NULLABLE
├── workflow_task_id    UUID (FK -> workflow_tasks) NULLABLE
├── automation_type     VARCHAR(128) NOT NULL  -- "create_entra_user", "assign_license"
├── status              VARCHAR(32)  -- queued/running/completed/failed/rolled_back
├── input_params        JSONB
├── output_result       JSONB
├── error               TEXT
├── retry_count         INTEGER DEFAULT 0
├── idempotency_key     VARCHAR(255) UNIQUE
├── started_at          TIMESTAMP
├── completed_at        TIMESTAMP
├── created_at          TIMESTAMP NOT NULL
└── INDEX: ticket_id, status
```

#### Automation Step Logs

```
automation_step_logs
├── id                  UUID (PK)
├── automation_run_id   UUID (FK -> automation_runs) NOT NULL
├── step_name           VARCHAR(128) NOT NULL
├── action              VARCHAR(255) NOT NULL  -- "POST /users" "Add to group X"
├── status              VARCHAR(32)
├── request_payload     JSONB
├── response_payload    JSONB
├── error               TEXT
├── duration_ms         INTEGER
├── created_at          TIMESTAMP NOT NULL
└── INDEX: automation_run_id
```

#### Slack Message Links

```
slack_message_links
├── id                  UUID (PK)
├── ticket_id           UUID (FK -> tickets) NOT NULL
├── channel_id          VARCHAR(64) NOT NULL
├── channel_name        VARCHAR(128)
├── message_ts          VARCHAR(64) NOT NULL   -- Slack message timestamp (unique ID)
├── thread_ts           VARCHAR(64)            -- parent thread timestamp
├── slack_user_id       VARCHAR(64) NOT NULL
├── slack_display_name  VARCHAR(255)
├── slack_user_email    VARCHAR(255)
├── original_text       TEXT
├── permalink           VARCHAR(1000)
├── created_at          TIMESTAMP NOT NULL
└── UNIQUE: channel_id, message_ts
```

#### Teams and Queues

```
teams
├── id                  UUID (PK)
├── name                VARCHAR(128) NOT NULL UNIQUE  -- "IT Operations", "Security", "IAM"
├── description         TEXT
├── lead_id             UUID (FK -> users)
├── is_active           BOOLEAN DEFAULT true
├── created_at          TIMESTAMP NOT NULL

team_memberships
├── team_id             UUID (FK -> teams)
├── user_id             UUID (FK -> users)
├── role                VARCHAR(32)  -- member/lead
├── PRIMARY KEY: (team_id, user_id)

queues
├── id                  UUID (PK)
├── name                VARCHAR(128) NOT NULL UNIQUE
├── team_id             UUID (FK -> teams) NOT NULL
├── description         TEXT
├── auto_assign         BOOLEAN DEFAULT false
├── assignment_strategy VARCHAR(32)  -- round_robin/least_loaded/manual
├── is_active           BOOLEAN DEFAULT true
├── created_at          TIMESTAMP NOT NULL
```

#### SLA Policies

```
sla_policies
├── id                  UUID (PK)
├── name                VARCHAR(128) NOT NULL
├── priority            VARCHAR(16) NOT NULL
├── response_time_mins  INTEGER NOT NULL
├── resolution_time_mins INTEGER NOT NULL
├── business_hours_only BOOLEAN DEFAULT true
├── escalation_rules    JSONB  -- who to notify at what thresholds
├── is_active           BOOLEAN DEFAULT true
├── created_at          TIMESTAMP NOT NULL
```

#### Assets / Devices

```
assets
├── id                  UUID (PK)
├── asset_tag           VARCHAR(64) UNIQUE
├── asset_type          VARCHAR(32)  -- laptop/monitor/phone/peripheral
├── make                VARCHAR(128)
├── model               VARCHAR(255)
├── serial_number       VARCHAR(128) UNIQUE
├── status              VARCHAR(32)  -- available/assigned/in_transit/returned/retired
├── assigned_to         UUID (FK -> users) NULLABLE
├── assigned_ticket_id  UUID (FK -> tickets) NULLABLE
├── purchase_date       DATE
├── warranty_end        DATE
├── notes               TEXT
├── created_at          TIMESTAMP NOT NULL
├── updated_at          TIMESTAMP NOT NULL
```

#### Applications

```
applications
├── id                  UUID (PK)
├── name                VARCHAR(255) NOT NULL UNIQUE
├── vendor              VARCHAR(255)
├── app_type            VARCHAR(32)  -- saas/on_prem/desktop
├── provisioning_method VARCHAR(32)  -- manual/scim/api/script
├── license_type        VARCHAR(32)  -- per_user/per_seat/unlimited
├── sso_enabled         BOOLEAN DEFAULT false
├── owner_team_id       UUID (FK -> teams)
├── documentation_url   VARCHAR(1000)
├── is_active           BOOLEAN DEFAULT true
├── created_at          TIMESTAMP NOT NULL
```

#### Access Entitlements

```
access_entitlements
├── id                  UUID (PK)
├── user_id             UUID (FK -> users) NOT NULL
├── application_id      UUID (FK -> applications) NULLABLE
├── entitlement_type    VARCHAR(64)  -- app_access/group_membership/role/license/aws_role
├── entitlement_value   VARCHAR(500)  -- group name, role ARN, license SKU
├── granted_ticket_id   UUID (FK -> tickets)
├── granted_at          TIMESTAMP NOT NULL
├── granted_by          UUID (FK -> users)
├── revoked_ticket_id   UUID (FK -> tickets) NULLABLE
├── revoked_at          TIMESTAMP NULLABLE
├── revoked_by          UUID (FK -> users) NULLABLE
├── expires_at          TIMESTAMP NULLABLE
├── status              VARCHAR(16)  -- active/revoked/expired
├── created_at          TIMESTAMP NOT NULL
└── INDEX: user_id, status
```

#### Audit Log

```
audit_log
├── id                  UUID (PK)
├── event_type          VARCHAR(64) NOT NULL  -- ticket.created, ticket.status_changed, approval.decided
├── entity_type         VARCHAR(64) NOT NULL  -- ticket/user/workflow/config
├── entity_id           UUID NOT NULL
├── actor_id            UUID (FK -> users) NULLABLE  -- null for system actions
├── actor_type          VARCHAR(32)  -- user/system/automation
├── action              VARCHAR(64) NOT NULL
├── details             JSONB NOT NULL  -- structured event payload
├── ip_address          INET
├── user_agent          VARCHAR(500)
├── created_at          TIMESTAMP NOT NULL
└── INDEX: entity_type + entity_id, actor_id, created_at
└── PARTITION BY: created_at (monthly)
```

#### Notifications

```
notification_events
├── id                  UUID (PK)
├── recipient_id        UUID (FK -> users) NOT NULL
├── event_type          VARCHAR(64) NOT NULL
├── channel             VARCHAR(16) NOT NULL  -- email/slack/in_app
├── ticket_id           UUID (FK -> tickets) NULLABLE
├── subject             VARCHAR(500)
├── body                TEXT
├── status              VARCHAR(16)  -- queued/sent/failed/read
├── sent_at             TIMESTAMP
├── read_at             TIMESTAMP
├── created_at          TIMESTAMP NOT NULL
└── INDEX: recipient_id, status, created_at
```

#### Integration Configs

```
integration_configs
├── id                  UUID (PK)
├── name                VARCHAR(128) NOT NULL UNIQUE
├── integration_type    VARCHAR(64) NOT NULL  -- microsoft_graph/aws/slack/generic_webhook
├── config              JSONB NOT NULL  -- non-secret configuration
├── secrets_ref         VARCHAR(255)  -- reference to secrets vault
├── is_active           BOOLEAN DEFAULT true
├── last_health_check   TIMESTAMP
├── health_status       VARCHAR(16)
├── created_at          TIMESTAMP NOT NULL
├── updated_at          TIMESTAMP NOT NULL
```

#### Knowledge Base Articles

```
kb_articles
├── id                  UUID (PK)
├── title               VARCHAR(500) NOT NULL
├── slug                VARCHAR(255) UNIQUE NOT NULL
├── body                TEXT NOT NULL
├── category_id         UUID (FK -> categories) NULLABLE
├── author_id           UUID (FK -> users) NOT NULL
├── status              VARCHAR(16)  -- draft/published/archived
├── tags                TEXT[]
├── view_count          INTEGER DEFAULT 0
├── helpful_count       INTEGER DEFAULT 0
├── published_at        TIMESTAMP
├── created_at          TIMESTAMP NOT NULL
├── updated_at          TIMESTAMP NOT NULL
└── INDEX: GIN on title + body for full-text search
```

---

## F. Ticket Taxonomy

### F.1 Service Catalog Structure

```
Service Catalog
├── Identity & Access
│   ├── Employee Onboarding
│   ├── Employee Offboarding
│   ├── Grant Access Request
│   ├── Revoke Access Request
│   ├── Password Reset / Account Unlock
│   ├── MFA Reset
│   └── Service Account Request
│
├── Microsoft 365 & Azure
│   ├── Azure / Entra ID Change
│   ├── M365 License Assignment
│   ├── Shared Mailbox / Distribution List
│   ├── Teams / SharePoint Request
│   └── Conditional Access Policy Change
│
├── AWS
│   ├── AWS IAM Role / Policy Change
│   ├── AWS Account Access Request
│   ├── AWS Resource Provisioning
│   └── AWS VPN Access
│
├── Network & Security
│   ├── Network Change Request
│   ├── Firewall Rule Change
│   ├── VPN Access Request
│   ├── DNS Change Request
│   ├── SSL Certificate Request
│   └── Security Tool Provisioning
│
├── Hardware & Devices
│   ├── New Employee Kit
│   ├── Hardware Purchase Request
│   ├── Device Replacement / Repair
│   ├── Peripheral Request
│   └── Device Return / Decommission
│
├── Software & Applications
│   ├── Software Installation Request
│   ├── Application Access Request
│   ├── License Request
│   └── Application Provisioning
│
├── General IT Support
│   ├── Troubleshooting / Break-Fix
│   ├── How-To / Guidance
│   ├── Performance Issue
│   └── Other / Miscellaneous
│
└── HR-IT
    ├── Department Transfer
    ├── Job Title Change
    ├── Name Change
    └── Leave of Absence (IT actions)
```

### F.2 Priority Levels

| Priority | Description | Example | Response SLA | Resolution SLA |
|---|---|---|---|---|
| **Critical (P1)** | Complete service outage or security incident affecting multiple users | Production SSO down, active breach | 15 minutes | 4 hours |
| **High (P2)** | Significant impact to business operations or single-user blocker on day 1 | New hire cannot log in on start date, executive laptop failure | 1 hour | 8 business hours |
| **Medium (P3)** | Moderate impact, workaround exists | Access request, software install, non-blocking hardware issue | 4 business hours | 3 business days |
| **Low (P4)** | Minimal impact, informational, or planned change | Knowledge base question, future hardware order, cosmetic issue | 8 business hours | 5 business days |

### F.3 Severity Levels (for categorizing impact independently of urgency)

| Severity | Definition |
|---|---|
| **S1 - Critical** | Affects entire organization or critical system |
| **S2 - Major** | Affects a department or key business process |
| **S3 - Moderate** | Affects a team or non-critical process |
| **S4 - Minor** | Affects an individual with no broader impact |

### F.4 Status Lifecycle

```
                                     ┌─────────────┐
                                     │   CANCELLED  │
                                     └──────▲───────┘
                                            │ (any state)
                                            │
┌──────┐    ┌──────────┐    ┌─────────────┐ │  ┌────────────────────┐    ┌──────────┐    ┌────────┐
│ NEW  │───>│ TRIAGED  │───>│ IN PROGRESS │───>│ PENDING            │───>│ RESOLVED │───>│ CLOSED │
└──────┘    └──────────┘    └─────────────┘    │  ├─ Pending Approval│    └──────────┘    └────────┘
   │                          ▲    │           │  ├─ Pending Info    │         │               ▲
   │                          │    │           │  ├─ Pending Vendor  │         │               │
   │                          │    └───────────│  └─ Pending Change  │         │     auto-close after
   │                          │                └────────────────────┘          │     N days no response
   │                          └───────────────────────────────────────────────┘
   │                                      (re-opened)
   │
   └──> (auto-triage rules can skip TRIAGED and go directly to IN PROGRESS)
```

**Status Definitions:**

| Status | Description | Transitions From | Transitions To |
|---|---|---|---|
| **New** | Ticket created, not yet reviewed | - | Triaged, In Progress, Cancelled |
| **Triaged** | Reviewed by agent, categorized, prioritized, assigned | New | In Progress, Cancelled |
| **In Progress** | Actively being worked | Triaged, Pending* | Pending*, Resolved, Cancelled |
| **Pending Approval** | Waiting for approval decision | In Progress | In Progress (approved), Cancelled (rejected) |
| **Pending Info** | Waiting for requester input | In Progress | In Progress |
| **Pending Vendor** | Waiting for external vendor | In Progress | In Progress |
| **Pending Change** | Waiting for scheduled change window | In Progress | In Progress |
| **Resolved** | Work completed, pending requester confirmation | In Progress | Closed, In Progress (reopened) |
| **Closed** | Finalized | Resolved (auto or manual) | In Progress (reopen within 7 days) |
| **Cancelled** | Ticket withdrawn or duplicate | Any | - (terminal) |

### F.5 SLA Rules

| Ticket Type | Default Priority | Response SLA | Resolution SLA | Escalation |
|---|---|---|---|---|
| Employee Onboarding | High | 2 hours | 2 business days before start date | Auto-escalate to IT Lead at 75% of SLA |
| Employee Offboarding | High (Critical if involuntary) | 1 hour | Same day (involuntary) / 2 days (voluntary) | Auto-escalate to Security + IT Lead |
| Access Request | Medium | 4 hours | 2 business days | Escalate if approval pending > 24 hours |
| Firewall Change | Medium | 4 hours | 3 business days | Escalate if security approval pending > 48 hours |
| Hardware Request | Low | 8 hours | 5 business days | None (tracked in reports) |
| General IT Support | Medium | 4 hours | 3 business days | Standard escalation chain |

---

## G. Request Workflows

### G.1 General IT Ticket

```
1. INTAKE
   ├── Portal: User submits via service catalog
   ├── Slack: Bot creates ticket from channel message
   └── API: External system creates ticket

2. VALIDATION
   ├── Auto-categorize based on keywords (optional ML)
   ├── Assign default priority based on category
   └── Route to default queue

3. TRIAGE
   ├── Agent reviews, adjusts category/priority/queue
   ├── Agent assigns to self or specific agent
   └── Agent may request more info from requester

4. FULFILLMENT
   ├── Agent works the ticket
   ├── Agent adds internal notes documenting actions
   ├── Agent may escalate to other team/vendor
   └── Agent posts public comments updating requester

5. VERIFICATION
   ├── Agent marks as Resolved
   └── Requester confirms resolution or reopens

6. CLOSURE
   ├── Auto-close after 5 days if no response
   ├── Satisfaction survey sent
   └── Ticket becomes read-only (except reopen within 7 days)

7. AUDIT TRAIL
   └── All actions logged with actor, timestamp, before/after values

8. EXCEPTION HANDLING
   ├── SLA breach → notification to team lead
   ├── Requester non-responsive → auto-follow-up at 48h, auto-close at 120h
   └── Reassignment → logged with reason
```

### G.2 Onboarding Workflow

*See Section H for full detail.*

### G.3 Offboarding Workflow

*See Section I for full detail.*

### G.4 Access Request

```
1. INTAKE
   └── User submits access request form specifying:
       - Application/system
       - Access level (read/write/admin)
       - Business justification
       - Duration (permanent/temporary with end date)

2. VALIDATION
   ├── System checks if requester already has the access
   ├── System identifies required approvers based on application + access level
   └── Ticket created in IAM queue

3. APPROVALS
   ├── Manager approval (auto-identified from user record)
   ├── Application owner approval (auto-identified from application record)
   ├── Security review (if access level = admin or application is security-sensitive)
   └── Approval timeout: 48 hours → escalate to next-level

4. FULFILLMENT
   ├── AUTOMATED (if connector exists):
   │   ├── Add user to Entra ID group
   │   ├── Assign application role via SCIM/API
   │   └── Record entitlement in access_entitlements table
   ├── SEMI-AUTOMATED:
   │   ├── System generates instruction set for agent
   │   └── Agent executes and confirms
   └── MANUAL:
       └── Agent provisions access and documents steps

5. VERIFICATION
   ├── Requester confirms access works
   └── System sends confirmation to requester and approvers

6. CLOSURE
   ├── Access entitlement recorded with grant ticket link
   ├── If temporary: system schedules revocation task
   └── Ticket closed

7. AUDIT TRAIL
   ├── Approval chain with decisions and timestamps
   ├── Provisioning actions logged
   └── Entitlement record created with full lineage

8. EXCEPTION HANDLING
   ├── Approval rejected → requester notified with reason, ticket cancelled
   ├── Provisioning failure → retry 3x, then manual fallback, notify agent
   └── Conflicting access detected → security review required
```

### G.5 Azure / Entra ID Change

```
1. INTAKE → Structured form: change type, target object, proposed change, justification
2. VALIDATION → System categorizes risk level (low/medium/high/critical)
3. APPROVALS
   ├── Low risk (add user to standard group): manager only
   ├── Medium risk (license change, conditional access): manager + IT Lead
   ├── High risk (admin role, policy change): manager + IT Lead + Security
   └── Critical (tenant-wide change): CAB review required
4. FULFILLMENT → Microsoft Graph API automation where possible; manual for complex changes
5. VERIFICATION → Agent confirms change applied correctly; system validates via Graph API read-back
6. CLOSURE → Change documented, audit logged
7. AUDIT TRAIL → Full Graph API request/response logged
8. EXCEPTION HANDLING → Rollback action defined for each change type; failed changes auto-revert if safe
```

### G.6 AWS IAM / Account Change

```
1. INTAKE → Structured form: AWS account, IAM action type, role/policy, justification
2. VALIDATION → System identifies risk based on policy permissions (admin/write/read)
3. APPROVALS
   ├── Read-only access: manager only
   ├── Write access: manager + cloud team lead
   ├── Admin access: manager + cloud team lead + security
   └── Cross-account: additional account owner approval
4. FULFILLMENT → AWS IAM API automation (CreateRole, AttachPolicy, AssumeRole config)
5. VERIFICATION → AWS IAM access analyzer confirms effective permissions match intent
6. CLOSURE → Access entitlement recorded, temporary access scheduled for revocation
7. AUDIT TRAIL → AWS CloudTrail event ID linked to ticket
8. EXCEPTION HANDLING → Overly broad permissions detected → security hold, manual review required
```

### G.7 Network Change

```
1. INTAKE → Form: change type (VLAN, routing, DNS, DHCP), affected systems, justification
2. VALIDATION → Impact assessment: number of affected endpoints/services
3. APPROVALS → Network team lead + security review (if cross-zone)
4. FULFILLMENT → Change window scheduled; network engineer executes with rollback plan
5. VERIFICATION → Connectivity tests, monitoring check (no new alerts post-change)
6. CLOSURE → Change documented with before/after network diagrams or configs
7. AUDIT TRAIL → Change window, executor, verification results
8. EXCEPTION HANDLING → Failed verification → immediate rollback; post-incident review
```

### G.8 Firewall Change

```
1. INTAKE → Form: source/destination, ports/protocols, direction, duration, justification
2. VALIDATION → Auto-check for conflicting or redundant rules; flag overly broad rules
3. APPROVALS
   ├── Standard rule: network team lead + security
   ├── Any-any or broad rules: security lead + CISO approval
   └── Temporary rules: approval + auto-expiry date required
4. FULFILLMENT → Firewall API or agent execution; configuration backup before change
5. VERIFICATION → Rule test (traffic flow confirmation); no unintended blocks
6. CLOSURE → Rule documented with expiry date if temporary; ticket linked to firewall rule ID
7. AUDIT TRAIL → Full rule before/after, approval chain, test results
8. EXCEPTION HANDLING → Emergency rule: apply first, approval within 24 hours (break-glass with elevated audit)
```

### G.9 Hardware Request

```
1. INTAKE → Form: hardware type, justification, urgency, shipping address
2. VALIDATION → Budget approval check; asset availability check
3. APPROVALS → Manager approval; finance approval if above threshold ($X)
4. FULFILLMENT
   ├── In-stock: assign asset from inventory, prepare, ship
   ├── Procurement needed: create purchase order, track delivery
   └── Kit assembly: parallel tasks for device setup, software install, MDM enrollment
5. VERIFICATION → Requester confirms receipt; asset assigned in inventory
6. CLOSURE → Asset record created/updated with assignee; ticket closed
7. AUDIT TRAIL → Procurement, assignment, shipping tracking
8. EXCEPTION HANDLING → Shipping delay → requester notified; loaner device offered if critical
```

---

## H. Onboarding Workflow Design

### H.1 Normalized Onboarding Form

The following form consolidates and improves the provided baseline, removing duplicates and adding fields required for real automation.

#### Section 1: Employee Information

| Field | Type | Required | Options / Notes |
|---|---|---|---|
| First Name | text | Yes | |
| Last Name | text | Yes | |
| Personal Email | email | Yes | Pre-employment communication |
| Personal Phone | phone | Yes | Emergency contact / 2FA setup |
| Job Title | text | Yes | |
| Department | select | Yes | R&D, Marketing, HR, Biz Dev & Strategy, Finance, Operations, Legal, IT, Other |
| Employment Type | select | Yes | Full-Time Employee, Part-Time Employee, Contractor, Intern |
| Legal Entity / Company | select | Yes | Supports multi-entity orgs |
| Cost Center | text | No | For asset and license billing |
| Office Location | select | Yes | HQ, Remote, [Office list] |
| Time Zone | select | Yes | For scheduling and calendar setup |
| Start Date | date | Yes | |
| Start Time | time | No | Default: 9:00 AM local |
| VIP / Expedited Flag | checkbox | No | Triggers priority escalation |

#### Section 2: Reporting & Approvals

| Field | Type | Required | Notes |
|---|---|---|---|
| Supervisor / Manager | user_picker | Yes | Must resolve to a valid employee record |
| Manager Email | email | Auto-populated | From supervisor picker |
| HR Contact | user_picker | No | Defaults to department HR partner |
| Budget Approver | user_picker | No | For hardware/license costs; defaults to manager |

#### Section 3: Access & Role Profile

| Field | Type | Required | Notes |
|---|---|---|---|
| Access Profile / Role Template | select | No | Pre-configured bundles (see Section W.9). Options: Engineering Standard, Marketing Standard, HR Standard, BizDev Standard, Executive, Contractor Limited, Custom |
| Additional Applications | multi_select | No | Slack, Microsoft 365, Notion, AWS VPN Client, SentinelOne, RustDesk, TeamViewer, Putty, VS Code, Git, Other |
| AWS Access Required | checkbox | No | If yes, triggers AWS IAM sub-workflow |
| AWS Role / Permission Set | select | Conditional | Shown if AWS Access = Yes |
| VPN Access Required | checkbox | No | |

#### Section 4: Device & Hardware

| Field | Type | Required | Notes |
|---|---|---|---|
| Kit Type | select | Yes | Dell Latitude Kit, Lenovo ThinkPad Kit, Apple MacBook Air Kit, Apple MacBook Pro Kit, Apple MacBook Pro Max Kit, Other |
| Peripherals | multi_select | No | Headphones (with microphone), Monitor, Keyboard, Mouse, Docking Station, Webcam, Other |
| Device Shipping Required | checkbox | Yes | |
| Shipping Address | textarea | Conditional | Shown if Device Shipping = Yes |
| Shipping Priority | select | Conditional | Standard (5-7 days), Express (2-3 days), Overnight |

#### Section 5: Additional Notes

| Field | Type | Required | Notes |
|---|---|---|---|
| Additional Software / Tools | textarea | No | Free text for anything not in the lists |
| Special Instructions | textarea | No | |

### H.2 Onboarding Workflow Steps

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ONBOARDING WORKFLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. REQUEST CREATION                                                        │
│     └── HR/Manager submits onboarding form via portal                       │
│         └── Ticket created: type=onboarding, priority=High                  │
│                                                                             │
│  2. VALIDATION                                                              │
│     ├── Form completeness check (all required fields)                       │
│     ├── Start date sanity check (not in the past, not > 90 days out)        │
│     ├── Manager exists in directory                                         │
│     ├── No duplicate onboarding for same person + start date                │
│     └── Kit type availability check                                         │
│                                                                             │
│  3. APPROVALS (parallel)                                                    │
│     ├── Manager approval (auto-assigned)                                    │
│     ├── HR confirmation (auto-assigned to HR contact)                       │
│     └── Finance approval (if kit cost > threshold)                          │
│     └── Timeout: 48h → escalate to next-level manager/HR lead              │
│                                                                             │
│  4. IT TASK BREAKDOWN (upon all approvals granted)                          │
│     System creates parallel child tasks:                                    │
│                                                                             │
│     4a. IDENTITY CREATION [AUTOMATED]                                       │
│         ├── Create Entra ID user account                                    │
│         ├── Set temporary password                                          │
│         ├── Add to department group                                         │
│         ├── Add to role-template groups                                     │
│         └── Output: UPN, temp password stored securely                      │
│                                                                             │
│     4b. LICENSE ASSIGNMENT [AUTOMATED]                                      │
│         ├── Assign M365 license (E3/E5 based on role template)              │
│         ├── Assign other SaaS licenses per role template                    │
│         └── Validate license availability before assignment                 │
│                                                                             │
│     4c. APPLICATION PROVISIONING [SEMI-AUTOMATED]                           │
│         ├── Slack: invite via Slack API [AUTOMATED]                         │
│         ├── Notion: invite via API [AUTOMATED]                              │
│         ├── SentinelOne: create agent deployment package [MANUAL]           │
│         ├── AWS: create IAM user/role if requested [APPROVAL-GATED]         │
│         ├── VPN: provision VPN profile [SEMI-AUTOMATED]                     │
│         └── Other apps: manual provisioning tasks assigned to IT agent      │
│                                                                             │
│     4d. DEVICE PROVISIONING [MANUAL with tracking]                          │
│         ├── Reserve device from inventory                                   │
│         ├── Image/configure device (MDM enrollment)                         │
│         ├── Install required software                                       │
│         │   └── OS, SentinelOne, RustDesk, VS Code, Git, Putty,           │
│         │       TeamViewer, AWS VPN Client (per form selections)            │
│         ├── Apply security policies                                         │
│         ├── Ship device (if shipping required)                              │
│         └── Track shipping, update ticket with tracking number              │
│                                                                             │
│     4e. NOTIFICATIONS [AUTOMATED]                                           │
│         ├── Welcome email to personal email with Day 1 instructions         │
│         ├── Manager notification with new hire details                      │
│         ├── IT team Slack notification                                      │
│         └── Calendar invite for IT onboarding session                       │
│                                                                             │
│  5. CHECKLIST COMPLETION                                                    │
│     ├── Each task checked off as completed                                  │
│     ├── Blocking tasks prevent workflow completion                          │
│     ├── Dashboard shows real-time progress per new hire                     │
│     └── Daily digest of pending onboarding tasks to IT lead                 │
│                                                                             │
│  6. COMPLETION CONFIRMATION                                                 │
│     ├── All tasks marked complete                                           │
│     ├── System validates: account exists, licenses assigned, groups correct  │
│     ├── Manager sent "onboarding complete" notification                     │
│     ├── HR sent completion confirmation                                     │
│     ├── Ticket status → Resolved                                            │
│     └── Satisfaction survey to manager after 1 week                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### H.3 Automation Classification for Onboarding

| Step | Classification | Method | Rollback |
|---|---|---|---|
| Create Entra ID account | **Fully Automated** | Microsoft Graph API `POST /users` | Delete user |
| Set temporary password | **Fully Automated** | Microsoft Graph API | Reset |
| Add to department group | **Fully Automated** | Microsoft Graph API `POST /groups/{id}/members` | Remove from group |
| Assign M365 license | **Fully Automated** | Microsoft Graph API `POST /users/{id}/assignLicense` | Remove license |
| Invite to Slack | **Fully Automated** | Slack API `admin.users.invite` | Deactivate user |
| Invite to Notion | **Fully Automated** | Notion API | Remove user |
| Provision AWS IAM | **Approval-Gated Automation** | AWS IAM API | Delete user/role |
| Provision VPN | **Semi-Automated** | Generate config, agent applies | Revoke config |
| Install SentinelOne | **Manual** | Agent prepares device | Uninstall |
| Device imaging | **Manual** | IT tech performs | Re-image |
| Device shipping | **Manual** | Logistics team ships | N/A |
| Software installation | **Semi-Automated** | MDM pushes standard apps; manual for specialty | Uninstall via MDM |
| Welcome email | **Fully Automated** | Email template engine | N/A |
| Manager notification | **Fully Automated** | Notification service | N/A |

### H.4 Timing and Scheduling

| Milestone | Target |
|---|---|
| Form submitted | Start date minus 10+ business days (ideal) |
| Approvals complete | Within 48 hours of submission |
| Account created | Within 4 hours of approval |
| Licenses assigned | Within 1 hour of account creation |
| Device ready | Start date minus 3 business days |
| Device shipped | Start date minus 5 business days (remote) |
| All tasks complete | Start date minus 1 business day |
| Verification | Start date (Day 1 morning) |

---

## I. Offboarding Workflow Design

### I.1 Normalized Offboarding Form

#### Section 1: Employee Information

| Field | Type | Required | Notes |
|---|---|---|---|
| First Name | text | Yes | |
| Last Name | text | Yes | |
| Company Email | email | Yes | Must match existing employee record |
| Employee ID | text | Auto-populated | From employee record lookup |
| Job Title | text | Auto-populated | |
| Department | select | Auto-populated | |
| Office Location | text | Auto-populated | |

#### Section 2: Termination Details

| Field | Type | Required | Notes |
|---|---|---|---|
| Termination Type | select | Yes | Voluntary (Resignation), Involuntary (Termination), End of Contract/Internship, Retirement, Mutual Separation |
| Last Working Day | date | Yes | |
| Termination Effective Date | date | Yes | May differ from last working day (e.g., garden leave) |
| Termination Effective Time | time | No | Default: end of business day. For involuntary: immediate |
| Immediate Disable Required | checkbox | Yes | Default: No. Auto-set to Yes for involuntary |
| Manager / Supervisor | user_picker | Yes | Auto-populated, editable |
| Manager Email | email | Auto-populated | |
| HR Contact | user_picker | Yes | |
| Rehire Eligible | select | No | Yes, No, TBD |

#### Section 3: Data Ownership & Handover

| Field | Type | Required | Notes |
|---|---|---|---|
| Email Mailbox Action | select | Yes | Disable Immediately, Forward to [user], Convert to Shared Mailbox, Retain for [X days], Other |
| Forwarding Recipient | user_picker | Conditional | Shown if mailbox action = Forward |
| Retention Duration (days) | number | Conditional | Shown if mailbox action = Retain |
| OneDrive Action | select | Yes | Transfer to Manager, Transfer to [user], Retain for [X days], Delete |
| OneDrive Transfer Recipient | user_picker | Conditional | |
| Shared Folders Handover | textarea | No | List shared folders and new owners |
| Project Files Handover | textarea | No | List projects and handover contacts |
| External Accounts to Transfer | textarea | No | Vendor portals, social media, etc. |
| Shared Credentials to Review | textarea | No | Any shared accounts this person had access to |

#### Section 4: Compliance, Legal & Risk

| Field | Type | Required | Notes |
|---|---|---|---|
| Legal Hold Required | checkbox | Yes | Default: No |
| Legal Hold Details | textarea | Conditional | Shown if legal hold = Yes |
| Regulatory Requirements | multi_select | No | GDPR, SOX, HIPAA, PCI-DSS, None |
| Customer/Partner Access Involved | checkbox | No | Triggers additional review |
| Privileged Account Holder | checkbox | Yes | Admin access to critical systems |
| High-Risk Departure | checkbox | No | HR flag for elevated monitoring |
| Security Incident / Investigation | checkbox | No | Triggers security team involvement |
| Known Owned Systems | textarea | No | Systems where this person is primary admin/owner |

#### Section 5: Asset Recovery

| Field | Type | Required | Notes |
|---|---|---|---|
| Device Return Required | checkbox | Yes | |
| Devices to Return | multi_select | Conditional | Auto-populated from asset inventory |
| Device Return Method | select | Conditional | In-office return, Shipping label provided, On-site pickup |
| Shipping Address for Label | textarea | Conditional | For remote returns |

### I.2 Offboarding Workflow Steps

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       OFFBOARDING WORKFLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. INTAKE                                                                  │
│     ├── HR/Manager submits offboarding form                                 │
│     ├── System validates employee exists and is active                      │
│     └── Ticket created: type=offboarding                                    │
│         ├── Voluntary: priority=High                                        │
│         ├── Involuntary: priority=Critical, immediate disable flag          │
│         └── End of contract: priority=High, scheduled date                  │
│                                                                             │
│  2. VALIDATION                                                              │
│     ├── Employee record lookup and verification                             │
│     ├── Cross-reference with active onboarding (edge case: in-progress      │
│     │   onboarding for same person → flag for review)                       │
│     ├── Identify all known access entitlements from access_entitlements     │
│     ├── Identify all assigned assets from asset inventory                   │
│     ├── Check for privileged accounts (admin roles, service accounts)       │
│     └── Flag legal hold status                                              │
│                                                                             │
│  3. REVIEWS & APPROVALS                                                     │
│     ├── HR confirmation (required)                                          │
│     ├── Manager confirmation (required)                                     │
│     ├── Security review (required if: privileged account, high-risk,        │
│     │   security incident, or customer access involved)                     │
│     ├── Legal review (required if legal hold = Yes)                         │
│     └── For INVOLUNTARY: approvals may be pre-completed by HR              │
│         (form submission = implicit HR approval)                            │
│                                                                             │
│  BRANCH: INVOLUNTARY / IMMEDIATE DISABLE                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Execute immediately upon HR submission (parallel):                  │    │
│  │  ├── Disable Entra ID account [AUTOMATED]                           │    │
│  │  ├── Revoke all active sessions [AUTOMATED]                         │    │
│  │  ├── Revoke OAuth tokens [AUTOMATED]                                │    │
│  │  ├── Disable Slack account [AUTOMATED]                              │    │
│  │  ├── Change passwords on known shared credentials [MANUAL-URGENT]   │    │
│  │  └── Remaining steps continue as below                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  BRANCH: VOLUNTARY / SCHEDULED                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Schedule for termination effective date/time:                       │    │
│  │  ├── Schedule account disable [AUTOMATED - timer trigger]           │    │
│  │  ├── Provide transition period for knowledge transfer                │    │
│  │  └── Begin non-disruptive steps immediately                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  4. ACCESS REVOCATION (parallel tasks)                                      │
│                                                                             │
│     4a. MICROSOFT / ENTRA ID [AUTOMATED]                                    │
│         ├── Disable sign-in                                                 │
│         ├── Revoke refresh tokens                                           │
│         ├── Remove from all Entra ID groups                                 │
│         ├── Remove all role assignments                                     │
│         ├── Remove M365 licenses (after retention period)                   │
│         ├── Set mailbox action per form (forward/convert/disable)           │
│         ├── Set OneDrive transfer per form                                  │
│         └── Disable MFA methods                                             │
│                                                                             │
│     4b. SLACK [AUTOMATED]                                                   │
│         ├── Deactivate Slack user                                           │
│         └── Log channel memberships before removal                          │
│                                                                             │
│     4c. AWS [AUTOMATED with approval gate if privileged]                    │
│         ├── Delete/disable IAM users                                        │
│         ├── Remove from IAM groups                                          │
│         ├── Revoke active sessions                                          │
│         ├── Remove SSO permission sets                                      │
│         └── Delete access keys                                              │
│                                                                             │
│     4d. VPN / NETWORK [SEMI-AUTOMATED]                                      │
│         ├── Revoke VPN certificates/profiles                                │
│         └── Remove firewall rules specific to user                          │
│                                                                             │
│     4e. APPLICATION ACCESS [SEMI-AUTOMATED]                                 │
│         ├── For each application in access_entitlements:                     │
│         │   ├── API-based: automated revocation                             │
│         │   ├── SCIM-based: automated deprovisioning                        │
│         │   └── Manual: task assigned to application owner                  │
│         └── Mark each entitlement as revoked with ticket link               │
│                                                                             │
│     4f. SECURITY TOOLS [MANUAL]                                             │
│         ├── SentinelOne: remove device from console                         │
│         └── Other security tools: manual revocation tasks                   │
│                                                                             │
│  5. DATA RETENTION & LEGAL                                                  │
│     ├── If legal hold: preserve all data, prevent deletion                  │
│     ├── Email: execute mailbox action per form                              │
│     ├── OneDrive: execute transfer/retention per form                       │
│     ├── Shared drives: reassign ownership per form                          │
│     └── Generate data retention evidence log                                │
│                                                                             │
│  6. ASSET RECOVERY                                                          │
│     ├── Generate device return checklist                                    │
│     ├── For remote: generate shipping label, send to personal email         │
│     ├── Track device return status                                          │
│     ├── Upon receipt: wipe device, return to inventory                      │
│     └── If not returned within 30 days: escalate to HR/manager             │
│                                                                             │
│  7. COMPLIANCE ACTIONS                                                      │
│     ├── GDPR: schedule data deletion per retention policy                   │
│     ├── SOX: generate access change evidence report                         │
│     ├── Shared credential rotation: create tasks for each                   │
│     └── External account transfer: create tasks per account                 │
│                                                                             │
│  8. FINAL VERIFICATION                                                      │
│     ├── System validates:                                                   │
│     │   ├── Account disabled in Entra ID                                    │
│     │   ├── No active sessions                                              │
│     │   ├── All entitlements marked revoked                                 │
│     │   ├── Mailbox action completed                                        │
│     │   └── All manual tasks checked off                                    │
│     ├── Generate completion checklist PDF                                    │
│     ├── Generate evidence log (all actions with timestamps)                 │
│     └── Notify HR, manager, security of completion                          │
│                                                                             │
│  9. CLOSURE                                                                 │
│     ├── Ticket status → Resolved → Closed                                   │
│     ├── Employee record marked inactive with offboarding ticket link        │
│     └── Audit log sealed                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### I.3 Safe Offboarding Sequencing

The order of operations matters. Incorrect sequencing can lock out IT from completing remaining steps or alert the employee prematurely.

**Recommended sequence for involuntary/immediate offboarding:**

```
Phase 1 - Immediate (within minutes, parallel):
  1. Disable Entra ID sign-in
  2. Revoke all refresh tokens and active sessions
  3. Disable Slack account
  4. Revoke VPN access
  5. Disable AWS console/CLI access

Phase 2 - Within 1 hour:
  6. Remove from all security groups (which cascades app access)
  7. Remove admin roles
  8. Rotate any shared credentials this person knew

Phase 3 - Within 4 hours:
  9. Set mailbox forwarding/conversion
  10. Transfer OneDrive to manager
  11. Remove application-specific access (API/SCIM)
  12. Remove from distribution lists / shared mailboxes

Phase 4 - Within 24 hours:
  13. Remove licenses (after mailbox action is set)
  14. Remove device from MDM / SentinelOne
  15. Generate compliance reports

Phase 5 - Tracked (within 30 days):
  16. Device returned and wiped
  17. Data retention period actions
  18. Final audit closure
```

**Recommended sequence for voluntary offboarding:**

```
Day of notification (last working day - N):
  1. Ticket created, scheduled actions set

Last working day, end of business:
  2-5. Same as involuntary Phase 1

Last working day + 1:
  6-12. Same as involuntary Phase 2-3

Last working day + 7:
  13-15. License removal, device management

Within 30 days:
  16-18. Same as involuntary Phase 5
```

### I.4 Automation Classification for Offboarding

| Step | Classification | Notes |
|---|---|---|
| Disable Entra ID account | **Fully Automated** | Immediate for involuntary; scheduled for voluntary |
| Revoke sessions/tokens | **Fully Automated** | |
| Remove group memberships | **Fully Automated** | |
| Remove role assignments | **Fully Automated** | Security review gate for admin roles |
| Mailbox forwarding/conversion | **Fully Automated** | |
| OneDrive transfer | **Fully Automated** | |
| Remove M365 licenses | **Fully Automated** | Delayed per sequence |
| Disable Slack | **Fully Automated** | |
| Disable AWS access | **Approval-Gated** | Security review for privileged accounts |
| Revoke VPN | **Semi-Automated** | Depends on VPN provider API availability |
| Application deprovisioning (SCIM) | **Fully Automated** | Per application |
| Application deprovisioning (manual) | **Manual** | Task assigned to app owner |
| Security tool removal | **Manual** | |
| Shared credential rotation | **Manual** | Task per credential |
| Device wipe | **Semi-Automated** | MDM command + physical verification |
| Generate compliance report | **Fully Automated** | |
| Legal hold enforcement | **Fully Automated** | Flag set, all deletion blocked |

---

## J. Slack Integration Design

### J.1 Architecture

```
┌──────────────────────┐       ┌───────────────────────────┐
│    Slack Workspace    │       │     ITSM Platform          │
│                       │       │                             │
│  #it-help channel ────┼──────>│  Slack Event Listener       │
│                       │  Events│  (webhook endpoint)         │
│  Slash commands ──────┼──────>│  ├── /it-help               │
│                       │       │  ├── /ticket                 │
│  Message shortcuts ───┼──────>│  └── Message shortcut       │
│                       │       │                             │
│  Interactive msgs <───┼──────<│  Slack Response Service     │
│  (modals, buttons)    │       │  ├── Acknowledgments         │
│                       │       │  ├── Status updates          │
│  DMs to approvers <───┼──────<│  ├── Approval buttons        │
│                       │       │  └── Ticket summaries         │
│                       │       │                             │
│                       │       │  Slack Identity Resolver     │
│                       │       │  ├── Slack user -> email      │
│                       │       │  └── email -> internal user   │
└──────────────────────┘       └───────────────────────────┘
```

### J.2 Slack APIs and Events

| Component | Slack API / Feature |
|---|---|
| **Event subscription** | Events API: `message.channels`, `message.groups`, `app_mention` |
| **Message posting** | Web API: `chat.postMessage`, `chat.update` |
| **Thread replies** | Web API: `chat.postMessage` with `thread_ts` parameter |
| **User identity** | Web API: `users.info`, `users.lookupByEmail` |
| **File download** | Web API: `files.info` + authenticated URL download |
| **Slash commands** | Slash Commands: `/it-help`, `/ticket` |
| **Modals** | Block Kit: `views.open`, `views.push`, `views.update` |
| **Interactive messages** | Block Kit interactive components: buttons, selects, actions |
| **Message shortcuts** | Global Shortcuts / Message Shortcuts API |
| **Approvals** | Interactive message buttons in DMs |

### J.3 Event Flow: Message to Ticket

```
1. User posts message in #it-help
   │
2. Slack sends event to ITSM webhook endpoint
   │  Event payload: channel_id, user_id, text, ts, thread_ts, files[]
   │
3. Event listener validates:
   ├── Is this a monitored channel? (check against config)
   ├── Is this from a bot? (ignore if so)
   ├── Is this a thread reply to an existing ticket? (check thread_ts)
   │   ├── YES: route to "add comment" flow
   │   └── NO: route to "create ticket" flow
   │
4. CREATE TICKET FLOW:
   ├── Resolve Slack user identity:
   │   ├── Call Slack users.info to get email
   │   ├── Look up email in internal users table
   │   ├── If not found: JIT create user record with Slack details
   │   └── Cache Slack user ID <-> internal user ID mapping
   │
   ├── Deduplication check:
   │   ├── Same user + same channel + message within 30 seconds = skip
   │   └── Fuzzy text match against recent tickets from same user (optional)
   │
   ├── Create ticket:
   │   ├── title: first 100 chars of message (or AI-generated summary, future)
   │   ├── description: full message text
   │   ├── source: "slack"
   │   ├── requester: resolved user
   │   ├── category: auto-detect from keywords or default to "General IT Support"
   │   ├── priority: Medium (default)
   │   └── custom_fields: { slack_channel, slack_ts }
   │
   ├── Create slack_message_link record
   │
   ├── Download and attach any files from the Slack message
   │
   ├── Post acknowledgment to Slack thread:
   │   "✓ Ticket IT-20260042 created. Track at: [portal link]
   │    An IT team member will respond shortly.
   │    Priority: Medium | SLA: Response within 4 hours"
   │
   └── Post to IT agent Slack channel / assign to queue
   │
5. ADD COMMENT FLOW (thread reply on existing ticket):
   ├── Look up ticket by thread_ts in slack_message_links
   ├── Resolve commenter identity
   ├── Add comment to ticket (public)
   ├── If commenter is an agent: option to add as internal note via reaction
   └── No acknowledgment needed (comment is on a known thread)
```

### J.4 Slash Command: `/it-help`

```
User types: /it-help

1. ITSM receives slash command payload
2. Open a Slack modal with fields:
   ├── Request Type (select): General Help, Access Request, Hardware, Software, Other
   ├── Summary (text input): short description
   ├── Details (textarea): full description
   ├── Priority (select): Low, Medium, High
   └── Attachments note: "Attach files in the channel after submitting"
3. User submits modal
4. Create ticket from structured data
5. Post confirmation as ephemeral message to user
6. Post ticket summary to #it-help channel for visibility
```

### J.5 Slash Command: `/ticket <ID>`

```
User types: /ticket IT-20260042

1. Look up ticket by number
2. Verify user has access (requester or agent)
3. Return ephemeral message:
   "Ticket IT-20260042: Laptop keyboard not working
    Status: In Progress | Priority: Medium
    Assigned to: @jane.doe | Queue: IT Operations
    Last update: 2h ago - Replacement keyboard ordered
    [View in Portal]"
```

### J.6 Deduplication Strategy

| Method | Implementation |
|---|---|
| **Time-based** | Messages from the same user within 30 seconds are treated as one (take the longest message) |
| **Thread-based** | Any message in a thread that already has a linked ticket is a comment, not a new ticket |
| **Bot-ignore** | Skip messages from bots and the ITSM bot itself |
| **Duplicate detection** | Before creating a ticket, check if the same user has an open ticket with >70% text similarity in the last hour |
| **Explicit opt-out** | Emoji reaction (e.g., :no_ticket:) on a message prevents ticket creation |
| **Confirmation** | For ambiguous messages, bot asks "Should I create a ticket for this?" with Yes/No buttons |

### J.7 Identity Mapping: Slack to Microsoft

```
Resolution chain (in order):

1. Check users table: slack_user_id already mapped?
   └── YES: use cached mapping
   └── NO: continue

2. Call Slack users.info API to get user's email
   └── Got email? Check users table by email
       └── Found: link slack_user_id to user record
       └── Not found: continue

3. Call Slack users.info to get real_name / display_name
   └── Fuzzy match against users table display_name / email prefix
       └── Confidence > 90%: link with manual confirmation
       └── Confidence < 90%: create provisional user record, flag for admin review

4. Fallback: create user record with Slack details only, mark as "slack_only"
   └── Admin can manually link later
   └── User can self-link by logging into portal (SSO resolves the mapping)
```

### J.8 Security Considerations

- **Webhook verification**: Validate Slack request signatures on every incoming event using the signing secret
- **Token storage**: Slack bot token and signing secret stored in secrets vault, never in code
- **Scoped permissions**: Slack app uses minimum required OAuth scopes
- **Channel restriction**: Only process events from explicitly configured channels
- **Rate limiting**: Respect Slack API rate limits (Tier 1-4); queue outgoing messages
- **PII handling**: Slack message text may contain sensitive data - apply same data handling policies as ticket descriptions
- **File handling**: Files downloaded from Slack are scanned for malware before attaching to tickets

### J.9 Failure Handling

| Failure | Handling |
|---|---|
| Webhook delivery failure | Slack retries up to 3 times with backoff; ITSM returns 200 quickly, processes async |
| Ticket creation failure | Log error, post apology message to Slack thread, alert IT admin |
| Identity resolution failure | Create ticket with Slack details only, flag for manual user linking |
| File download failure | Create ticket without attachment, log warning, note in ticket |
| Slack API failure (posting ack) | Queue for retry; ticket is still created even if Slack notification fails |
| Duplicate webhook delivery | Idempotency via message_ts - same channel+ts never processed twice |

---

## K. SSO Design

### K.1 Recommendation: OIDC with Microsoft Entra ID

**Recommended: OIDC (OpenID Connect) over SAML.**

Rationale:
- OIDC is the modern standard; SAML is legacy (XML-based, more complex)
- OIDC uses JSON/JWT tokens which are lighter and easier to work with
- OIDC supports refresh tokens natively for session extension
- Microsoft Entra ID has first-class OIDC support
- OIDC is simpler to implement in modern web frameworks (Next.js, Express, etc.)
- OIDC supports both web apps and SPAs (via PKCE)
- The Entra ID team recommends OIDC for new applications

### K.2 OIDC Configuration

```
Provider: Microsoft Entra ID
Protocol: OpenID Connect
Grant Type: Authorization Code with PKCE (for portal)
            Client Credentials (for service-to-service)

Entra ID App Registration:
├── Application (client) ID: <generated>
├── Directory (tenant) ID: <your-tenant-id>
├── Redirect URIs:
│   ├── https://itsm.company.com/auth/callback
│   └── http://localhost:3000/auth/callback (dev only)
├── Supported account types: Single tenant (this org only)
├── Client secret: stored in secrets vault (not in code)
└── API permissions:
    ├── openid (delegated)
    ├── profile (delegated)
    ├── email (delegated)
    ├── User.Read (delegated)
    └── GroupMember.Read.All (delegated) - for role mapping

Discovery endpoint:
https://login.microsoftonline.com/{tenant-id}/v2.0/.well-known/openid-configuration
```

### K.3 Claims

| Claim | Source | Use |
|---|---|---|
| `sub` | ID token | Unique user identifier (Entra object ID) |
| `preferred_username` | ID token | UPN (user@company.com) |
| `email` | ID token | Email address |
| `name` | ID token | Display name |
| `given_name` | ID token | First name |
| `family_name` | ID token | Last name |
| `groups` | ID token (optional claim) | Security group object IDs for RBAC |
| `tid` | ID token | Tenant ID (validate matches expected tenant) |
| `aud` | ID token | Audience (validate matches our client ID) |
| `roles` | ID token (app roles) | Application roles if configured |

**Important**: For group claims, configure the Entra app registration to include security groups in the ID token. If the user is in many groups (>200), Entra returns a `_claim_names`/`_claim_sources` overage indicator - in that case, call Microsoft Graph API to retrieve groups.

### K.4 Group-to-Role Mapping

| Entra ID Group | ITSM Role | Description |
|---|---|---|
| `ITSM-Agents` | IT Agent | IT operations team members |
| `ITSM-Leads` | IT Lead | IT team leads |
| `ITSM-Admins` | IT Admin | System administrators |
| `ITSM-HR` | HR / People Ops | HR team members |
| `ITSM-Security` | Security Reviewer | Security team members |
| `ITSM-Auditors` | Auditor | Compliance and audit team |
| *(none of the above)* | End User | Default role for all authenticated users |

The Approver role is not mapped from a group - it is dynamically assigned per ticket based on workflow rules.

### K.5 JIT (Just-In-Time) Provisioning

```
On first login:
1. User authenticates via Entra ID
2. ITSM receives ID token with claims
3. Check if user exists in users table (by entra_object_id)
   ├── EXISTS: update last_login_at, sync display_name/email/groups
   └── NOT EXISTS:
       ├── Create user record:
       │   ├── email = claim.email
       │   ├── display_name = claim.name
       │   ├── entra_object_id = claim.sub
       │   ├── department = (from Graph API if not in claims)
       │   ├── job_title = (from Graph API)
       │   └── manager_id = (resolved via Graph API)
       ├── Assign roles based on group claims
       └── Log user creation in audit log

On subsequent logins:
1. Sync group memberships -> role updates
2. Update profile fields if changed
3. Log login event
```

### K.6 SCIM (Optional, Phase 4+)

For proactive user lifecycle management (instead of waiting for login):

- Implement SCIM 2.0 endpoints (`/scim/v2/Users`, `/scim/v2/Groups`)
- Entra ID Enterprise Application configured for automatic provisioning
- Handles: user creation, updates, deactivation, group membership changes
- Eliminates stale user records for employees who never log in to the ITSM portal
- Useful for offboarding: Entra ID disablement triggers SCIM deprovisioning

### K.7 Session Management

| Parameter | Value |
|---|---|
| Session duration | 8 hours (sliding window) |
| Absolute session max | 24 hours |
| Session storage | Server-side (Redis or database), not JWT-only |
| Idle timeout | 30 minutes of inactivity |
| Token refresh | Refresh token used to extend session without re-authentication |
| Concurrent sessions | Allowed (user may be on multiple devices) |
| Logout | Destroys local session + redirect to Entra ID logout endpoint |

### K.8 MFA Expectations

MFA is enforced at the Entra ID level via Conditional Access policies. The ITSM application does not implement its own MFA. This is the correct approach because:

- Centralized MFA management across all apps
- Users have consistent MFA experience
- MFA methods managed in one place
- Conditional Access can enforce MFA based on risk signals (location, device compliance, etc.)

The ITSM application can request `acr_values` or check the `amr` claim to verify MFA was performed if needed for high-security operations.

---

## L. Automation Framework

### L.1 Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                      AUTOMATION ENGINE                                │
│                                                                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐    │
│  │  TRIGGERS     │    │  RULES       │    │  CONNECTORS          │    │
│  │               │    │  ENGINE      │    │                      │    │
│  │ - Form submit │───>│              │───>│ - Microsoft Graph    │    │
│  │ - Approval    │    │ - Evaluate   │    │ - AWS IAM            │    │
│  │ - Status chg  │    │   conditions │    │ - Slack API          │    │
│  │ - Schedule    │    │ - Select     │    │ - Email (SMTP)       │    │
│  │ - Manual      │    │   actions    │    │ - Webhook (generic)  │    │
│  │ - Webhook     │    │ - Route to   │    │ - MDM (Intune/Jamf)  │    │
│  └──────────────┘    │   connector  │    │ - Custom scripts     │    │
│                       └──────────────┘    └──────────────────────┘    │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                    EXECUTION ENGINE                             │   │
│  │                                                                 │   │
│  │  Job Queue ──> Worker Pool ──> Connector Execution ──> Result   │   │
│  │      │              │                │                   │      │   │
│  │      │         Retry Logic      Error Handler       Audit Log   │   │
│  │      │              │                │                   │      │   │
│  │  Idempotency    Backoff         Rollback              Notify    │   │
│  │  Check          Strategy        Strategy              Callback  │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                    APPROVAL GATES                               │   │
│  │                                                                 │   │
│  │  Before executing high-risk actions, pause and request          │   │
│  │  human approval. Resume only after explicit approval.           │   │
│  │                                                                 │   │
│  │  Risk Classification:                                           │   │
│  │  - LOW: notifications, read-only queries → auto-execute         │   │
│  │  - MEDIUM: group adds, license assignments → auto if template   │   │
│  │  - HIGH: account creation, admin roles → require approval       │   │
│  │  - CRITICAL: tenant-wide changes, bulk operations → CAB         │   │
│  └────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

### L.2 Trigger Types

| Trigger | Description | Example |
|---|---|---|
| **form_submission_approved** | Fires when all required approvals for a form submission are granted | Onboarding form approved → start provisioning |
| **ticket_status_change** | Fires when ticket status transitions | Ticket → Resolved: send satisfaction survey |
| **schedule** | Fires at a specific date/time or recurring cron | Offboarding: disable account at termination date EOD |
| **manual** | Agent clicks "Run Automation" button | Re-run failed license assignment |
| **webhook** | External system calls ITSM webhook endpoint | HRIS sends new hire notification |
| **approval_decision** | Fires when an approval is granted or rejected | Access approved → provision access |
| **timer** | Fires after elapsed time since a condition | No response from requester after 48h → auto-follow-up |

### L.3 Connector Framework

Each connector implements a standard interface:

```typescript
interface AutomationConnector {
  name: string;
  type: string;
  
  // Health check
  healthCheck(): Promise<HealthStatus>;
  
  // Execute an action
  execute(action: string, params: Record<string, any>): Promise<ConnectorResult>;
  
  // Rollback a previously executed action
  rollback(action: string, executionId: string, params: Record<string, any>): Promise<ConnectorResult>;
  
  // Validate parameters before execution
  validate(action: string, params: Record<string, any>): ValidationResult;
}

interface ConnectorResult {
  success: boolean;
  data: Record<string, any>;
  error?: string;
  rollbackable: boolean;
  idempotencyKey: string;
}
```

#### Connector: Microsoft Graph

| Action | API Call | Risk Level |
|---|---|---|
| `create_user` | `POST /users` | HIGH |
| `disable_user` | `PATCH /users/{id} { accountEnabled: false }` | HIGH |
| `assign_license` | `POST /users/{id}/assignLicense` | MEDIUM |
| `remove_license` | `POST /users/{id}/assignLicense (removeLicenses)` | MEDIUM |
| `add_to_group` | `POST /groups/{id}/members/$ref` | MEDIUM |
| `remove_from_group` | `DELETE /groups/{id}/members/{userId}/$ref` | MEDIUM |
| `revoke_sessions` | `POST /users/{id}/revokeSignInSessions` | HIGH |
| `set_mailbox_forwarding` | `PATCH /users/{id}/mailboxSettings` | MEDIUM |
| `convert_to_shared_mailbox` | Exchange Online PowerShell via Graph | MEDIUM |
| `get_user_groups` | `GET /users/{id}/memberOf` | LOW |
| `get_user` | `GET /users/{id}` | LOW |

#### Connector: AWS IAM

| Action | API Call | Risk Level |
|---|---|---|
| `create_iam_user` | `CreateUser` | HIGH |
| `delete_iam_user` | `DeleteUser` (with dependency cleanup) | HIGH |
| `attach_policy` | `AttachUserPolicy` / `AttachGroupPolicy` | HIGH |
| `detach_policy` | `DetachUserPolicy` / `DetachGroupPolicy` | MEDIUM |
| `add_to_group` | `AddUserToGroup` | MEDIUM |
| `remove_from_group` | `RemoveUserFromGroup` | MEDIUM |
| `create_access_key` | `CreateAccessKey` | HIGH |
| `delete_access_key` | `DeleteAccessKey` | MEDIUM |
| `create_sso_assignment` | SSO `CreateAccountAssignment` | HIGH |
| `delete_sso_assignment` | SSO `DeleteAccountAssignment` | HIGH |

#### Connector: Slack

| Action | API Call | Risk Level |
|---|---|---|
| `invite_user` | `admin.users.invite` | MEDIUM |
| `deactivate_user` | `admin.users.remove` | HIGH |
| `post_message` | `chat.postMessage` | LOW |
| `send_dm` | `conversations.open` + `chat.postMessage` | LOW |

### L.4 Retry and Error Handling

```
Retry Strategy:
├── Transient errors (429, 500, 502, 503, 504, network timeout):
│   ├── Retry up to 3 times
│   ├── Exponential backoff: 2s, 8s, 32s
│   └── Respect Retry-After header from API responses
│
├── Client errors (400, 403, 404, 409):
│   ├── Do NOT retry
│   ├── Log error with full request/response
│   ├── Mark automation step as FAILED
│   └── Create manual task for agent to investigate
│
└── Timeout (execution > 60 seconds):
    ├── Retry once
    ├── If still timeout: mark as FAILED
    └── Alert IT admin
```

### L.5 Idempotency

Every automation action generates an idempotency key:

```
idempotency_key = hash(ticket_id + step_name + action + canonical_params)
```

Before execution:
1. Check `automation_runs` table for existing run with same idempotency key
2. If found and status = `completed`: return cached result (no re-execution)
3. If found and status = `failed`: allow re-execution (new attempt)
4. If found and status = `running`: wait or reject (prevent concurrent execution)

### L.6 Rollback Strategy

```
On workflow step failure:
1. Mark current step as FAILED
2. Evaluate rollback policy:
   ├── ROLLBACK_ALL: undo all completed steps in reverse order
   ├── ROLLBACK_STEP: undo only the failed step, continue workflow
   ├── PAUSE: pause workflow, notify agent, await manual resolution
   └── SKIP: skip failed step, continue (for non-critical steps only)
3. Execute rollback actions for each step (if rollbackable)
4. Log all rollback actions in automation_step_logs
5. If rollback fails: escalate to IT admin with full context
```

Default policy per risk level:
- LOW risk steps: SKIP on failure
- MEDIUM risk steps: PAUSE on failure
- HIGH risk steps: PAUSE on failure, notify security
- CRITICAL risk steps: ROLLBACK_ALL on failure

### L.7 Human-in-the-Loop Checkpoints

Certain automation steps require explicit human approval before execution, even within an otherwise automated workflow:

| Checkpoint | Condition | Approver |
|---|---|---|
| Before creating admin account | Target role includes admin privileges | Security reviewer |
| Before cross-account AWS access | Access spans multiple AWS accounts | Cloud team lead |
| Before bulk license removal | Offboarding affects > 5 licenses | IT lead |
| Before tenant-wide policy change | Any conditional access / policy change | IT admin + security |
| Before immediate account disable | Involuntary termination | HR confirmation (may be pre-approved) |
| Before shared credential rotation | Credential used by > 1 system | IT lead |

---

## M. Integration Architecture

### M.1 Integration Overview

```
                    ┌─────────────────────────────────┐
                    │         ITSM Platform            │
                    │                                   │
                    │  ┌─────────────────────────────┐ │
                    │  │   Integration Gateway        │ │
                    │  │   (rate limiting, retry,     │ │
                    │  │    auth, logging)             │ │
                    │  └──────┬──────────────────────┘ │
                    │         │                         │
                    └─────────┼─────────────────────────┘
                              │
          ┌───────────────────┼───────────────────────────┐
          │                   │                             │
    ┌─────▼─────┐     ┌──────▼──────┐     ┌──────────────▼──┐
    │ Microsoft │     │    AWS      │     │    Slack         │
    │ Graph API │     │  IAM/SSO   │     │    API           │
    │           │     │  STS       │     │                  │
    │ - Users   │     │  Orgs      │     │ - Events         │
    │ - Groups  │     │            │     │ - Messages       │
    │ - Licenses│     │            │     │ - Users          │
    │ - Mail    │     │            │     │ - Modals         │
    └───────────┘     └────────────┘     └─────────────────┘
          │                   │                   │
    ┌─────▼─────┐     ┌──────▼──────┐     ┌──────▼────────┐
    │ HRIS      │     │ MDM         │     │ Email          │
    │ (webhook  │     │ (Intune /   │     │ (SMTP /        │
    │  or API)  │     │  Jamf)      │     │  SendGrid)     │
    └───────────┘     └─────────────┘     └───────────────┘
          │                   │
    ┌─────▼─────┐     ┌──────▼──────┐
    │ VPN       │     │ Security    │
    │ (provider │     │ Tools       │
    │  API)     │     │ (S1, etc.)  │
    └───────────┘     └─────────────┘
```

### M.2 Microsoft 365 / Entra ID / Azure Integration

| Aspect | Detail |
|---|---|
| **Auth** | OAuth 2.0 client credentials flow with certificate (preferred) or client secret |
| **Permissions** | Application permissions: `User.ReadWrite.All`, `Group.ReadWrite.All`, `Directory.ReadWrite.All`, `Mail.ReadWrite`, `Organization.Read.All` |
| **Rate Limits** | Microsoft Graph: 10,000 requests per 10 minutes per app. Implement token bucket rate limiter. |
| **API Version** | Use `v1.0` for stable endpoints; `beta` only when v1.0 lacks required capability |
| **Webhook** | Subscribe to `users`, `groups` change notifications for real-time sync |
| **Exchange** | Mailbox operations via Graph API (`/users/{id}/mailboxSettings`, `/users/{id}/messages`) |
| **Licensing** | License management via Graph API (`/users/{id}/assignLicense`) - requires knowledge of SKU IDs |

### M.3 AWS Integration

| Aspect | Detail |
|---|---|
| **Auth** | IAM role assumption with external ID; dedicated ITSM service account with minimum permissions |
| **Multi-account** | AWS Organizations integration; cross-account role assumption per target account |
| **IAM operations** | IAM API for user/group/policy management |
| **SSO** | AWS IAM Identity Center (successor to AWS SSO) for permission set management |
| **CloudTrail** | Link ITSM actions to CloudTrail events for audit correlation |
| **Rate Limits** | IAM API: varies by action. Implement conservative rate limiting. |

### M.4 Slack Integration

| Aspect | Detail |
|---|---|
| **Auth** | Bot token (xoxb-) stored in secrets vault |
| **Scopes** | `channels:history`, `channels:read`, `chat:write`, `commands`, `files:read`, `groups:history`, `groups:read`, `users:read`, `users:read.email`, `admin.users:read`, `admin.users:write` |
| **Events** | Event Subscriptions with request URL verification |
| **Socket Mode** | Alternative to webhook if firewall restrictions apply (uses WebSocket) |

### M.5 HRIS Integration

| Approach | Detail |
|---|---|
| **Webhook** | HRIS sends new hire / termination events to ITSM webhook endpoint |
| **Polling** | If HRIS lacks webhooks: scheduled poll of HRIS API for changes |
| **Data** | Employee name, ID, start date, department, manager, termination date |
| **Auto-ticket** | HRIS new hire event → auto-create onboarding ticket (or at minimum, pre-fill form) |
| **Source of truth** | HRIS is the authoritative source for employment status; ITSM acts on HRIS signals |

### M.6 MDM Integration (Intune / Jamf)

| Action | Method |
|---|---|
| Enroll device | MDM enrollment profile pushed during device prep |
| Push applications | MDM app deployment policies (SentinelOne, etc.) |
| Wipe device | Remote wipe command via MDM API |
| Compliance check | Query device compliance status |
| Inventory sync | Pull device inventory into ITSM asset table |

### M.7 Future Integration Extensibility

The integration gateway supports a standardized connector interface. Adding a new integration requires:

1. Implement the `AutomationConnector` interface
2. Register connector in the integration registry
3. Configure credentials in secrets vault
4. Map connector actions to workflow steps
5. No core platform code changes required

---

## N. Admin and Operations Design

### N.1 Admin Console Capabilities

| Module | Capabilities |
|---|---|
| **Workflow Editor** | Visual workflow designer or YAML editor. Create/edit/version/publish workflow definitions. Test workflows in dry-run mode. View active workflow instances. |
| **Form Builder** | Drag-and-drop form fields. Conditional logic configuration. Preview and test. Version management. Link forms to ticket types. |
| **Category Management** | CRUD for categories and subcategories. Set default queues, priorities, SLA policies per category. Reorder display hierarchy. |
| **Automation Templates** | Library of pre-built automation actions. Template composition (chain actions into sequences). Risk classification. Connector configuration. |
| **SLA Configuration** | Define SLA policies per priority and category. Set business hours calendars. Configure escalation chains. Pause/resume SLA clock rules. |
| **Team & Queue Management** | Create/edit teams, assign members, set leads. Create/edit queues, link to teams. Configure auto-assignment strategies. |
| **User & Role Management** | View all users, search, filter. Manual role assignment (override group-based). Deactivate users. View user's tickets, audit trail. |
| **Integration Management** | Configure integration connections. Test connectivity. View health status. Manage OAuth tokens / API keys. View integration logs. |
| **Notification Templates** | Edit email/Slack notification templates. Configure variables/placeholders. Preview rendered output. |
| **System Health** | Application health dashboard. Background job queue depth. Integration health checks. Error rate monitoring. |
| **Feature Flags** | Enable/disable features per environment. Progressive rollout (% of users). |
| **Secrets Management** | Encrypted storage for API keys, client secrets, certificates. Rotation reminders. Access audit. |

### N.2 Operational Procedures

| Procedure | Detail |
|---|---|
| **Deployment** | Blue-green deployment with health check gate. Database migrations run as pre-deploy step. Rollback via revert to previous version. |
| **Backup** | Automated daily database snapshots. Continuous WAL archiving. Attachment storage replicated. Quarterly restore test. |
| **Monitoring** | Alerting on: error rate > 1%, API latency P95 > 2s, job queue depth > 100, SLA breach, automation failure rate > 5%. |
| **Incident response** | ITSM platform incidents use separate incident management process (not self-referential). Runbook maintained. |
| **Capacity planning** | Monthly review of: user growth, ticket volume, storage usage, API call volume. |

---

## O. Reporting and Dashboards

### O.1 Executive Dashboard

| Widget | Metric |
|---|---|
| Ticket Volume | Total open/new/resolved/closed per day/week/month |
| SLA Performance | % of tickets within SLA (response and resolution) by priority |
| Mean Time to Resolution | Average resolution time by category and priority |
| Top Categories | Bar chart of ticket volume by category |
| Trend | Line chart of ticket volume over time |
| Customer Satisfaction | Average CSAT score, trend |

### O.2 Queue Health Dashboard

| Widget | Metric |
|---|---|
| Queue Depth | Number of open tickets per queue |
| Aging Tickets | Tickets open > 7 days, > 14 days, > 30 days |
| Unassigned Tickets | Tickets in queue with no assignee |
| Agent Workload | Tickets per agent, currently assigned |
| SLA At Risk | Tickets approaching SLA deadline (within 25%) |

### O.3 Onboarding Dashboard

| Widget | Metric |
|---|---|
| Active Onboardings | Count of in-progress onboarding workflows |
| Average Turnaround | Mean time from submission to completion |
| Task Completion Rate | % of onboarding tasks completed on time |
| Upcoming Start Dates | Calendar view of new hires in next 30 days |
| Bottlenecks | Tasks most frequently delayed (approvals, device prep, etc.) |
| Automation Success | % of automated onboarding steps succeeding without manual intervention |

### O.4 Offboarding Dashboard

| Widget | Metric |
|---|---|
| Active Offboardings | Count of in-progress offboarding workflows |
| Average Turnaround | Mean time from submission to completion |
| Involuntary Offboarding Time | Mean time from submission to full access revocation (target: < 1 hour) |
| Outstanding Device Returns | Devices not yet returned, aging |
| Access Revocation Completeness | % of entitlements successfully revoked per offboarding |
| Compliance | Legal holds active, data retention actions pending |

### O.5 Approval Analytics

| Widget | Metric |
|---|---|
| Approval Turnaround | Mean time from request to decision, by approver |
| Approval Rate | % approved vs rejected vs expired |
| Bottleneck Approvers | Approvers with highest pending count or longest response time |
| Escalation Rate | % of approvals that required escalation |

### O.6 Automation Dashboard

| Widget | Metric |
|---|---|
| Automation Runs | Total runs per day/week, by connector |
| Success Rate | % of automation runs completing successfully |
| Failure Analysis | Top failure reasons, by connector and action |
| Retry Rate | % of runs requiring retries |
| Time Saved | Estimated time saved vs manual execution (configurable per action) |

### O.7 Access Request Metrics

| Widget | Metric |
|---|---|
| Request Volume | Access requests per day/week by application |
| Approval Time | Mean time from request to approval |
| Provisioning Time | Mean time from approval to access granted |
| Top Requested Apps | Most frequently requested applications |
| Revocation Compliance | % of temporary access revoked on schedule |

---

## P. Security and Compliance

### P.1 Least Privilege

- All users start with End User role (minimum access)
- Agents only see tickets in their assigned queues
- Automation service accounts have scoped permissions per integration (not global admin)
- API keys are scoped to specific operations
- Database access restricted to application service account (no direct admin access in production)

### P.2 Auditability

- Every action generates an audit log entry (immutable, append-only)
- Audit log stored in separate partition/table with restricted delete permissions
- Log entries include: who, what, when, where (IP), before/after state
- Audit log export for external SIEM/compliance tools
- Admin actions (config changes, role assignments) logged separately with elevated detail

### P.3 Encryption

| Layer | Method |
|---|---|
| Transport | TLS 1.3 for all HTTP traffic |
| Database | AES-256 encryption at rest (managed by cloud provider) |
| Attachments | AES-256 encrypted in object storage |
| Secrets | Encrypted vault (never in environment variables or code) |
| Sensitive form fields | Application-level encryption for PII fields (personal email, phone) |
| Backups | Encrypted at rest |

### P.4 Secrets Handling

- All integration credentials stored in secrets vault (AWS Secrets Manager, Azure Key Vault, or HashiCorp Vault)
- Secrets referenced by name, never by value in config or code
- Automatic rotation reminders for client secrets and API keys
- Secrets accessed via IAM role (no hardcoded credentials)
- Audit trail for secret access

### P.5 Separation of Duties

| Principle | Implementation |
|---|---|
| Requester cannot approve own request | System enforces: approver_id != requester_id |
| Agent cannot close without resolution | Workflow enforces resolution steps before closure |
| Admin cannot bypass approval gates | Approval-gated automations require approval even from admins |
| High-risk changes require multiple approvals | Multi-approver workflows for admin access, tenant changes |
| Config changes logged separately | Admin audit trail independent of ticket audit trail |

### P.6 Privileged Request Handling

Requests involving privileged access (admin roles, root access, cross-tenant) receive:
- Automatic security review requirement
- Elevated SLA (shorter response time)
- Time-limited access with automatic revocation
- Enhanced audit logging (all actions during privileged access)
- Notification to security team

### P.7 Legal Hold Interactions

When a legal hold is placed on a ticket or employee:
- All related data (ticket, comments, attachments, audit logs, automation logs) is marked as held
- Retention policies are suspended (no automatic deletion)
- Deletion endpoints return 403 for held data
- Only designated legal/compliance roles can place or release holds
- Hold actions are logged with reason and authorization

### P.8 Evidence Collection

For compliance-sensitive workflows (access changes, offboarding):
- System generates an evidence package containing:
  - Original request and form data
  - Approval chain with decisions and timestamps
  - Automation execution logs with API request/response
  - Before/after state screenshots (where applicable)
  - Completion confirmation
- Evidence packages exportable as PDF or structured JSON
- Evidence linked to ticket and audit log

---

## Q. API Design

### Q.1 API Conventions

- **Base URL**: `https://itsm.company.com/api/v1`
- **Auth**: Bearer token (OAuth 2.0 access token from Entra ID) or API key for service accounts
- **Format**: JSON request/response
- **Pagination**: Cursor-based (`?cursor=xxx&limit=50`)
- **Errors**: Standard error envelope: `{ "error": { "code": "...", "message": "...", "details": [...] } }`
- **Versioning**: URL-based (`/api/v1/...`)
- **Rate Limiting**: 1000 requests/minute per authenticated user; 100/minute for unauthenticated

### Q.2 Key Endpoints

#### Tickets

```
POST   /api/v1/tickets                    Create a new ticket
GET    /api/v1/tickets                    List tickets (with filters)
GET    /api/v1/tickets/:id                Get ticket detail
PATCH  /api/v1/tickets/:id                Update ticket fields
POST   /api/v1/tickets/:id/comments       Add a comment
GET    /api/v1/tickets/:id/comments       List comments
POST   /api/v1/tickets/:id/attachments    Upload attachment
GET    /api/v1/tickets/:id/history        Get change history
POST   /api/v1/tickets/:id/assign         Assign ticket
POST   /api/v1/tickets/:id/escalate       Escalate ticket
POST   /api/v1/tickets/:id/merge          Merge with another ticket

Query Parameters for GET /tickets:
  ?status=open,in_progress
  ?priority=high,critical
  ?queue_id=<uuid>
  ?assignee_id=<uuid>
  ?requester_id=<uuid>
  ?category_id=<uuid>
  ?source=slack,portal
  ?created_after=2026-01-01T00:00:00Z
  ?created_before=2026-03-31T23:59:59Z
  ?search=keyword
  ?sort=created_at:desc
  ?cursor=xxx
  ?limit=50
```

#### Form Submissions

```
POST   /api/v1/forms/:slug/submit         Submit a form (creates ticket)
GET    /api/v1/forms/:slug                 Get form schema (for rendering)
GET    /api/v1/forms                       List available forms
GET    /api/v1/forms/:slug/submissions     List submissions for a form
```

**Example: Submit onboarding form**

```json
POST /api/v1/forms/employee-onboarding/submit
{
  "data": {
    "first_name": "Alex",
    "last_name": "Johnson",
    "personal_email": "alex.j@gmail.com",
    "personal_phone": "+1-555-0123",
    "job_title": "Software Engineer",
    "department": "rnd",
    "employment_type": "full_time",
    "legal_entity": "Zimark Inc.",
    "office_location": "remote",
    "time_zone": "America/New_York",
    "start_date": "2026-04-15",
    "supervisor": "user:8f3a...",
    "access_profile": "engineering_standard",
    "additional_applications": ["slack", "notion", "aws_vpn"],
    "aws_access_required": true,
    "aws_role": "developer_read_write",
    "kit_type": "apple_macbook_pro",
    "peripherals": ["headphones_mic", "monitor"],
    "device_shipping_required": true,
    "shipping_address": "123 Main St, Apt 4B, New York, NY 10001",
    "shipping_priority": "express"
  }
}

Response:
{
  "ticket": {
    "id": "9c2f...",
    "ticket_number": "IT-20260085",
    "status": "new",
    "type": "employee_onboarding",
    "url": "https://itsm.company.com/tickets/IT-20260085"
  },
  "form_submission_id": "a1b2...",
  "workflow_instance_id": "c3d4..."
}
```

#### Approvals

```
GET    /api/v1/approvals/pending           List my pending approvals
POST   /api/v1/approvals/:id/approve       Approve
POST   /api/v1/approvals/:id/reject        Reject
POST   /api/v1/approvals/:id/request-info  Request more information
POST   /api/v1/approvals/:id/delegate      Delegate to another user

Example: Approve with comment
POST /api/v1/approvals/e5f6.../approve
{
  "comment": "Approved. Standard engineering access is fine."
}
```

#### Slack Event Ingestion

```
POST   /api/v1/slack/events               Slack Events API webhook
POST   /api/v1/slack/interactions          Slack interactive component callbacks
POST   /api/v1/slack/commands              Slack slash command endpoint

Note: These endpoints validate Slack request signatures and process asynchronously.
```

#### User Lookup

```
GET    /api/v1/users/me                    Get current user profile
GET    /api/v1/users/:id                   Get user by ID
GET    /api/v1/users?email=x@company.com   Look up user by email
GET    /api/v1/users?slack_id=U123456      Look up user by Slack ID
GET    /api/v1/users/:id/entitlements      Get user's access entitlements
GET    /api/v1/users/:id/assets            Get user's assigned assets
```

#### Workflow State Transitions

```
GET    /api/v1/workflows/instances/:id         Get workflow instance status
GET    /api/v1/workflows/instances/:id/tasks   Get workflow tasks
POST   /api/v1/workflows/tasks/:id/complete    Mark manual task as complete
POST   /api/v1/workflows/tasks/:id/fail        Mark manual task as failed
POST   /api/v1/workflows/instances/:id/cancel  Cancel workflow
POST   /api/v1/workflows/instances/:id/retry   Retry failed workflow step
```

#### Automation Execution

```
POST   /api/v1/automations/execute         Trigger an automation action manually
GET    /api/v1/automations/runs/:id        Get automation run status
GET    /api/v1/automations/runs/:id/logs   Get step-level execution logs
POST   /api/v1/automations/runs/:id/retry  Retry a failed automation run
POST   /api/v1/automations/dry-run         Execute in dry-run mode (validate only)
```

#### Notifications

```
GET    /api/v1/notifications                List my notifications
PATCH  /api/v1/notifications/:id/read       Mark as read
POST   /api/v1/notifications/read-all       Mark all as read
GET    /api/v1/notifications/preferences    Get notification preferences
PUT    /api/v1/notifications/preferences    Update notification preferences
```

#### Reporting Exports

```
GET    /api/v1/reports/tickets              Ticket report with filters
GET    /api/v1/reports/sla                  SLA compliance report
GET    /api/v1/reports/onboarding           Onboarding metrics
GET    /api/v1/reports/offboarding          Offboarding metrics
GET    /api/v1/reports/automations          Automation success/failure report
GET    /api/v1/reports/approvals            Approval analytics

Query parameters:
  ?from=2026-01-01&to=2026-03-31
  ?group_by=category,priority
  ?format=json|csv
```

---

## R. Recommended Architecture

### R.1 Recommendation: Modular Monolith

**We recommend a modular monolith over microservices.**

Rationale:
- **Scale**: Internal ITSM serving hundreds of users does not require the horizontal scaling complexity of microservices
- **Transactional integrity**: Ticket creation + workflow initiation + audit logging must be atomic. In a monolith, this is a database transaction. In microservices, it requires saga patterns.
- **Operational simplicity**: One deployment unit, one database, one log stream. The team doesn't need service mesh, distributed tracing infrastructure, or container orchestration for a v1.
- **Development velocity**: Refactoring across modules is a code change, not a contract negotiation. Critical for early-stage iteration.
- **Future decomposition**: Clean module boundaries (see below) allow extracting a module to a service later if needed (e.g., if the automation engine needs to scale independently).

### R.2 Module Structure

```
itsm-platform/
├── src/
│   ├── core/                     # Shared kernel
│   │   ├── auth/                 # SSO, session, RBAC
│   │   ├── config/               # App configuration
│   │   ├── database/             # Connection, migrations
│   │   ├── errors/               # Error types
│   │   └── logging/              # Structured logging
│   │
│   ├── modules/
│   │   ├── tickets/              # Ticketing engine
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   ├── models/
│   │   │   └── events/           # Ticket domain events
│   │   │
│   │   ├── forms/                # Form engine
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   ├── models/
│   │   │   └── schemas/          # Built-in form schemas
│   │   │
│   │   ├── workflows/            # Workflow/state machine engine
│   │   │   ├── routes/
│   │   │   ├── engine/           # State machine executor
│   │   │   ├── models/
│   │   │   └── definitions/      # Built-in workflow definitions
│   │   │
│   │   ├── approvals/            # Approval engine
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── models/
│   │   │
│   │   ├── automations/          # Automation engine
│   │   │   ├── routes/
│   │   │   ├── engine/           # Job processor
│   │   │   ├── connectors/       # Integration connectors
│   │   │   │   ├── microsoft-graph/
│   │   │   │   ├── aws-iam/
│   │   │   │   ├── slack/
│   │   │   │   └── generic-webhook/
│   │   │   └── models/
│   │   │
│   │   ├── slack/                # Slack integration module
│   │   │   ├── routes/           # Webhook endpoints
│   │   │   ├── services/         # Event processing
│   │   │   ├── identity/         # Slack-to-user resolution
│   │   │   └── models/
│   │   │
│   │   ├── notifications/        # Notification engine
│   │   │   ├── services/
│   │   │   ├── channels/         # email, slack, in-app
│   │   │   ├── templates/
│   │   │   └── models/
│   │   │
│   │   ├── audit/                # Audit and compliance
│   │   │   ├── services/
│   │   │   ├── models/
│   │   │   └── exporters/
│   │   │
│   │   ├── reporting/            # Reports and dashboards
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── queries/
│   │   │
│   │   ├── assets/               # Asset/device management
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── models/
│   │   │
│   │   ├── knowledge-base/       # KB articles
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── models/
│   │   │
│   │   └── admin/                # Admin console
│   │       ├── routes/
│   │       └── services/
│   │
│   ├── web/                      # Frontend
│   │   ├── portal/               # End-user portal
│   │   ├── agent/                # Agent dashboard
│   │   └── admin/                # Admin console UI
│   │
│   └── infrastructure/
│       ├── event-bus/            # In-process event bus (domain events)
│       ├── job-queue/            # Background job processing
│       ├── cache/                # Redis cache layer
│       ├── storage/              # File storage abstraction
│       └── search/               # Full-text search
│
├── migrations/                   # Database migrations
├── config/                       # Environment configs
├── scripts/                      # Operational scripts
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

### R.3 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │  Portal   │  │  Agent   │  │  Admin   │  │  Slack   │               │
│  │  (React)  │  │Dashboard │  │ Console  │  │  Bot     │               │
│  └─────┬─────┘  └─────┬────┘  └─────┬────┘  └─────┬────┘               │
└────────┼───────────────┼─────────────┼─────────────┼────────────────────┘
         │               │             │             │
         └───────────────┴──────┬──────┴─────────────┘
                                │
                          ┌─────▼─────┐
                          │   Nginx   │  (reverse proxy, TLS, rate limit)
                          └─────┬─────┘
                                │
┌───────────────────────────────┼─────────────────────────────────────────┐
│                          APPLICATION                                     │
│                               │                                          │
│  ┌────────────────────────────▼──────────────────────────────────────┐  │
│  │                      API Layer (Express/Fastify)                   │  │
│  │  Auth middleware → Route handlers → Service layer → Models         │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────┐  ┌──────────────────────┐                    │
│  │   Workflow Engine     │  │  Automation Engine    │                    │
│  │   (state machine)     │  │  (job processor)      │                    │
│  └──────────────────────┘  └──────────────────────┘                    │
│                                                                          │
│  ┌──────────────────────┐  ┌──────────────────────┐                    │
│  │   Event Bus           │  │  Notification Engine  │                    │
│  │   (in-process)        │  │  (email, Slack, app)  │                    │
│  └──────────────────────┘  └──────────────────────┘                    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
         │              │              │
    ┌────▼────┐   ┌─────▼────┐  ┌─────▼────┐
    │PostgreSQL│   │  Redis   │  │  S3 /    │
    │          │   │ (cache,  │  │  Blob    │
    │          │   │  jobs,   │  │ Storage  │
    │          │   │  sessions)│  │          │
    └─────────┘   └──────────┘  └──────────┘
```

---

## S. Suggested Technology Stack

### S.1 Frontend

| Component | Recommendation | Rationale |
|---|---|---|
| **Framework** | **Next.js 15 (App Router)** | Server-side rendering for fast initial load, built-in API routes, React ecosystem, excellent TypeScript support. Enables both the end-user portal and agent dashboard as a single deployable. |
| **UI Library** | **shadcn/ui + Tailwind CSS** | High-quality components, fully customizable (not a dependency, code is owned), accessible by default, great for internal tools. |
| **State Management** | **TanStack Query (React Query)** | Server state management with caching, optimistic updates, and automatic revalidation. No need for Redux for a server-driven app. |
| **Forms** | **React Hook Form + Zod** | Performance-optimized forms with runtime schema validation. Zod schemas can be shared between client and server. |
| **Rich Text** | **Tiptap** | For ticket comments with formatting. Extensible, headless editor. |

### S.2 Backend

| Component | Recommendation | Rationale |
|---|---|---|
| **Runtime** | **Node.js 22 LTS** | Same language as frontend (TypeScript everywhere), excellent async I/O for API-heavy workload, large ecosystem. |
| **Framework** | **Fastify** (or Express if team prefers familiarity) | Fastify: faster than Express, built-in schema validation, better TypeScript support. Express: more ecosystem, more familiar. Either works. |
| **Language** | **TypeScript 5.x** | Type safety across the entire stack. Shared types between frontend and backend. |
| **ORM** | **Drizzle ORM** | Type-safe SQL queries, lightweight, excellent migration support. Avoids the complexity of Prisma's query engine while maintaining type safety. |
| **Validation** | **Zod** | Runtime validation for API inputs, form schemas, and config. Shared with frontend. |

### S.3 Database

| Component | Recommendation | Rationale |
|---|---|---|
| **Primary Database** | **PostgreSQL 16** | Battle-tested relational database. JSONB for flexible form data and custom fields. Excellent full-text search. Partitioning for audit logs. Row-level security possible for multi-tenancy. |
| **Full-Text Search** | **PostgreSQL built-in** (tsvector/tsquery) initially; **Meilisearch or Typesense** if search becomes critical | PostgreSQL FTS is sufficient for thousands of tickets. Dedicated search engine only if needed later. |
| **Migrations** | **Drizzle Kit** | Paired with Drizzle ORM for type-safe, versioned, reversible migrations. |

### S.4 Job Queue

| Component | Recommendation | Rationale |
|---|---|---|
| **Queue** | **BullMQ** (backed by Redis) | Mature, production-tested job queue for Node.js. Supports delayed jobs (for scheduled offboarding), retries with backoff, job priorities, rate limiting, and concurrency control. |
| **Dashboard** | **Bull Board** | Built-in admin UI for job queue monitoring. |

### S.5 Workflow Engine

| Component | Recommendation | Rationale |
|---|---|---|
| **Engine** | **Custom state machine** built on top of the database + BullMQ | A purpose-built state machine is more maintainable than integrating Temporal or Camunda for this scale. Workflow definitions stored as JSON in the database. State transitions are database transactions. Async steps dispatched via BullMQ. |
| **Alternative (if team prefers)** | **Temporal** | If the team wants a battle-tested workflow orchestrator and is willing to run the infrastructure. Better for very complex, long-running workflows with many compensating transactions. |

**Recommendation**: Start with custom state machine. Migrate to Temporal only if workflow complexity exceeds what the custom engine handles cleanly.

### S.6 Auth Layer

| Component | Recommendation | Rationale |
|---|---|---|
| **SSO Library** | **next-auth (Auth.js) v5** with Microsoft Entra ID provider | Well-maintained, supports OIDC out of the box, handles token refresh, session management. Entra ID provider is built in. |
| **Session Store** | **Redis** (via next-auth adapter) | Fast session lookups, automatic expiry. |
| **API Auth** | **jose** (JWT validation) | Lightweight JWT validation for API endpoints. Validates Entra ID-issued tokens. |

### S.7 Audit / Event Storage

| Component | Recommendation | Rationale |
|---|---|---|
| **Storage** | **PostgreSQL** with partitioned `audit_log` table | Same database, partitioned by month for performance. Append-only (no UPDATE/DELETE permissions on this table). |
| **Archival** | **S3/Blob export** | Monthly export of old partitions to cold storage for long-term retention. |

### S.8 File Storage

| Component | Recommendation | Rationale |
|---|---|---|
| **Storage** | **S3** (AWS) or **Azure Blob Storage** | Depending on primary cloud provider. Server-signed upload URLs for direct browser upload. |
| **CDN** | Not needed for internal tool | Files served via pre-signed URLs with expiry. |
| **Scanning** | **ClamAV** (or cloud-native equivalent) | Scan uploaded files for malware. |

### S.9 Observability

| Component | Recommendation | Rationale |
|---|---|---|
| **Logging** | **Pino** (structured JSON logging) | Fastest Node.js logger, structured output, integrates with any log aggregator. |
| **Log Aggregation** | **Datadog** or **Grafana Loki** | Datadog if already in use; Loki if self-hosting with Grafana. |
| **Metrics** | **Prometheus** + **Grafana** | Standard metrics stack. Node.js metrics via `prom-client`. |
| **Tracing** | **OpenTelemetry** | Vendor-neutral tracing. Particularly valuable for tracing workflow execution and automation connector calls. |
| **Alerting** | **PagerDuty** or **Grafana Alerting** | Alert on SLA breaches, automation failures, error rates. |

### S.10 Infrastructure

| Component | Recommendation | Rationale |
|---|---|---|
| **Hosting** | **AWS** (ECS Fargate or EC2) or **Azure** (App Service or AKS) | Depends on company's primary cloud. Containerized deployment. |
| **Container** | **Docker** | Standard containerization. Multi-stage build for small images. |
| **Orchestration** | **ECS Fargate** (AWS) or **Azure Container Apps** | Managed container hosting. No Kubernetes overhead for a single application. |
| **IaC** | **Terraform** or **Pulumi** | Infrastructure as code for reproducible environments. |
| **CI/CD** | **GitHub Actions** | Standard CI/CD. Build, test, deploy pipeline. |
| **Secrets** | **AWS Secrets Manager** or **Azure Key Vault** | Managed secrets with rotation support. |

---

## T. Phased Delivery Plan

### Phase 1: Core Platform (Weeks 1-8)

**Scope:**
- Project scaffolding, CI/CD pipeline, infrastructure provisioning
- Database schema and migrations (core tables: users, tickets, comments, attachments, history, queues, teams)
- Microsoft Entra ID OIDC SSO integration
- User JIT provisioning and role mapping
- Ticket CRUD API and portal UI
- Service catalog landing page
- Ticket list/detail views with filtering
- Agent dashboard with queue views
- Comment system (public + internal notes)
- File attachments
- Basic status lifecycle (New -> In Progress -> Resolved -> Closed)
- Basic SLA tracking (response time, resolution time)
- Audit log for all ticket actions
- Role-based access control

**Dependencies:**
- Entra ID app registration approved
- Cloud infrastructure provisioned
- Development team onboarded

**Risks:**
- SSO configuration delays (Entra ID admin approval)
- Schema changes during development (mitigate: design data model thoroughly upfront)

**Outcomes:**
- Functional ticketing portal replacing ad-hoc processes
- SSO-authenticated access for all employees
- Agents can manage tickets through the web portal
- Foundation for all subsequent phases

### Phase 2: Slack + Forms + Approvals (Weeks 9-16)

**Scope:**
- Slack app creation and deployment
- Slack event listener (channel monitoring, ticket creation from messages)
- Slack thread-to-comment mapping
- Slack identity resolution (Slack user -> corporate identity)
- Slash commands (`/it-help`, `/ticket`)
- Interactive modals for structured request submission
- Acknowledgment and status update messages in Slack
- Form engine (schema-driven, JSON-based)
- Form builder admin UI
- Onboarding form (normalized, per Section H.1)
- Offboarding form (normalized, per Section I.1)
- Access request form
- Approval engine (single/multi-approver, sequential/parallel)
- Approval UI in portal
- Approval via Slack interactive buttons
- Approval timeout and escalation
- Notification engine (email + Slack + in-app)
- Notification preferences

**Dependencies:**
- Phase 1 complete
- Slack workspace admin access
- Slack app approved and installed

**Risks:**
- Slack identity to Microsoft identity mapping gaps (mitigate: graceful fallback to manual linking)
- Approval workflow complexity (mitigate: start with simple single-approver, iterate)

**Outcomes:**
- Employees can submit IT requests via Slack or portal
- Structured forms for onboarding, offboarding, access requests
- Approval workflows with multi-channel notification
- Slack becomes a primary intake channel

### Phase 3: Onboarding/Offboarding Workflows (Weeks 17-24)

**Scope:**
- Workflow engine (state machine, task management, parallel execution)
- Onboarding workflow definition (per Section H.2)
- Offboarding workflow definition (per Section I.2)
- Workflow visualization in portal (progress tracker)
- Task assignment to roles/teams
- Checklist completion tracking
- Child ticket / sub-task creation
- Device provisioning tracking (asset management basics)
- Integration with Microsoft Graph for read operations (user lookup, group listing)
- Scheduled actions (for voluntary offboarding date-based disable)
- Workflow dashboard (active onboardings/offboardings)
- Completion confirmation and evidence generation

**Dependencies:**
- Phase 2 complete
- Workflow definitions finalized with IT and HR stakeholders

**Risks:**
- Workflow definition complexity (mitigate: start with happy path, add exception handling iteratively)
- HR process alignment (mitigate: early stakeholder workshops)

**Outcomes:**
- Structured, tracked onboarding and offboarding processes
- Visibility into every step of employee lifecycle
- Tasks assigned to responsible parties with due dates
- No more missed onboarding/offboarding steps

### Phase 4: Automation with Microsoft + AWS (Weeks 25-36)

**Scope:**
- Automation engine (BullMQ-based job processor)
- Connector framework implementation
- Microsoft Graph connector (create user, assign license, add to group, disable user, revoke sessions, mailbox actions)
- AWS IAM connector (create user, attach policy, add to group, SSO assignments)
- Slack connector (invite user, deactivate user)
- Idempotency and retry logic
- Rollback actions per connector
- Human-in-the-loop approval gates for high-risk automations
- Dry-run mode
- Automation execution logging and dashboard
- License bundle templates (per Section W.9)
- Onboarding automation (end-to-end: account creation through provisioning)
- Offboarding automation (account disable, access revocation, mailbox actions)
- Safe offboarding sequencing (per Section I.3)
- Access request automation (group/role provisioning)
- VPN / MDM integration (if APIs available)

**Dependencies:**
- Phase 3 complete
- Microsoft Graph API permissions granted (application permissions)
- AWS IAM service account created with appropriate permissions
- Integration credentials provisioned in secrets vault

**Risks:**
- Microsoft Graph API rate limiting (mitigate: token bucket rate limiter, request batching)
- AWS cross-account complexity (mitigate: start with single account, expand)
- Automation failures in production (mitigate: dry-run testing, phased rollout, manual fallback always available)
- Partial failure during multi-step automations (mitigate: idempotency, compensating transactions)

**Outcomes:**
- Onboarding: new hire account fully provisioned automatically upon approval
- Offboarding: access revoked reliably and in the correct sequence
- Access requests: common access changes provisioned automatically
- Significant reduction in manual IT work for repetitive tasks

### Phase 5: Reporting, Hardening, Scale (Weeks 37-44)

**Scope:**
- Reporting dashboards (per Section O)
- Scheduled reports via email
- CSV/PDF export
- Knowledge base module
- Admin console polish (workflow editor, form builder, SLA config, integration health)
- Performance optimization (query optimization, caching, connection pooling)
- Security hardening (penetration test remediation, dependency audit, input validation review)
- SCIM endpoint for Entra ID automatic provisioning (optional)
- HRIS webhook integration (if HRIS supports it)
- Comprehensive E2E test suite for critical paths
- Runbook and operational documentation
- Disaster recovery drill
- User training materials

**Dependencies:**
- Phase 4 complete
- Penetration test scheduled

**Risks:**
- Reporting query performance on growing data (mitigate: materialized views, read replicas)
- Security vulnerabilities found in pentest (mitigate: allocate remediation buffer)

**Outcomes:**
- Production-grade platform with monitoring, alerting, and operational maturity
- Leadership visibility into IT operations metrics
- Self-service knowledge base reducing ticket volume
- Platform ready for organization-wide rollout

---

## U. Risks and Design Tradeoffs

### U.1 Major Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Automation reliability** | Medium | High | Idempotency keys, retry with backoff, manual fallback for every automated step, dry-run testing before production, gradual rollout |
| **Approvals complexity** | High | Medium | Start simple (single approver), iterate. Avoid building complex approval matrix until real needs emerge. Default to manager + one additional approver. |
| **Identity mismatch (Slack/Microsoft)** | Medium | Medium | Multi-step resolution chain (Section J.7). Graceful degradation: tickets created with Slack identity only if no match found. Admin UI for manual linking. |
| **Partial failure in onboarding** | Medium | High | Each step is independently retryable. Workflow pauses on failure, alerts agent. Dashboard shows exactly which steps completed and which failed. |
| **Partial failure in offboarding** | Medium | Critical | Offboarding follows strict sequence (Section I.3). Phase 1 (disable access) executes first and must succeed before anything else. If Phase 1 succeeds but later phases fail, the security risk is mitigated. |
| **Over-automation** | Medium | High | Human-in-the-loop gates for all HIGH/CRITICAL risk actions. No automation executes tenant-wide changes without CAB approval. Dry-run mode for testing. |
| **Audit/compliance edge cases** | Low | High | Legal hold flag prevents any deletion. Audit log is append-only with no application-level delete. Monthly archive to cold storage. |
| **Integration API throttling** | Medium | Medium | Token bucket rate limiters per integration. Request queuing with backpressure. Batch operations where APIs support it (Microsoft Graph $batch). |
| **Slack message volume** | Low | Low | Deduplication (Section J.6). Rate limiting on ticket creation (max 10 tickets/minute per user). Bot ignores its own messages and other bots. |
| **Schema evolution** | Medium | Medium | JSONB for custom fields and form data provides schema flexibility. Form versioning prevents breaking changes. Database migrations are versioned and reversible. |

### U.2 Design Tradeoffs

| Decision | Tradeoff | Rationale |
|---|---|---|
| **Modular monolith** over microservices | Less independent scalability; easier to accidentally couple modules | Team size and user scale don't justify microservice operational overhead. Clean module interfaces allow future extraction. |
| **Custom workflow engine** over Temporal/Camunda | More development effort; less battle-tested | Simpler to operate, no external dependency, sufficient for ITSM workflow complexity. Can migrate to Temporal later if needed. |
| **PostgreSQL for everything** (including search, audit, jobs) | Won't outperform specialized systems at extreme scale | Simpler operations. One database to back up, monitor, and manage. PostgreSQL FTS, partitioning, and JSONB are sufficient for this scale. |
| **BullMQ** over SQS/RabbitMQ | Tied to Redis; less durable than SQS | Already using Redis for sessions/cache. BullMQ provides job visibility, delayed jobs, and rate limiting out of the box. For critical jobs, combine with database persistence. |
| **OIDC** over SAML | SAML has broader legacy compatibility | OIDC is the modern standard, simpler to implement, better developer experience. All target identity providers support OIDC. |
| **JSON form schemas** over dedicated form builder framework | Requires building form renderer | Full control over form behavior, conditional logic, and validation. No vendor lock-in. Schemas are versionable and portable. |
| **Append-only audit log** over event sourcing | Cannot replay state from audit log alone | Event sourcing adds significant complexity. Audit log captures all changes but ticket state is maintained in the tickets table (simpler queries, easier to understand). |

---

## V. Sample User Journeys

### V.1 New Employee Onboarding

**Scenario**: HR submits an onboarding request for Alex Johnson, a new Software Engineer starting April 15.

```
Day -10 (April 5):
1. HR manager Sarah opens the ITSM portal → Service Catalog → "Employee Onboarding"
2. Sarah fills out the onboarding form:
   - Name: Alex Johnson
   - Personal email: alex.j@gmail.com
   - Start date: April 15
   - Department: R&D
   - Supervisor: Maria Chen
   - Access Profile: Engineering Standard
   - Kit: Apple MacBook Pro
   - Peripherals: Headphones, Monitor
   - Shipping: Yes, to Alex's home address
   - AWS access: Yes (developer_read_write)
3. Sarah submits. Ticket IT-20260085 created. Status: New.

Day -10 (automated, within minutes):
4. Workflow starts. Approval requests sent:
   - Maria Chen (manager): Slack DM with approval button
   - Sarah (HR): auto-approved (she submitted)
   - Finance: auto-approved (kit cost within budget threshold)

Day -9:
5. Maria clicks "Approve" in Slack. All approvals complete.
6. Workflow advances to IT Task Breakdown.

Day -9 (automated, within 1 hour):
7. Entra ID account created: alex.johnson@company.com
8. Added to groups: "All Employees", "R&D", "Engineering-Standard"
9. M365 E5 license assigned
10. Slack invitation sent to alex.j@gmail.com
11. Notion access granted
12. AWS IAM: approval gate triggered (IAM access = HIGH risk)
    - Cloud team lead receives approval request
    - Approved within 2 hours
    - AWS developer_read_write role assigned

Day -7:
13. IT technician receives task: "Prepare MacBook Pro for Alex Johnson"
14. Technician images device, installs: SentinelOne, VS Code, Git, AWS VPN Client
15. Technician marks device preparation task as complete
16. Shipping label generated, device shipped (Express)

Day -5:
17. Tracking shows device delivered. Notification sent to Alex's personal email.

Day -1:
18. Welcome email sent to alex.j@gmail.com with:
    - Day 1 instructions
    - Temporary password (via separate secure channel)
    - IT onboarding session calendar invite
    - Links to key tools

Day 0 (April 15):
19. Alex logs in, changes password, sets up MFA
20. Workflow verification: system confirms account active, licenses assigned, groups correct
21. Ticket IT-20260085 → Resolved
22. Manager Maria notified: "Alex's onboarding is complete"
23. After 7 days, satisfaction survey sent to Maria
24. Ticket auto-closes after 5 days with no issues reported
```

### V.2 Urgent Involuntary Offboarding

**Scenario**: HR needs to immediately terminate John Smith due to a policy violation. It's 2:30 PM on a Tuesday.

```
2:30 PM:
1. HR director opens ITSM portal → "Employee Offboarding"
2. Fills out offboarding form:
   - Employee: John Smith (john.smith@company.com)
   - Termination type: Involuntary
   - Last working day: Today
   - Immediate disable: YES (auto-set for involuntary)
   - Mailbox action: Convert to shared mailbox
   - OneDrive: Transfer to manager
   - Legal hold: Yes (pending investigation)
   - High-risk departure: Yes
   - Privileged accounts: Yes (AWS admin)
   - Device return: Yes (shipping label)
3. HR submits. Ticket IT-20260131 created. Priority: CRITICAL.

2:31 PM (automated, immediate):
4. Workflow starts. HR approval: auto-granted (submitter = HR).
5. IMMEDIATE PHASE executes (parallel, within 2 minutes):
   a. Entra ID sign-in DISABLED ✓
   b. All refresh tokens REVOKED ✓
   c. All active sessions REVOKED ✓
   d. Slack account DEACTIVATED ✓
   e. VPN access REVOKED ✓
   f. AWS console access DISABLED ✓
   g. AWS access keys DEACTIVATED ✓
6. Notification to security team: "Involuntary offboarding - John Smith - access revoked"
7. Slack acknowledgment posted to #it-alerts: "Emergency offboarding IT-20260131 - Phase 1 complete"

2:35 PM (security review gate):
8. Security reviewer receives task: "Review privileged account actions for John Smith"
   - System lists all known admin access: AWS admin, Entra Global Reader
   - Security reviewer confirms shared credentials to rotate
   - Security reviewer approves Phase 2

2:40 PM (automated):
9. Remove from all Entra ID groups ✓
10. Remove all role assignments ✓
11. Convert mailbox to shared (accessible by manager) ✓
12. Transfer OneDrive to manager ✓
13. Remove from all distribution lists ✓
14. Legal hold flag set on all data ✓

3:00 PM:
15. Manual task: "Rotate shared credentials known to John Smith"
    - IT agent rotates 3 shared credentials
    - Agent marks task complete

3:15 PM:
16. Automated: Generate evidence package
    - Access revocation log with timestamps
    - Approval chain
    - All automation execution logs
    - Before/after state of account
17. Evidence package attached to ticket

3:30 PM:
18. Shipping label for device return sent to John's personal email
19. HR manager notified: "IT offboarding complete. Device return pending."
20. Ticket status → Resolved (pending device return)

Day +14:
21. Device not yet returned. Automated reminder sent.

Day +30:
22. Device still not returned. Escalation to HR and legal.

Day +45:
23. Device returned. Wiped. Returned to inventory.
24. Final verification: all entitlements marked revoked.
25. Ticket → Closed.
```

### V.3 AWS Access Request

**Scenario**: Developer Priya needs read-write access to the staging AWS account for a new project.

```
1. Priya opens ITSM portal → "AWS Account Access Request"
2. Fills form:
   - AWS Account: staging-123456
   - Access type: Developer (read-write)
   - Duration: 90 days (project-based)
   - Justification: "Working on Project Phoenix, need access to staging S3 and Lambda"
3. Submits. Ticket IT-20260200 created.

4. Approval flow:
   a. Manager (auto-detected from Priya's record): approves via email link
   b. Cloud team lead (auto-assigned for staging account): approves via portal
   c. (No security review needed: read-write, not admin)

5. Upon approval, automation executes:
   a. AWS IAM: create SSO permission set assignment for staging-123456
   b. Permission set: "DeveloperReadWrite" (pre-defined template)
   c. Expiry: 90 days from now

6. Priya receives notification: "AWS access granted. Expires June 29, 2026."
7. Access entitlement recorded: user=Priya, type=aws_sso, value=staging-DeveloperReadWrite
8. Ticket → Resolved → Closed

Day +83:
9. Automated reminder: "Your AWS staging access expires in 7 days. Renew?"
10. Priya clicks "Renew" → new ticket created with pre-filled data → approval flow repeats

Day +90:
11. If not renewed: automated revocation. Access removed. Priya notified.
```

### V.4 Firewall Change Request from Slack

**Scenario**: DevOps engineer Marcus posts in #it-help asking for a firewall rule change.

```
Marcus in #it-help:
"Hey team, can we open port 443 from the staging VPC (10.0.2.0/24) to
the production API gateway (10.0.1.50)? We need this for the new
service mesh rollout. Needed by EOW."

1. ITSM bot detects message in monitored channel
2. Bot resolves Marcus → marcus.williams@company.com → internal user record
3. Bot creates ticket:
   - Ticket: IT-20260215
   - Title: "Open port 443 from staging VPC to production API gateway"
   - Description: [full Slack message text]
   - Category: Network & Security → Firewall Rule Change
   - Priority: Medium
   - Source: Slack
   - Queue: Network

4. Bot replies in Slack thread:
   "✓ Ticket IT-20260215 created for your firewall change request.
    Assigned to: Network queue
    Priority: Medium | SLA: Response within 4 hours
    Track at: https://itsm.company.com/tickets/IT-20260215"

5. Network agent sees ticket in queue, opens it.
   Agent adds internal note: "Standard request, staging→prod 443. Looks fine."
   Agent converts to structured firewall request (fills in the missing details):
   - Source: 10.0.2.0/24
   - Destination: 10.0.1.50
   - Port: 443/TCP
   - Direction: Outbound (from staging perspective)
   - Duration: Permanent

6. Approval flow triggered:
   a. Network team lead: approves
   b. Security reviewer: approves (standard port, specific source/dest, not overly broad)

7. Agent applies firewall rule, tests connectivity.
8. Agent posts public comment: "Firewall rule applied and tested. Port 443 is open."

9. Bot posts to Slack thread:
   "Ticket IT-20260215 updated → Resolved
    Firewall rule has been applied and tested. ✓"

10. Marcus replies in Slack thread: "Awesome, thanks!"
    → Bot adds this as a comment on the ticket (no new ticket created)

11. Ticket auto-closes after 5 days.
```

### V.5 Hardware Replacement Request

**Scenario**: Marketing coordinator Lisa's laptop screen is flickering and she needs a replacement.

```
1. Lisa types /it-help in Slack
2. Modal opens:
   - Request Type: Hardware
   - Summary: "Laptop screen flickering, need replacement"
   - Details: "My Dell Latitude screen started flickering yesterday.
     Getting worse. Hard to work."
   - Priority: High

3. Ticket IT-20260230 created. Bot confirms in ephemeral message.

4. IT agent triages:
   - Checks asset record: Lisa's Dell Latitude, 2 years old, out of warranty
   - Adds internal note: "OOW Dell, screen defect. Recommend replacement."
   - Changes status to In Progress

5. Agent posts public comment: "Hi Lisa, we'll get you a replacement.
   Can you confirm your shipping address and whether you need it urgently?"

6. Lisa replies in Slack thread: "123 Oak St, Portland OR. Yes, ASAP please!"
   → Added as comment on ticket

7. Agent creates sub-tasks:
   a. Prepare replacement Dell Latitude from inventory
   b. Ship to Lisa's address (Express)
   c. Schedule data migration / device swap

8. Manager approval: not required (replacement under $2000 threshold)

9. Device prepared, shipped. Tracking number added to ticket.

10. Lisa receives device. IT schedules remote session for data migration.

11. Lisa ships old device back using prepaid label.

12. Old device received, wiped, marked as "retired" in asset inventory.

13. Asset records updated:
    - Old device: unassigned, status=retired
    - New device: assigned to Lisa, status=assigned

14. Ticket → Resolved → Closed
```

---

## W. Additional Guidance

### W.1 Service Catalog Structure

The service catalog (Section F.1) is organized into 8 top-level categories with 30+ specific request types. Each request type maps to:

- A **ticket type** (defines default queue, priority, SLA)
- An optional **form** (structured data capture)
- An optional **workflow** (approval and fulfillment steps)

New request types are added by:
1. Creating a form schema (JSON)
2. Creating a workflow definition (JSON/YAML)
3. Creating a ticket type record linking the form and workflow
4. Adding to the appropriate category

No code changes required.

### W.2 Approval Model

```
Approval Matrix:

Request Type              | Approver 1        | Approver 2          | Approver 3
--------------------------|-------------------|---------------------|-------------------
Onboarding                | Manager           | HR Contact          | Finance (if >$X)
Offboarding               | HR (auto)         | Manager             | Security (if privileged)
Access - Standard         | Manager           | App Owner           | -
Access - Admin/Privileged | Manager           | App Owner           | Security
Azure - Low Risk          | Manager           | -                   | -
Azure - High Risk         | Manager           | IT Lead             | Security
AWS - Read                | Manager           | -                   | -
AWS - Write/Admin         | Manager           | Cloud Lead          | Security
Firewall                  | Network Lead      | Security            | -
Hardware - Under $2000    | (none)            | -                   | -
Hardware - Over $2000     | Manager           | Finance             | -
Software                  | Manager           | (IT Lead if >$500)  | -
```

Approval resolution rules:
- "Manager" = requester's manager from employee record
- "HR Contact" = department HR partner from team config
- "Security" = any member of the Security Reviewer role
- "App Owner" = owner_team lead from application record
- "Finance" = member of Finance approver group

### W.3 Status Lifecycle (Summary)

```
NEW → TRIAGED → IN PROGRESS → PENDING* → RESOLVED → CLOSED
                                  ↑          │
                                  └──────────┘ (reopen)

Terminal: CANCELLED (from any state)

Pending substates: Pending Approval, Pending Info, Pending Vendor, Pending Change
```

### W.4 Form Schema Approach

Forms are defined as JSON schemas stored in the `form_definitions` table:

```json
{
  "version": 1,
  "sections": [
    {
      "id": "employee_info",
      "title": "Employee Information",
      "fields": [
        {
          "id": "first_name",
          "type": "text",
          "label": "First Name",
          "required": true,
          "placeholder": "Enter first name",
          "validation": {
            "min_length": 1,
            "max_length": 100
          }
        },
        {
          "id": "department",
          "type": "select",
          "label": "Department",
          "required": true,
          "options": [
            { "value": "rnd", "label": "R&D" },
            { "value": "marketing", "label": "Marketing" },
            { "value": "hr", "label": "HR" }
          ]
        },
        {
          "id": "aws_role",
          "type": "select",
          "label": "AWS Role",
          "required": true,
          "options": [...],
          "conditions": [
            {
              "field": "aws_access_required",
              "operator": "equals",
              "value": true
            }
          ]
        }
      ]
    }
  ]
}
```

The frontend renders forms dynamically from this schema. The backend validates submissions against the schema. Form versioning ensures published forms are immutable - edits create a new version.

### W.5 Automation Classification

| Classification | Definition | Approval Required | Human Intervention |
|---|---|---|---|
| **Fully Automated** | System executes without any human action after initial trigger | No (pre-approved via workflow approval) | None |
| **Approval-Gated Automation** | System pauses, requests explicit approval, then executes automatically | Yes, per execution | Approval only |
| **Semi-Automated** | System prepares action (generates instructions, pre-fills data), human executes | Depends on request type | Human executes final step |
| **Manual** | System creates task, human performs all work | Depends on request type | All |

### W.6 Preventing Duplicate Tickets from Slack

1. **Idempotency on message_ts**: The Slack `channel_id + message_ts` combination is globally unique. Before creating a ticket, check `slack_message_links` table. If exists, skip.

2. **Thread awareness**: Any message in a thread where the parent already has a linked ticket is treated as a comment, not a new ticket.

3. **Time-window deduplication**: Multiple messages from the same user within 30 seconds are collapsed into one ticket (use the longest message as the description).

4. **Edited message handling**: Slack sends `message_changed` events for edits. If a ticket exists for the original message_ts, update the ticket description instead of creating a new ticket.

5. **Bot and app message filtering**: Ignore messages with `subtype` of `bot_message`, `channel_join`, `channel_leave`, `file_comment`, etc.

6. **Emoji opt-out**: If anyone reacts with a configured emoji (e.g., `:no_ticket:`) before the bot processes the message, skip ticket creation.

7. **Ambiguity handling**: For short or ambiguous messages, bot asks "Would you like me to create a ticket for this?" with interactive buttons, rather than auto-creating.

### W.7 Correlating Slack Users to Microsoft Identities

See Section J.7 for the full resolution chain. Summary:

| Method | Reliability | Coverage |
|---|---|---|
| Cached mapping (slack_user_id in users table) | 100% | Grows over time |
| Email match (Slack profile email = Entra UPN) | 95%+ | Requires Slack email = work email |
| Display name fuzzy match | ~70% | Fallback only |
| Self-service linking (user logs into portal) | 100% | Requires user action |
| Admin manual linking | 100% | Last resort |

**Recommendation**: Bulk-seed the mapping by calling `users.list` Slack API and matching emails against Entra directory on initial setup. This covers 90%+ of users immediately.

### W.8 Safe Offboarding Sequencing

See Section I.3 for the full recommended sequence. Key principles:

1. **Disable authentication first** (Entra sign-in, session revocation) - this is the most critical step and must succeed before anything else
2. **Cascade from identity provider outward** - disabling Entra ID cascades to SSO-connected apps; then explicitly revoke non-SSO apps
3. **Do not remove licenses before setting mailbox actions** - removing M365 license before converting mailbox will lose data
4. **Schedule, don't rush, for voluntary departures** - premature access revocation disrupts knowledge transfer
5. **Rotate shared credentials early for involuntary** - assume compromised
6. **Device wipe only after data transfer confirmed** - prevent accidental data loss

### W.9 License Bundle Templates by Role

| Role Template | M365 License | Slack | Notion | AWS | SentinelOne | VPN | Additional |
|---|---|---|---|---|---|---|---|
| **Engineering Standard** | E5 | Yes | Yes | Developer (read-write) | Yes | Yes | VS Code, Git, Putty, AWS VPN Client |
| **Marketing Standard** | E3 | Yes | Yes | No | Yes | No | - |
| **HR Standard** | E3 | Yes | Yes | No | Yes | No | HRIS access |
| **BizDev Standard** | E3 | Yes | Yes | No | Yes | No | CRM access |
| **Finance Standard** | E3 | Yes | Yes | Read-only (billing) | Yes | No | Financial tools |
| **Executive** | E5 | Yes | Yes | Read-only | Yes | Yes | All standard tools |
| **Contractor Limited** | E1 | Yes (guest) | Read-only | As needed | Yes | As needed | Minimal |
| **Intern** | E1 | Yes | Yes | No | Yes | No | Department-specific |

These templates are configurable in the admin console. Selecting a template pre-fills the access profile fields in the onboarding form but can be overridden.

### W.10 Reusable Onboarding/Offboarding Playbooks

**Onboarding Playbooks** (workflow templates):

| Playbook | Description | Steps |
|---|---|---|
| `standard-onboarding` | Default for most employees | Identity → License → Apps → Device → Welcome |
| `contractor-onboarding` | Limited access, no hardware | Identity → Limited License → Approved Apps Only → Welcome |
| `executive-onboarding` | VIP treatment, expedited | Same as standard but Priority=Critical, Express shipping, all apps |
| `intern-onboarding` | Temporary, limited access | Identity → E1 License → Basic Apps → Shared Device |
| `transfer-onboarding` | Department transfer, existing employee | Update groups → Update license if needed → Update app access |

**Offboarding Playbooks** (workflow templates):

| Playbook | Description | Steps |
|---|---|---|
| `standard-offboarding` | Voluntary resignation, planned | Scheduled disable → Access revocation → Data transfer → Device return |
| `immediate-offboarding` | Involuntary, same-day | Immediate disable → Security review → Access revocation → Data preservation → Device recovery |
| `contractor-end` | Contract completion | Disable on end date → Revoke limited access → No device return (if BYOD) |
| `leave-of-absence` | Temporary, account preserved | Disable sign-in → Preserve data → Set calendar OOO → Schedule re-enable |

---

## Final Recommendations

### Recommended Final Architecture

**Modular monolith** deployed as a containerized Node.js/Next.js application with:
- PostgreSQL for all persistent data
- Redis for sessions, cache, and job queue (BullMQ)
- S3/Blob storage for attachments
- Custom state machine workflow engine
- Connector-based automation framework
- Microsoft Entra ID OIDC for SSO
- Slack Events API + interactive components for Slack integration
- OpenTelemetry for observability

### Recommended MVP Scope

**MVP = Phase 1 + Phase 2 (first 16 weeks)**

MVP delivers:
- Working ticketing portal with SSO
- Slack-based ticket creation
- Structured forms for onboarding, offboarding, and access requests
- Basic approval workflows
- Agent dashboard with queues
- Audit logging

MVP does NOT include:
- Automated provisioning/deprovisioning (manual fulfillment)
- Advanced workflow engine (simple status transitions only)
- Reporting dashboards (basic ticket list views only)
- Knowledge base
- SCIM / HRIS integration

This MVP is usable from day one and provides immediate value over ad-hoc processes, while the automation phases build on top.

### Recommended Implementation Roadmap

```
Weeks 1-4:   Infrastructure, auth, database, basic ticket CRUD
Weeks 5-8:   Portal UI, agent dashboard, SLA, audit logging
Weeks 9-12:  Slack integration, form engine, onboarding/offboarding forms
Weeks 13-16: Approval engine, notification engine, Slack approvals
Weeks 17-20: Workflow engine, onboarding/offboarding workflow definitions
Weeks 21-24: Workflow UI, task management, checklist tracking
Weeks 25-30: Microsoft Graph connector, Entra automation
Weeks 31-36: AWS connector, Slack provisioning, full onboarding automation
Weeks 37-40: Reporting dashboards, knowledge base
Weeks 41-44: Security hardening, performance optimization, DR testing
```

### Open Questions / Assumptions

| # | Question / Assumption | Impact | Resolution needed by |
|---|---|---|---|
| 1 | **Which cloud provider is primary?** AWS assumed, but Azure integration is also needed. Hosting decision affects infra choices. | Architecture, hosting | Phase 1 start |
| 2 | **HRIS system in use?** Determines whether auto-onboarding from HRIS is feasible and which API/webhook to integrate. | Phase 5 scope | Phase 4 |
| 3 | **MDM tool in use?** Intune vs Jamf vs other affects device provisioning automation. | Phase 4 connector | Phase 3 |
| 4 | **VPN provider and API availability?** Determines whether VPN provisioning can be automated. | Automation scope | Phase 4 |
| 5 | **Number of AWS accounts?** Single account vs multi-account (Organizations) changes AWS IAM automation complexity. | AWS connector design | Phase 4 |
| 6 | **Microsoft license SKUs in use?** Need exact SKU IDs (E1, E3, E5, etc.) for automation. | License automation | Phase 4 |
| 7 | **Existing shared credentials inventory?** Needed for offboarding shared credential rotation. | Offboarding completeness | Phase 3 |
| 8 | **Legal/compliance team requirements?** Specific retention durations, legal hold procedures, audit export formats. | Compliance design | Phase 1 |
| 9 | **Expected ticket volume at launch?** Affects database sizing, SLA configuration, team capacity planning. | Infrastructure sizing | Phase 1 |
| 10 | **Team size for IT agents?** Affects queue design, assignment strategy, escalation chains. | Queue configuration | Phase 1 |
| 11 | **Existing SSO/Entra ID configuration?** Conditional access policies, group naming conventions, existing app registrations. | SSO implementation | Phase 1 |
| 12 | **Budget for SaaS components?** If any (e.g., SendGrid for email, Datadog for monitoring) vs self-hosted. | Tech stack finalization | Phase 1 |
| 13 | **Email as intake channel?** Blueprint focuses on portal + Slack. Email-to-ticket is mentioned as future. Confirm if needed in MVP. | Phase 2 scope | Phase 2 |
| 14 | **Multi-tenant / multi-entity?** Blueprint assumes single tenant. If multiple legal entities need isolated views, impacts RBAC and data model. | Data model | Phase 1 |
| 15 | **Approval delegation policies?** Can any approver delegate to anyone, or are there restrictions (e.g., must delegate to same-level manager)? | Approval engine | Phase 2 |

---

*End of Solution Blueprint*
