import { and, eq, isNull, sql } from "drizzle-orm";

import { addresses, users } from "../schema";
import type { Executor } from "./executor";

/** Case-insensitive email lookup, ignoring soft-deleted accounts. */
export async function findUserByEmail(executor: Executor, email: string) {
  const [user] = await executor
    .select()
    .from(users)
    .where(
      and(
        sql`lower(${users.email}) = lower(${email})`,
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  return user ?? null;
}

export async function findUserByPhone(executor: Executor, phoneE164: string) {
  const [user] = await executor
    .select()
    .from(users)
    .where(and(eq(users.phoneE164, phoneE164), isNull(users.deletedAt)))
    .limit(1);
  return user ?? null;
}

/**
 * Creates a customer, or returns the existing one for the same phone number.
 *
 * OTP sign-in races produce duplicate create attempts; the unique index is the
 * arbiter and this function converges on one account instead of failing.
 */
export async function ensureCustomerByPhone(
  executor: Executor,
  input: { readonly phoneE164: string; readonly displayName?: string | null },
) {
  const existing = await findUserByPhone(executor, input.phoneE164);
  if (existing !== null) return existing;

  const [created] = await executor
    .insert(users)
    .values({
      phoneE164: input.phoneE164,
      displayName: input.displayName ?? null,
      role: "CUSTOMER",
    })
    // The uniqueness index is partial, so ON CONFLICT must repeat its predicate.
    .onConflictDoNothing({
      target: users.phoneE164,
      where: sql`${users.phoneE164} is not null`,
    })
    .returning();

  if (created !== undefined) return created;

  const raced = await findUserByPhone(executor, input.phoneE164);
  if (raced === null) {
    throw new Error("Failed to create or find the customer account");
  }
  return raced;
}

export async function listAddresses(executor: Executor, userId: string) {
  return executor
    .select()
    .from(addresses)
    .where(and(eq(addresses.userId, userId), isNull(addresses.deletedAt)))
    .orderBy(addresses.createdAt);
}

/**
 * Sets one address as the default.
 *
 * Clears the previous default first because a partial unique index allows only
 * one default address per user.
 */
export async function setDefaultAddress(
  executor: Executor,
  input: { readonly userId: string; readonly addressId: string },
) {
  await executor
    .update(addresses)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(
      and(eq(addresses.userId, input.userId), eq(addresses.isDefault, true)),
    );

  const [updated] = await executor
    .update(addresses)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(
      and(
        eq(addresses.id, input.addressId),
        eq(addresses.userId, input.userId),
        isNull(addresses.deletedAt),
      ),
    )
    .returning();

  return updated ?? null;
}
