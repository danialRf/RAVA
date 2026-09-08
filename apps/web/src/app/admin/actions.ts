"use server";

import { randomUUID } from "node:crypto";

import { loadEnvironment } from "@rava/config";
import {
  createAdminContent,
  createAdminPricingRule,
  createAdminTrip,
  assignOrderToTrip,
  reviewAdminOffer,
  reviewCardPayment,
  receiveOrderInGermany,
  updateAdminContentStatus,
  updateAdminProduct,
  updateAdminProductRequest,
  updateAdminRetailer,
  updateAdminTripStatus,
  updateProcurementItem,
  operateOrderLifecycle,
} from "@rava/db";
import {
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
  if (
    !UUID.test(id) ||
    !["DRAFT", "NEEDS_REVIEW", "PUBLISHED", "ARCHIVED"].includes(status) ||
    !["", "XS", "S", "M", "L", "BLOCKED"].includes(transport) ||
    (weightValue && weight === null)
  )
    destination("/admin/catalog", "error", "اطلاعات محصول معتبر نیست.");
  try {
    await updateAdminProduct(database(), {
      id,
      actorUserId: user.id,
      titleFa: field(formData, "titleFa"),
      descriptionFa: field(formData, "descriptionFa") || null,
      status: status as "DRAFT" | "NEEDS_REVIEW" | "PUBLISHED" | "ARCHIVED",
      weightGrams: weight,
      transportClass: (transport || null) as
        "XS" | "S" | "M" | "L" | "BLOCKED" | null,
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
