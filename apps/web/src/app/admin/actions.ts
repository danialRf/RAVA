"use server";

import { randomUUID } from "node:crypto";

import { loadEnvironment } from "@rava/config";
import { reviewCardPayment, updateProcurementItem } from "@rava/db";
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
  try {
    await reviewCardPayment(database(), {
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
      ? "پرداخت تأیید و وارد صف تهیه شد."
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
