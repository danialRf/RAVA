import { loadEnvironment, publicRuntimeSummary } from "@rava/config";
import { createHeartbeat } from "./health";

const environment = loadEnvironment();
const heartbeatIntervalMs = 30_000;
let closeDatabase: (() => Promise<void>) | null = null;
let fxRefreshTimer: NodeJS.Timeout | null = null;

function writeLog(event: string, details: object) {
  process.stdout.write(
    `${JSON.stringify({ event, service: "rava-worker", ...details })}\n`,
  );
}

writeLog("worker.started", {
  pid: process.pid,
  runtime: publicRuntimeSummary(environment),
});

const heartbeatTimer = setInterval(() => {
  writeLog("worker.heartbeat", createHeartbeat());
}, heartbeatIntervalMs);

async function initializeFxScheduler() {
  const [{ createDatabase }, { FX_REFRESH_INTERVAL_MS, refreshFxRate }] =
    await Promise.all([import("@rava/db"), import("./jobs/fx-refresh")]);
  const databaseHandle = createDatabase({ maxConnections: 2 });
  closeDatabase = databaseHandle.close;

  async function runFxRefresh() {
    try {
      const rate = await refreshFxRate(databaseHandle.db, environment);
      writeLog("fx.refreshed", {
        provider: rate.provider,
        providerTimestamp: rate.providerTimestamp.toISOString(),
      });
    } catch (error) {
      writeLog("fx.refresh_failed", {
        message: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  await runFxRefresh();
  fxRefreshTimer = setInterval(() => {
    void runFxRefresh();
  }, FX_REFRESH_INTERVAL_MS);
}

void initializeFxScheduler();

async function shutdown(signal: NodeJS.Signals) {
  clearInterval(heartbeatTimer);
  if (fxRefreshTimer) clearInterval(fxRefreshTimer);
  await closeDatabase?.();
  writeLog("worker.stopped", { signal });
  process.exit(0);
}

process.once("SIGINT", (signal) => void shutdown(signal));
process.once("SIGTERM", (signal) => void shutdown(signal));
