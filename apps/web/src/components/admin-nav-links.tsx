"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "./icons";

export type AdminNavItem = {
  label: string;
  href: string;
  icon: "home" | "orders" | "truck" | "payment" | "history";
};

export function AdminNavLinks({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="ناوبری مدیریت">
      {items.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === item.href
            : pathname.startsWith(item.href);
        return (
          <Link
            href={item.href}
            key={item.href}
            aria-current={active ? "page" : undefined}
          >
            <Icon name={item.icon} width="20" height="20" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
