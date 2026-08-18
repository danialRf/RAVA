import { describe, expect, it } from "vitest";

import {
  createFxRateProvider,
  FakeFxRateProvider,
  FxRateUnavailableError,
  ManualFxRateProvider,
} from "./fx";

const request = { base: "EUR", quote: "TOMAN", side: "SELL" } as const;

describe("FakeFxRateProvider", () => {
  it("returns the configured integer rate with a current timestamp", async () => {
    const now = new Date("2026-08-16T10:00:00.000Z");
    const provider = new FakeFxRateProvider(200_000n, () => now);
    const snapshot = await provider.getRate(request);

    expect(snapshot.rate).toBe(200_000n);
    expect(snapshot.providerTimestamp).toEqual(now);
    expect(snapshot.sourceId).toBe("fake");
  });

  it("rejects an unsupported currency pair instead of guessing", async () => {
    const provider = new FakeFxRateProvider(200_000n);
    await expect(
      provider.getRate({ ...request, base: "USD" as "EUR" }),
    ).rejects.toThrow(FxRateUnavailableError);
  });

  it("rejects a non-positive configured rate", () => {
    expect(() => new FakeFxRateProvider(0n)).toThrow(FxRateUnavailableError);
  });
});

describe("ManualFxRateProvider", () => {
  it("serves the operator rate with the time it was observed", async () => {
    const observedAt = new Date("2026-08-16T09:00:00.000Z");
    const provider = new ManualFxRateProvider(() => ({
      tomanPerEur: 215_000n,
      observedAt,
    }));

    const snapshot = await provider.getRate(request);
    expect(snapshot.rate).toBe(215_000n);
    expect(snapshot.providerTimestamp).toEqual(observedAt);
  });

  it("fails when no manual rate exists", async () => {
    const provider = new ManualFxRateProvider(() => null);
    await expect(provider.getRate(request)).rejects.toThrow(
      FxRateUnavailableError,
    );
  });
});

describe("createFxRateProvider", () => {
  it("builds the configured provider", () => {
    expect(
      createFxRateProvider({ FX_PROVIDER: "fake", FX_FAKE_EUR_TOMAN: 200_000 })
        .id,
    ).toBe("fake");
    expect(
      createFxRateProvider({ FX_PROVIDER: "manual", FX_FAKE_EUR_TOMAN: 0 }).id,
    ).toBe("manual");
  });

  it("refuses to silently fall back when the API adapter is missing", () => {
    expect(() =>
      createFxRateProvider({ FX_PROVIDER: "api", FX_FAKE_EUR_TOMAN: 200_000 }),
    ).toThrow(FxRateUnavailableError);
  });
});
