import { loadEnvironment } from "../packages/config/src/index";

const environment = loadEnvironment();
const blockers: string[] = [];

if (environment.NODE_ENV !== "production") {
  blockers.push("NODE_ENV must be production.");
}
if (!environment.APP_URL.startsWith("https://")) {
  blockers.push("APP_URL must use HTTPS.");
}
if (environment.AUTH_SECRET === "development-only-change-me") {
  blockers.push(
    "AUTH_SECRET must be replaced with a long random production secret.",
  );
}
for (const [name, value] of [
  ["DATABASE_URL", environment.DATABASE_URL],
  ["REDIS_URL", environment.REDIS_URL],
] as const) {
  if (/localhost|127\.0\.0\.1/.test(value)) {
    blockers.push(`${name} still points to localhost.`);
  }
}
if (environment.STORAGE_PROVIDER !== "s3") {
  blockers.push(
    "STORAGE_PROVIDER must be s3 for a multi-instance production deployment.",
  );
}
if (/localhost|127\.0\.0\.1/.test(environment.S3_ENDPOINT)) {
  blockers.push("S3_ENDPOINT still points to localhost.");
}
if (
  environment.S3_ACCESS_KEY === "minio" ||
  environment.S3_SECRET_KEY === "minio123"
) {
  blockers.push("S3 credentials still use the local MinIO defaults.");
}
if (environment.PAYMENT_PROVIDER === "fake") {
  blockers.push(
    "PAYMENT_PROVIDER is still fake; real money cannot be accepted.",
  );
} else {
  blockers.push(
    "The production payment gateway adapter is not implemented; connect the selected PSP before accepting real money.",
  );
}
if (environment.FX_PROVIDER === "fake") {
  blockers.push("FX_PROVIDER is still fake.");
}
if (environment.EMAIL_PROVIDER !== "smtp" || !environment.SMTP_URL) {
  blockers.push("Transactional SMTP email is not configured.");
}
if (environment.SMS_PROVIDER !== "api" || !environment.SMS_API_KEY) {
  blockers.push("The production SMS provider is not configured.");
}

if (blockers.length > 0) {
  console.error("RAVA production blockers:\n- " + blockers.join("\n- "));
  process.exit(1);
}

console.log("RAVA production environment passed the mandatory launch checks.");
