import { eq } from "drizzle-orm";

import { orderItems, purchaseTasks } from "../schema";
import type { Executor } from "./executor";

/**
 * Creates the buyer work queue for a paid order.
 *
 * Idempotent so payment callback retries and manual review can share it. A
 * missing price ceiling fails closed: procurement must never start without the
 * maximum source price locked by checkout.
 */
export async function ensurePurchaseTasksForOrder(
  executor: Executor,
  orderId: string,
): Promise<void> {
  const items = await executor
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  for (const item of items) {
    if (item.maxSourcePriceEurCents === null) {
      throw new Error("PROCUREMENT_PRICE_MISSING");
    }
    await executor
      .insert(purchaseTasks)
      .values({
        orderItemId: item.id,
        sourceUrl: item.offerSnapshot.sourceUrl,
        targetMaxPriceEurCents: item.maxSourcePriceEurCents,
      })
      .onConflictDoNothing();
  }
}
