/**
 * Integration tests against a real PostgreSQL database.
 *
 * Requires local infrastructure (`pnpm infra:up`). The database is created
 * from the committed migrations, so a broken migration fails here first.
 */

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Database } from "./client";
import {
  addCartItem,
  capturePayment,
  completeGatewayDeposit,
  consumeVerificationToken,
  createOrderFromQuote,
  createPaymentIntent,
  ensureActiveCart,
  findOwnedPayment,
  findPaymentByAuthority,
  getOwnedOrder,
  getQuoteWithItems,
  listCartDetails,
  persistQuote,
  removeCartItem,
  setPaymentAuthority,
  submitPaymentReceipt,
  updateCartItemQuantity,
  countStorefrontProducts,
  createSession,
  createUserWithPassword,
  ensureCustomerByPhone,
  expireStaleQuotes,
  findBestOfferForVariant,
  findSessionWithUser,
  findFreshFxRate,
  findNextOpenTrip,
  getPublishedProductBySlug,
  getStorefrontProduct,
  listBrandsWithCounts,
  getAdminOverview,
  listAdminAuditLog,
  listAdminOrders,
  listPaymentsNeedingReview,
  listProcurementQueue,
  listCategoriesWithCounts,
  listOfferPriceHistory,
  listOrderStatusHistory,
  listPublishedContent,
  listPublishedProducts,
  listWishlistProducts,
  listStorefrontProducts,
  listStorefrontProductsBySlugs,
  recordOfferObservation,
  recordRateLimitAttempt,
  reviewCardPayment,
  replaceWishlistFromSlugs,
  resolvePricingRule,
  searchPublishedProducts,
  setDefaultAddress,
  transitionOrderStatus,
  updateProcurementItem,
  issueVerificationToken,
} from "./repositories";
import {
  adminAuditLog,
  addresses,
  brands,
  cartItems,
  carts,
  categories,
  coupons,
  paymentReceipts,
  fxRates,
  orderItems,
  orders,
  outboxEvents,
  payments,
  pricingRules,
  productVariants,
  products,
  purchaseTasks,
  quotes,
  retailers,
  reviews,
  sourceOffers,
  users,
} from "./schema";
import { seed } from "./seed";
import {
  createTestDatabase,
  truncateAll,
  type TestDatabase,
} from "./test-support";

let handle: TestDatabase;
let db: Database;

beforeAll(async () => {
  handle = await createTestDatabase();
  db = handle.db;
}, 60_000);

afterAll(async () => {
  await handle?.close();
});

beforeEach(async () => {
  await truncateAll(db);
});

/** Inserts the minimum catalog graph a test needs. */
async function createCatalogFixture() {
  const [brand] = await db
    .insert(brands)
    .values({ name: "Adidas", slug: "adidas", country: "DE" })
    .returning();
  const [category] = await db
    .insert(categories)
    .values({ nameFa: "کفش", nameEn: "Footwear", slug: "footwear" })
    .returning();
  if (brand === undefined || category === undefined) {
    throw new Error("Catalog fixture failed");
  }

  const [product] = await db
    .insert(products)
    .values({
      brandId: brand.id,
      categoryId: category.id,
      titleFa: "کفش آدیداس سامبا",
      titleOriginal: "Adidas Samba OG",
      slug: "adidas-samba-og",
      status: "PUBLISHED",
      publishedAt: new Date(),
    })
    .returning();
  if (product === undefined) throw new Error("Product fixture failed");

  const [variant] = await db
    .insert(productVariants)
    .values({
      productId: product.id,
      skuInternal: "RAVA-ADI-SMB-42",
      size: "42",
    })
    .returning();
  if (variant === undefined) throw new Error("Variant fixture failed");

  const [retailer] = await db
    .insert(retailers)
    .values({
      name: "Demo Retailer",
      domain: "demo-retailer.example",
      isEnabled: true,
      trustTier: "AUTHORIZED_RETAILER",
    })
    .returning();
  if (retailer === undefined) throw new Error("Retailer fixture failed");

  return { brand, category, product, variant, retailer };
}

async function createOrderFixture(
  options: {
    readonly total?: bigint;
    readonly deposit?: bigint;
    readonly depositPaid?: bigint;
    readonly status?: "QUOTED" | "DEPOSIT_PENDING" | "DEPOSIT_PAID";
  } = {},
) {
  const total = options.total ?? 10_000_000n;
  const deposit = options.deposit ?? 3_500_000n;

  const [customer] = await db
    .insert(users)
    .values({ phoneE164: "+989120000001", displayName: "مشتری آزمایشی" })
    .returning();
  if (customer === undefined) throw new Error("User fixture failed");

  const [order] = await db
    .insert(orders)
    .values({
      orderNumber: `RAVA-TEST-${Math.random().toString(36).slice(2, 8)}`,
      userId: customer.id,
      status: options.status ?? "DEPOSIT_PENDING",
      totalLockedToman: total,
      depositRequiredToman: deposit,
      depositPaidToman: options.depositPaid ?? 0n,
      balanceDueToman: total - deposit,
    })
    .returning();
  if (order === undefined) throw new Error("Order fixture failed");

  return { customer, order };
}

/**
 * Asserts that a statement was rejected by a named constraint.
 *
 * The constraint name lives on the PostgreSQL error, not on the Drizzle
 * wrapper, so matching on the wrapper message alone would pass for any failure.
 */
async function expectConstraintViolation(
  operation: () => Promise<unknown>,
  constraintName: string,
): Promise<void> {
  let caught: unknown;
  try {
    await operation();
  } catch (error) {
    caught = error;
  }

  expect(caught, `expected ${constraintName} to be violated`).toBeDefined();
  const cause = (
    caught as { cause?: { constraint_name?: string; message?: string } }
  ).cause;
  const detail = cause?.constraint_name ?? cause?.message ?? String(caught);
  expect(detail).toContain(constraintName);
}

describe("migrations", () => {
  it("creates the full schema from an empty database", async () => {
    const result = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public'`,
    );
    const tables = new Set(result.map((row) => row.table_name));

    for (const expected of [
      "users",
      "products",
      "product_variants",
      "source_offers",
      "offer_price_history",
      "fx_rates",
      "pricing_rules",
      "quotes",
      "orders",
      "order_items",
      "payments",
      "purchase_tasks",
      "trips",
      "outbox_events",
      "admin_audit_log",
    ]) {
      expect(tables.has(expected)).toBe(true);
    }
  });

  it("registers every order status in the database enum", async () => {
    const result = await db.execute<{ label: string }>(
      sql`select enumlabel as label from pg_enum
          join pg_type on pg_type.oid = pg_enum.enumtypid
          where pg_type.typname = 'order_status'`,
    );
    const labels = result.map((row) => row.label);
    expect(labels).toContain("DEPOSIT_PAID");
    expect(labels).toContain("REFUNDED");
    expect(labels).toHaveLength(22);
  });

  it("records both migrations in the drizzle journal", async () => {
    const result = await db.execute<{ count: string }>(
      sql`select count(*)::text as count from drizzle.__drizzle_migrations`,
    );
    expect(Number(result[0]?.count ?? 0)).toBeGreaterThanOrEqual(2);
  });
});

describe("admin operating read models", () => {
  it("reads only persisted operational queues and totals", async () => {
    await seed(db);

    const [overview, adminOrders, paymentQueue, procurementQueue, auditLog] =
      await Promise.all([
        getAdminOverview(db),
        listAdminOrders(db),
        listPaymentsNeedingReview(db),
        listProcurementQueue(db),
        listAdminAuditLog(db),
      ]);

    expect(adminOrders).toHaveLength(1);
    expect(adminOrders[0]?.orderNumber).toBe("RAVA-DEMO-0001");
    expect(overview.depositsReceived).toBeGreaterThan(0n);
    expect(overview.outstandingBalances).toBeGreaterThan(0n);
    expect(paymentQueue).toEqual([]);
    expect(procurementQueue).toEqual([]);
    expect(auditLog).toEqual([]);
  });
});

describe("constraints", () => {
  it("rejects an order whose deposit and balance do not reconstruct the total", async () => {
    const [customer] = await db
      .insert(users)
      .values({ phoneE164: "+989120000002" })
      .returning();

    await expectConstraintViolation(
      () =>
        db.insert(orders).values({
          orderNumber: "RAVA-BAD-1",
          userId: customer!.id,
          totalLockedToman: 10_000_000n,
          depositRequiredToman: 3_500_000n,
          balanceDueToman: 1n,
        }),
      "orders_split_balances",
    );
  });

  it("rejects paying more than the locked total", async () => {
    const { order } = await createOrderFixture();
    await expectConstraintViolation(
      () =>
        db
          .update(orders)
          .set({ depositPaidToman: 9_000_000n, balancePaidToman: 9_000_000n })
          .where(sql`${orders.id} = ${order.id}`),
      "orders_paid_within_total",
    );
  });

  it("rejects an order line whose total does not match unit × quantity", async () => {
    const { order } = await createOrderFixture();
    await expectConstraintViolation(
      () =>
        db.insert(orderItems).values({
          orderId: order.id,
          productSnapshot: {
            titleFa: "x",
            titleOriginal: "x",
            brand: "x",
            variant: {},
          },
          offerSnapshot: {
            retailer: "x",
            sourceUrl: "https://example.com",
            priceEurCents: "1",
            observedAt: new Date().toISOString(),
          },
          quantity: 2,
          unitTotalToman: 1_000n,
          lineTotalToman: 3_000n,
        }),
      "order_items_line_total_matches",
    );
  });

  it("rejects a user with neither email nor phone", async () => {
    await expectConstraintViolation(
      () => db.insert(users).values({ displayName: "بدون شناسه" }),
      "users_identifier_present",
    );
  });

  it("rejects a phone number that is not E.164", async () => {
    await expectConstraintViolation(
      () => db.insert(users).values({ phoneE164: "09120000000" }),
      "users_phone_e164_format",
    );
  });

  it("rejects a non-positive source price", async () => {
    const { retailer } = await createCatalogFixture();
    await expect(
      db.insert(sourceOffers).values({
        retailerId: retailer.id,
        sourceUrl: "https://demo-retailer.example/p/zero",
        rawTitle: "Zero",
        sourcePriceEurCents: 0n,
        stockStatus: "IN_STOCK",
      }),
      "source_offers_price_positive",
    );
  });

  it("rejects a review rating outside 1-5", async () => {
    const { product } = await createCatalogFixture();
    const [customer] = await db
      .insert(users)
      .values({ phoneE164: "+989120000003" })
      .returning();

    await expectConstraintViolation(
      () =>
        db.insert(reviews).values({
          productId: product.id,
          userId: customer!.id,
          rating: 6,
        }),
      "reviews_rating_range",
    );
  });

  it("requires a coupon to carry exactly one discount kind", async () => {
    await expectConstraintViolation(
      () =>
        db.insert(coupons).values({
          code: "BOTH",
          discountBps: 1_000,
          discountToman: 50_000n,
        }),
      "coupons_discount_present",
    );

    await expectConstraintViolation(
      () => db.insert(coupons).values({ code: "NEITHER" }),
      "coupons_discount_present",
    );
  });

  it("allows only one default address per user", async () => {
    const [customer] = await db
      .insert(users)
      .values({ phoneE164: "+989120000004" })
      .returning();

    const base = {
      userId: customer!.id,
      recipientName: "گیرنده",
      phoneE164: "+989120000004",
      province: "تهران",
      city: "تهران",
      addressLine: "خیابان نمونه",
      isDefault: true,
    };

    await db.insert(addresses).values(base);
    await expectConstraintViolation(
      () => db.insert(addresses).values(base),
      "addresses_single_default",
    );
  });

  it("keeps payment idempotency keys unique", async () => {
    const { order } = await createOrderFixture();
    const payment = {
      orderId: order.id,
      type: "DEPOSIT" as const,
      method: "GATEWAY" as const,
      provider: "fake",
      amountToman: 1_000n,
      idempotencyKey: "same-key",
      status: "SUCCEEDED" as const,
      verifiedAt: new Date(),
    };

    await db.insert(payments).values(payment);
    await expectConstraintViolation(
      () => db.insert(payments).values(payment),
      "payments_idempotency_unique",
    );
  });

  it("requires a succeeded payment to be verified", async () => {
    const { order } = await createOrderFixture();
    await expectConstraintViolation(
      () =>
        db.insert(payments).values({
          orderId: order.id,
          type: "DEPOSIT",
          method: "GATEWAY",
          provider: "fake",
          amountToman: 1_000n,
          idempotencyKey: "unverified",
          status: "SUCCEEDED",
        }),
      "payments_verified_when_succeeded",
    );
  });

  it("rejects a pricing rule whose margin and fee consume the whole price", async () => {
    await expectConstraintViolation(
      () =>
        db.insert(pricingRules).values({
          scope: "GLOBAL",
          targetMarginBps: 9_000,
          minProfitToman: 0n,
          transportClass: "M",
          paymentFeeBps: 1_500,
          depositBps: 3_500,
        }),
      "pricing_rules_margin_plus_fee",
    );
  });

  it("rejects a scoped pricing rule with no target", async () => {
    await expectConstraintViolation(
      () =>
        db.insert(pricingRules).values({
          scope: "CATEGORY",
          targetMarginBps: 2_000,
          minProfitToman: 0n,
          transportClass: "M",
          depositBps: 3_500,
        }),
      "pricing_rules_scope_target",
    );
  });
});

describe("catalog repository", () => {
  it("returns published products and hides drafts", async () => {
    const { brand, category } = await createCatalogFixture();
    await db.insert(products).values({
      brandId: brand.id,
      categoryId: category.id,
      titleFa: "پیش‌نویس",
      titleOriginal: "Draft product",
      slug: "draft-product",
      status: "DRAFT",
    });

    const listed = await listPublishedProducts(db);
    expect(listed.map((row) => row.slug)).toEqual(["adidas-samba-og"]);

    expect(await getPublishedProductBySlug(db, "draft-product")).toBeNull();
  });

  it("loads a product with its variants and media", async () => {
    await createCatalogFixture();
    const detail = await getPublishedProductBySlug(db, "adidas-samba-og");
    expect(detail?.brand.name).toBe("Adidas");
    expect(detail?.variants).toHaveLength(1);
    expect(detail?.variants[0]?.size).toBe("42");
  });

  it("searches Persian and Latin titles", async () => {
    await createCatalogFixture();
    expect(await searchPublishedProducts(db, "سامبا")).toHaveLength(1);
    expect(await searchPublishedProducts(db, "samba")).toHaveLength(1);
    expect(await searchPublishedProducts(db, "Adidas")).toHaveLength(1);
    expect(await searchPublishedProducts(db, "چیزی که نیست")).toHaveLength(0);
    expect(await searchPublishedProducts(db, "   ")).toHaveLength(0);
  });
});

describe("offer repository", () => {
  it("appends price history only when the observation changed", async () => {
    const { retailer, variant } = await createCatalogFixture();
    const base = {
      retailerId: retailer.id,
      sourceUrl: "https://demo-retailer.example/p/samba-42",
      rawTitle: "Adidas Samba OG 42",
      stockStatus: "IN_STOCK" as const,
      sourceVerified: true,
    };

    const first = await recordOfferObservation(db, {
      ...base,
      sourcePriceEurCents: 10_995n,
    });
    expect(first.historyAppended).toBe(true);

    const unchanged = await recordOfferObservation(db, {
      ...base,
      sourcePriceEurCents: 10_995n,
    });
    expect(unchanged.historyAppended).toBe(false);
    expect(unchanged.offerId).toBe(first.offerId);

    const changed = await recordOfferObservation(db, {
      ...base,
      sourcePriceEurCents: 9_995n,
    });
    expect(changed.historyAppended).toBe(true);

    const history = await listOfferPriceHistory(db, first.offerId);
    expect(history.map((row) => row.priceEurCents)).toEqual([10_995n, 9_995n]);

    const [offer] = await db
      .select()
      .from(sourceOffers)
      .where(sql`${sourceOffers.id} = ${first.offerId}`);
    // The prior price is carried forward, never invented.
    expect(offer?.previousPriceEurCents).toBe(10_995n);

    await db
      .update(sourceOffers)
      .set({ productVariantId: variant.id })
      .where(sql`${sourceOffers.id} = ${first.offerId}`);

    const best = await findBestOfferForVariant(db, variant.id);
    expect(best?.sourcePriceEurCents).toBe(9_995n);
  });

  it("never treats an unverified or unknown-stock offer as purchasable", async () => {
    const { retailer, variant } = await createCatalogFixture();

    await db.insert(sourceOffers).values([
      {
        retailerId: retailer.id,
        sourceUrl: "https://demo-retailer.example/p/unverified",
        productVariantId: variant.id,
        rawTitle: "Unverified",
        sourcePriceEurCents: 1_000n,
        stockStatus: "IN_STOCK",
        sourceVerified: false,
      },
      {
        retailerId: retailer.id,
        sourceUrl: "https://demo-retailer.example/p/unknown-stock",
        productVariantId: variant.id,
        rawTitle: "Unknown stock",
        sourcePriceEurCents: 1_100n,
        stockStatus: "UNKNOWN",
        sourceVerified: true,
      },
    ]);

    expect(await findBestOfferForVariant(db, variant.id)).toBeNull();
  });
});

describe("order repository", () => {
  it("writes status, history and an outbox event in one transaction", async () => {
    const { order } = await createOrderFixture({
      status: "DEPOSIT_PENDING",
      depositPaid: 3_500_000n,
    });

    const updated = await transitionOrderStatus(db, {
      orderId: order.id,
      toStatus: "DEPOSIT_PAID",
      note: "پرداخت بیعانه تأیید شد",
    });
    expect(updated.status).toBe("DEPOSIT_PAID");

    const history = await listOrderStatusHistory(db, order.id);
    expect(history).toHaveLength(1);
    expect(history[0]?.fromStatus).toBe("DEPOSIT_PENDING");

    const events = await db
      .select()
      .from(outboxEvents)
      .where(sql`${outboxEvents.aggregateId} = ${order.id}`);
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe("order.status_changed");
  });

  it("refuses an illegal transition and leaves no trace", async () => {
    const { order } = await createOrderFixture({ status: "QUOTED" });

    await expect(
      transitionOrderStatus(db, {
        orderId: order.id,
        toStatus: "DELIVERED",
      }),
    ).rejects.toThrow(/not allowed/);

    const events = await db.select().from(outboxEvents);
    expect(events).toHaveLength(0);
    const history = await listOrderStatusHistory(db, order.id);
    expect(history).toHaveLength(0);
  });

  it("refuses to mark a deposit paid without captured money", async () => {
    const { order } = await createOrderFixture({ status: "DEPOSIT_PENDING" });
    await expect(
      transitionOrderStatus(db, {
        orderId: order.id,
        toStatus: "DEPOSIT_PAID",
      }),
    ).rejects.toThrow(/deposit/);
  });

  it("captures a payment once even when the callback repeats", async () => {
    const { order } = await createOrderFixture();

    const first = await capturePayment(db, {
      orderId: order.id,
      type: "DEPOSIT",
      method: "GATEWAY",
      provider: "fake",
      amountToman: 3_500_000n,
      idempotencyKey: "gateway-callback-1",
      providerReference: "REF-1",
    });
    expect(first.applied).toBe(true);

    const replay = await capturePayment(db, {
      orderId: order.id,
      type: "DEPOSIT",
      method: "GATEWAY",
      provider: "fake",
      amountToman: 3_500_000n,
      idempotencyKey: "gateway-callback-1",
      providerReference: "REF-1",
    });
    expect(replay.applied).toBe(false);
    expect(replay.paymentId).toBe(first.paymentId);

    const [reloaded] = await db
      .select()
      .from(orders)
      .where(sql`${orders.id} = ${order.id}`);
    expect(reloaded?.depositPaidToman).toBe(3_500_000n);

    // With the money now captured, the guarded transition is allowed.
    const updated = await transitionOrderStatus(db, {
      orderId: order.id,
      toStatus: "DEPOSIT_PAID",
    });
    expect(updated.status).toBe("DEPOSIT_PAID");
  });

  it("applies a gateway deposit callback once and queues procurement", async () => {
    const { order } = await createOrderFixture();
    await db.insert(payments).values({
      orderId: order.id,
      type: "DEPOSIT",
      method: "GATEWAY",
      provider: "fake",
      providerAuthority: "FAKE-AUTHORITY-1",
      amountToman: order.depositRequiredToman,
      idempotencyKey: `deposit:${order.id}:GATEWAY`,
    });

    const first = await completeGatewayDeposit(db, {
      authority: "FAKE-AUTHORITY-1",
      providerReference: "FAKE-REFERENCE-1",
      amountToman: order.depositRequiredToman,
    });
    const replay = await completeGatewayDeposit(db, {
      authority: "FAKE-AUTHORITY-1",
      providerReference: "FAKE-REFERENCE-1",
      amountToman: order.depositRequiredToman,
    });

    expect(first.applied).toBe(true);
    expect(replay.applied).toBe(false);
    const [reloaded] = await db
      .select()
      .from(orders)
      .where(sql`${orders.id} = ${order.id}`);
    expect(reloaded?.status).toBe("PROCUREMENT_PENDING");
    expect(reloaded?.depositPaidToman).toBe(order.depositRequiredToman);
    const history = await listOrderStatusHistory(db, order.id);
    expect(history).toHaveLength(2);
    expect(history.map((entry) => entry.toStatus)).toEqual([
      "DEPOSIT_PAID",
      "PROCUREMENT_PENDING",
    ]);
  });

  it("does not credit a refund to the paid totals", async () => {
    const { order } = await createOrderFixture();
    await capturePayment(db, {
      orderId: order.id,
      type: "REFUND",
      method: "GATEWAY",
      provider: "fake",
      amountToman: 1_000_000n,
      idempotencyKey: "refund-1",
    });

    const [reloaded] = await db
      .select()
      .from(orders)
      .where(sql`${orders.id} = ${order.id}`);
    expect(reloaded?.depositPaidToman).toBe(0n);
    expect(reloaded?.balancePaidToman).toBe(0n);
  });
});

describe("user repository", () => {
  it("converges on one account for the same phone number", async () => {
    const first = await ensureCustomerByPhone(db, {
      phoneE164: "+989121111111",
      displayName: "کاربر",
    });
    const second = await ensureCustomerByPhone(db, {
      phoneE164: "+989121111111",
    });
    expect(second.id).toBe(first.id);

    const all = await db.select().from(users);
    expect(all).toHaveLength(1);
  });

  it("moves the default address without violating the single-default rule", async () => {
    const customer = await ensureCustomerByPhone(db, {
      phoneE164: "+989122222222",
    });
    const base = {
      userId: customer.id,
      recipientName: "گیرنده",
      phoneE164: "+989122222222",
      province: "تهران",
      city: "تهران",
    };

    const [first] = await db
      .insert(addresses)
      .values({ ...base, addressLine: "آدرس اول", isDefault: true })
      .returning();
    const [second] = await db
      .insert(addresses)
      .values({ ...base, addressLine: "آدرس دوم" })
      .returning();

    const updated = await setDefaultAddress(db, {
      userId: customer.id,
      addressId: second!.id,
    });
    expect(updated?.isDefault).toBe(true);

    const stored = await db.select().from(addresses);
    expect(stored.filter((row) => row.isDefault)).toHaveLength(1);
    expect(stored.find((row) => row.id === first!.id)?.isDefault).toBe(false);
  });
});

describe("pricing repository", () => {
  it("only returns an FX rate that is still fresh", async () => {
    const now = new Date();
    await db.insert(fxRates).values({
      provider: "fake",
      tomanPerUnit: 200_000n,
      providerTimestamp: new Date(now.getTime() - 10 * 60 * 1000),
    });

    expect(await findFreshFxRate(db, { maxAgeSeconds: 300, now })).toBeNull();
    expect(
      await findFreshFxRate(db, { maxAgeSeconds: 900, now }),
    ).not.toBeNull();
  });

  it("prefers the most specific active pricing rule", async () => {
    const { brand, category } = await createCatalogFixture();
    const common = {
      targetMarginBps: 2_000,
      minProfitToman: 0n,
      transportClass: "M" as const,
      depositBps: 3_500,
    };

    await db.insert(pricingRules).values([
      { ...common, scope: "GLOBAL", notes: "global" },
      {
        ...common,
        scope: "CATEGORY",
        categoryId: category.id,
        notes: "category",
      },
      { ...common, scope: "BRAND", brandId: brand.id, notes: "brand" },
    ]);

    const brandRule = await resolvePricingRule(db, {
      brandId: brand.id,
      categoryId: category.id,
    });
    expect(brandRule?.notes).toBe("brand");

    const categoryRule = await resolvePricingRule(db, {
      categoryId: category.id,
    });
    expect(categoryRule?.notes).toBe("category");

    const fallback = await resolvePricingRule(db, {});
    expect(fallback?.notes).toBe("global");
  });

  it("ignores a rule whose active window has closed", async () => {
    const past = new Date(Date.now() - 60 * 60 * 1000);
    await db.insert(pricingRules).values({
      scope: "GLOBAL",
      targetMarginBps: 2_000,
      minProfitToman: 0n,
      transportClass: "M",
      depositBps: 3_500,
      activeFrom: new Date(past.getTime() - 60 * 60 * 1000),
      activeTo: past,
    });

    expect(await resolvePricingRule(db, {})).toBeNull();
  });

  it("expires lapsed quotes", async () => {
    const [rate] = await db
      .insert(fxRates)
      .values({
        provider: "fake",
        tomanPerUnit: 200_000n,
        providerTimestamp: new Date(),
      })
      .returning();

    await db.insert(quotes).values([
      {
        fxRateId: rate!.id,
        fxTomanPerEur: 200_000n,
        subtotalToman: 1_000_000n,
        finalToman: 1_000_000n,
        depositToman: 350_000n,
        balanceToman: 650_000n,
        calculationVersion: "test",
        expiresAt: new Date(Date.now() - 1_000),
      },
      {
        fxRateId: rate!.id,
        fxTomanPerEur: 200_000n,
        subtotalToman: 1_000_000n,
        finalToman: 1_000_000n,
        depositToman: 350_000n,
        balanceToman: 650_000n,
        calculationVersion: "test",
        expiresAt: new Date(Date.now() + 600_000),
      },
    ]);

    expect(await expireStaleQuotes(db)).toBe(1);
    expect(await expireStaleQuotes(db)).toBe(0);
  });
});

describe("seed script", () => {
  it("produces demo data and is safe to re-run", async () => {
    const first = await seed(db);
    expect(first.products).toBeGreaterThan(0);
    expect(first.orders).toBe(1);

    const second = await seed(db);
    expect(second).toEqual(first);

    // The seeded demo order must satisfy the same money invariants as real ones.
    const [demoOrder] = await db.select().from(orders);
    expect(
      (demoOrder?.depositRequiredToman ?? 0n) +
        (demoOrder?.balanceDueToman ?? 0n),
    ).toBe(demoOrder?.totalLockedToman);
  }, 30_000);
});

describe("storefront read model", () => {
  /**
   * The storefront queries are exercised against the seeded catalog, because
   * their whole job is to join products, offers and media correctly.
   */
  beforeEach(async () => {
    await seed(db);
  }, 30_000);

  it("returns each product once with its cheapest verified offer", async () => {
    const rows = await listStorefrontProducts(db, { limit: 50 });
    const slugs = rows.map((row) => row.slug);
    expect(new Set(slugs).size).toBe(slugs.length);

    const samba = rows.find((row) => row.slug === "adidas-samba-og");
    expect(samba?.offerId).not.toBeNull();
    expect(samba?.retailerName).toBe("RAVA Demo Retailer");
    expect(samba?.imageUrl).not.toBeNull();
    // Three seeded sizes share one price, so the join must not fan out.
    expect(slugs.filter((slug) => slug === "adidas-samba-og")).toHaveLength(1);
  });

  it("filters by category, brand and observed discount", async () => {
    const footwear = await listStorefrontProducts(db, {
      categorySlug: "footwear",
    });
    expect(footwear.length).toBeGreaterThan(0);
    expect(footwear.every((row) => row.categorySlug === "footwear")).toBe(true);

    const adidas = await listStorefrontProducts(db, { brandSlug: "adidas" });
    expect(adidas.every((row) => row.brandSlug === "adidas")).toBe(true);

    const deals = await listStorefrontProducts(db, { discountOnly: true });
    expect(deals.length).toBeGreaterThan(0);
    for (const row of deals) {
      expect(row.offerPreviousPriceEurCents).not.toBeNull();
      expect(row.offerPreviousPriceEurCents!).toBeGreaterThan(
        row.offerPriceEurCents!,
      );
    }
  });

  it("sorts by source price in both directions", async () => {
    const ascending = await listStorefrontProducts(db, { sort: "price-low" });
    const prices = ascending
      .map((row) => row.offerPriceEurCents)
      .filter((price): price is bigint => price !== null);
    const sorted = [...prices].sort((left, right) => (left < right ? -1 : 1));
    expect(prices).toEqual(sorted);

    const descending = await listStorefrontProducts(db, { sort: "price-high" });
    expect(descending[0]?.offerPriceEurCents).toBe(prices.at(-1));
  });

  it("matches Persian and Latin search terms", async () => {
    expect(
      (await listStorefrontProducts(db, { search: "سامبا" })).length,
    ).toBeGreaterThan(0);
    expect(
      (await listStorefrontProducts(db, { search: "Samba" })).length,
    ).toBeGreaterThan(0);
    expect(
      (await listStorefrontProducts(db, { search: "Adidas" })).length,
    ).toBeGreaterThan(0);
    expect(await listStorefrontProducts(db, { search: "zzzznope" })).toEqual(
      [],
    );
    expect(await countStorefrontProducts(db, { search: "zzzznope" })).toBe(0);
  });

  it("loads a product with variants, offers and media in one call", async () => {
    const detail = await getStorefrontProduct(db, "adidas-samba-og");
    expect(detail?.variants).toHaveLength(3);
    expect(detail?.media.length).toBeGreaterThan(0);
    expect(detail?.variants.every((variant) => variant.offerId !== null)).toBe(
      true,
    );
    expect(await getStorefrontProduct(db, "no-such-product")).toBeNull();
  });

  it("hides offers that are unverified or out of stock", async () => {
    await db
      .update(sourceOffers)
      .set({ sourceVerified: false })
      .where(sql`true`);

    const rows = await listStorefrontProducts(db, { limit: 50 });
    expect(rows.every((row) => row.offerId === null)).toBe(true);
    expect(await listStorefrontProducts(db, { verifiedOnly: true })).toEqual(
      [],
    );
  });

  it("resolves wishlist slugs in the caller's order", async () => {
    const ordered = await listStorefrontProductsBySlugs(db, [
      "samsonite-respark-cabin",
      "adidas-samba-og",
    ]);
    expect(ordered.map((row) => row.slug)).toEqual([
      "samsonite-respark-cabin",
      "adidas-samba-og",
    ]);
    expect(await listStorefrontProductsBySlugs(db, [])).toEqual([]);
  });

  it("counts published products per category and brand", async () => {
    const categories = await listCategoriesWithCounts(db);
    expect(categories.length).toBeGreaterThan(0);
    expect(
      categories.find((row) => row.slug === "footwear")?.productCount,
    ).toBeGreaterThan(0);

    const brands = await listBrandsWithCounts(db);
    expect(brands.every((row) => row.productCount > 0)).toBe(true);
  });

  it("serves published home content and the next open trip", async () => {
    const content = await listPublishedContent(db, ["home.hero"]);
    expect(content[0]?.key).toBe("home.hero");
    expect(content[0]?.title).toBeTruthy();

    const trip = await findNextOpenTrip(db);
    expect(trip?.code).toBe("TRIP-DEMO-01");
  });
});

describe("authentication and account persistence", () => {
  it("stores only session hashes and rejects expired sessions", async () => {
    const user = await createUserWithPassword(db, {
      email: "customer@example.com",
      passwordHash: "$argon2id$test-only-hash",
      displayName: "Test Customer",
    });
    expect(user).not.toBeNull();

    await createSession(db, {
      userId: user!.id,
      sessionTokenHash: "sha256-session-token",
      expiresAt: new Date(Date.now() + 60_000),
      ipAddress: null,
      userAgent: null,
    });
    expect(
      await findSessionWithUser(db, {
        sessionTokenHash: "sha256-session-token",
        now: new Date(),
      }),
    ).toMatchObject({
      session: { userId: user!.id },
      user: { email: "customer@example.com" },
    });
    expect(
      await findSessionWithUser(db, {
        sessionTokenHash: "sha256-session-token",
        now: new Date(Date.now() + 120_000),
      }),
    ).toBeNull();
  });

  it("makes verification tokens single-use and limits wrong guesses", async () => {
    await issueVerificationToken(db, {
      identifier: "customer@example.com",
      purpose: "EMAIL_VERIFY",
      tokenHash: "correct-token-hash",
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(
      consumeVerificationToken(db, {
        identifier: "customer@example.com",
        purpose: "EMAIL_VERIFY",
        tokenHash: "correct-token-hash",
        now: new Date(),
      }),
    ).resolves.toMatchObject({ outcome: "consumed" });
    await expect(
      consumeVerificationToken(db, {
        identifier: "customer@example.com",
        purpose: "EMAIL_VERIFY",
        tokenHash: "correct-token-hash",
        now: new Date(),
      }),
    ).resolves.toEqual({ outcome: "invalid" });
  });

  it("increments shared rate limits atomically", async () => {
    const input = {
      action: "login",
      identifierHash: "hmac-email",
      bucket: "2026-08-18T01",
      expiresAt: new Date(Date.now() + 60_000),
    };
    await expect(recordRateLimitAttempt(db, input)).resolves.toBe(1);
    await expect(recordRateLimitAttempt(db, input)).resolves.toBe(2);
  });

  it("migrates anonymous wishlist slugs idempotently", async () => {
    await seed(db);
    const user = await createUserWithPassword(db, {
      email: "wishlist@example.com",
      passwordHash: "$argon2id$test-only-hash",
      displayName: null,
    });
    await replaceWishlistFromSlugs(db, user!.id, [
      "adidas-samba-og",
      "adidas-samba-og",
      "does-not-exist",
    ]);
    await replaceWishlistFromSlugs(db, user!.id, ["adidas-samba-og"]);
    expect(await listWishlistProducts(db, user!.id)).toEqual([
      { slug: "adidas-samba-og" },
    ]);
  });
});

describe("checkout repository", () => {
  /** Catalog, customer, address, FX snapshot and an empty cart. */
  async function createCheckoutFixture() {
    const catalog = await createCatalogFixture();

    const [offer] = await db
      .insert(sourceOffers)
      .values({
        retailerId: catalog.retailer.id,
        sourceUrl: "https://demo-retailer.example/p/samba-42",
        productVariantId: catalog.variant.id,
        rawTitle: "Adidas Samba OG 42",
        sourcePriceEurCents: 10_995n,
        shippingEurCents: 0n,
        stockStatus: "IN_STOCK",
        sourceVerified: true,
      })
      .returning();
    if (!offer) throw new Error("Offer fixture failed");

    const user = await createUserWithPassword(db, {
      email: "checkout@example.com",
      passwordHash: "$argon2id$test-only-hash",
      displayName: null,
    });
    if (!user) throw new Error("User fixture failed");

    const [address] = await db
      .insert(addresses)
      .values({
        userId: user.id,
        recipientName: "گیرنده آزمایشی",
        phoneE164: "+989120000009",
        province: "تهران",
        city: "تهران",
        addressLine: "خیابان نمونه",
      })
      .returning();
    if (!address) throw new Error("Address fixture failed");

    const [rate] = await db
      .insert(fxRates)
      .values({
        provider: "fake",
        tomanPerUnit: 200_000n,
        providerTimestamp: new Date(),
      })
      .returning();
    if (!rate) throw new Error("FX fixture failed");

    const cart = await ensureActiveCart(db, { userId: user.id });
    return { ...catalog, offer, user, address, rate, cart };
  }

  type CheckoutFixture = Awaited<ReturnType<typeof createCheckoutFixture>>;

  /**
   * A quote whose money satisfies the same invariants the checkout service
   * produces: the components add up to the line total and the split
   * reconstructs the final amount.
   */
  async function persistTestQuote(
    fixture: CheckoutFixture,
    overrides: { readonly expiresAt?: Date } = {},
  ) {
    const lineTotal = 30_000_000n;
    const deposit = 10_500_000n;
    return persistQuote(db, {
      userId: fixture.user.id,
      cartId: fixture.cart.id,
      fxRateId: fixture.rate.id,
      fxTomanPerEur: 200_000n,
      subtotalToman: 22_000_000n,
      finalToman: lineTotal,
      depositToman: deposit,
      appliedRuleIds: [],
      calculationVersion: "test-v1",
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 10 * 60 * 1000),
      lines: [
        {
          sourceOfferId: fixture.offer.id,
          productVariantId: fixture.variant.id,
          quantity: 1,
          sourcePriceEurCents: 10_995n,
          shippingEurCents: 0n,
          sourceTomanTotal: 22_000_000n,
          transportToman: 1_600_000n,
          customsRiskToman: 880_000n,
          localDeliveryToman: 0n,
          paymentFeeToman: 1_050_000n,
          marginToman: 4_470_000n,
          lineTotalToman: lineTotal,
          observedAt: new Date(),
          breakdown: {
            titleFa: "کفش آدیداس سامبا",
            titleOriginal: "Adidas Samba OG",
            brand: "Adidas",
            variant: "سایز ۴۲",
            retailer: "Demo Retailer",
            sourceUrl: fixture.offer.sourceUrl,
          },
        },
      ],
    });
  }

  it("keeps a single active cart per owner", async () => {
    const fixture = await createCheckoutFixture();
    const again = await ensureActiveCart(db, { userId: fixture.user.id });
    expect(again.id).toBe(fixture.cart.id);
    expect(await db.select().from(carts)).toHaveLength(1);
  });

  it("refuses to add an offer that is not purchasable", async () => {
    const fixture = await createCheckoutFixture();

    const [unverified] = await db
      .insert(sourceOffers)
      .values({
        retailerId: fixture.retailer.id,
        sourceUrl: "https://demo-retailer.example/p/unverified",
        productVariantId: fixture.variant.id,
        rawTitle: "Unverified",
        sourcePriceEurCents: 9_000n,
        stockStatus: "IN_STOCK",
        sourceVerified: false,
      })
      .returning();

    await expect(
      addCartItem(db, {
        cartId: fixture.cart.id,
        productVariantId: fixture.variant.id,
        sourceOfferId: unverified!.id,
      }),
    ).resolves.toBe(false);
    expect(await db.select().from(cartItems)).toHaveLength(0);
  });

  it("merges a repeated add and caps the quantity", async () => {
    const fixture = await createCheckoutFixture();
    const add = () =>
      addCartItem(db, {
        cartId: fixture.cart.id,
        productVariantId: fixture.variant.id,
        sourceOfferId: fixture.offer.id,
        quantity: 6,
      });

    expect(await add()).toBe(true);
    expect(await add()).toBe(true);

    const rows = await db.select().from(cartItems);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.quantity).toBe(10);
  });

  it("updates and removes a cart line", async () => {
    const fixture = await createCheckoutFixture();
    await addCartItem(db, {
      cartId: fixture.cart.id,
      productVariantId: fixture.variant.id,
      sourceOfferId: fixture.offer.id,
    });

    const [line] = await listCartDetails(db, fixture.cart.id);
    expect(line?.quantity).toBe(1);

    await updateCartItemQuantity(db, {
      cartId: fixture.cart.id,
      itemId: line!.itemId,
      quantity: 3,
    });
    const [updated] = await listCartDetails(db, fixture.cart.id);
    expect(updated?.quantity).toBe(3);

    await removeCartItem(db, {
      cartId: fixture.cart.id,
      itemId: line!.itemId,
    });
    expect(await listCartDetails(db, fixture.cart.id)).toHaveLength(0);
  });

  it("stores an immutable quote whose split reconstructs the total", async () => {
    const fixture = await createCheckoutFixture();
    const quote = await persistTestQuote(fixture);

    expect(quote.depositToman + quote.balanceToman).toBe(quote.finalToman);

    const stored = await getQuoteWithItems(db, quote.id);
    expect(stored?.items).toHaveLength(1);
    expect(stored?.quote.calculationVersion).toBe("test-v1");
    expect(stored?.quote.fxTomanPerEur).toBe(200_000n);
  });

  it("cancels a previous active quote for the same cart", async () => {
    const fixture = await createCheckoutFixture();
    const first = await persistTestQuote(fixture);
    const second = await persistTestQuote(fixture);

    const rows = await db.select().from(quotes);
    const byId = new Map(rows.map((row) => [row.id, row.status]));
    expect(byId.get(first.id)).toBe("CANCELLED");
    expect(byId.get(second.id)).toBe("ACTIVE");
  });

  it("creates an order from a valid quote and consumes it", async () => {
    const fixture = await createCheckoutFixture();
    const quote = await persistTestQuote(fixture);

    const order = await createOrderFromQuote(db, {
      quoteId: quote.id,
      userId: fixture.user.id,
      addressId: fixture.address.id,
    });

    expect(order.status).toBe("DEPOSIT_PENDING");
    expect(order.totalLockedToman).toBe(quote.finalToman);
    expect(order.depositRequiredToman).toBe(quote.depositToman);
    expect(order.depositRequiredToman + order.balanceDueToman).toBe(
      order.totalLockedToman,
    );

    const [storedQuote] = await db.select().from(quotes);
    expect(storedQuote?.status).toBe("CONSUMED");

    const [storedCart] = await db.select().from(carts);
    expect(storedCart?.status).toBe("CONVERTED");

    // The line snapshot is frozen onto the order, not re-read from the offer.
    const [item] = await db.select().from(orderItems);
    expect(item?.productSnapshot.titleFa).toBe("کفش آدیداس سامبا");
    expect(item?.offerSnapshot.retailer).toBe("Demo Retailer");
  });

  it("refuses to reuse a consumed quote", async () => {
    const fixture = await createCheckoutFixture();
    const quote = await persistTestQuote(fixture);
    const input = {
      quoteId: quote.id,
      userId: fixture.user.id,
      addressId: fixture.address.id,
    };

    await createOrderFromQuote(db, input);
    await expect(createOrderFromQuote(db, input)).rejects.toThrow(
      /QUOTE_UNAVAILABLE/,
    );
    expect(await db.select().from(orders)).toHaveLength(1);
  });

  it("refuses an expired quote", async () => {
    const fixture = await createCheckoutFixture();
    const quote = await persistTestQuote(fixture, {
      expiresAt: new Date(Date.now() - 1_000),
    });

    await expect(
      createOrderFromQuote(db, {
        quoteId: quote.id,
        userId: fixture.user.id,
        addressId: fixture.address.id,
      }),
    ).rejects.toThrow(/QUOTE_UNAVAILABLE/);
  });

  it("refuses an address that belongs to someone else", async () => {
    const fixture = await createCheckoutFixture();
    const quote = await persistTestQuote(fixture);
    const stranger = await createUserWithPassword(db, {
      email: "stranger@example.com",
      passwordHash: "$argon2id$test-only-hash",
      displayName: null,
    });
    const [foreign] = await db
      .insert(addresses)
      .values({
        userId: stranger!.id,
        recipientName: "دیگری",
        phoneE164: "+989120000010",
        province: "تهران",
        city: "تهران",
        addressLine: "آدرس دیگری",
      })
      .returning();

    await expect(
      createOrderFromQuote(db, {
        quoteId: quote.id,
        userId: fixture.user.id,
        addressId: foreign!.id,
      }),
    ).rejects.toThrow(/ADDRESS_INVALID/);
  });

  it("refuses to lock an order when the source price moved", async () => {
    const fixture = await createCheckoutFixture();
    const quote = await persistTestQuote(fixture);

    // The retailer raised the price after the quote was issued.
    await db
      .update(sourceOffers)
      .set({ sourcePriceEurCents: 12_995n })
      .where(sql`${sourceOffers.id} = ${fixture.offer.id}`);

    await expect(
      createOrderFromQuote(db, {
        quoteId: quote.id,
        userId: fixture.user.id,
        addressId: fixture.address.id,
      }),
    ).rejects.toThrow(/SOURCE_CHANGED/);
    expect(await db.select().from(orders)).toHaveLength(0);
  });

  it("refuses to lock an order when the source went out of stock", async () => {
    const fixture = await createCheckoutFixture();
    const quote = await persistTestQuote(fixture);

    await db
      .update(sourceOffers)
      .set({ stockStatus: "OUT_OF_STOCK" })
      .where(sql`${sourceOffers.id} = ${fixture.offer.id}`);

    await expect(
      createOrderFromQuote(db, {
        quoteId: quote.id,
        userId: fixture.user.id,
        addressId: fixture.address.id,
      }),
    ).rejects.toThrow(/SOURCE_CHANGED/);
  });

  it("returns the same payment intent for a repeated idempotency key", async () => {
    const fixture = await createCheckoutFixture();
    const quote = await persistTestQuote(fixture);
    const order = await createOrderFromQuote(db, {
      quoteId: quote.id,
      userId: fixture.user.id,
      addressId: fixture.address.id,
    });

    const intent = {
      orderId: order.id,
      method: "GATEWAY" as const,
      provider: "fake",
      amountToman: order.depositRequiredToman,
      idempotencyKey: `deposit:${order.id}:GATEWAY`,
    };

    const first = await createPaymentIntent(db, intent);
    const second = await createPaymentIntent(db, intent);

    expect(second.id).toBe(first.id);
    expect(first.status).toBe("INITIATED");
    expect(await db.select().from(payments)).toHaveLength(1);
  });

  it("captures a gateway deposit once and moves the order to procurement", async () => {
    const fixture = await createCheckoutFixture();
    const quote = await persistTestQuote(fixture);
    const order = await createOrderFromQuote(db, {
      quoteId: quote.id,
      userId: fixture.user.id,
      addressId: fixture.address.id,
    });
    const payment = await createPaymentIntent(db, {
      orderId: order.id,
      method: "GATEWAY",
      provider: "fake",
      amountToman: order.depositRequiredToman,
      idempotencyKey: `deposit:${order.id}:GATEWAY`,
    });
    await setPaymentAuthority(db, {
      paymentId: payment.id,
      authority: "AUTH-1",
    });

    const capture = {
      authority: "AUTH-1",
      providerReference: "REF-1",
      amountToman: order.depositRequiredToman,
    };

    const first = await completeGatewayDeposit(db, capture);
    expect(first.applied).toBe(true);
    expect(first.payment.status).toBe("SUCCEEDED");

    // A retried gateway callback must not capture the money twice.
    const replay = await completeGatewayDeposit(db, capture);
    expect(replay.applied).toBe(false);

    const [reloaded] = await db.select().from(orders);
    expect(reloaded?.status).toBe("PROCUREMENT_PENDING");
    expect(reloaded?.depositPaidToman).toBe(order.depositRequiredToman);
    expect(await db.select().from(purchaseTasks)).toHaveLength(1);

    const events = await db.select().from(outboxEvents);
    expect(
      events.filter((event) => event.eventType === "order.deposit_paid"),
    ).toHaveLength(1);

    const history = await listOrderStatusHistory(db, order.id);
    const statuses = history.map((row) => row.toStatus);
    expect(statuses).toContain("DEPOSIT_PAID");
    expect(statuses).toContain("PROCUREMENT_PENDING");
  });

  it("rejects a callback whose amount does not match the intent", async () => {
    const fixture = await createCheckoutFixture();
    const quote = await persistTestQuote(fixture);
    const order = await createOrderFromQuote(db, {
      quoteId: quote.id,
      userId: fixture.user.id,
      addressId: fixture.address.id,
    });
    const payment = await createPaymentIntent(db, {
      orderId: order.id,
      method: "GATEWAY",
      provider: "fake",
      amountToman: order.depositRequiredToman,
      idempotencyKey: `deposit:${order.id}:GATEWAY`,
    });
    await setPaymentAuthority(db, {
      paymentId: payment.id,
      authority: "AUTH-2",
    });

    await expect(
      completeGatewayDeposit(db, {
        authority: "AUTH-2",
        providerReference: "REF-2",
        amountToman: 1n,
      }),
    ).rejects.toThrow(/AMOUNT_MISMATCH/);

    const [reloaded] = await db.select().from(orders);
    expect(reloaded?.status).toBe("DEPOSIT_PENDING");
    expect(reloaded?.depositPaidToman).toBe(0n);
  });

  it("finds a payment by its gateway authority", async () => {
    const fixture = await createCheckoutFixture();
    const quote = await persistTestQuote(fixture);
    const order = await createOrderFromQuote(db, {
      quoteId: quote.id,
      userId: fixture.user.id,
      addressId: fixture.address.id,
    });
    const payment = await createPaymentIntent(db, {
      orderId: order.id,
      method: "GATEWAY",
      provider: "fake",
      amountToman: order.depositRequiredToman,
      idempotencyKey: `deposit:${order.id}:GATEWAY`,
    });
    await setPaymentAuthority(db, {
      paymentId: payment.id,
      authority: "AUTH-3",
    });

    expect((await findPaymentByAuthority(db, "AUTH-3"))?.id).toBe(payment.id);
    expect(await findPaymentByAuthority(db, "AUTH-MISSING")).toBeNull();
  });

  it("accepts a card-to-card receipt and moves the payment to verification", async () => {
    const fixture = await createCheckoutFixture();
    const quote = await persistTestQuote(fixture);
    const order = await createOrderFromQuote(db, {
      quoteId: quote.id,
      userId: fixture.user.id,
      addressId: fixture.address.id,
    });
    const payment = await createPaymentIntent(db, {
      orderId: order.id,
      method: "CARD_TO_CARD",
      provider: "manual",
      amountToman: order.depositRequiredToman,
      idempotencyKey: `deposit:${order.id}:CARD_TO_CARD`,
    });

    // A fresh card-to-card intent must be uploadable straight away.
    const owned = await findOwnedPayment(db, {
      paymentId: payment.id,
      userId: fixture.user.id,
    });
    expect(owned?.payment.status).toBe("INITIATED");

    await submitPaymentReceipt(db, {
      paymentId: payment.id,
      userId: fixture.user.id,
      storageKey: "payment-receipts/test/receipt.jpg",
      contentType: "image/jpeg",
      byteSize: 2_048,
    });

    const [stored] = await db.select().from(payments);
    expect(stored?.status).toBe("PENDING_VERIFICATION");
    expect(await db.select().from(paymentReceipts)).toHaveLength(1);

    // A receipt alone never credits money to the order.
    const [reloaded] = await db.select().from(orders);
    expect(reloaded?.depositPaidToman).toBe(0n);
    expect(reloaded?.status).toBe("DEPOSIT_PENDING");
  });

  it("approves a card receipt atomically and creates an audited procurement task", async () => {
    const fixture = await createCheckoutFixture();
    const quote = await persistTestQuote(fixture);
    const order = await createOrderFromQuote(db, {
      quoteId: quote.id,
      userId: fixture.user.id,
      addressId: fixture.address.id,
    });
    const payment = await createPaymentIntent(db, {
      orderId: order.id,
      method: "CARD_TO_CARD",
      provider: "manual",
      amountToman: order.depositRequiredToman,
      idempotencyKey: `review:${order.id}:approve`,
    });
    await submitPaymentReceipt(db, {
      paymentId: payment.id,
      userId: fixture.user.id,
      storageKey: "payment-receipts/test/approve.jpg",
      contentType: "image/jpeg",
      byteSize: 2_048,
    });
    const [reviewer] = await db
      .insert(users)
      .values({ email: "finance@example.com", role: "FINANCE" })
      .returning();
    if (!reviewer) throw new Error("Reviewer fixture missing");

    await reviewCardPayment(db, {
      paymentId: payment.id,
      actorUserId: reviewer.id,
      decision: "APPROVE",
      reason: "مبلغ و رسید تطبیق داده شد",
    });

    const [storedPayment] = await db.select().from(payments);
    const [storedOrder] = await db.select().from(orders);
    const [receipt] = await db.select().from(paymentReceipts);
    const tasks = await db.select().from(purchaseTasks);
    const audit = await db.select().from(adminAuditLog);
    expect(storedPayment?.status).toBe("SUCCEEDED");
    expect(storedOrder?.status).toBe("PROCUREMENT_PENDING");
    expect(storedOrder?.depositPaidToman).toBe(order.depositRequiredToman);
    expect(receipt?.reviewedByUserId).toBe(reviewer.id);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.status).toBe("OPEN");
    expect(audit[0]?.action).toBe("payment.card_receipt_approved");

    const itemId = tasks[0]?.orderItemId;
    if (!itemId) throw new Error("Purchase task fixture missing");
    await updateProcurementItem(db, {
      orderItemId: itemId,
      actorUserId: reviewer.id,
      action: "ASSIGN_TO_SELF",
    });
    await updateProcurementItem(db, {
      orderItemId: itemId,
      actorUserId: reviewer.id,
      action: "START",
    });
    await updateProcurementItem(db, {
      orderItemId: itemId,
      actorUserId: reviewer.id,
      action: "MARK_UNAVAILABLE",
      reason: "کالا در منبع ثبت‌شده موجود نبود",
    });
    const [updatedTask] = await db.select().from(purchaseTasks);
    const [updatedItem] = await db.select().from(orderItems);
    expect(updatedTask?.status).toBe("BLOCKED");
    expect(updatedItem?.procurementStatus).toBe("UNAVAILABLE");
    expect(await db.select().from(adminAuditLog)).toHaveLength(4);
  });

  it("rejects a card receipt with a reason without crediting the order", async () => {
    const fixture = await createCheckoutFixture();
    const quote = await persistTestQuote(fixture);
    const order = await createOrderFromQuote(db, {
      quoteId: quote.id,
      userId: fixture.user.id,
      addressId: fixture.address.id,
    });
    const payment = await createPaymentIntent(db, {
      orderId: order.id,
      method: "CARD_TO_CARD",
      provider: "manual",
      amountToman: order.depositRequiredToman,
      idempotencyKey: `review:${order.id}:reject`,
    });
    await submitPaymentReceipt(db, {
      paymentId: payment.id,
      userId: fixture.user.id,
      storageKey: "payment-receipts/test/reject.jpg",
      contentType: "image/jpeg",
      byteSize: 2_048,
    });
    const [reviewer] = await db
      .insert(users)
      .values({ email: "finance-reject@example.com", role: "FINANCE" })
      .returning();
    if (!reviewer) throw new Error("Reviewer fixture missing");

    await reviewCardPayment(db, {
      paymentId: payment.id,
      actorUserId: reviewer.id,
      decision: "REJECT",
      reason: "مبلغ رسید با درخواست تطبیق ندارد",
    });

    const [storedPayment] = await db.select().from(payments);
    const [storedOrder] = await db.select().from(orders);
    expect(storedPayment?.status).toBe("FAILED");
    expect(storedOrder?.status).toBe("DEPOSIT_PENDING");
    expect(storedOrder?.depositPaidToman).toBe(0n);
    expect(await db.select().from(purchaseTasks)).toEqual([]);
    expect((await db.select().from(adminAuditLog))[0]?.action).toBe(
      "payment.card_receipt_rejected",
    );
  });

  it("does not expose a payment or order to another customer", async () => {
    const fixture = await createCheckoutFixture();
    const quote = await persistTestQuote(fixture);
    const order = await createOrderFromQuote(db, {
      quoteId: quote.id,
      userId: fixture.user.id,
      addressId: fixture.address.id,
    });
    const payment = await createPaymentIntent(db, {
      orderId: order.id,
      method: "CARD_TO_CARD",
      provider: "manual",
      amountToman: order.depositRequiredToman,
      idempotencyKey: `deposit:${order.id}:CARD_TO_CARD`,
    });
    const stranger = await createUserWithPassword(db, {
      email: "stranger2@example.com",
      passwordHash: "$argon2id$test-only-hash",
      displayName: null,
    });

    expect(
      await findOwnedPayment(db, {
        paymentId: payment.id,
        userId: stranger!.id,
      }),
    ).toBeNull();
    expect(await getOwnedOrder(db, order.id, stranger!.id)).toBeNull();
    expect(await getOwnedOrder(db, order.id, fixture.user.id)).not.toBeNull();
  });
});
