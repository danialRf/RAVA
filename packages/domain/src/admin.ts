import type { UserRole } from "./enums";

export const ADMIN_PERMISSIONS = [
  "ADMIN_ACCESS",
  "OVERVIEW_READ",
  "ORDERS_READ",
  "PAYMENTS_READ",
  "PAYMENTS_REVIEW",
  "PROCUREMENT_READ",
  "PROCUREMENT_WRITE",
  "CATALOG_READ",
  "CATALOG_WRITE",
  "PRICING_READ",
  "PRICING_WRITE",
  "CUSTOMERS_READ",
  "CONTENT_READ",
  "CONTENT_WRITE",
  "AUDIT_READ",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

const ALL = new Set<AdminPermission>(ADMIN_PERMISSIONS);
const READ_OPERATIONS = new Set<AdminPermission>([
  "ADMIN_ACCESS",
  "OVERVIEW_READ",
  "ORDERS_READ",
  "PAYMENTS_READ",
  "PROCUREMENT_READ",
  "CATALOG_READ",
  "PRICING_READ",
  "CUSTOMERS_READ",
  "CONTENT_READ",
]);

const ROLE_PERMISSIONS: Readonly<
  Record<UserRole, ReadonlySet<AdminPermission>>
> = {
  CUSTOMER: new Set(),
  OWNER: ALL,
  ADMIN: ALL,
  MERCHANDISER: new Set([
    "ADMIN_ACCESS",
    "OVERVIEW_READ",
    "CATALOG_READ",
    "CATALOG_WRITE",
    "PRICING_READ",
  ]),
  BUYER_GERMANY: new Set([
    "ADMIN_ACCESS",
    "OVERVIEW_READ",
    "ORDERS_READ",
    "PROCUREMENT_READ",
    "PROCUREMENT_WRITE",
  ]),
  SUPPORT: new Set([
    "ADMIN_ACCESS",
    "OVERVIEW_READ",
    "ORDERS_READ",
    "CUSTOMERS_READ",
  ]),
  FINANCE: new Set([
    "ADMIN_ACCESS",
    "OVERVIEW_READ",
    "ORDERS_READ",
    "PAYMENTS_READ",
    "PAYMENTS_REVIEW",
    "PRICING_READ",
    "AUDIT_READ",
  ]),
  CONTENT_EDITOR: new Set([
    "ADMIN_ACCESS",
    "OVERVIEW_READ",
    "CATALOG_READ",
    "CONTENT_READ",
    "CONTENT_WRITE",
  ]),
  OPERATOR: READ_OPERATIONS,
};

export function hasAdminPermission(
  role: UserRole,
  permission: AdminPermission,
): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function isStaffRole(role: UserRole): boolean {
  return hasAdminPermission(role, "ADMIN_ACCESS");
}
