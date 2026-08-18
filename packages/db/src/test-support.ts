/**
 * Integration-test harness.
 *
 * Tests run against a real PostgreSQL instance because the constraints, partial
 * indexes and transactional behaviour being verified do not exist anywhere
 * else. The database is dropped and recreated from the committed migrations on
 * every run, which also exercises "migrate from empty" continuously.
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { loadEnvironment } from "@rava/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import type { Database } from "./client";
import * as schema from "./schema";

export const MIGRATIONS_FOLDER = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "migrations",
);

/** Test database URL, derived from DATABASE_URL when not set explicitly. */
export function resolveTestDatabaseUrl(): string {
  const environment = loadEnvironment();
  if (environment.TEST_DATABASE_URL !== undefined) {
    return environment.TEST_DATABASE_URL;
  }
  const url = new URL(environment.DATABASE_URL);
  url.pathname = `${url.pathname.replace(/^\//, "")}_test`;
  return url.toString();
}

function maintenanceUrl(testUrl: string): {
  readonly url: string;
  readonly databaseName: string;
} {
  const url = new URL(testUrl);
  const databaseName = url.pathname.replace(/^\//, "");
  url.pathname = "/postgres";
  return { url: url.toString(), databaseName };
}

export interface TestDatabase {
  readonly db: Database;
  readonly url: string;
  readonly close: () => Promise<void>;
}

/**
 * Recreates the test database and applies every migration from scratch.
 *
 * Throws with an actionable message when PostgreSQL is unreachable rather than
 * silently skipping, so a broken local environment cannot look like a pass.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const url = resolveTestDatabaseUrl();
  const { url: adminUrl, databaseName } = maintenanceUrl(url);

  const admin = postgres(adminUrl, { max: 1 });
  try {
    await admin.unsafe(
      `drop database if exists "${databaseName}" with (force)`,
    );
    await admin.unsafe(`create database "${databaseName}"`);
  } catch (error) {
    await admin.end();
    throw new Error(
      `Cannot prepare the test database at ${adminUrl}. Run "pnpm infra:up" first. Cause: ${String(error)}`,
    );
  }
  await admin.end();

  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  return {
    db,
    url,
    close: async () => {
      await client.end();
    },
  };
}

/** Deletes all business rows while keeping the schema, for per-test isolation. */
export async function truncateAll(db: Database): Promise<void> {
  await db.execute(
    // app_metadata is bootstrap state, not test data.
    `do $$
      declare statement text;
      begin
        select 'truncate table ' || string_agg(format('%I.%I', schemaname, tablename), ', ') || ' restart identity cascade'
        into statement
        from pg_tables
        where schemaname = 'public' and tablename <> 'app_metadata';
        if statement is not null then execute statement; end if;
      end $$;`,
  );
}
