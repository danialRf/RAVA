import Link from "next/link";
import { hasAdminPermission, type SessionPrincipal } from "@rava/domain";

import { AdminNavLinks, type AdminNavItem } from "./admin-nav-links";
import { Icon } from "./icons";

const NAVIGATION = [
  ["نمای کلی", "/admin", "OVERVIEW_READ", "home"],
  ["سفارش‌ها", "/admin/orders", "ORDERS_READ", "orders"],
  ["تدارکات و خرید", "/admin/procurement", "PROCUREMENT_READ", "truck"],
  ["بررسی پرداخت‌ها", "/admin/payments", "PAYMENTS_READ", "payment"],
  ["تاریخچه ممیزی", "/admin/audit", "AUDIT_READ", "history"],
] as const;

export function AdminNavigation({ user }: { user: SessionPrincipal }) {
  const items = NAVIGATION.filter(([, , permission]) =>
    hasAdminPermission(user.role, permission),
  ).map(([label, href, , icon]) => ({ label, href, icon })) as AdminNavItem[];

  return (
    <aside className="admin-sidebar">
      <div className="admin-brand">
        <Link href="/admin" aria-label="مرکز عملیات روا">
          <span>روا</span>
          <small>RAVA OPERATIONS</small>
        </Link>
      </div>
      <AdminNavLinks items={items} />
      <div className="admin-next-modules">
        <span>در صف توسعه</span>
        <small>کاتالوگ، قیمت‌گذاری، سفرها، مشتریان و منابع خرید</small>
      </div>
      <div className="admin-identity">
        <span>{user.displayName ?? user.email ?? "همکار روا"}</span>
        <small dir="ltr">{user.role}</small>
      </div>
    </aside>
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
        <span>مرکز عملیات</span>
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

export function AdminEmptyState({ children }: { children: React.ReactNode }) {
  return <div className="admin-empty">{children}</div>;
}
