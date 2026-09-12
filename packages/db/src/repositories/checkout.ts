import { randomUUID } from "node:crypto";

import {
  assertOrderTransition,
  orderStateMachine,
  paymentStateMachine,
} from "@rava/domain";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import type { Database } from "../client";
import {
  addresses,
  brands,
  cartItems,
  carts,
  categories,
  localDeliveries,
  orderItems,
  orderStatusHistory,
  orders,
  outboxEvents,
  paymentReceipts,
  payments,
  productMedia,
  products,
  productVariants,
  quoteItems,
  quotes,
  retailers,
  sourceOffers,
  trips,
} from "../schema";
import type { Executor } from "./executor";
import { ensurePurchaseTasksForOrder } from "./procurement";

export interface CartOwner {
  readonly userId?: string | null;
  readonly anonymousKey?: string | null;
}

function ownerPredicate(owner: CartOwner) {
  if (owner.anonymousKey) return eq(carts.anonymousKey, owner.anonymousKey);
  if (owner.userId) return eq(carts.userId, owner.userId);
  return sql`false`;
}

export async function getActiveCart(executor: Executor, owner: CartOwner) {
  const [cart] = await executor
    .select()
    .from(carts)
    .where(and(ownerPredicate(owner), eq(carts.status, "ACTIVE")))
    .orderBy(desc(carts.updatedAt))
    .limit(1);
  return cart ?? null;
}

export async function ensureActiveCart(executor: Executor, owner: CartOwner) {
  const existing = await getActiveCart(executor, owner);
  if (existing) return existing;
  if (!owner.userId && !owner.anonymousKey)
    throw new Error("Cart owner missing");
  const [created] = await executor
    .insert(carts)
    .values({
      userId: owner.anonymousKey ? null : (owner.userId ?? null),
      anonymousKey: owner.anonymousKey ?? null,
    })
    .returning();
  if (!created) throw new Error("Cart insert did not return a row");
  return created;
}

/** Moves an anonymous cart into the signed-in account, merging duplicate variants. */
export async function claimAnonymousCart(
  db: Database,
  input: { readonly anonymousKey: string; readonly userId: string },
) {
  return db.transaction(async (tx) => {
    const [anonymousCart] = await tx
      .select()
      .from(carts)
      .where(
        and(
          eq(carts.anonymousKey, input.anonymousKey),
          eq(carts.status, "ACTIVE"),
        ),
      )
      .for("update")
      .limit(1);
    if (!anonymousCart) return null;

    const [userCart] = await tx
      .select()
      .from(carts)
      .where(and(eq(carts.userId, input.userId), eq(carts.status, "ACTIVE")))
      .orderBy(desc(carts.updatedAt))
      .for("update")
      .limit(1);
    if (!userCart) {
      const [claimed] = await tx
        .update(carts)
        .set({
          userId: input.userId,
          anonymousKey: null,
          updatedAt: new Date(),
        })
        .where(eq(carts.id, anonymousCart.id))
        .returning();
      return claimed ?? null;
    }

    const anonymousItems = await tx
      .select()
      .from(cartItems)
      .where(eq(cartItems.cartId, anonymousCart.id));
    for (const item of anonymousItems) {
      await tx
        .insert(cartItems)
        .values({
          cartId: userCart.id,
          productVariantId: item.productVariantId,
          sourceOfferId: item.sourceOfferId,
          quantity: item.quantity,
        })
        .onConflictDoUpdate({
          target: [cartItems.cartId, cartItems.productVariantId],
          set: {
            quantity: sql`least(10, ${cartItems.quantity} + ${item.quantity})`,
            sourceOfferId: item.sourceOfferId,
            updatedAt: new Date(),
          },
        });
    }
    await tx
      .update(carts)
      .set({ status: "ABANDONED", anonymousKey: null, updatedAt: new Date() })
      .where(eq(carts.id, anonymousCart.id));
    await tx
      .update(carts)
      .set({ updatedAt: new Date() })
      .where(eq(carts.id, userCart.id));
    return userCart;
  });
}

export async function addCartItem(
  executor: Executor,
  input: {
    readonly cartId: string;
    readonly productVariantId: string;
    /** Null for a manually priced variant, which has no supplier offer. */
    readonly sourceOfferId: string | null;
    readonly quantity?: number;
  },
): Promise<boolean> {
  const quantity = Math.min(10, Math.max(1, Math.trunc(input.quantity ?? 1)));
  const offerId = input.sourceOfferId;

  // Two ways a variant can be purchasable, checked server-side either way:
  // a manual Toman price set by an operator, or a verified in-stock offer.
  const candidate =
    offerId === null
      ? (
          await executor
            .select({ variantId: productVariants.id })
            .from(productVariants)
            .where(
              and(
                eq(productVariants.id, input.productVariantId),
                eq(productVariants.status, "ACTIVE"),
                sql`${productVariants.manualPriceToman} is not null`,
                sql`coalesce(${productVariants.manualStockStatus}, 'IN_STOCK') in ('IN_STOCK', 'LOW_STOCK', 'PREORDER')`,
              ),
            )
            .limit(1)
        )[0]
      : (
          await executor
            .select({ variantId: productVariants.id })
            .from(productVariants)
            .innerJoin(
              sourceOffers,
              and(
                eq(sourceOffers.id, offerId),
                eq(sourceOffers.productVariantId, productVariants.id),
              ),
            )
            .where(
              and(
                eq(productVariants.id, input.productVariantId),
                eq(productVariants.status, "ACTIVE"),
                eq(sourceOffers.sourceVerified, true),
                sql`${sourceOffers.stockStatus} in ('IN_STOCK', 'LOW_STOCK')`,
              ),
            )
            .limit(1)
        )[0];
  if (!candidate) return false;

  await executor
    .insert(cartItems)
    .values({
      cartId: input.cartId,
      productVariantId: input.productVariantId,
      sourceOfferId: offerId,
      quantity,
    })
    .onConflictDoUpdate({
      target: [cartItems.cartId, cartItems.productVariantId],
      set: {
        sourceOfferId: offerId,
        quantity: sql`least(10, ${cartItems.quantity} + ${quantity})`,
        updatedAt: new Date(),
      },
    });
  await executor
    .update(carts)
    .set({ updatedAt: new Date() })
    .where(eq(carts.id, input.cartId));
  return true;
}

export async function updateCartItemQuantity(
  executor: Executor,
  input: {
    readonly cartId: string;
    readonly itemId: string;
    readonly quantity: number;
  },
) {
  const quantity = Math.min(10, Math.max(1, Math.trunc(input.quantity)));
  await executor
    .update(cartItems)
    .set({ quantity, updatedAt: new Date() })
    .where(
      and(eq(cartItems.id, input.itemId), eq(cartItems.cartId, input.cartId)),
    );
}

export async function removeCartItem(
  executor: Executor,
  input: { readonly cartId: string; readonly itemId: string },
) {
  await executor
    .delete(cartItems)
    .where(
      and(eq(cartItems.id, input.itemId), eq(cartItems.cartId, input.cartId)),
    );
}

export async function listCartDetails(executor: Executor, cartId: string) {
  return (
    executor
      .select({
        itemId: cartItems.id,
        cartId: cartItems.cartId,
        quantity: cartItems.quantity,
        variantId: productVariants.id,
        variantSize: productVariants.size,
        variantColor: productVariants.color,
        variantVolumeMl: productVariants.volumeMl,
        variantSku: productVariants.skuInternal,
        productId: products.id,
        productSlug: products.slug,
        titleFa: products.titleFa,
        titleOriginal: products.titleOriginal,
        weightGrams: products.weightGrams,
        transportClass: products.transportClass,
        brandId: brands.id,
        brandName: brands.name,
        categoryId: categories.id,
        categoryNameFa: categories.nameFa,
        categoryTransportClass: categories.defaultTransportClass,
        imageUrl: sql<
          string | null
        >`coalesce(${productMedia.storageKey}, ${productMedia.sourceUrl})`,
        manualPriceToman: productVariants.manualPriceToman,
        manualStockStatus: productVariants.manualStockStatus,
        offerId: sourceOffers.id,
        sourceUrl: sourceOffers.sourceUrl,
        sourcePriceEurCents: sourceOffers.sourcePriceEurCents,
        shippingEurCents: sourceOffers.shippingEurCents,
        stockStatus: sourceOffers.stockStatus,
        sourceVerified: sourceOffers.sourceVerified,
        observedAt: sourceOffers.lastSeenAt,
        retailerName: retailers.name,
        retailerTrustTier: retailers.trustTier,
      })
      .from(cartItems)
      .innerJoin(
        productVariants,
        eq(cartItems.productVariantId, productVariants.id),
      )
      .innerJoin(products, eq(productVariants.productId, products.id))
      .innerJoin(brands, eq(products.brandId, brands.id))
      .innerJoin(categories, eq(products.categoryId, categories.id))
      // Left joins: a manually priced line has no offer and no retailer, and
      // must still appear in the cart.
      .leftJoin(sourceOffers, eq(cartItems.sourceOfferId, sourceOffers.id))
      .leftJoin(retailers, eq(sourceOffers.retailerId, retailers.id))
      .leftJoin(
        productMedia,
        and(
          eq(productMedia.productId, products.id),
          eq(productMedia.kind, "PRIMARY"),
        ),
      )
      .where(eq(cartItems.cartId, cartId))
      .orderBy(cartItems.createdAt)
  );
}

export interface QuoteLineSnapshot {
  /** Null for a manually priced line. */
  readonly sourceOfferId: string | null;
  readonly productVariantId: string;
  readonly quantity: number;
  readonly sourcePriceEurCents: bigint;
  readonly shippingEurCents: bigint;
  readonly sourceTomanTotal: bigint;
  readonly transportToman: bigint;
  readonly customsRiskToman: bigint;
  readonly localDeliveryToman: bigint;
  readonly paymentFeeToman: bigint;
  readonly marginToman: bigint;
  readonly lineTotalToman: bigint;
  /** For a manual line this is the moment the price was quoted. */
  readonly observedAt: Date;
  readonly breakdown: Record<string, string>;
}

export async function persistQuote(
  db: Database,
  input: {
    readonly userId: string;
    readonly cartId: string;
    /** Null when every line is manually priced: there is no EUR leg. */
    readonly fxRateId: string | null;
    readonly fxTomanPerEur: bigint | null;
    readonly subtotalToman: bigint;
    readonly finalToman: bigint;
    readonly depositToman: bigint;
    readonly appliedRuleIds: readonly string[];
    readonly calculationVersion: string;
    readonly expiresAt: Date;
    readonly lines: readonly QuoteLineSnapshot[];
  },
) {
  return db.transaction(async (tx) => {
    const [ownedCart] = await tx
      .select({ id: carts.id })
      .from(carts)
      .where(and(eq(carts.id, input.cartId), eq(carts.userId, input.userId)))
      .limit(1);
    if (!ownedCart) throw new Error("CART_INVALID");
    await tx
      .update(quotes)
      .set({ status: "CANCELLED" })
      .where(and(eq(quotes.cartId, input.cartId), eq(quotes.status, "ACTIVE")));
    const [quote] = await tx
      .insert(quotes)
      .values({
        userId: input.userId,
        cartId: input.cartId,
        fxRateId: input.fxRateId,
        fxTomanPerEur: input.fxTomanPerEur,
        subtotalToman: input.subtotalToman,
        finalToman: input.finalToman,
        depositToman: input.depositToman,
        balanceToman: input.finalToman - input.depositToman,
        appliedRuleIds: input.appliedRuleIds,
        calculationVersion: input.calculationVersion,
        expiresAt: input.expiresAt,
      })
      .returning();
    if (!quote) throw new Error("Quote insert did not return a row");
    await tx
      .insert(quoteItems)
      .values(input.lines.map((line) => ({ quoteId: quote.id, ...line })));
    return quote;
  });
}

export async function createOrderFromQuote(
  db: Database,
  input: {
    readonly quoteId: string;
    readonly userId: string;
    readonly addressId: string;
  },
) {
  return db.transaction(async (tx) => {
    const [quote] = await tx
      .select()
      .from(quotes)
      .where(and(eq(quotes.id, input.quoteId), eq(quotes.userId, input.userId)))
      .for("update")
      .limit(1);
    if (!quote || quote.status !== "ACTIVE" || quote.expiresAt <= new Date()) {
      throw new Error("QUOTE_UNAVAILABLE");
    }
    const [address] = await tx
      .select({ id: addresses.id })
      .from(addresses)
      .where(
        and(
          eq(addresses.id, input.addressId),
          eq(addresses.userId, input.userId),
          isNull(addresses.deletedAt),
        ),
      )
      .limit(1);
    if (!address) throw new Error("ADDRESS_INVALID");
    const lines = await tx
      .select()
      .from(quoteItems)
      .where(eq(quoteItems.quoteId, quote.id));
    if (lines.length === 0) throw new Error("QUOTE_EMPTY");

    for (const line of lines) {
      // A manually priced line is re-verified against the variant's own price,
      // so a price the operator changed after quoting cannot be locked in.
      if (line.sourceOfferId === null) {
        const [variant] = await tx
          .select({
            manualPriceToman: productVariants.manualPriceToman,
            manualStockStatus: productVariants.manualStockStatus,
            status: productVariants.status,
          })
          .from(productVariants)
          .where(eq(productVariants.id, line.productVariantId!))
          .limit(1);
        const unitToman = line.lineTotalToman / BigInt(line.quantity);
        if (
          !variant ||
          variant.status !== "ACTIVE" ||
          variant.manualPriceToman === null ||
          variant.manualPriceToman !== unitToman ||
          !["IN_STOCK", "LOW_STOCK", "PREORDER"].includes(
            variant.manualStockStatus ?? "IN_STOCK",
          )
        ) {
          throw new Error("SOURCE_CHANGED");
        }
        continue;
      }
      const [offer] = await tx
        .select()
        .from(sourceOffers)
        .where(eq(sourceOffers.id, line.sourceOfferId))
        .limit(1);
      if (
        !offer ||
        !offer.sourceVerified ||
        !["IN_STOCK", "LOW_STOCK"].includes(offer.stockStatus) ||
        offer.sourcePriceEurCents !== line.sourcePriceEurCents ||
        (offer.shippingEurCents ?? 0n) !== line.shippingEurCents
      ) {
        throw new Error("SOURCE_CHANGED");
      }
    }

    const orderNumber = `RAVA-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const [order] = await tx
      .insert(orders)
      .values({
        orderNumber,
        userId: input.userId,
        quoteId: quote.id,
        shippingAddressId: address.id,
        status: "DEPOSIT_PENDING",
        totalLockedToman: quote.finalToman,
        depositRequiredToman: quote.depositToman,
        balanceDueToman: quote.balanceToman,
        placedAt: new Date(),
      })
      .returning();
    if (!order) throw new Error("Order insert did not return a row");

    await tx.insert(orderItems).values(
      lines.map((line) => ({
        orderId: order.id,
        productVariantId: line.productVariantId,
        sourceOfferId: line.sourceOfferId,
        productSnapshot: {
          titleFa: line.breakdown.titleFa ?? "محصول",
          titleOriginal: line.breakdown.titleOriginal ?? "",
          brand: line.breakdown.brand ?? "",
          variant: { label: line.breakdown.variant ?? "" },
        },
        // Null rather than a blank retailer: a manually priced line genuinely
        // had no supplier offer, and unknown must stay unknown.
        offerSnapshot:
          line.sourceOfferId === null
            ? null
            : {
                retailer: line.breakdown.retailer ?? "",
                sourceUrl: line.breakdown.sourceUrl ?? "",
                priceEurCents: line.sourcePriceEurCents.toString(),
                observedAt: line.observedAt.toISOString(),
              },
        quantity: line.quantity,
        unitTotalToman: line.lineTotalToman / BigInt(line.quantity),
        lineTotalToman: line.lineTotalToman,
        maxSourcePriceEurCents:
          line.sourceOfferId === null ? null : line.sourcePriceEurCents,
        sourceStockStatus: "IN_STOCK" as const,
      })),
    );
    await tx.insert(orderStatusHistory).values([
      {
        orderId: order.id,
        fromStatus: null,
        toStatus: "DRAFT",
        note: "ایجاد از قیمت قطعی",
      },
      { orderId: order.id, fromStatus: "DRAFT", toStatus: "QUOTE_PENDING" },
      { orderId: order.id, fromStatus: "QUOTE_PENDING", toStatus: "QUOTED" },
      { orderId: order.id, fromStatus: "QUOTED", toStatus: "DEPOSIT_PENDING" },
    ]);
    await tx
      .update(quotes)
      .set({ status: "CONSUMED" })
      .where(eq(quotes.id, quote.id));
    if (quote.cartId)
      await tx
        .update(carts)
        .set({ status: "CONVERTED" })
        .where(eq(carts.id, quote.cartId));
    return order;
  });
}

export async function createPaymentIntent(
  executor: Executor,
  input: {
    readonly orderId: string;
    readonly type?: "DEPOSIT" | "BALANCE";
    readonly method: "GATEWAY" | "CARD_TO_CARD";
    readonly provider: string;
    readonly amountToman: bigint;
    readonly idempotencyKey: string;
  },
) {
  const [payment] = await executor
    .insert(payments)
    .values({ ...input, type: input.type ?? "DEPOSIT", status: "INITIATED" })
    .onConflictDoNothing({ target: payments.idempotencyKey })
    .returning();
  if (payment) return payment;
  const [existing] = await executor
    .select()
    .from(payments)
    .where(eq(payments.idempotencyKey, input.idempotencyKey))
    .limit(1);
  if (!existing) throw new Error("Payment intent was not persisted");
  return existing;
}

export async function setPaymentAuthority(
  executor: Executor,
  input: { readonly paymentId: string; readonly authority: string },
) {
  await executor
    .update(payments)
    .set({
      providerAuthority: input.authority,
      status: "PENDING_VERIFICATION",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(payments.id, input.paymentId),
        inArray(payments.status, ["INITIATED", "PENDING_VERIFICATION"]),
      ),
    );
}

export async function findPaymentByAuthority(
  executor: Executor,
  authority: string,
) {
  const [payment] = await executor
    .select()
    .from(payments)
    .where(eq(payments.providerAuthority, authority))
    .limit(1);
  return payment ?? null;
}

export async function findOwnedPayment(
  executor: Executor,
  input: { readonly paymentId: string; readonly userId: string },
) {
  const [row] = await executor
    .select({ payment: payments, order: orders })
    .from(payments)
    .innerJoin(orders, eq(payments.orderId, orders.id))
    .where(
      and(eq(payments.id, input.paymentId), eq(orders.userId, input.userId)),
    )
    .limit(1);
  return row ?? null;
}

export async function submitPaymentReceipt(
  db: Database,
  input: {
    readonly paymentId: string;
    readonly userId: string;
    readonly storageKey: string;
    readonly contentType: string;
    readonly byteSize: number;
  },
) {
  return db.transaction(async (tx) => {
    const owned = await findOwnedPayment(tx, input);
    if (!owned || owned.payment.method !== "CARD_TO_CARD")
      throw new Error("PAYMENT_INVALID");
    const [updated] = await tx
      .update(payments)
      .set({ status: "PENDING_VERIFICATION", updatedAt: new Date() })
      .where(
        and(
          eq(payments.id, input.paymentId),
          inArray(payments.status, ["INITIATED", "PENDING_VERIFICATION"]),
        ),
      )
      .returning({ id: payments.id });
    if (!updated) throw new Error("PAYMENT_INVALID");
    const [receipt] = await tx
      .insert(paymentReceipts)
      .values({
        paymentId: input.paymentId,
        uploadedByUserId: input.userId,
        storageKey: input.storageKey,
        contentType: input.contentType,
        byteSize: input.byteSize,
      })
      .returning();
    return receipt;
  });
}

export async function completeGatewayPayment(
  db: Database,
  input: {
    readonly authority: string;
    readonly providerReference: string;
    readonly amountToman: bigint;
  },
) {
  return db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(payments)
      .where(eq(payments.providerAuthority, input.authority))
      .for("update")
      .limit(1);
    if (!payment) throw new Error("PAYMENT_NOT_FOUND");
    if (payment.status === "SUCCEEDED") return { payment, applied: false };
    if (payment.amountToman !== input.amountToman)
      throw new Error("AMOUNT_MISMATCH");
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, payment.orderId))
      .for("update")
      .limit(1);
    const expectedOrderStatus =
      payment.type === "DEPOSIT" ? "DEPOSIT_PENDING" : "BALANCE_DUE";
    if (
      !order ||
      !["DEPOSIT", "BALANCE"].includes(payment.type) ||
      order.status !== expectedOrderStatus
    )
      throw new Error("ORDER_NOT_PAYABLE");
    paymentStateMachine.assertTransition(payment.status, "SUCCEEDED");
    const nextMoney = {
      totalLockedToman: order.totalLockedToman,
      depositRequiredToman: order.depositRequiredToman,
      depositPaidToman:
        payment.type === "DEPOSIT" ? input.amountToman : order.depositPaidToman,
      balanceDueToman: order.balanceDueToman,
      balancePaidToman:
        payment.type === "BALANCE" ? input.amountToman : order.balancePaidToman,
    };
    if (payment.type === "DEPOSIT") {
      assertOrderTransition("DEPOSIT_PENDING", "DEPOSIT_PAID", nextMoney);
      orderStateMachine.assertTransition("DEPOSIT_PAID", "PROCUREMENT_PENDING");
    } else {
      assertOrderTransition("BALANCE_DUE", "BALANCE_PAID", nextMoney);
    }
    const now = new Date();
    if (payment.type === "DEPOSIT") {
      await ensurePurchaseTasksForOrder(tx, order.id);
    }
    const [updatedPayment] = await tx
      .update(payments)
      .set({
        status: "SUCCEEDED",
        providerReference: input.providerReference,
        verifiedAt: now,
        updatedAt: now,
      })
      .where(eq(payments.id, payment.id))
      .returning();
    if (payment.type === "DEPOSIT") {
      await tx
        .update(orders)
        .set({
          depositPaidToman: input.amountToman,
          status: "PROCUREMENT_PENDING",
          updatedAt: now,
        })
        .where(eq(orders.id, order.id));
      await tx.insert(orderStatusHistory).values([
        {
          orderId: order.id,
          fromStatus: "DEPOSIT_PENDING",
          toStatus: "DEPOSIT_PAID",
          note: "پیش‌پرداخت تأیید شد",
        },
        {
          orderId: order.id,
          fromStatus: "DEPOSIT_PAID",
          toStatus: "PROCUREMENT_PENDING",
        },
      ]);
    } else {
      await tx
        .update(orders)
        .set({
          balancePaidToman: input.amountToman,
          status: "BALANCE_PAID",
          updatedAt: now,
        })
        .where(eq(orders.id, order.id));
      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        fromStatus: "BALANCE_DUE",
        toStatus: "BALANCE_PAID",
        note: "مانده سفارش تأیید شد",
      });
    }
    await tx.insert(outboxEvents).values({
      aggregateType: "order",
      aggregateId: order.id,
      eventType:
        payment.type === "DEPOSIT"
          ? "order.deposit_paid"
          : "order.balance_paid",
      payload: {
        orderNumber: order.orderNumber,
        amountToman: input.amountToman.toString(),
      },
    });
    return { payment: updatedPayment!, applied: true };
  });
}

/** Backward-compatible name for existing callers and older integrations. */
export const completeGatewayDeposit = completeGatewayPayment;

export async function getOwnedOrder(
  executor: Executor,
  orderId: string,
  userId: string,
) {
  const [order] = await executor
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1);
  if (!order) return null;
  const [items, paymentRows, history, deliveryRows, tripRows] =
    await Promise.all([
      executor
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id)),
      executor
        .select()
        .from(payments)
        .where(eq(payments.orderId, order.id))
        .orderBy(desc(payments.createdAt)),
      executor
        .select()
        .from(orderStatusHistory)
        .where(eq(orderStatusHistory.orderId, order.id))
        .orderBy(orderStatusHistory.createdAt),
      executor
        .select()
        .from(localDeliveries)
        .where(eq(localDeliveries.orderId, order.id))
        .orderBy(desc(localDeliveries.createdAt))
        .limit(1),
      order.tripId
        ? executor
            .select()
            .from(trips)
            .where(eq(trips.id, order.tripId))
            .limit(1)
        : Promise.resolve([]),
    ]);
  return {
    order,
    items,
    payments: paymentRows,
    history,
    delivery: deliveryRows[0] ?? null,
    trip: tripRows[0] ?? null,
  };
}

export async function listOwnedOrders(executor: Executor, userId: string) {
  return executor
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));
}
