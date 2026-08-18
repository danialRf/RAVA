"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { loadEnvironment } from "@rava/config";
import { findOwnedPayment, submitPaymentReceipt } from "@rava/db";
import type { PaymentStatus } from "@rava/domain";
import {
  createPrivateStorage,
  matchesImageSignature,
} from "@rava/integrations";

import { siteUrl } from "../../lib/site";
import { currentUser, enforceRateLimit } from "../../server/auth";
import {
  addCurrentCartItem,
  beginOrderPayment,
  createFreshQuote,
  removeCurrentCartItem,
  updateCurrentCartItem,
} from "../../server/checkout";
import { database } from "../../server/db";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function addToCartAction(formData: FormData): Promise<void> {
  const variantId = String(formData.get("variantId") ?? "");
  const sourceOfferId = String(formData.get("offerId") ?? "");
  if (!UUID.test(variantId) || !UUID.test(sourceOfferId)) redirect("/category");
  const added = await addCurrentCartItem({
    productVariantId: variantId,
    sourceOfferId,
  });
  redirect(added ? "/cart?notice=added" : "/cart?error=unavailable");
}

export async function removeCartItemAction(formData: FormData): Promise<void> {
  const itemId = String(formData.get("itemId") ?? "");
  if (UUID.test(itemId)) await removeCurrentCartItem(itemId);
  redirect("/cart");
}

export async function updateCartItemAction(formData: FormData): Promise<void> {
  const itemId = String(formData.get("itemId") ?? "");
  const quantity = Number(formData.get("quantity"));
  if (UUID.test(itemId) && Number.isInteger(quantity)) {
    await updateCurrentCartItem(itemId, quantity);
  }
  redirect("/cart");
}

export async function createQuoteAction(formData: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) {
    const query = new URLSearchParams({
      next: "/cart",
      notice: "برای ادامه وارد حساب شوید",
    });
    redirect(`/account/login?${query.toString()}`);
  }
  if (!(await enforceRateLimit("checkout-quote", user.id, 10, 10 * 60))) {
    redirect("/cart?error=rate-limit");
  }
  const previous = String(formData.get("previousQuoteId") ?? "");
  let quote;
  try {
    quote = await createFreshQuote(user.id);
  } catch (error) {
    const code = error instanceof Error ? error.message : "QUOTE_FAILED";
    redirect(`/cart?error=${encodeURIComponent(code)}`);
  }
  const suffix = UUID.test(previous) ? `?previous=${previous}` : "";
  redirect(`/checkout/quote/${quote.id}${suffix}`);
}

export async function beginPaymentAction(formData: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) redirect("/account/login?next=%2Fcart");
  const quoteId = String(formData.get("quoteId") ?? "");
  const addressId = String(formData.get("addressId") ?? "");
  const rawMethod = String(formData.get("method") ?? "");
  const method = rawMethod === "CARD_TO_CARD" ? "CARD_TO_CARD" : "GATEWAY";
  if (!UUID.test(quoteId) || !UUID.test(addressId)) {
    redirect(`/checkout/quote/${quoteId}?error=invalid`);
  }
  let result;
  try {
    const requestHeaders = await headers();
    const requestHost = requestHeaders.get("host");
    const developmentOrigin =
      process.env.NODE_ENV !== "production" &&
      requestHost &&
      /^(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(requestHost)
        ? `http://${requestHost}`
        : siteUrl();
    const callbackUrl = new URL(
      "/api/payments/fake/callback",
      developmentOrigin,
    ).toString();
    result = await beginOrderPayment({
      quoteId,
      userId: user.id,
      addressId,
      method,
      callbackUrl,
      origin: developmentOrigin,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "PAYMENT_FAILED";
    redirect(`/checkout/quote/${quoteId}?error=${encodeURIComponent(code)}`);
  }
  if (result.redirectUrl) redirect(result.redirectUrl);
  redirect(`/checkout/payment/card/${result.payment.id}`);
}

export async function uploadReceiptAction(formData: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) redirect("/account/login");
  const paymentId = String(formData.get("paymentId") ?? "");
  const file = formData.get("receipt");
  if (!UUID.test(paymentId) || !(file instanceof File) || file.size === 0) {
    redirect(`/checkout/payment/card/${paymentId}?error=invalid`);
  }
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type) || file.size > 5 * 1024 * 1024) {
    redirect(`/checkout/payment/card/${paymentId}?error=file`);
  }
  if (!(await enforceRateLimit("payment-receipt", user.id, 5, 60 * 60))) {
    redirect(`/checkout/payment/card/${paymentId}?error=rate-limit`);
  }
  const owned = await findOwnedPayment(database(), {
    paymentId,
    userId: user.id,
  });
  // A card-to-card intent is created as INITIATED and moves to
  // PENDING_VERIFICATION once a receipt exists; re-uploading a replacement
  // receipt before an operator reviews it stays allowed.
  const uploadableStatuses: readonly PaymentStatus[] = [
    "INITIATED",
    "PENDING_VERIFICATION",
  ];
  if (
    !owned ||
    owned.payment.method !== "CARD_TO_CARD" ||
    !uploadableStatuses.includes(owned.payment.status)
  ) {
    redirect(`/checkout/payment/card/${paymentId}?error=invalid`);
  }
  const extension =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesImageSignature(bytes, file.type)) {
    redirect(`/checkout/payment/card/${paymentId}?error=file`);
  }
  const environment = loadEnvironment();
  const stored = await createPrivateStorage(environment).putPrivate(
    `payment-receipts/${user.id}/${randomUUID()}.${extension}`,
    bytes,
    file.type,
  );
  await submitPaymentReceipt(database(), {
    paymentId,
    userId: user.id,
    storageKey: stored.objectKey,
    contentType: stored.contentType,
    byteSize: stored.sizeBytes,
  });
  redirect(`/account/orders/${owned.order.id}?notice=receipt`);
}
