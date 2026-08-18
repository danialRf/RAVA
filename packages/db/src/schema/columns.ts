/**
 * Shared column builders.
 *
 * Money is always a bigint in `mode: "bigint"` so values arrive in JavaScript
 * as `bigint`, never as a lossy `number`.
 */

import { bigint, timestamp, uuid } from "drizzle-orm/pg-core";

export function primaryId() {
  return uuid("id").primaryKey().defaultRandom();
}

export function createdAt() {
  return timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow();
}

export function updatedAt() {
  return timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow();
}

export function moment(name: string) {
  return timestamp(name, { withTimezone: true, mode: "date" });
}

/** Integer Toman. Never fractional, never a float. */
export function tomanAmount(name: string) {
  return bigint(name, { mode: "bigint" });
}

/** Integer EUR cents as charged by the source retailer. */
export function eurCentsAmount(name: string) {
  return bigint(name, { mode: "bigint" });
}
