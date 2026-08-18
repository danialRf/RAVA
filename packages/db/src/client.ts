import { loadEnvironment } from "@rava/config";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

export interface DatabaseHandle {
  readonly db: Database;
  readonly close: () => Promise<void>;
}

export interface CreateDatabaseOptions {
  readonly url?: string;
  /** Keep this at 1 for migrations and short-lived scripts. */
  readonly maxConnections?: number;
}

/**
 * Opens a pooled connection.
 *
 * Callers own the handle and must close it; the web app creates one module
 * singleton, scripts and tests create their own and close it in teardown.
 */
export function createDatabase(
  options: CreateDatabaseOptions = {},
): DatabaseHandle {
  const url = options.url ?? loadEnvironment().DATABASE_URL;
  const client = postgres(url, { max: options.maxConnections ?? 10 });
  const db = drizzle(client, { schema });
  return {
    db,
    close: async () => {
      await client.end();
    },
  };
}
