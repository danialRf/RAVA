import { eq } from "drizzle-orm";

import { orderItems, purchaseTasks } from "../schema";
import type { Executor } from "./executor";

/**
 * Creates the buyer work queue for a paid order.
 *
 * Idempotent so payment callback retries and manual review can share it. A
 * missing price ceiling fails closed: procurement must never start without the
 * maximum source price locked by checkout.
 *
 * Manually priced lines are skipped: they were never sourced from a German
 * retailer, so there is no purchase link to buy from and no EUR ceiling to
 * enforce. Skipping them is not a relaxation of the fail-closed rule above,
 * which still applies to every line that does come from a source offer.
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
    if (item.sourceOfferId === null && item.offerSnapshot === null) continue;
    if (item.offerSnapshot === null) {
      throw new Error("PROCUREMENT_SOURCE_MISSING");
    }
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
