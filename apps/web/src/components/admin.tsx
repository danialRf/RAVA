import Link from "next/link";
import { hasAdminPermission, type SessionPrincipal } from "@rava/domain";

import { AdminNavLinks, type AdminNavGroup } from "./admin-nav-links";
import { Icon, type IconName } from "./icons";

type NavigationItem = readonly [
  string,
  string,
  Parameters<typeof hasAdminPermission>[1],
  IconName,
];
const NAVIGATION: ReadonlyArray<{
  label?: string;
  items: readonly NavigationItem[];
}> = [
  { items: [["داشبورد", "/admin", "OVERVIEW_READ", "home"]] },
  {
    label: "فروشگاه",
    items: [
      ["سفارش‌ها", "/admin/orders", "ORDERS_READ", "orders"],
      ["محصولات", "/admin/catalog", "CATALOG_READ", "products"],
      ["پرداخت‌ها", "/admin/payments", "PAYMENTS_READ", "payment"],
      ["مشتریان", "/admin/customers", "CUSTOMERS_READ", "customers"],
    ],
  },
  {
    label: "ارسال و تأمین",
    items: [
      ["ارسال سفارش‌ها", "/admin/trips", "TRIPS_READ", "trips"],
      ["تهیه از آلمان", "/admin/procurement", "PROCUREMENT_READ", "truck"],
      ["درخواست‌های مشتری", "/admin/requests", "REQUESTS_READ", "requests"],
    ],
  },
  {
    label: "سایت",
    items: [["متن‌های سایت", "/admin/content", "CONTENT_READ", "content"]],
  },
  // Everything below is real functionality that a shop assistant never needs
  // on a normal day. It stays available, just out of the daily path.
  {
    label: "تنظیمات پیشرفته",
    items: [
      ["لینک‌های خرید از آلمان", "/admin/offers", "CATALOG_READ", "offers"],
      ["فروشگاه‌های آلمان", "/admin/sources", "SOURCES_READ", "store"],
      ["قیمت‌گذاری خودکار", "/admin/pricing", "PRICING_READ", "pricing"],
      ["وضعیت سرویس‌ها", "/admin/health", "HEALTH_READ", "health"],
      ["تاریخچه فعالیت‌ها", "/admin/audit", "AUDIT_READ", "history"],
    ],
  },
];

function adminRoleLabel(role: SessionPrincipal["role"]): string {
  const labels: Partial<Record<SessionPrincipal["role"], string>> = {
    OWNER: "مالک فروشگاه",
    ADMIN: "مدیر فروشگاه",
    SUPPORT: "پشتیبانی مشتریان",
    MERCHANDISER: "کارشناس محصولات",
    BUYER_GERMANY: "کارشناس تأمین آلمان",
    CONTENT_EDITOR: "مدیر محتوا",
    FINANCE: "کارشناس مالی",
    OPERATOR: "کارشناس عملیات",
  };
  return labels[role] ?? "همکار روا";
}

export function AdminNavigation({ user }: { user: SessionPrincipal }) {
  const groups = NAVIGATION.map((group) => ({
    ...(group.label ? { label: group.label } : {}),
    items: group.items
      .filter(([, , permission]) => hasAdminPermission(user.role, permission))
      .map(([label, href, , icon]) => ({ label, href, icon })),
  })).filter((group) => group.items.length > 0) as AdminNavGroup[];
  return (
    <AdminNavLinks
      groups={groups}
      displayName={user.displayName ?? user.email ?? "همکار روا"}
      roleLabel={adminRoleLabel(user.role)}
    />
  );
}

export function AdminTopbar({
  displayName,
  logoutAction,
}: {
  displayName: string;
  logoutAction: () => Promise<void>;
}) {
  return (
    <header className="admin-topbar">
      <div>
        <span>مرکز مدیریت فروشگاه</span>
        <strong>{displayName}</strong>
      </div>
      <div className="admin-topbar-actions">
        <Link href="/" target="_blank">
          <Icon name="external" width="17" height="17" />
          مشاهده فروشگاه
        </Link>
        <form action={logoutAction}>
          <button type="submit">
            <Icon name="logout" width="17" height="17" />
            خروج
          </button>
        </form>
      </div>
    </header>
  );
}

export function AdminPageHeader({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <header className="admin-page-header">
      <p>{eyebrow}</p>
      <h1>{title}</h1>
      <span>{copy}</span>
    </header>
  );
}

export { AdminEmptyState } from "./admin-ui";
