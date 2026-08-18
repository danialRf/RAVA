import { existsSync } from "node:fs";
import { dirname, join, parse } from "node:path";

import { z } from "zod";

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.url().optional(),
);

const booleanFromString = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean());

export const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_URL: z.url().default("http://localhost:3000"),
  AUTH_SECRET: z.string().min(10).default("development-only-change-me"),
  DATABASE_URL: z.url().default("postgresql://rava:rava@localhost:5432/rava"),
  /** Only used by repository integration tests; absent in production. */
  TEST_DATABASE_URL: optionalUrl,
  REDIS_URL: z.url().default("redis://localhost:6379"),
  STORAGE_PROVIDER: z.enum(["minio", "s3", "fake"]).default("minio"),
  S3_ENDPOINT: z.url().default("http://localhost:9000"),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_BUCKET_PUBLIC: z.string().min(1).default("rava-public"),
  S3_BUCKET_PRIVATE: z.string().min(1).default("rava-private"),
  S3_ACCESS_KEY: z.string().min(1).default("minio"),
  S3_SECRET_KEY: z.string().min(1).default("minio123"),
  FX_PROVIDER: z.enum(["fake", "manual", "api"]).default("fake"),
  FX_FAKE_EUR_TOMAN: z.coerce.number().int().positive().default(200_000),
  FX_API_KEY: z.string().optional(),
  FX_MANUAL_FALLBACK_ENABLED: booleanFromString.default(true),
  PAYMENT_PROVIDER: z.enum(["fake", "gateway"]).default("fake"),
  PAYMENT_MERCHANT_ID: z.string().optional(),
  SMS_PROVIDER: z.enum(["fake", "api"]).default("fake"),
  SMS_API_KEY: z.string().optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  TELEGRAM_ENABLED: booleanFromString.default(false),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHANNEL_ID: z.string().optional(),
  EMAIL_PROVIDER: z.enum(["console", "smtp"]).default("console"),
  SMTP_URL: optionalUrl,
  SEARCH_PROVIDER: z.enum(["postgres", "typesense"]).default("postgres"),
  TYPESENSE_URL: z.url().default("http://localhost:8108"),
  TYPESENSE_API_KEY: z.string().optional(),
  AI_PROVIDER: z.enum(["disabled", "openai"]).default("disabled"),
  OPENAI_API_KEY: z.string().optional(),
});

export type Environment = z.infer<typeof environmentSchema>;

let dotEnvLoaded = false;

/**
 * Loads the workspace `.env` for plain Node processes.
 *
 * Next.js does this itself, but `tsx` scripts (migrations, seed, worker smoke)
 * do not, so they would otherwise silently fall back to the schema defaults.
 * Existing environment variables always win, which keeps CI and shell
 * overrides authoritative.
 */
function loadDotEnvOnce(): void {
  if (dotEnvLoaded) return;
  dotEnvLoaded = true;
  if (typeof process.loadEnvFile !== "function") return;

  let directory = process.cwd();
  const { root } = parse(directory);
  for (;;) {
    const candidate = join(directory, ".env");
    if (existsSync(candidate)) {
      const before = { ...process.env };
      process.loadEnvFile(candidate);
      Object.assign(process.env, before);
      return;
    }
    if (directory === root) return;
    directory = dirname(directory);
  }
}

export function loadEnvironment(
  overrides: NodeJS.ProcessEnv = process.env,
): Environment {
  if (overrides === process.env) loadDotEnvOnce();
  return environmentSchema.parse(overrides);
}

export function publicRuntimeSummary(environment: Environment) {
  return {
    nodeEnvironment: environment.NODE_ENV,
    dependencies: {
      database: "configured",
      redis: "configured",
      objectStorage: environment.STORAGE_PROVIDER,
    },
    providers: {
      fx: environment.FX_PROVIDER,
      payment: environment.PAYMENT_PROVIDER,
      sms: environment.SMS_PROVIDER,
      email: environment.EMAIL_PROVIDER,
      ai: environment.AI_PROVIDER,
    },
  } as const;
}
