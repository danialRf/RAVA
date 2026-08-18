import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, moment, primaryId, updatedAt } from "./columns";
import { products } from "./catalog";
import {
  contentStatusEnum,
  outboxStatusEnum,
  publicationChannelEnum,
  publicationStatusEnum,
  scraperRunStatusEnum,
} from "./enums";
import { users } from "./identity";
import { retailers } from "./sourcing";

/** Editorial/homepage/FAQ content, versioned per locale. */
export const contentEntries = pgTable(
  "content_entries",
  {
    id: primaryId(),
    key: text("key").notNull(),
    locale: text("locale").notNull().default("fa-IR"),
    version: integer("version").notNull().default(1),
    status: contentStatusEnum("status").notNull().default("DRAFT"),
    title: text("title"),
    body: jsonb("body").$type<Record<string, unknown>>().notNull().default({}),
    publishedAt: moment("published_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("content_entries_key_locale_version_unique").on(
      table.key,
      table.locale,
      table.version,
    ),
    index("content_entries_status_idx").on(table.status, table.locale),
    check("content_entries_version_positive", sql`${table.version} > 0`),
    check(
      "content_entries_published_has_timestamp",
      sql`${table.status} <> 'PUBLISHED' or ${table.publishedAt} is not null`,
    ),
  ],
);

/** Deterministically rendered marketing card or campaign asset. */
export const marketingAssets = pgTable(
  "marketing_assets",
  {
    id: primaryId(),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "cascade",
    }),
    kind: text("kind").notNull(),
    storageKey: text("storage_key").notNull(),
    /** Inputs that produced this asset, so it can be regenerated identically. */
    renderInputs: jsonb("render_inputs")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    rendererVersion: text("renderer_version").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("marketing_assets_product_idx").on(table.productId, table.kind),
    uniqueIndex("marketing_assets_storage_key_unique").on(table.storageKey),
  ],
);

export const publicationJobs = pgTable(
  "publication_jobs",
  {
    id: primaryId(),
    channel: publicationChannelEnum("channel").notNull(),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "cascade",
    }),
    contentEntryId: uuid("content_entry_id").references(
      () => contentEntries.id,
      { onDelete: "cascade" },
    ),
    status: publicationStatusEnum("status").notNull().default("QUEUED"),
    scheduledFor: moment("scheduled_for"),
    externalMessageId: text("external_message_id"),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    failureReason: text("failure_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("publication_jobs_status_idx").on(table.status, table.scheduledFor),
    uniqueIndex("publication_jobs_external_message_unique")
      .on(table.channel, table.externalMessageId)
      .where(sql`${table.externalMessageId} is not null`),
    check(
      "publication_jobs_target_present",
      sql`${table.productId} is not null or ${table.contentEntryId} is not null`,
    ),
  ],
);

export const scraperRuns = pgTable(
  "scraper_runs",
  {
    id: primaryId(),
    retailerId: uuid("retailer_id")
      .notNull()
      .references(() => retailers.id, { onDelete: "cascade" }),
    startedAt: moment("started_at").notNull().defaultNow(),
    finishedAt: moment("finished_at"),
    status: scraperRunStatusEnum("status").notNull().default("RUNNING"),
    discoveredCount: integer("discovered_count").notNull().default(0),
    updatedCount: integer("updated_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    errorSummary: text("error_summary"),
    extractorVersion: text("extractor_version"),
  },
  (table) => [
    index("scraper_runs_retailer_time_idx").on(
      table.retailerId,
      table.startedAt,
    ),
    check(
      "scraper_runs_counts_non_negative",
      sql`${table.discoveredCount} >= 0 and ${table.updatedCount} >= 0 and ${table.errorCount} >= 0`,
    ),
    check(
      "scraper_runs_finish_after_start",
      sql`${table.finishedAt} is null or ${table.finishedAt} >= ${table.startedAt}`,
    ),
  ],
);

/** Business-visible background job record. */
export const jobsAudit = pgTable(
  "jobs_audit",
  {
    id: primaryId(),
    queue: text("queue").notNull(),
    jobName: text("job_name").notNull(),
    externalJobId: text("external_job_id"),
    status: text("status").notNull(),
    attempts: integer("attempts").notNull().default(0),
    context: jsonb("context")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    startedAt: moment("started_at"),
    finishedAt: moment("finished_at"),
    createdAt: createdAt(),
  },
  (table) => [
    index("jobs_audit_queue_time_idx").on(table.queue, table.createdAt),
  ],
);

/**
 * Admin audit trail.
 *
 * `before`/`after` hold redacted JSON only: secrets, OTPs and payment
 * credentials must never reach this table.
 */
export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: primaryId(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    before: jsonb("before").$type<Record<string, unknown>>(),
    after: jsonb("after").$type<Record<string, unknown>>(),
    ipAddress: text("ip_address"),
    requestId: text("request_id"),
    createdAt: createdAt(),
  },
  (table) => [
    index("admin_audit_log_entity_idx").on(table.entityType, table.entityId),
    index("admin_audit_log_actor_time_idx").on(
      table.actorUserId,
      table.createdAt,
    ),
  ],
);

/**
 * Transactional outbox.
 *
 * Domain events are written in the same transaction as the state change and
 * relayed afterwards, so a delivery failure can never lose the event.
 */
export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: primaryId(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    status: outboxStatusEnum("status").notNull().default("PENDING"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: moment("available_at").notNull().defaultNow(),
    lastError: text("last_error"),
    createdAt: createdAt(),
    processedAt: moment("processed_at"),
  },
  (table) => [
    index("outbox_events_pending_idx")
      .on(table.availableAt)
      .where(sql`${table.status} = 'PENDING'`),
    index("outbox_events_aggregate_idx").on(
      table.aggregateType,
      table.aggregateId,
    ),
    check("outbox_events_attempts_non_negative", sql`${table.attempts} >= 0`),
  ],
);
