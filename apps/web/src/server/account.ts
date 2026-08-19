import "server-only";

import {
  listAddresses,
  listAlerts,
  listNotificationPreferences,
  listOwnedOrders,
  listProductRequests,
  listWishlistProducts,
} from "@rava/db";

import { database } from "./db";

/** Account read use-cases. Route components never receive a database handle. */
export const accountQueries = {
  addresses: (userId: string) => listAddresses(database(), userId),
  alerts: (userId: string) => listAlerts(database(), userId),
  notificationPreferences: (userId: string) =>
    listNotificationPreferences(database(), userId),
  orders: (userId: string) => listOwnedOrders(database(), userId),
  productRequests: (userId: string) => listProductRequests(database(), userId),
  wishlist: (userId: string) => listWishlistProducts(database(), userId),
};
