import type { Environment } from "@rava/config";
import { recordFxRate, type Database } from "@rava/db";
import { createFxRateProvider } from "@rava/integrations";

export const FX_REFRESH_INTERVAL_MS = 4 * 60 * 1_000;

/**
 * One append-only FX refresh. Scheduling stays in the worker process while
 * provider selection and persistence remain independently replaceable.
 */
export async function refreshFxRate(
  database: Database,
  environment: Environment,
) {
  const snapshot = await createFxRateProvider(environment).getRate({
    base: "EUR",
    quote: "TOMAN",
    side: "SELL",
  });
  return recordFxRate(database, {
    provider: snapshot.sourceId,
    tomanPerUnit: snapshot.rate,
    providerTimestamp: snapshot.providerTimestamp,
    fetchedAt: snapshot.fetchedAt,
    rawReference: snapshot.rawReference,
  });
}
