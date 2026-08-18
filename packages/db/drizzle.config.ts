import { loadEnvironment } from "@rava/config";
import { defineConfig } from "drizzle-kit";

const environment = loadEnvironment();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema",
  out: "./migrations",
  dbCredentials: {
    url: environment.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
