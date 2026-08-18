import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import {
  addresses,
  authRateLimits,
  notificationPreferences,
  priceAlerts,
  privateUploads,
  productRequests,
  products,
  wishlists,
} from "../schema";
import type { Executor } from "./executor";

export async function recordRateLimitAttempt(
  executor: Executor,
  input: {
    action: string;
    identifierHash: string;
    bucket: string;
    expiresAt: Date;
  },
): Promise<number> {
  const [row] = await executor
    .insert(authRateLimits)
    .values(input)
    .onConflictDoUpdate({
      target: [
        authRateLimits.action,
        authRateLimits.identifierHash,
        authRateLimits.bucket,
      ],
      set: { attemptCount: sql`${authRateLimits.attemptCount} + 1` },
    })
    .returning({ attemptCount: authRateLimits.attemptCount });
  return row?.attemptCount ?? 1;
}

export async function createAddress(
  executor: Executor,
  input: {
    userId: string;
    recipientName: string;
    phoneE164: string;
    province: string;
    city: string;
    addressLine: string;
    postalCode: string | null;
    isDefault: boolean;
  },
) {
  if (input.isDefault) {
    await executor
      .update(addresses)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(
        and(eq(addresses.userId, input.userId), eq(addresses.isDefault, true)),
      );
  }
  const [created] = await executor.insert(addresses).values(input).returning();
  return created;
}

export async function deleteAddress(
  executor: Executor,
  input: { userId: string; addressId: string },
): Promise<boolean> {
  const [deleted] = await executor
    .update(addresses)
    .set({ deletedAt: new Date(), isDefault: false, updatedAt: new Date() })
    .where(
      and(
        eq(addresses.id, input.addressId),
        eq(addresses.userId, input.userId),
        isNull(addresses.deletedAt),
      ),
    )
    .returning({ id: addresses.id });
  return deleted !== undefined;
}

export async function listWishlistProducts(executor: Executor, userId: string) {
  return executor
    .select({ slug: products.slug })
    .from(wishlists)
    .innerJoin(products, eq(wishlists.productId, products.id))
    .where(eq(wishlists.userId, userId))
    .orderBy(desc(wishlists.createdAt));
}

export async function replaceWishlistFromSlugs(
  executor: Executor,
  userId: string,
  slugs: readonly string[],
): Promise<void> {
  if (slugs.length === 0) return;
  const rows = await executor
    .select({ id: products.id })
    .from(products)
    .where(inArray(products.slug, [...slugs]));
  if (rows.length === 0) return;
  await executor
    .insert(wishlists)
    .values(rows.map(({ id }) => ({ userId, productId: id })))
    .onConflictDoNothing();
}

export async function toggleUserWishlist(
  executor: Executor,
  input: { userId: string; productSlug: string },
): Promise<boolean> {
  const [product] = await executor
    .select({ id: products.id })
    .from(products)
    .where(eq(products.slug, input.productSlug))
    .limit(1);
  if (!product) return false;
  const [existing] = await executor
    .select({ id: wishlists.id })
    .from(wishlists)
    .where(
      and(
        eq(wishlists.userId, input.userId),
        eq(wishlists.productId, product.id),
      ),
    )
    .limit(1);
  if (existing) {
    await executor.delete(wishlists).where(eq(wishlists.id, existing.id));
    return false;
  }
  await executor
    .insert(wishlists)
    .values({ userId: input.userId, productId: product.id });
  return true;
}

export async function listAlerts(executor: Executor, userId: string) {
  return executor
    .select({
      id: priceAlerts.id,
      productId: priceAlerts.productId,
      productSlug: products.slug,
      productTitle: products.titleFa,
      thresholdToman: priceAlerts.thresholdToman,
      status: priceAlerts.status,
      createdAt: priceAlerts.createdAt,
    })
    .from(priceAlerts)
    .innerJoin(products, eq(priceAlerts.productId, products.id))
    .where(eq(priceAlerts.userId, userId))
    .orderBy(desc(priceAlerts.createdAt));
}

export async function createPriceAlert(
  executor: Executor,
  input: { userId: string; productSlug: string; thresholdToman: bigint },
) {
  const [product] = await executor
    .select({ id: products.id })
    .from(products)
    .where(eq(products.slug, input.productSlug))
    .limit(1);
  if (!product) return null;
  const [created] = await executor
    .insert(priceAlerts)
    .values({
      userId: input.userId,
      productId: product.id,
      thresholdToman: input.thresholdToman,
    })
    .onConflictDoNothing()
    .returning();
  return created ?? null;
}

export async function cancelAlert(
  executor: Executor,
  input: { userId: string; alertId: string },
): Promise<void> {
  await executor
    .update(priceAlerts)
    .set({ status: "CANCELLED" })
    .where(
      and(
        eq(priceAlerts.id, input.alertId),
        eq(priceAlerts.userId, input.userId),
      ),
    );
}

export async function listNotificationPreferences(
  executor: Executor,
  userId: string,
) {
  return executor
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));
}

export async function setNotificationPreference(
  executor: Executor,
  input: {
    userId: string;
    channel: "SMS" | "EMAIL" | "IN_APP";
    topic: string;
    isEnabled: boolean;
  },
): Promise<void> {
  await executor
    .insert(notificationPreferences)
    .values(input)
    .onConflictDoUpdate({
      target: [
        notificationPreferences.userId,
        notificationPreferences.channel,
        notificationPreferences.topic,
      ],
      set: { isEnabled: input.isEnabled, updatedAt: new Date() },
    });
}

export async function createPrivateUploadRecord(
  executor: Executor,
  input: {
    userId: string;
    purpose: string;
    objectKey: string;
    contentType: string;
    sizeBytes: number;
  },
) {
  const [created] = await executor
    .insert(privateUploads)
    .values(input)
    .returning();
  return created;
}

export async function createProductRequest(
  executor: Executor,
  input: {
    userId: string;
    contactPhoneE164: string | null;
    descriptionFa: string;
    referenceUrl: string | null;
    budgetToman: bigint | null;
    imageUploadId: string | null;
  },
) {
  const [created] = await executor
    .insert(productRequests)
    .values(input)
    .returning();
  return created;
}

export async function listProductRequests(executor: Executor, userId: string) {
  return executor
    .select({
      id: productRequests.id,
      descriptionFa: productRequests.descriptionFa,
      referenceUrl: productRequests.referenceUrl,
      budgetToman: productRequests.budgetToman,
      status: productRequests.status,
      createdAt: productRequests.createdAt,
    })
    .from(productRequests)
    .where(eq(productRequests.userId, userId))
    .orderBy(desc(productRequests.createdAt));
}
