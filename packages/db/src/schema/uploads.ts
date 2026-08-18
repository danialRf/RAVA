import {
  check,
  index,
  integer,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { createdAt, primaryId } from "./columns";
import { users } from "./identity";

/**
 * Private uploads: request images, payment receipts and similar customer
 * files. They live in the private object-storage bucket and are NEVER served
 * from a public URL; staff reads them through an authenticated flow only.
 */
export const privateUploads = pgTable(
  "private_uploads",
  {
    id: primaryId(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Logical purpose, e.g. PRODUCT_REQUEST_IMAGE, PAYMENT_RECEIPT. */
    purpose: text("purpose").notNull(),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("private_uploads_user_idx").on(table.userId),
    index("private_uploads_purpose_idx").on(table.purpose),
    check("private_uploads_size_positive", sql`${table.sizeBytes} > 0`),
    check(
      "private_uploads_content_type_allowed",
      sql`${table.contentType} in ('image/jpeg', 'image/png', 'image/webp')`,
    ),
  ],
);
