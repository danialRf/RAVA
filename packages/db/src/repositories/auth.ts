import { timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";

import { OTP_MAX_ATTEMPTS, type VerificationPurpose } from "@rava/domain";

import { authAccounts, sessions, users, verificationTokens } from "../schema";
import type { Executor } from "./executor";

/**
 * Authentication persistence: credential accounts, provider links, sessions
 * and single-use verification tokens.
 *
 * Only hashes are stored. Session tokens and OTP/email tokens are random
 * high-entropy (or rate-limited) values whose SHA-256 digest lives in the
 * database, so a database leak cannot be replayed against the auth endpoints.
 */

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/** Returns null when the email is already registered instead of throwing. */
export async function createUserWithPassword(
  executor: Executor,
  input: {
    readonly email: string;
    readonly passwordHash: string;
    readonly displayName: string | null;
  },
) {
  const [created] = await executor
    .insert(users)
    .values({
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      role: "CUSTOMER",
    })
    // Partial unique index on lower(email) where email is not null.
    .onConflictDoNothing()
    .returning();
  return created ?? null;
}

/** Creates an account only from a provider-verified email assertion. */
export async function createVerifiedProviderUser(
  executor: Executor,
  input: { email: string; displayName: string | null; verifiedAt: Date },
) {
  const [created] = await executor
    .insert(users)
    .values({
      email: input.email,
      emailVerifiedAt: input.verifiedAt,
      displayName: input.displayName,
      role: "CUSTOMER",
    })
    .onConflictDoNothing()
    .returning();
  return created ?? null;
}

export async function updateUserPassword(
  executor: Executor,
  input: { readonly userId: string; readonly passwordHash: string },
): Promise<void> {
  await executor
    .update(users)
    .set({ passwordHash: input.passwordHash, updatedAt: new Date() })
    .where(eq(users.id, input.userId));
}

export async function markEmailVerified(
  executor: Executor,
  userId: string,
  verifiedAt: Date,
): Promise<void> {
  await executor
    .update(users)
    .set({ emailVerifiedAt: verifiedAt, updatedAt: verifiedAt })
    .where(eq(users.id, userId));
}

/** Applies an already-verified email change; returns false on conflict. */
export async function applyEmailChange(
  executor: Executor,
  input: { readonly userId: string; readonly newEmail: string },
): Promise<boolean> {
  const conflict = await executor
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        sql`lower(${users.email}) = lower(${input.newEmail})`,
        sql`${users.id} <> ${input.userId}`,
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  if (conflict.length > 0) return false;

  await executor
    .update(users)
    .set({
      email: input.newEmail,
      emailVerifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, input.userId));
  return true;
}

/**
 * Links a verified phone. Returns false when another live account already
 * owns the number — silent merging of two accounts is never allowed.
 */
export async function linkVerifiedPhone(
  executor: Executor,
  input: {
    readonly userId: string;
    readonly phoneE164: string;
    readonly verifiedAt: Date;
  },
): Promise<boolean> {
  const conflict = await executor
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.phoneE164, input.phoneE164),
        sql`${users.id} <> ${input.userId}`,
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  if (conflict.length > 0) return false;

  await executor
    .update(users)
    .set({
      phoneE164: input.phoneE164,
      phoneVerifiedAt: input.verifiedAt,
      updatedAt: input.verifiedAt,
    })
    .where(eq(users.id, input.userId));
  return true;
}

export async function updateDisplayName(
  executor: Executor,
  input: { readonly userId: string; readonly displayName: string },
): Promise<void> {
  await executor
    .update(users)
    .set({ displayName: input.displayName, updatedAt: new Date() })
    .where(eq(users.id, input.userId));
}

// ---------------------------------------------------------------------------
// Provider links (Google, later others)
// ---------------------------------------------------------------------------

export async function findUserIdByProviderAccount(
  executor: Executor,
  input: { readonly provider: string; readonly providerAccountId: string },
): Promise<string | null> {
  const [link] = await executor
    .select({ userId: authAccounts.userId })
    .from(authAccounts)
    .where(
      and(
        eq(authAccounts.provider, input.provider),
        eq(authAccounts.providerAccountId, input.providerAccountId),
      ),
    )
    .limit(1);
  return link?.userId ?? null;
}

/** Idempotent link; converges when two requests race. */
export async function linkProviderAccount(
  executor: Executor,
  input: {
    readonly userId: string;
    readonly provider: string;
    readonly providerAccountId: string;
    readonly scope?: string | null;
  },
): Promise<void> {
  await executor
    .insert(authAccounts)
    .values({
      userId: input.userId,
      provider: input.provider,
      providerAccountId: input.providerAccountId,
      scope: input.scope ?? null,
    })
    .onConflictDoNothing({
      target: [authAccounts.provider, authAccounts.providerAccountId],
    });
}

export async function listProviderAccounts(executor: Executor, userId: string) {
  return executor
    .select({
      id: authAccounts.id,
      provider: authAccounts.provider,
      createdAt: authAccounts.createdAt,
    })
    .from(authAccounts)
    .where(eq(authAccounts.userId, userId))
    .orderBy(desc(authAccounts.createdAt));
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function createSession(
  executor: Executor,
  input: {
    readonly userId: string;
    readonly sessionTokenHash: string;
    readonly expiresAt: Date;
    readonly ipAddress?: string | null;
    readonly userAgent?: string | null;
  },
) {
  const [created] = await executor
    .insert(sessions)
    .values({
      userId: input.userId,
      sessionTokenHash: input.sessionTokenHash,
      expiresAt: input.expiresAt,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    })
    .returning();
  return created;
}

/** Session lookup joined with its live, non-deleted user. */
export async function findSessionWithUser(
  executor: Executor,
  input: { readonly sessionTokenHash: string; readonly now: Date },
) {
  const [row] = await executor
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.sessionTokenHash, input.sessionTokenHash),
        gt(sessions.expiresAt, input.now),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Sliding refresh: extends the cookie expiry up to the absolute cap of
 * 90 days from creation, so a stolen old token still dies.
 */
export async function touchSession(
  executor: Executor,
  input: {
    readonly sessionId: string;
    readonly createdAt: Date;
    readonly now: Date;
    readonly slidingTtlSeconds: number;
    readonly absoluteTtlSeconds: number;
  },
): Promise<Date> {
  const sliding = new Date(
    input.now.getTime() + input.slidingTtlSeconds * 1000,
  );
  const absolute = new Date(
    input.createdAt.getTime() + input.absoluteTtlSeconds * 1000,
  );
  const next = sliding < absolute ? sliding : absolute;
  await executor
    .update(sessions)
    .set({ expiresAt: next })
    .where(eq(sessions.id, input.sessionId));
  return next;
}

export async function deleteSession(
  executor: Executor,
  sessionTokenHash: string,
): Promise<void> {
  await executor
    .delete(sessions)
    .where(eq(sessions.sessionTokenHash, sessionTokenHash));
}

export async function deleteAllUserSessions(
  executor: Executor,
  userId: string,
): Promise<void> {
  await executor.delete(sessions).where(eq(sessions.userId, userId));
}

// ---------------------------------------------------------------------------
// Verification tokens (email links, OTP codes)
// ---------------------------------------------------------------------------

/**
 * Issues a fresh token and revokes every earlier unconsumed token for the
 * same identifier+purpose, so only the newest link/code works.
 */
export async function issueVerificationToken(
  executor: Executor,
  input: {
    readonly identifier: string;
    readonly purpose: VerificationPurpose;
    readonly tokenHash: string;
    readonly expiresAt: Date;
  },
) {
  await executor
    .delete(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, input.identifier),
        eq(verificationTokens.purpose, input.purpose),
      ),
    );
  const [created] = await executor
    .insert(verificationTokens)
    .values({
      identifier: input.identifier,
      purpose: input.purpose,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
    })
    .returning();
  return created;
}

export type TokenConsumeResult =
  | { readonly outcome: "consumed"; readonly tokenDbId: string }
  | { readonly outcome: "invalid" }
  | { readonly outcome: "expired" }
  | { readonly outcome: "tooManyAttempts" };

/**
 * Validates and consumes a token in one step.
 *
 * The row is located by (identifier, purpose), not by hash: OTP codes have
 * low entropy, so lookup-by-hash would let an attacker probe codes directly.
 * Wrong guesses increment `attempt_count` and lock the token after
 * OTP_MAX_ATTEMPTS.
 */
export async function consumeVerificationToken(
  executor: Executor,
  input: {
    readonly identifier: string;
    readonly purpose: VerificationPurpose;
    readonly tokenHash: string;
    readonly now: Date;
  },
): Promise<TokenConsumeResult> {
  const [row] = await executor
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, input.identifier),
        eq(verificationTokens.purpose, input.purpose),
        isNull(verificationTokens.consumedAt),
      ),
    )
    .orderBy(desc(verificationTokens.createdAt))
    .limit(1);

  if (row === undefined) return { outcome: "invalid" };
  if (row.expiresAt <= input.now) {
    await executor
      .delete(verificationTokens)
      .where(eq(verificationTokens.id, row.id));
    return { outcome: "expired" };
  }
  if (row.attemptCount >= OTP_MAX_ATTEMPTS) {
    await executor
      .delete(verificationTokens)
      .where(eq(verificationTokens.id, row.id));
    return { outcome: "tooManyAttempts" };
  }
  if (!hashesEqual(row.tokenHash, input.tokenHash)) {
    await executor
      .update(verificationTokens)
      .set({ attemptCount: row.attemptCount + 1 })
      .where(eq(verificationTokens.id, row.id));
    return { outcome: "invalid" };
  }

  await executor
    .update(verificationTokens)
    .set({ consumedAt: input.now })
    .where(eq(verificationTokens.id, row.id));
  return { outcome: "consumed", tokenDbId: row.id };
}

function hashesEqual(stored: string, candidate: string): boolean {
  const a = Buffer.from(stored, "utf8");
  const b = Buffer.from(candidate, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Latest issued token row for an identifier; used only by the dev harness. */
export async function findLatestVerificationToken(
  executor: Executor,
  input: {
    readonly identifier: string;
    readonly purpose: VerificationPurpose;
  },
) {
  const [row] = await executor
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, input.identifier),
        eq(verificationTokens.purpose, input.purpose),
      ),
    )
    .orderBy(desc(verificationTokens.createdAt))
    .limit(1);
  return row ?? null;
}
