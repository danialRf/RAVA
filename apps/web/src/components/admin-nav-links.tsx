"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Icon, type IconName } from "./icons";

export type AdminNavItem = { label: string; href: string; icon: IconName };
export type AdminNavGroup = { label?: string; items: AdminNavItem[] };

export function AdminNavLinks({
  groups,
  displayName,
  roleLabel,
}: {
  groups: AdminNavGroup[];
  displayName: string;
  roleLabel: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <aside className={`admin-sidebar${open ? " is-open" : ""}`}>
      <div className="admin-mobile-bar">
        <Link
          href="/admin"
          className="admin-mobile-brand"
          aria-label="داشبورد روا"
          onClick={() => setOpen(false)}
        >
          روا
        </Link>
        <button
          type="button"
          className="admin-nav-toggle"
          aria-expanded={open}
          aria-controls="admin-navigation"
          onClick={() => setOpen((current) => !current)}
        >
          <Icon name={open ? "close" : "menu"} width="22" height="22" />
          <span>{open ? "بستن" : "منو"}</span>
        </button>
      </div>
      {open && (
        <button
          type="button"
          className="admin-nav-backdrop"
          aria-label="بستن منوی مدیریت"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="admin-sidebar-panel" id="admin-navigation">
        <div className="admin-brand">
          <Link
            href="/admin"
            aria-label="مرکز مدیریت روا"
            onClick={() => setOpen(false)}
          >
            <span>روا</span>
            <small>مرکز مدیریت فروشگاه</small>
          </Link>
        </div>
        <nav aria-label="ناوبری مدیریت">
          {groups.map((group, index) => (
            <section
              className="admin-nav-group"
              key={group.label ?? `primary-${index}`}
            >
              {group.label && <h2>{group.label}</h2>}
              <div>
                {group.items.map((item) => {
                  const active =
                    item.href === "/admin"
                      ? pathname === item.href
                      : pathname.startsWith(item.href);
                  return (
                    <Link
                      href={item.href}
                      key={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                    >
                      <Icon name={item.icon} width="19" height="19" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
        <div className="admin-identity">
          <span>{displayName}</span>
          <small>{roleLabel}</small>
        </div>
      </div>
    </aside>
  );
}
