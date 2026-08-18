import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { createdAt, moment, primaryId, updatedAt } from "./columns";
import { tripStatusEnum } from "./enums";

/**
 * A physical carry trip from Germany to Iran.
 *
 * Declared without any commerce dependency so that `orders.trip_id` can point
 * at it without creating an import cycle.
 */
export const trips = pgTable(
  "trips",
  {
    id: primaryId(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    departureWindowStart: moment("departure_window_start"),
    departureWindowEnd: moment("departure_window_end"),
    arrivalWindowStart: moment("arrival_window_start"),
    arrivalWindowEnd: moment("arrival_window_end"),
    capacityWeightGrams: integer("capacity_weight_grams"),
    status: tripStatusEnum("status").notNull().default("PLANNED"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("trips_code_unique").on(table.code),
    index("trips_status_idx").on(table.status, table.departureWindowStart),
    check(
      "trips_capacity_positive",
      sql`${table.capacityWeightGrams} is null or ${table.capacityWeightGrams} > 0`,
    ),
    check(
      "trips_departure_window_order",
      sql`${table.departureWindowStart} is null
        or ${table.departureWindowEnd} is null
        or ${table.departureWindowEnd} >= ${table.departureWindowStart}`,
    ),
    check(
      "trips_arrival_window_order",
      sql`${table.arrivalWindowStart} is null
        or ${table.arrivalWindowEnd} is null
        or ${table.arrivalWindowEnd} >= ${table.arrivalWindowStart}`,
    ),
  ],
);
