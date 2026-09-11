import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";

import { Icon, type IconName } from "./icons";

export type AdminTableColumn = {
  key: string;
  label: string;
  align?: "start" | "center" | "end";
};
export type AdminTableRow = { id: string; cells: Record<string, ReactNode> };

export function AdminDataTable({
  caption,
  columns,
  rows,
  emptyMessage = "اطلاعاتی برای نمایش وجود ندارد.",
}: {
  caption: string;
  columns: AdminTableColumn[];
  rows: AdminTableRow[];
  emptyMessage?: string;
}) {
  if (rows.length === 0)
    return <AdminEmptyState>{emptyMessage}</AdminEmptyState>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-data-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                data-align={column.align ?? "start"}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td key={column.key} data-align={column.align ?? "start"}>
                  <span className="admin-cell-label">{column.label}</span>
                  <span className="admin-cell-value">
                    {row.cells[column.key] ?? "—"}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminFilterBar({
  children,
  resultCount,
  actions,
}: {
  children: ReactNode;
  resultCount?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="admin-filter-bar" aria-label="فیلترها">
      <div className="admin-filter-fields">{children}</div>
      {(resultCount || actions) && (
        <div className="admin-filter-meta">
          {resultCount && <span aria-live="polite">{resultCount}</span>}
          {actions}
        </div>
      )}
    </section>
  );
}

export function AdminFlash({
  notice,
  error,
}: {
  notice?: string | string[] | undefined;
  error?: string | string[] | undefined;
}) {
  if (!notice && !error) return null;
  const message = error ?? notice;
  return (
    <div
      className={`admin-flash ${error ? "error" : "success"}`}
      role={error ? "alert" : "status"}
    >
      <Icon name={error ? "warning" : "check"} width="18" height="18" />
      <span>{Array.isArray(message) ? message[0] : message}</span>
    </div>
  );
}

export function AdminStatGrid({ children }: { children: ReactNode }) {
  return <section className="admin-stat-grid">{children}</section>;
}

export function AdminStat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: StatusTone;
}) {
  return (
    <div className="admin-stat" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}

export function AdminNotice({
  title,
  children,
  tone = "info",
}: {
  title: string;
  children: ReactNode;
  tone?: "info" | "warning";
}) {
  return (
    <aside className="admin-notice" data-tone={tone}>
      <Icon
        name={tone === "warning" ? "warning" : "history"}
        width="20"
        height="20"
      />
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </aside>
  );
}

type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";
export function AdminStatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: StatusTone;
}) {
  const icon: IconName =
    tone === "success"
      ? "check"
      : tone === "warning" || tone === "danger"
        ? "warning"
        : "history";
  return (
    <span className="admin-status-badge" data-tone={tone}>
      <Icon name={icon} width="14" height="14" />
      {children}
    </span>
  );
}

function AdminState({
  icon,
  title,
  children,
  action,
  kind,
}: {
  icon: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  kind: "empty" | "error";
}) {
  return (
    <section
      className="admin-state"
      data-state={kind}
      role={kind === "error" ? "alert" : undefined}
    >
      <span className="admin-state-icon" aria-hidden="true">
        <Icon name={icon} width="24" height="24" />
      </span>
      <div>
        <h2>{title}</h2>
        {children && <p>{children}</p>}
      </div>
      {action && <div className="admin-state-action">{action}</div>}
    </section>
  );
}

export function AdminEmptyState({ children }: { children: ReactNode }) {
  return (
    <AdminState icon="products" title="موردی پیدا نشد" kind="empty">
      {children}
    </AdminState>
  );
}

export function AdminLoadingState({
  label = "در حال آماده‌سازی اطلاعات…",
}: {
  label?: string;
}) {
  return (
    <section className="admin-loading" aria-live="polite" aria-busy="true">
      <span className="admin-loading-spinner" aria-hidden="true" />
      <div>
        <strong>{label}</strong>
        <span>لطفاً چند لحظه صبر کنید.</span>
      </div>
    </section>
  );
}

export function AdminErrorState({
  title = "نمایش این بخش ممکن نیست",
  children = "خطایی رخ داده است. دوباره تلاش کنید.",
  action,
}: {
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <AdminState icon="warning" title={title} action={action} kind="error">
      {children}
    </AdminState>
  );
}

type AdminActionButtonProps = {
  children: ReactNode;
  icon?: IconName;
  tone?: "primary" | "secondary" | "danger";
  href?: string;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
};

export function AdminActionButton(props: AdminActionButtonProps) {
  const { children, icon, tone = "secondary", href, disabled, onClick } = props;
  const content = (
    <>
      {icon && <Icon name={icon} width="17" height="17" />}
      <span>{children}</span>
    </>
  );
  if (href) {
    return (
      <Link className="admin-action-button" data-tone={tone} href={href}>
        {content}
      </Link>
    );
  }
  return (
    <button
      className="admin-action-button"
      data-tone={tone}
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      {content}
    </button>
  );
}

export function AdminActionButtons({ children }: { children: ReactNode }) {
  return <div className="admin-action-buttons">{children}</div>;
}

export function AdminDetailPanel({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="admin-detail-panel">
      <header>
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {actions}
      </header>
      <div className="admin-detail-panel-content">{children}</div>
    </section>
  );
}
