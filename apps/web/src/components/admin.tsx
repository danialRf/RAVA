import Link from "next/link";
import { hasAdminPermission, type SessionPrincipal } from "@rava/domain";

const NAVIGATION = [
  ["نمای کلی", "/admin", "OVERVIEW_READ"],
  ["سفارش‌ها", "/admin/orders", "ORDERS_READ"],
  ["تدارکات", "/admin/procurement", "PROCUREMENT_READ"],
  ["پرداخت‌های نیازمند بررسی", "/admin/payments", "PAYMENTS_READ"],
  ["گزارش ممیزی", "/admin/audit", "AUDIT_READ"],
] as const;

export function AdminNavigation({ user }: { user: SessionPrincipal }) {
  return (
    <aside className="admin-sidebar">
      <div>
        <p>سیستم عملیاتی روا</p>
        <strong>{user.displayName ?? user.email ?? "همکار روا"}</strong>
        <small dir="ltr">{user.role}</small>
      </div>
      <nav aria-label="ناوبری مدیریت">
        {NAVIGATION.filter(([, , permission]) =>
          hasAdminPermission(user.role, permission),
        ).map(([label, href]) => (
          <Link href={href} key={href}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="admin-next-modules">
        <span>در ادامه فاز ۶</span>
        <small>کاتالوگ، قیمت‌گذاری، سفرها، مشتریان، محتوا و منابع</small>
      </div>
    </aside>
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
