import type { ReactNode } from "react";

import { AdminStatusBadge } from "../components/admin-ui";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const LABELS: Record<string, string> = {
  DRAFT: "پیش‌نویس",
  NEEDS_REVIEW: "نیازمند بازبینی",
  PUBLISHED: "منتشرشده",
  ARCHIVED: "بایگانی‌شده",
  ACTIVE: "فعال",
  INACTIVE: "غیرفعال",
  OPEN: "باز",
  ASSIGNED: "اختصاص‌یافته",
  IN_PROGRESS: "در حال انجام",
  COMPLETED: "تکمیل‌شده",
  FAILED: "ناموفق",
  PENDING: "در انتظار",
  PENDING_VERIFICATION: "در انتظار بررسی",
  VERIFIED: "تأییدشده",
  REJECTED: "ردشده",
  SUBMITTED: "ثبت‌شده",
  IN_RESEARCH: "در حال بررسی",
  QUOTED: "قیمت‌گذاری‌شده",
  FULFILLED: "انجام‌شده",
  DECLINED: "ردشده",
  SCHEDULED: "زمان‌بندی‌شده",
  PLANNED: "برنامه‌ریزی‌شده",
  COLLECTING: "در حال جمع‌آوری",
  PACKED: "بسته‌بندی‌شده",
  DEPARTED: "حرکت‌کرده از آلمان",
  ARRIVED: "رسیده به ایران",
  DISTRIBUTED: "توزیع‌شده",
  CANCELLED: "لغوشده",
  OFFICIAL_BRAND: "برند رسمی",
  AUTHORIZED_RETAILER: "فروشنده مجاز",
  TRUSTED_MARKETPLACE: "مارکت‌پلیس بررسی‌شده",
  UNVERIFIED: "تأییدنشده",
  IN_STOCK: "موجود",
  LOW_STOCK: "موجودی محدود",
  PREORDER: "پیش‌فروش",
  OUT_OF_STOCK: "ناموجود",
  UNKNOWN: "نامعلوم",
  PURCHASED: "خریداری‌شده",
  UNAVAILABLE: "ناموجود در منبع",
};

function toneFor(status: string): Tone {
  if (
    /FAILED|REJECTED|DECLINED|CANCELLED|UNAVAILABLE|OUT_OF_STOCK/.test(status)
  )
    return "danger";
  if (/NEEDS_REVIEW|PENDING|SUBMITTED|UNKNOWN|UNVERIFIED/.test(status))
    return "warning";
  if (
    /PUBLISHED|VERIFIED|COMPLETED|FULFILLED|ARRIVED|DISTRIBUTED|IN_STOCK|PURCHASED/.test(
      status,
    )
  )
    return "success";
  if (
    /ACTIVE|ASSIGNED|IN_PROGRESS|QUOTED|SCHEDULED|COLLECTING|PACKED|DEPARTED/.test(
      status,
    )
  )
    return "info";
  return "neutral";
}

export function adminStatusLabel(status: string | null | undefined): string {
  return status ? (LABELS[status] ?? status) : "نامعلوم";
}

export function AdminEntityStatus({
  status,
  children,
}: {
  status: string | null | undefined;
  children?: ReactNode;
}) {
  const normalized = status ?? "UNKNOWN";
  return (
    <AdminStatusBadge tone={toneFor(normalized)}>
      {children ?? adminStatusLabel(normalized)}
    </AdminStatusBadge>
  );
}
