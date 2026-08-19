import "server-only";

import {
  getAdminOverview,
  listAdminAuditLog,
  listAdminOrders,
  listPaymentsNeedingReview,
  listProcurementQueue,
} from "@rava/db";
import {
  hasAdminPermission,
  type AdminPermission,
  type SessionPrincipal,
} from "@rava/domain";
import { redirect } from "next/navigation";

import { currentUser } from "./auth";
import { database } from "./db";

export async function requireAdmin(
  permission: AdminPermission = "ADMIN_ACCESS",
): Promise<SessionPrincipal> {
  const user = await currentUser();
  if (user === null) {
    redirect(`/account/login?next=${encodeURIComponent("/admin")}`);
  }
  if (!hasAdminPermission(user.role, permission)) redirect("/account");
  return user;
}

export const adminQueries = {
  overview: () => getAdminOverview(database()),
  orders: () => listAdminOrders(database()),
  paymentsNeedingReview: () => listPaymentsNeedingReview(database()),
  procurementQueue: () => listProcurementQueue(database()),
  auditLog: () => listAdminAuditLog(database()),
};
