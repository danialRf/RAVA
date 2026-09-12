"use server";

import { randomUUID } from "node:crypto";

import { loadEnvironment } from "@rava/config";
import {
  createAdminContent,
  createAdminProduct,
  createAdminOffer,
  createAdminPricingRule,
  createAdminRetailer,
  createAdminTrip,
  assignOrderToTrip,
  archiveAdminOffer,
  archiveAdminProduct,
  archiveAdminRetailer,
  reviewAdminOffer,
  reviewCardPayment,
  receiveOrderInGermany,
  updateAdminContentStatus,
  updateAdminOffer,
  updateAdminProduct,
  updateAdminProductRequest,
  updateAdminRetailer,
  updateAdminTripStatus,
  updateProcurementItem,
  operateOrderLifecycle,
} from "@rava/db";
import {
  createPublicStorage,
  createPrivateStorage,
  matchesImageSignature,
} from "@rava/integrations";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "../../server/admin";
import { database } from "../../server/db";
import { destroyCurrentSession } from "../../server/auth";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

async function productImage(formData: FormData, userId: string) {
  const image = formData.get("image");
  if (!(image instanceof File) || image.size === 0) return null;
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (image.size > 5 * 1024 * 1024 || !allowed.includes(image.type))
    destination(
      "/admin/catalog",
      "error",
      "تصویر باید JPG، PNG یا WebP و حداکثر ۵ مگابایت باشد.",
    );
  const bytes = new Uint8Array(await image.arrayBuffer());
  if (!matchesImageSignature(bytes, image.type))
    destination(
      "/admin/catalog",
      "error",
      "محتوای فایل با نوع تصویر مطابقت ندارد.",
    );
  const extension =
    image.type === "image/png"
      ? "png"
      : image.type === "image/webp"
        ? "webp"
        : "jpg";
  try {
    return await createPublicStorage(loadEnvironment()).putPublic(
      `products/${userId}/${randomUUID()}.${extension}`,
      bytes,
      image.type,
    );
  } catch {
    destination(
      "/admin/catalog",
      "error",
      "بارگذاری تصویر انجام نشد؛ دوباره تلاش کنید.",
    );
  }
}

function eurCents(value: string, allowZero = false): bigint | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [euros, fraction = ""] = normalized.split(".");
  const cents = BigInt(euros!) * 100n + BigInt(fraction.padEnd(2, "0"));
  return allowZero ? (cents >= 0n ? cents : null) : cents > 0n ? cents : null;
}

function integer(value: string, minimum = 0, maximum = 2_147_483_647) {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : null;
}

function toman(value: string, allowZero = true): bigint | null {
  if (!/^\d{1,18}$/.test(value)) return null;
  const parsed = BigInt(value);
  return allowZero ? parsed : parsed > 0n ? parsed : null;
}

/**
 * Sell price as a shop operator actually types it.
 *
 * Persian and Arabic-Indic digits, thousand separators and spaces are all
 * accepted; anything else is rejected rather than guessed at. The result is
 * integer Toman, never a float.
 */
function sellPriceToman(value: string): bigint | null {
  const latin = value
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[,٬،.\s_]/g, "");
  if (!/^\d{1,15}$/.test(latin)) return null;
  const parsed = BigInt(latin);
  return parsed > 0n ? parsed : null;
}

const STOCK_CHOICES = ["IN_STOCK", "LOW_STOCK", "PREORDER", "OUT_OF_STOCK"];

function dateOrNull(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function destination(
  path: string,
  type: "notice" | "error",
  message: string,
): never {
  redirect(`${path}?${type}=${encodeURIComponent(message)}`);
}

export async function adminLogoutAction(): Promise<void> {
  await requireAdmin();
  await destroyCurrentSession();
  redirect("/account/login");
}

export async function reviewCardPaymentAction(formData: FormData) {
  const user = await requireAdmin("PAYMENTS_REVIEW");
  const paymentId = field(formData, "paymentId");
  const decision = field(formData, "decision");
  const reason = field(formData, "reason");
  if (!UUID.test(paymentId) || !["APPROVE", "REJECT"].includes(decision)) {
    destination("/admin/payments", "error", "درخواست بررسی معتبر نیست.");
  }
  let result;
  try {
    result = await reviewCardPayment(database(), {
      paymentId,
      actorUserId: user.id,
      decision: decision as "APPROVE" | "REJECT",
      reason,
    });
  } catch {
    destination(
      "/admin/payments",
      "error",
      "عملیات انجام نشد؛ وضعیت پرداخت یا دلیل واردشده را بررسی کنید.",
    );
  }
  revalidatePath("/admin");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/procurement");
  destination(
    "/admin/payments",
    "notice",
    decision === "APPROVE"
      ? result.paymentType === "BALANCE"
        ? "پرداخت مانده تأیید شد و سفارش آماده ارسال داخلی است."
        : "پیش‌پرداخت تأیید و سفارش وارد صف تهیه شد."
      : "پرداخت با ثبت دلیل رد شد.",
  );
}

export async function updateProcurementAction(formData: FormData) {
  const user = await requireAdmin("PROCUREMENT_WRITE");
  const orderItemId = field(formData, "orderItemId");
  const action = field(formData, "action");
  const reason = field(formData, "reason");
  if (
    !UUID.test(orderItemId) ||
    ![
      "ASSIGN_TO_SELF",
      "START",
      "MARK_UNAVAILABLE",
      "COMPLETE_PURCHASE",
    ].includes(action)
  ) {
    destination("/admin/procurement", "error", "درخواست تدارکات معتبر نیست.");
  }
  let purchase:
    | {
        purchaseEurCents: bigint;
        shippingEurCents: bigint;
        retailerOrderRef: string | null;
        document: {
          storageKey: string;
          contentType: string;
          byteSize: number;
        };
      }
    | undefined;
  if (action === "COMPLETE_PURCHASE") {
    const actualPrice = eurCents(field(formData, "purchaseEur"));
    const shipping = eurCents(field(formData, "shippingEur"), true);
    const reference = field(formData, "retailerOrderRef");
    const receipt = formData.get("receipt");
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (
      actualPrice === null ||
      shipping === null ||
      reference.length > 120 ||
      !(receipt instanceof File) ||
      receipt.size === 0 ||
      receipt.size > 5 * 1024 * 1024 ||
      !allowed.includes(receipt.type)
    ) {
      destination(
        "/admin/procurement",
        "error",
        "مبلغ‌ها یا تصویر رسید معتبر نیستند.",
      );
    }
    const bytes = new Uint8Array(await receipt.arrayBuffer());
    if (!matchesImageSignature(bytes, receipt.type)) {
      destination(
        "/admin/procurement",
        "error",
        "محتوای فایل با نوع تصویر رسید مطابقت ندارد.",
      );
    }
    const extension =
      receipt.type === "image/png"
        ? "png"
        : receipt.type === "image/webp"
          ? "webp"
          : "jpg";
    let stored;
    try {
      stored = await createPrivateStorage(loadEnvironment()).putPrivate(
        `purchase-receipts/${user.id}/${randomUUID()}.${extension}`,
        bytes,
        receipt.type,
      );
    } catch {
      destination(
        "/admin/procurement",
        "error",
        "ذخیره رسید انجام نشد؛ دوباره تلاش کنید.",
      );
    }
    purchase = {
      purchaseEurCents: actualPrice,
      shippingEurCents: shipping,
      retailerOrderRef: reference || null,
      document: {
        storageKey: stored.objectKey,
        contentType: stored.contentType,
        byteSize: stored.sizeBytes,
      },
    };
  }
  try {
    await updateProcurementItem(database(), {
      orderItemId,
      actorUserId: user.id,
      action: action as
        "ASSIGN_TO_SELF" | "START" | "MARK_UNAVAILABLE" | "COMPLETE_PURCHASE",
      reason,
      ...(purchase === undefined ? {} : { purchase }),
    });
  } catch {
    destination(
      "/admin/procurement",
      "error",
      "عملیات انجام نشد؛ وضعیت وظیفه، سقف قیمت یا اطلاعات خرید را بررسی کنید.",
    );
  }
  revalidatePath("/admin");
  revalidatePath("/admin/procurement");
  destination("/admin/procurement", "notice", "وضعیت تدارکات ثبت شد.");
}

export async function updateProductAction(formData: FormData) {
  const user = await requireAdmin("CATALOG_WRITE");
  const id = field(formData, "id");
  const status = field(formData, "status");
  const transport = field(formData, "transportClass");
  const weightValue = field(formData, "weightGrams");
  const weight = weightValue ? integer(weightValue, 1, 1_000_000) : null;
  const brandId = field(formData, "brandId");
  const categoryId = field(formData, "categoryId");
  const priceValue = field(formData, "priceToman");
  const price = priceValue ? sellPriceToman(priceValue) : null;
  const stock = field(formData, "stockStatus") || "IN_STOCK";
  if (
    !STOCK_CHOICES.includes(stock) ||
    !UUID.test(id) ||
    !["DRAFT", "NEEDS_REVIEW", "PUBLISHED", "ARCHIVED"].includes(status) ||
    !["", "XS", "S", "M", "L", "BLOCKED"].includes(transport) ||
    (weightValue && weight === null) ||
    (brandId && !UUID.test(brandId)) ||
    (categoryId && !UUID.test(categoryId))
  )
    destination("/admin/catalog", "error", "اطلاعات محصول معتبر نیست.");
  if (priceValue && price === null)
    destination(
      "/admin/catalog",
      "error",
      "قیمت فروش باید یک عدد صحیح به تومان باشد.",
    );
  try {
    const storedImage = await productImage(formData, user.id);
    await updateAdminProduct(database(), {
      id,
      actorUserId: user.id,
      titleFa: field(formData, "titleFa"),
      titleOriginal: field(formData, "titleOriginal"),
      ...(brandId ? { brandId } : {}),
      ...(categoryId ? { categoryId } : {}),
      descriptionFa: field(formData, "descriptionFa") || null,
      status: status as "DRAFT" | "NEEDS_REVIEW" | "PUBLISHED" | "ARCHIVED",
      weightGrams: weight,
      transportClass: (transport || null) as
        "XS" | "S" | "M" | "L" | "BLOCKED" | null,
      manualPriceToman: price,
      manualStockStatus: price === null ? null : (stock as "IN_STOCK"),
      imageUrl: storedImage?.publicUrl ?? null,
      imageAlt: field(formData, "imageAlt") || null,
    });
  } catch {
    destination("/admin/catalog", "error", "ویرایش محصول انجام نشد.");
  }
  revalidatePath("/admin/catalog");
  revalidatePath("/");
  destination(
    "/admin/catalog",
    "notice",
    "محصول و تاریخچه ممیزی به‌روزرسانی شد.",
  );
}

export async function createProductAction(formData: FormData) {
  const user = await requireAdmin("CATALOG_WRITE");
  const brandId = field(formData, "brandId");
  const categoryId = field(formData, "categoryId");
  const transport = field(formData, "transportClass");
  const weightValue = field(formData, "weightGrams");
  const weight = weightValue ? integer(weightValue, 1, 1_000_000) : null;
  const priceValue = field(formData, "priceToman");
  const price = priceValue ? sellPriceToman(priceValue) : null;
  const stock = field(formData, "stockStatus") || "IN_STOCK";
  if (
    !UUID.test(brandId) ||
    !UUID.test(categoryId) ||
    !["", "XS", "S", "M", "L", "BLOCKED"].includes(transport) ||
    (weightValue && weight === null) ||
    !STOCK_CHOICES.includes(stock)
  )
    destination("/admin/catalog", "error", "اطلاعات محصول معتبر نیست.");
  if (priceValue && price === null)
    destination(
      "/admin/catalog",
      "error",
      "قیمت فروش باید یک عدد صحیح به تومان باشد.",
    );
  try {
    const storedImage = await productImage(formData, user.id);
    await createAdminProduct(database(), {
      actorUserId: user.id,
      brandId,
      categoryId,
      titleFa: field(formData, "titleFa"),
      titleOriginal: field(formData, "titleOriginal"),
      descriptionFa: field(formData, "descriptionFa") || null,
      weightGrams: weight,
      transportClass: (transport || null) as
        "XS" | "S" | "M" | "L" | "BLOCKED" | null,
      skuInternal: field(formData, "skuInternal"),
      size: field(formData, "size") || null,
      color: field(formData, "color") || null,
      manualPriceToman: price,
      manualStockStatus: price === null ? null : (stock as "IN_STOCK"),
      imageUrl: storedImage?.publicUrl ?? null,
      imageAlt: field(formData, "imageAlt") || null,
    });
  } catch {
    destination(
      "/admin/catalog",
      "error",
      "ساخت محصول انجام نشد؛ SKU تکراری یا اطلاعات فرم را بررسی کنید.",
    );
  }
  revalidatePath("/admin/catalog");
  revalidatePath("/");
  destination("/admin/catalog", "notice", "محصول به‌صورت پیش‌نویس ساخته شد.");
}

export async function archiveProductAction(formData: FormData) {
  const user = await requireAdmin("CATALOG_WRITE");
  const id = field(formData, "id");
  if (!UUID.test(id))
    destination("/admin/catalog", "error", "محصول معتبر نیست.");
  try {
    await archiveAdminProduct(database(), { id, actorUserId: user.id });
  } catch {
    destination("/admin/catalog", "error", "آرشیو محصول انجام نشد.");
  }
  revalidatePath("/admin/catalog");
  revalidatePath("/");
  destination("/admin/catalog", "notice", "محصول از سایت خارج و آرشیو شد.");
}

export async function reviewOfferAction(formData: FormData) {
  const user = await requireAdmin("CATALOG_WRITE");
  const id = field(formData, "id");
  if (!UUID.test(id))
    destination("/admin/offers", "error", "پیشنهاد معتبر نیست.");
  try {
    await reviewAdminOffer(database(), {
      id,
      actorUserId: user.id,
      sourceVerified: field(formData, "sourceVerified") === "true",
    });
  } catch {
    destination(
      "/admin/offers",
      "error",
      "پیشنهاد بدون محصول تطبیق‌یافته قابل تأیید نیست.",
    );
  }
  revalidatePath("/admin/offers");
  destination("/admin/offers", "notice", "وضعیت پیشنهاد ثبت شد.");
}

export async function saveOfferAction(formData: FormData) {
  const user = await requireAdmin("CATALOG_WRITE");
  const id = field(formData, "id");
  const retailerId = field(formData, "retailerId");
  const productVariantId = field(formData, "productVariantId");
  const price = eurCents(field(formData, "sourcePriceEur"));
  const shippingValue = field(formData, "shippingEur");
  const shipping = shippingValue ? eurCents(shippingValue, true) : null;
  const stockStatus = field(formData, "stockStatus");
  if (
    (id && !UUID.test(id)) ||
    !UUID.test(retailerId) ||
    !UUID.test(productVariantId) ||
    price === null ||
    (shippingValue && shipping === null) ||
    !["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK", "PREORDER", "UNKNOWN"].includes(
      stockStatus,
    )
  )
    destination("/admin/offers", "error", "اطلاعات لینک خرید معتبر نیست.");
  const input = {
    actorUserId: user.id,
    retailerId,
    productVariantId,
    sourceUrl: field(formData, "sourceUrl"),
    rawTitle: field(formData, "rawTitle"),
    sourcePriceEurCents: price,
    shippingEurCents: shipping,
    stockStatus: stockStatus as
      "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "PREORDER" | "UNKNOWN",
  };
  try {
    if (id) await updateAdminOffer(database(), { ...input, id });
    else await createAdminOffer(database(), input);
  } catch {
    destination(
      "/admin/offers",
      "error",
      "ذخیره انجام نشد؛ لینک تکراری، فروشگاه یا اطلاعات محصول را بررسی کنید.",
    );
  }
  revalidatePath("/admin/offers");
  revalidatePath("/");
  destination(
    "/admin/offers",
    "notice",
    id
      ? "لینک خرید ویرایش شد و برای تأیید مجدد آماده است."
      : "لینک خرید ساخته شد؛ پس از بررسی آن را تأیید کنید.",
  );
}

export async function archiveOfferAction(formData: FormData) {
  const user = await requireAdmin("CATALOG_WRITE");
  const id = field(formData, "id");
  if (!UUID.test(id))
    destination("/admin/offers", "error", "لینک خرید معتبر نیست.");
  try {
    await archiveAdminOffer(database(), { id, actorUserId: user.id });
  } catch {
    destination("/admin/offers", "error", "آرشیو لینک خرید انجام نشد.");
  }
  revalidatePath("/admin/offers");
  revalidatePath("/");
  destination(
    "/admin/offers",
    "notice",
    "لینک خرید آرشیو شد و دیگر در فروش استفاده نمی‌شود.",
  );
}

export async function createPricingRuleAction(formData: FormData) {
  const user = await requireAdmin("PRICING_WRITE");
  const priority = integer(field(formData, "priority"), 0, 100_000);
  const margin = integer(field(formData, "targetMarginBps"), 0, 9_999);
  const customs = integer(field(formData, "customsRiskBps"), 0, 9_999);
  const buffer = integer(field(formData, "fxBufferBps"), 0, 9_999);
  const fee = integer(field(formData, "paymentFeeBps"), 0, 9_999);
  const deposit = integer(field(formData, "depositBps"), 1, 10_000);
  const minProfit = toman(field(formData, "minProfitToman"));
  const minDeposit = toman(field(formData, "minDepositToman"));
  const rounding = toman(field(formData, "roundingUnitToman"), false);
  const transport = field(formData, "transportClass");
  if (
    [
      priority,
      margin,
      customs,
      buffer,
      fee,
      deposit,
      minProfit,
      minDeposit,
      rounding,
    ].some((v) => v === null) ||
    !["XS", "S", "M", "L", "BLOCKED"].includes(transport)
  )
    destination("/admin/pricing", "error", "عامل‌های قیمت‌گذاری معتبر نیستند.");
  try {
    await createAdminPricingRule(database(), {
      actorUserId: user.id,
      priority: priority!,
      targetMarginBps: margin!,
      minProfitToman: minProfit!,
      transportClass: transport as "XS" | "S" | "M" | "L" | "BLOCKED",
      customsRiskBps: customs!,
      fxBufferBps: buffer!,
      paymentFeeBps: fee!,
      depositBps: deposit!,
      minDepositToman: minDeposit!,
      roundingUnitToman: rounding!,
      notes: field(formData, "notes") || null,
    });
  } catch {
    destination(
      "/admin/pricing",
      "error",
      "قانون قیمت‌گذاری ثبت نشد؛ مجموع حاشیه و کارمزد را بررسی کنید.",
    );
  }
  revalidatePath("/admin/pricing");
  destination("/admin/pricing", "notice", "قانون قیمت‌گذاری جدید فعال شد.");
}

export async function createTripAction(formData: FormData) {
  const user = await requireAdmin("TRIPS_WRITE");
  const capacityValue = field(formData, "capacityWeightGrams");
  const capacity = capacityValue ? integer(capacityValue, 1) : null;
  if (capacityValue && capacity === null)
    destination("/admin/trips", "error", "ظرفیت سفر معتبر نیست.");
  try {
    await createAdminTrip(database(), {
      actorUserId: user.id,
      code: field(formData, "code"),
      title: field(formData, "title"),
      capacityWeightGrams: capacity,
      departureWindowStart: dateOrNull(field(formData, "departureWindowStart")),
      departureWindowEnd: dateOrNull(field(formData, "departureWindowEnd")),
      arrivalWindowStart: dateOrNull(field(formData, "arrivalWindowStart")),
      arrivalWindowEnd: dateOrNull(field(formData, "arrivalWindowEnd")),
      notes: field(formData, "notes") || null,
    });
  } catch {
    destination(
      "/admin/trips",
      "error",
      "سفر ثبت نشد؛ کد و بازه‌های زمانی را بررسی کنید.",
    );
  }
  revalidatePath("/admin/trips");
  destination("/admin/trips", "notice", "سفر ایجاد شد.");
}

export async function updateTripStatusAction(formData: FormData) {
  const user = await requireAdmin("TRIPS_WRITE");
  const id = field(formData, "id");
  const status = field(formData, "status");
  if (
    !UUID.test(id) ||
    ![
      "PLANNED",
      "COLLECTING",
      "PACKED",
      "DEPARTED",
      "ARRIVED",
      "DISTRIBUTED",
      "CANCELLED",
    ].includes(status)
  )
    destination("/admin/trips", "error", "وضعیت سفر معتبر نیست.");
  try {
    await updateAdminTripStatus(database(), {
      id,
      actorUserId: user.id,
      status: status as
        | "PLANNED"
        | "COLLECTING"
        | "PACKED"
        | "DEPARTED"
        | "ARRIVED"
        | "DISTRIBUTED"
        | "CANCELLED",
    });
  } catch {
    destination("/admin/trips", "error", "وضعیت سفر تغییر نکرد.");
  }
  revalidatePath("/admin/trips");
  destination("/admin/trips", "notice", "وضعیت سفر ثبت شد.");
}

export async function updateRetailerAction(formData: FormData) {
  const user = await requireAdmin("SOURCES_WRITE");
  const id = field(formData, "id");
  const trustTier = field(formData, "trustTier");
  const interval = integer(
    field(formData, "defaultIntervalMinutes"),
    5,
    43_200,
  );
  if (
    !UUID.test(id) ||
    interval === null ||
    ![
      "OFFICIAL_BRAND",
      "AUTHORIZED_RETAILER",
      "TRUSTED_MARKETPLACE",
      "UNVERIFIED",
    ].includes(trustTier)
  )
    destination("/admin/sources", "error", "تنظیمات منبع معتبر نیست.");
  try {
    await updateAdminRetailer(database(), {
      id,
      actorUserId: user.id,
      name: field(formData, "name"),
      domain: field(formData, "domain"),
      isEnabled: field(formData, "isEnabled") === "on",
      trustTier: trustTier as
        | "OFFICIAL_BRAND"
        | "AUTHORIZED_RETAILER"
        | "TRUSTED_MARKETPLACE"
        | "UNVERIFIED",
      defaultIntervalMinutes: interval!,
      termsNotes: field(formData, "termsNotes") || null,
    });
  } catch {
    destination("/admin/sources", "error", "منبع به‌روزرسانی نشد.");
  }
  revalidatePath("/admin/sources");
  revalidatePath("/admin/health");
  destination("/admin/sources", "notice", "سیاست منبع ثبت شد.");
}

export async function createRetailerAction(formData: FormData) {
  const user = await requireAdmin("SOURCES_WRITE");
  const trustTier = field(formData, "trustTier");
  const interval = integer(
    field(formData, "defaultIntervalMinutes"),
    5,
    43_200,
  );
  if (
    interval === null ||
    ![
      "OFFICIAL_BRAND",
      "AUTHORIZED_RETAILER",
      "TRUSTED_MARKETPLACE",
      "UNVERIFIED",
    ].includes(trustTier)
  )
    destination("/admin/sources", "error", "اطلاعات فروشگاه معتبر نیست.");
  try {
    await createAdminRetailer(database(), {
      actorUserId: user.id,
      name: field(formData, "name"),
      domain: field(formData, "domain"),
      isEnabled: field(formData, "isEnabled") === "on",
      trustTier: trustTier as
        | "OFFICIAL_BRAND"
        | "AUTHORIZED_RETAILER"
        | "TRUSTED_MARKETPLACE"
        | "UNVERIFIED",
      defaultIntervalMinutes: interval,
      termsNotes: field(formData, "termsNotes") || null,
    });
  } catch {
    destination(
      "/admin/sources",
      "error",
      "فروشگاه ساخته نشد؛ نام یا دامنه را بررسی کنید.",
    );
  }
  revalidatePath("/admin/sources");
  destination("/admin/sources", "notice", "فروشگاه جدید ثبت شد.");
}

export async function archiveRetailerAction(formData: FormData) {
  const user = await requireAdmin("SOURCES_WRITE");
  const id = field(formData, "id");
  if (!UUID.test(id))
    destination("/admin/sources", "error", "فروشگاه معتبر نیست.");
  try {
    await archiveAdminRetailer(database(), { id, actorUserId: user.id });
  } catch {
    destination("/admin/sources", "error", "غیرفعال‌سازی فروشگاه انجام نشد.");
  }
  revalidatePath("/admin/sources");
  revalidatePath("/admin/offers");
  revalidatePath("/");
  destination(
    "/admin/sources",
    "notice",
    "فروشگاه غیرفعال شد و لینک‌های آن از فروش خارج شدند.",
  );
}

export async function createContentAction(formData: FormData) {
  const user = await requireAdmin("CONTENT_WRITE");
  try {
    await createAdminContent(database(), {
      actorUserId: user.id,
      key: field(formData, "key"),
      title: field(formData, "title") || null,
      bodyText: field(formData, "bodyText"),
    });
  } catch {
    destination(
      "/admin/content",
      "error",
      "محتوا ثبت نشد؛ کلید باید یکتا و لاتین باشد.",
    );
  }
  revalidatePath("/admin/content");
  destination("/admin/content", "notice", "پیش‌نویس محتوا ایجاد شد.");
}

export async function updateContentStatusAction(formData: FormData) {
  const user = await requireAdmin("CONTENT_WRITE");
  const id = field(formData, "id");
  const status = field(formData, "status");
  if (
    !UUID.test(id) ||
    !["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"].includes(status)
  )
    destination("/admin/content", "error", "وضعیت محتوا معتبر نیست.");
  try {
    await updateAdminContentStatus(database(), {
      id,
      actorUserId: user.id,
      status: status as "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED",
    });
  } catch {
    destination("/admin/content", "error", "وضعیت محتوا تغییر نکرد.");
  }
  revalidatePath("/admin/content");
  destination("/admin/content", "notice", "وضعیت محتوا ثبت شد.");
}

export async function updateProductRequestAction(formData: FormData) {
  const user = await requireAdmin("REQUESTS_WRITE");
  const id = field(formData, "id");
  const status = field(formData, "status");
  if (
    !UUID.test(id) ||
    !["SUBMITTED", "IN_RESEARCH", "QUOTED", "FULFILLED", "DECLINED"].includes(
      status,
    )
  )
    destination("/admin/requests", "error", "وضعیت درخواست معتبر نیست.");
  try {
    await updateAdminProductRequest(database(), {
      id,
      actorUserId: user.id,
      status: status as
        "SUBMITTED" | "IN_RESEARCH" | "QUOTED" | "FULFILLED" | "DECLINED",
    });
  } catch {
    destination("/admin/requests", "error", "درخواست به‌روزرسانی نشد.");
  }
  revalidatePath("/admin/requests");
  destination("/admin/requests", "notice", "وضعیت درخواست ثبت شد.");
}

export async function receiveOrderInGermanyAction(formData: FormData) {
  const user = await requireAdmin("TRIPS_WRITE");
  const id = field(formData, "id");
  if (!UUID.test(id))
    destination("/admin/orders", "error", "سفارش معتبر نیست.");
  try {
    await receiveOrderInGermany(database(), { id, actorUserId: user.id });
  } catch {
    destination(
      `/admin/orders/${id}`,
      "error",
      "دریافت سفارش در آلمان ثبت نشد.",
    );
  }
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/trips");
  destination(
    `/admin/orders/${id}`,
    "notice",
    "دریافت در آلمان ثبت و سفارش وارد صف سفر شد.",
  );
}

export async function assignOrderToTripAction(formData: FormData) {
  const user = await requireAdmin("TRIPS_WRITE");
  const orderId = field(formData, "orderId");
  const tripId = field(formData, "tripId");
  if (!UUID.test(orderId) || !UUID.test(tripId))
    destination("/admin/trips", "error", "سفارش یا سفر معتبر نیست.");
  try {
    await assignOrderToTrip(database(), {
      orderId,
      tripId,
      actorUserId: user.id,
    });
  } catch {
    destination(
      "/admin/trips",
      "error",
      "تخصیص انجام نشد؛ وضعیت سفارش و سفر را بررسی کنید.",
    );
  }
  revalidatePath("/admin/trips");
  revalidatePath(`/admin/orders/${orderId}`);
  destination("/admin/trips", "notice", "سفارش به سفر تخصیص یافت.");
}

export async function operateOrderLifecycleAction(formData: FormData) {
  const action = field(formData, "action");
  const permission = ["REQUEST_REFUND", "COMPLETE_REFUND"].includes(action)
    ? "PAYMENTS_REVIEW"
    : "TRIPS_WRITE";
  const user = await requireAdmin(permission);
  const orderId = field(formData, "orderId");
  if (
    !UUID.test(orderId) ||
    ![
      "START_LOCAL_DELIVERY",
      "DISPATCH_LOCAL",
      "DELIVERY_FAILED",
      "DELIVER",
      "REQUEST_REFUND",
      "COMPLETE_REFUND",
    ].includes(action)
  ) {
    destination("/admin/orders", "error", "عملیات سفارش معتبر نیست.");
  }
  try {
    await operateOrderLifecycle(database(), {
      orderId,
      actorUserId: user.id,
      action: action as
        | "START_LOCAL_DELIVERY"
        | "DISPATCH_LOCAL"
        | "DELIVERY_FAILED"
        | "DELIVER"
        | "REQUEST_REFUND"
        | "COMPLETE_REFUND",
      courier: field(formData, "courier"),
      trackingCode: field(formData, "trackingCode"),
      reason: field(formData, "reason"),
      refundReference: field(formData, "refundReference"),
    });
  } catch {
    destination(
      `/admin/orders/${orderId}`,
      "error",
      "عملیات با وضعیت فعلی سفارش یا اطلاعات واردشده سازگار نیست.",
    );
  }
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath(`/account/orders/${orderId}`);
  revalidatePath("/admin/orders");
  destination(
    `/admin/orders/${orderId}`,
    "notice",
    "مرحله سفارش با ثبت تاریخچه و ممیزی به‌روزرسانی شد.",
  );
}
