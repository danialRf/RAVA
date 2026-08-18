import "server-only";

import { createHash, createHmac, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";

import { loadEnvironment } from "@rava/config";
import {
  createSession,
  deleteSession,
  findSessionWithUser,
  recordRateLimitAttempt,
} from "@rava/db";
import { SESSION_TTL_SECONDS, type SessionPrincipal } from "@rava/domain";

import { usesHttps } from "../lib/site";
import { database } from "./db";

const SESSION_COOKIE = "rava_session";

export function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export async function enforceRateLimit(
  action: string,
  identifier: string,
  limit: number,
  windowSeconds = 15 * 60,
): Promise<boolean> {
  const environment = loadEnvironment();
  const now = Date.now();
  const bucketNumber = Math.floor(now / (windowSeconds * 1000));
  const identifierHash = createHmac("sha256", environment.AUTH_SECRET)
    .update(identifier)
    .digest("hex");
  const attempts = await recordRateLimitAttempt(database(), {
    action,
    identifierHash,
    bucket: String(bucketNumber),
    expiresAt: new Date((bucketNumber + 1) * windowSeconds * 1000),
  });
  return attempts <= limit;
}

export async function createAuthSession(userId: string): Promise<void> {
  const token = randomToken();
  const now = new Date();
  const requestHeaders = await headers();
  await createSession(database(), {
    userId,
    sessionTokenHash: hashSecret(token),
    expiresAt: new Date(now.getTime() + SESSION_TTL_SECONDS * 1000),
    ipAddress:
      requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: requestHeaders.get("user-agent"),
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: usesHttps(),
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function currentSession(): Promise<{
  user: SessionPrincipal;
  sessionId: string;
} | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await findSessionWithUser(database(), {
    sessionTokenHash: hashSecret(token),
    now: new Date(),
  });
  if (!row || row.user.status !== "ACTIVE") return null;
  return {
    sessionId: row.session.id,
    user: {
      id: row.user.id,
      role: row.user.role,
      displayName: row.user.displayName,
      email: row.user.email,
      emailVerifiedAt: row.user.emailVerifiedAt,
      phoneE164: row.user.phoneE164,
      phoneVerifiedAt: row.user.phoneVerifiedAt,
    },
  };
}

export async function currentUser(): Promise<SessionPrincipal | null> {
  return (await currentSession())?.user ?? null;
}

export async function destroyCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(database(), hashSecret(token));
  store.delete(SESSION_COOKIE);
}

export function sessionCookieName(): string {
  return SESSION_COOKIE;
}
