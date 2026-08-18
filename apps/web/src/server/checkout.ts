import "server-only";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

import { loadEnvironment } from "@rava/config";
import {
  addCartItem,
  createOrderFromQuote,
  createPaymentIntent,
  ensureActiveCart,
  findPaymentByAuthority,
  getActiveCart,
  getOwnedOrder,
  getQuoteWithItems,
  listCartDetails,
  persistQuote,
  removeCartItem,
  setPaymentAuthority,
  updateCartItemQuantity,
} from "@rava/db";
import { createPaymentGateway } from "@rava/integrations";

import { usesHttps } from "../lib/site";
import { currentUser } from "./auth";
import { database } from "./db";
import { estimateFor, getCheckoutRate, type CheckoutRate } from "./pricing";

const CART_COOKIE = "rava_cart";
const CART_COOKIE_SECONDS = 60 * 60 * 24 * 30;
export const QUOTE_TTL_SECONDS = 10 * 60;
export const CALCULATION_VERSION = "checkout-v1";

async function cartOwner() {
  const store = await cookies();
  const anonymousKey = store.get(CART_COOKIE)?.value;
  if (anonymousKey && /^[a-f0-9-]{36}$/.test(anonymousKey)) {
    return { anonymousKey } as const;
  }
  const user = await currentUser();
  return user ? ({ userId: user.id } as const) : null;
}

export async function ensureCurrentCart() {
  const store = await cookies();
  let owner = await cartOwner();
  if (!owner) {
    const anonymousKey = randomUUID();
    store.set(CART_COOKIE, anonymousKey, {
      httpOnly: true,
      sameSite: "lax",
      secure: usesHttps(),
      path: "/",
      maxAge: CART_COOKIE_SECONDS,
    });
    owner = { anonymousKey };
  }
  return ensureActiveCart(database(), owner);
}

export async function getCurrentCart() {
  const owner = await cartOwner();
  if (!owner) return null;
  return getActiveCart(database(), owner);
}

export async function addCurrentCartItem(input: {
  readonly productVariantId: string;
  readonly sourceOfferId: string;
  readonly quantity?: number;
}) {
  const cart = await ensureCurrentCart();
  return addCartItem(database(), { cartId: cart.id, ...input });
}

export async function removeCurrentCartItem(itemId: string) {
  const cart = await getCurrentCart();
  if (cart) await removeCartItem(database(), { cartId: cart.id, itemId });
}

export async function updateCurrentCartItem(itemId: string, quantity: number) {
  const cart = await getCurrentCart();
  if (cart)
    await updateCartItemQuantity(database(), {
      cartId: cart.id,
      itemId,
      quantity,
    });
}

function variantLabel(
  item: Awaited<ReturnType<typeof listCartDetails>>[number],
) {
  const parts = [
    item.variantSize,
    item.variantColor,
    item.variantVolumeMl ? `${item.variantVolumeMl} ml` : null,
  ].filter(Boolean);
  return parts.join(" · ") || item.variantSku;
}

export async function readCartModel(checkoutRate?: CheckoutRate | null) {
  const cart = await getCurrentCart();
  if (!cart) return { cart: null, items: [], total: 0n, deposit: 0n } as const;
  const rows = await listCartDetails(database(), cart.id);
  const rate =
    checkoutRate === undefined ? await getCheckoutRate() : checkoutRate;
  const items = await Promise.all(
    rows.map(async (row) => {
      const estimate =
        row.sourceVerified &&
        ["IN_STOCK", "LOW_STOCK"].includes(row.stockStatus)
          ? await estimateFor(
              {
                productId: row.productId,
                brandId: row.brandId,
                categoryId: row.categoryId,
                sourcePriceEurCents: row.sourcePriceEurCents,
                shippingEurCents: row.shippingEurCents,
                previousPriceEurCents: null,
                weightGrams: row.weightGrams,
                transportClass: row.transportClass,
                categoryTransportClass: row.categoryTransportClass,
              },
              rate,
            )
          : null;
      return {
        ...row,
        variantLabel: variantLabel(row),
        imageUrl: row.imageUrl ?? "/products/bag.svg",
        estimate,
        lineTotal: estimate
          ? estimate.estimatedToman * BigInt(row.quantity)
          : null,
        lineDeposit: estimate
          ? estimate.depositToman * BigInt(row.quantity)
          : null,
      };
    }),
  );
  return {
    cart,
    items,
    total: items.reduce((sum, item) => sum + (item.lineTotal ?? 0n), 0n),
    deposit: items.reduce((sum, item) => sum + (item.lineDeposit ?? 0n), 0n),
  } as const;
}

export async function createFreshQuote(userId: string) {
  // A quote must be calculated and persisted from one immutable FX snapshot.
  const rate = await getCheckoutRate();
  if (!rate) throw new Error("FX_UNAVAILABLE");
  const model = await readCartModel(rate);
  if (!model.cart || model.items.length === 0) throw new Error("CART_EMPTY");
  if (model.items.some((item) => item.estimate === null))
    throw new Error("ITEM_UNAVAILABLE");
  const lines = model.items.map((item) => {
    const estimate = item.estimate!;
    const quantity = BigInt(item.quantity);
    return {
      sourceOfferId: item.offerId,
      productVariantId: item.variantId,
      quantity: item.quantity,
      sourcePriceEurCents: item.sourcePriceEurCents,
      shippingEurCents: item.shippingEurCents ?? 0n,
      sourceTomanTotal: estimate.breakdown.sourceToman * quantity,
      transportToman: estimate.breakdown.transportToman * quantity,
      customsRiskToman: estimate.breakdown.customsRiskToman * quantity,
      localDeliveryToman: estimate.breakdown.localDeliveryToman * quantity,
      paymentFeeToman: estimate.breakdown.paymentFeeToman * quantity,
      marginToman: estimate.breakdown.marginToman * quantity,
      lineTotalToman: estimate.estimatedToman * quantity,
      observedAt: item.observedAt,
      breakdown: {
        titleFa: item.titleFa,
        titleOriginal: item.titleOriginal,
        brand: item.brandName,
        variant: item.variantLabel,
        retailer: item.retailerName,
        sourceUrl: item.sourceUrl,
        ruleId: estimate.ruleId,
        effectiveTomanPerEur:
          estimate.breakdown.effectiveTomanPerEur.toString(),
      },
    };
  });
  const finalToman = lines.reduce((sum, line) => sum + line.lineTotalToman, 0n);
  const depositToman = model.items.reduce(
    (sum, item) => sum + item.estimate!.depositToman * BigInt(item.quantity),
    0n,
  );
  return persistQuote(database(), {
    userId,
    cartId: model.cart.id,
    fxRateId: rate.id,
    fxTomanPerEur: rate.tomanPerEur,
    subtotalToman: lines.reduce((sum, line) => sum + line.sourceTomanTotal, 0n),
    finalToman,
    depositToman,
    appliedRuleIds: [...new Set(lines.map((line) => line.breakdown.ruleId))],
    calculationVersion: CALCULATION_VERSION,
    expiresAt: new Date(Date.now() + QUOTE_TTL_SECONDS * 1000),
    lines,
  });
}

export async function readOwnedQuote(quoteId: string, userId: string) {
  const result = await getQuoteWithItems(database(), quoteId);
  return result?.quote.userId === userId ? result : null;
}

export async function beginOrderPayment(input: {
  readonly quoteId: string;
  readonly userId: string;
  readonly addressId: string;
  readonly method: "GATEWAY" | "CARD_TO_CARD";
  readonly callbackUrl: string;
  /** Origin the development gateway builds its approval screen on. */
  readonly origin: string;
}) {
  const environment = loadEnvironment();
  // Validate provider configuration before consuming the one-use quote.
  const gateway = createPaymentGateway(environment);
  const order = await createOrderFromQuote(database(), input);
  const payment = await createPaymentIntent(database(), {
    orderId: order.id,
    method: input.method,
    provider: input.method === "GATEWAY" ? gateway.id : "manual",
    amountToman: order.depositRequiredToman,
    idempotencyKey: `deposit:${order.id}:${input.method}`,
  });
  if (input.method === "CARD_TO_CARD")
    return { order, payment, redirectUrl: null };
  const created = await gateway.createPayment({
    paymentId: payment.id,
    orderId: order.id,
    amountToman: payment.amountToman,
    callbackUrl: input.callbackUrl,
    hostedPageUrl: new URL(
      `/checkout/payment/gateway/${payment.id}`,
      input.origin,
    ).toString(),
  });
  await setPaymentAuthority(database(), {
    paymentId: payment.id,
    authority: created.authority,
  });
  return { order, payment, redirectUrl: created.redirectUrl };
}

export async function paymentForCallback(authority: string) {
  return findPaymentByAuthority(database(), authority);
}

export async function readOwnedOrder(orderId: string, userId: string) {
  return getOwnedOrder(database(), orderId, userId);
}
