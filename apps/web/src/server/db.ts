import "server-only";

import { createDatabase, type Database } from "@rava/db";

/**
 * Process-wide connection pool.
 *
 * Next.js reloads route modules on every request in development, so the handle
 * is cached on `globalThis` to avoid opening a new pool per reload.
 */
const globalForDatabase = globalThis as typeof globalThis & {
  ravaDatabase?: Database;
};

export function database(): Database {
  globalForDatabase.ravaDatabase ??= createDatabase().db;
  return globalForDatabase.ravaDatabase;
}
