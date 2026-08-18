import { sql } from "drizzle-orm";
import {
  boolean,
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
import { userRoleEnum, userStatusEnum } from "./enums";

/**
 * A customer or staff account.
 *
 * Either an email or an Iranian phone number identifies the account; both are
 * nullable because sign-up can start from OAuth (email) or OTP (phone).
 * Soft deletion keeps order history intact.
 */
export const users = pgTable(
  "users",
  {
    id: primaryId(),
    email: text("email"),
    emailVerifiedAt: moment("email_verified_at"),
    phoneE164: text("phone_e164"),
    phoneVerifiedAt: moment("phone_verified_at"),
    passwordHash: text("password_hash"),
    displayName: text("display_name"),
    role: userRoleEnum("role").notNull().default("CUSTOMER"),
    status: userStatusEnum("status").notNull().default("ACTIVE"),
    preferredLocale: text("preferred_locale").notNull().default("fa-IR"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: moment("deleted_at"),
  },
  (table) => [
    uniqueIndex("users_email_unique")
      .on(sql`lower(${table.email})`)
      .where(sql`${table.email} is not null`),
    uniqueIndex("users_phone_unique")
      .on(table.phoneE164)
      .where(sql`${table.phoneE164} is not null`),
    index("users_role_idx").on(table.role),
    check(
      "users_identifier_present",
      sql`${table.email} is not null or ${table.phoneE164} is not null`,
    ),
    check(
      "users_phone_e164_format",
      sql`${table.phoneE164} is null or ${table.phoneE164} ~ '^\\+[1-9][0-9]{7,14}$'`,
    ),
  ],
);

/** OAuth/provider links, shaped to fit common auth libraries. */
export const authAccounts = pgTable(
  "auth_accounts",
  {
    id: primaryId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    accessTokenExpiresAt: moment("access_token_expires_at"),
    scope: text("scope"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("auth_accounts_provider_unique").on(
      table.provider,
      table.providerAccountId,
    ),
    index("auth_accounts_user_idx").on(table.userId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: primaryId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionTokenHash: text("session_token_hash").notNull(),
    expiresAt: moment("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("sessions_token_unique").on(table.sessionTokenHash),
    index("sessions_user_expires_idx").on(table.userId, table.expiresAt),
  ],
);

/**
 * Single-use OTP/magic-link tokens. Only the hash is stored so a database
 * leak cannot be replayed against the auth endpoints.
 */
export const verificationTokens = pgTable(
  "verification_tokens",
  {
    id: primaryId(),
    identifier: text("identifier").notNull(),
    tokenHash: text("token_hash").notNull(),
    purpose: text("purpose").notNull(),
    expiresAt: moment("expires_at").notNull(),
    consumedAt: moment("consumed_at"),
    attemptCount: integer("attempt_count").notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("verification_tokens_hash_unique").on(table.tokenHash),
    index("verification_tokens_identifier_idx").on(
      table.identifier,
      table.purpose,
    ),
  ],
);

/** Shared rate-limit counters; identifiers are keyed hashes, never raw PII. */
export const authRateLimits = pgTable(
  "auth_rate_limits",
  {
    id: primaryId(),
    action: text("action").notNull(),
    identifierHash: text("identifier_hash").notNull(),
    bucket: text("bucket").notNull(),
    attemptCount: integer("attempt_count").notNull().default(1),
    expiresAt: moment("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("auth_rate_limits_bucket_unique").on(
      table.action,
      table.identifierHash,
      table.bucket,
    ),
    index("auth_rate_limits_expiry_idx").on(table.expiresAt),
    check("auth_rate_limits_attempt_positive", sql`${table.attemptCount} > 0`),
  ],
);

/** Iranian delivery address. Kept denormalised for historic accuracy. */
export const addresses = pgTable(
  "addresses",
  {
    id: primaryId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientName: text("recipient_name").notNull(),
    phoneE164: text("phone_e164").notNull(),
    province: text("province").notNull(),
    city: text("city").notNull(),
    addressLine: text("address_line").notNull(),
    postalCode: text("postal_code"),
    nationalIdEncrypted: text("national_id_encrypted"),
    plusCode: text("plus_code"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: moment("deleted_at"),
  },
  (table) => [
    index("addresses_user_idx").on(table.userId),
    uniqueIndex("addresses_single_default")
      .on(table.userId)
      .where(sql`${table.isDefault} and ${table.deletedAt} is null`),
    check(
      "addresses_postal_code_format",
      sql`${table.postalCode} is null or ${table.postalCode} ~ '^[0-9]{10}$'`,
    ),
  ],
);
