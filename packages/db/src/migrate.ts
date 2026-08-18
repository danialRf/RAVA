import { loadEnvironment } from "@rava/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const environment = loadEnvironment();
const client = postgres(environment.DATABASE_URL, { max: 1 });
const database = drizzle(client);

try {
  await migrate(database, { migrationsFolder: "migrations" });
  process.stdout.write("Database migrations completed.\n");
} finally {
  await client.end();
}
