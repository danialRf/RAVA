import "server-only";

import {
  getAdminOverview,
  getAdminHealth,
  getAdminOrderDetails,
  getAdminOfferFormOptions,
  getAdminProductFormOptions,
  listAdminAuditLog,
  listAdminCatalog,
  listAdminContent,
  listAdminCustomers,
  listAdminOffers,
  listAdminOrders,
  listAdminPricingRules,
  listAdminProductRequests,
  listAdminRetailers,
  listAdminTrips,
  listPaymentsNeedingReview,
  listProcurementQueue,
  listOrdersAwaitingTrip,
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
  orders: (customerId?: string) => listAdminOrders(database(), 50, customerId),
  orderDetails: (orderId: string) => getAdminOrderDetails(database(), orderId),
  paymentsNeedingReview: () => listPaymentsNeedingReview(database()),
  procurementQueue: () => listProcurementQueue(database()),
  auditLog: () => listAdminAuditLog(database()),
  catalog: () => listAdminCatalog(database()),
  productFormOptions: () => getAdminProductFormOptions(database()),
  offers: () => listAdminOffers(database()),
  offerFormOptions: () => getAdminOfferFormOptions(database()),
  pricing: () => listAdminPricingRules(database()),
  trips: () => listAdminTrips(database()),
  ordersAwaitingTrip: () => listOrdersAwaitingTrip(database()),
  customers: () => listAdminCustomers(database()),
  sources: () => listAdminRetailers(database()),
  content: () => listAdminContent(database()),
  productRequests: () => listAdminProductRequests(database()),
  health: () => getAdminHealth(database()),
};
