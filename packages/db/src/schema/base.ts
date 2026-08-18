import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Bootstrap marker table introduced in Phase 0. */
export const appMetadata = pgTable("app_metadata", {
  id: text("id").primaryKey(),
  schemaVersion: integer("schema_version").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});
