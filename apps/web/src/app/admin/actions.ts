"use server";

import { reviewCardPayment, updateProcurementItem } from "@rava/db";
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
    !["ASSIGN_TO_SELF", "START", "MARK_UNAVAILABLE"].includes(action)
  ) {
    destination("/admin/procurement", "error", "درخواست تدارکات معتبر نیست.");
  }
  try {
    await updateProcurementItem(database(), {
      orderItemId,
      actorUserId: user.id,
      action: action as "ASSIGN_TO_SELF" | "START" | "MARK_UNAVAILABLE",
      reason,
    });
  } catch {
    destination(
      "/admin/procurement",
      "error",
      "عملیات انجام نشد؛ ممکن است وضعیت این وظیفه هم‌زمان تغییر کرده باشد.",
    );
  }
  revalidatePath("/admin");
  revalidatePath("/admin/procurement");
  destination("/admin/procurement", "notice", "وضعیت تدارکات ثبت شد.");
}
