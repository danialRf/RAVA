"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { loadEnvironment } from "@rava/config";
import {
  cancelAlert,
  createAddress,
  createPriceAlert,
  createPrivateUploadRecord,
  createProductRequest,
  deleteAddress,
  decideOrderReconfirmation,
  setDefaultAddress,
  setNotificationPreference,
  updateDisplayName,
} from "@rava/db";
import { normalizeIranianMobile } from "@rava/domain";
import { createPrivateStorage } from "@rava/integrations";

import { currentUser, enforceRateLimit } from "../../../server/auth";
import { beginBalancePayment } from "../../../server/checkout";
import { database } from "../../../server/db";
import { checkoutOrigin } from "../../../lib/site";

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function message(
  path: string,
  type: "error" | "notice",
  content: string,
): never {
  redirect(`${path}?${type}=${encodeURIComponent(content)}`);
}

async function requireUserId(): Promise<string> {
  const user = await currentUser();
  if (!user) redirect("/account/login?error=ابتدا وارد حساب شوید.");
  return user.id;
}

export async function updateProfileAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const displayName = value(formData, "displayName").slice(0, 80);
  if (displayName.length < 2)
    message("/account/profile", "error", "نام باید حداقل دو نویسه باشد.");
  await updateDisplayName(database(), { userId, displayName });
  message("/account/profile", "notice", "نام نمایشی ذخیره شد.");
}

export async function createAddressAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const phoneE164 = normalizeIranianMobile(value(formData, "phone"));
  const recipientName = value(formData, "recipientName").slice(0, 100);
  const province = value(formData, "province").slice(0, 80);
  const city = value(formData, "city").slice(0, 80);
  const addressLine = value(formData, "addressLine").slice(0, 500);
  const postalCode = value(formData, "postalCode").replace(/\D/g, "") || null;
  if (
    !phoneE164 ||
    !recipientName ||
    !province ||
    !city ||
    addressLine.length < 8
  ) {
    message("/account/addresses", "error", "اطلاعات نشانی کامل یا معتبر نیست.");
  }
  if (postalCode && !/^\d{10}$/.test(postalCode)) {
    message("/account/addresses", "error", "کد پستی باید ۱۰ رقم باشد.");
  }
  await createAddress(database(), {
    userId,
    recipientName,
    phoneE164,
    province,
    city,
    addressLine,
    postalCode,
    isDefault: formData.get("isDefault") === "on",
  });
  message("/account/addresses", "notice", "نشانی ذخیره شد.");
}

export async function setDefaultAddressAction(
  formData: FormData,
): Promise<void> {
  const userId = await requireUserId();
  await setDefaultAddress(database(), {
    userId,
    addressId: value(formData, "addressId"),
  });
  revalidatePath("/account/addresses");
}

export async function deleteAddressAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  await deleteAddress(database(), {
    userId,
    addressId: value(formData, "addressId"),
  });
  revalidatePath("/account/addresses");
}

export async function createPriceAlertAction(
  formData: FormData,
): Promise<void> {
  const userId = await requireUserId();
  const digits = value(formData, "threshold").replace(/[^0-9]/g, "");
  if (!digits || BigInt(digits) <= 0n)
    message("/account/alerts", "error", "مبلغ هشدار معتبر نیست.");
  const created = await createPriceAlert(database(), {
    userId,
    productSlug: value(formData, "productSlug"),
    thresholdToman: BigInt(digits),
  });
  if (!created)
    message(
      "/account/alerts",
      "error",
      "محصول پیدا نشد یا هشدار فعال تکراری است.",
    );
  message("/account/alerts", "notice", "هشدار قیمت ساخته شد.");
}

export async function cancelPriceAlertAction(
  formData: FormData,
): Promise<void> {
  const userId = await requireUserId();
  await cancelAlert(database(), {
    userId,
    alertId: value(formData, "alertId"),
  });
  revalidatePath("/account/alerts");
}

export async function updatePreferencesAction(
  formData: FormData,
): Promise<void> {
  const userId = await requireUserId();
  for (const channel of ["EMAIL", "SMS", "IN_APP"] as const) {
    await setNotificationPreference(database(), {
      userId,
      channel,
      topic: "ORDER_UPDATES",
      isEnabled: formData.get(channel) === "on",
    });
  }
  message("/account/notifications", "notice", "ترجیحات اطلاع‌رسانی ذخیره شد.");
}

export async function createProductRequestAction(
  formData: FormData,
): Promise<void> {
  const userId = await requireUserId();
  const descriptionFa = value(formData, "description").slice(0, 2000);
  if (descriptionFa.length < 10)
    message("/find-it", "error", "توضیح محصول باید روشن‌تر باشد.");
  const rawUrl = value(formData, "referenceUrl");
  let referenceUrl: string | null = null;
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
      referenceUrl = parsed.toString();
    } catch {
      message("/find-it", "error", "لینک محصول معتبر نیست.");
    }
  }
  const phone = value(formData, "phone");
  const contactPhoneE164 = phone ? normalizeIranianMobile(phone) : null;
  if (phone && !contactPhoneE164)
    message("/find-it", "error", "شماره تماس معتبر نیست.");
  const budgetDigits = value(formData, "budget").replace(/[^0-9]/g, "");
  const budgetToman = budgetDigits ? BigInt(budgetDigits) : null;
  if (budgetToman !== null && budgetToman <= 0n)
    message("/find-it", "error", "بودجه معتبر نیست.");
  if (!(await enforceRateLimit("product-request", userId, 10, 86400))) {
    message(
      "/find-it",
      "error",
      "تعداد درخواست‌های امروز شما به حد مجاز رسیده است.",
    );
  }

  let imageUploadId: string | null = null;
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowed.has(file.type) || file.size > 5 * 1024 * 1024) {
      message(
        "/find-it",
        "error",
        "تصویر باید JPG، PNG یا WebP و حداکثر ۵ مگابایت باشد.",
      );
    }
    const extension =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";
    const objectKey = `product-requests/${userId}/${randomUUID()}.${extension}`;
    const environment = loadEnvironment();
    const stored = await createPrivateStorage(environment).putPrivate(
      objectKey,
      new Uint8Array(await file.arrayBuffer()),
      file.type,
    );
    const upload = await createPrivateUploadRecord(database(), {
      userId,
      purpose: "PRODUCT_REQUEST_IMAGE",
      ...stored,
    });
    imageUploadId = upload?.id ?? null;
  }

  await createProductRequest(database(), {
    userId,
    contactPhoneE164,
    descriptionFa,
    referenceUrl,
    budgetToman,
    imageUploadId,
  });
  message("/find-it", "notice", "درخواست شما ثبت شد و در صف بررسی قرار گرفت.");
}

export async function decideOrderReconfirmationAction(
  formData: FormData,
): Promise<void> {
  const userId = await requireUserId();
  const orderId = value(formData, "orderId");
  const decision = value(formData, "decision");
  if (
    !/^[0-9a-f-]{36}$/i.test(orderId) ||
    !["CONTINUE", "CANCEL"].includes(decision)
  ) {
    message(`/account/orders/${orderId}`, "error", "تصمیم ثبت‌شده معتبر نیست.");
  }
  try {
    await decideOrderReconfirmation(database(), {
      orderId,
      userId,
      decision: decision as "CONTINUE" | "CANCEL",
    });
  } catch {
    message(
      `/account/orders/${orderId}`,
      "error",
      "این سفارش دیگر در انتظار تصمیم شما نیست.",
    );
  }
  message(
    `/account/orders/${orderId}`,
    "notice",
    decision === "CONTINUE"
      ? "ادامه تهیه تأیید شد و سفارش دوباره وارد صف خرید شد."
      : "درخواست لغو ثبت شد و سفارش وارد صف بازپرداخت شد.",
  );
}

export async function beginBalancePaymentAction(
  formData: FormData,
): Promise<void> {
  const userId = await requireUserId();
  const orderId = value(formData, "orderId");
  const method =
    value(formData, "method") === "CARD_TO_CARD" ? "CARD_TO_CARD" : "GATEWAY";
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) redirect("/account/orders");
  let result;
  try {
    const requestHeaders = await headers();
    const origin = checkoutOrigin(requestHeaders.get("host"));
    result = await beginBalancePayment({
      orderId,
      userId,
      method,
      callbackUrl: new URL("/api/payments/fake/callback", origin).toString(),
      origin,
    });
  } catch {
    message(
      `/account/orders/${orderId}`,
      "error",
      "پرداخت مانده قابل شروع نیست؛ وضعیت سفارش را دوباره بررسی کنید.",
    );
  }
  if (result.redirectUrl) redirect(result.redirectUrl);
  redirect(`/checkout/payment/card/${result.payment.id}`);
}
