/**
 * FX rate providers.
 *
 * The contract is from docs/PRICING_ENGINE.md. Rates are integer Toman per one
 * unit of the base currency; no float ever represents a rate.
 *
 * Two implementations exist today. Both are honest about where the number came
 * from, because every quote stores the snapshot it used:
 * - `fake` is deterministic and clearly labelled as development data,
 * - `manual` serves a rate an operator entered by hand.
 *
 * A real API adapter can be added later without touching callers.
 */

export interface FxRateRequest {
  readonly base: "EUR";
  readonly quote: "TOMAN";
  readonly side: "SELL" | "BUY";
}

export interface FxRateSnapshot {
  readonly rate: bigint;
  readonly providerTimestamp: Date;
  readonly fetchedAt: Date;
  readonly sourceId: string;
  readonly rawReference: Record<string, unknown>;
}

export interface FxRateProvider {
  readonly id: string;
  getRate(request: FxRateRequest): Promise<FxRateSnapshot>;
}

export class FxRateUnavailableError extends Error {
  constructor(providerId: string, reason: string) {
    super(`FX provider ${providerId} cannot supply a rate: ${reason}`);
    this.name = "FxRateUnavailableError";
  }
}

/**
 * Deterministic development provider.
 *
 * `providerTimestamp` is the call time so freshness checks behave exactly as
 * they will in production; only the number itself is fixed.
 */
export class FakeFxRateProvider implements FxRateProvider {
  readonly id = "fake";
  readonly #tomanPerEur: bigint;
  readonly #now: () => Date;

  constructor(tomanPerEur: bigint, now: () => Date = () => new Date()) {
    if (tomanPerEur <= 0n) {
      throw new FxRateUnavailableError(
        "fake",
        "configured rate must be positive",
      );
    }
    this.#tomanPerEur = tomanPerEur;
    this.#now = now;
  }

  async getRate(request: FxRateRequest): Promise<FxRateSnapshot> {
    assertSupported(this.id, request);
    const at = this.#now();
    return {
      rate: this.#tomanPerEur,
      providerTimestamp: at,
      fetchedAt: at,
      sourceId: this.id,
      rawReference: {
        note: "deterministic development rate; not a market observation",
      },
    };
  }
}

/** Rate entered by an operator, carrying the time they observed it. */
export class ManualFxRateProvider implements FxRateProvider {
  readonly id = "manual";
  readonly #read: () => {
    readonly tomanPerEur: bigint;
    readonly observedAt: Date;
  } | null;
  readonly #now: () => Date;

  constructor(
    read: () => {
      readonly tomanPerEur: bigint;
      readonly observedAt: Date;
    } | null,
    now: () => Date = () => new Date(),
  ) {
    this.#read = read;
    this.#now = now;
  }

  async getRate(request: FxRateRequest): Promise<FxRateSnapshot> {
    assertSupported(this.id, request);
    const entry = this.#read();
    if (entry === null) {
      throw new FxRateUnavailableError(this.id, "no manual rate is configured");
    }
    if (entry.tomanPerEur <= 0n) {
      throw new FxRateUnavailableError(this.id, "manual rate must be positive");
    }
    return {
      rate: entry.tomanPerEur,
      providerTimestamp: entry.observedAt,
      fetchedAt: this.#now(),
      sourceId: this.id,
      rawReference: { enteredBy: "operator" },
    };
  }
}

function assertSupported(providerId: string, request: FxRateRequest): void {
  if (request.base !== "EUR" || request.quote !== "TOMAN") {
    throw new FxRateUnavailableError(
      providerId,
      `${request.base}→${request.quote} is not supported`,
    );
  }
}

export interface FxProviderConfiguration {
  readonly FX_PROVIDER: "fake" | "manual" | "api";
  readonly FX_FAKE_EUR_TOMAN: number;
}

/**
 * Builds the configured provider.
 *
 * `api` has no adapter yet, so it fails loudly instead of silently degrading
 * to development data.
 */
export function createFxRateProvider(
  configuration: FxProviderConfiguration,
  manualRate?: () => {
    readonly tomanPerEur: bigint;
    readonly observedAt: Date;
  } | null,
): FxRateProvider {
  switch (configuration.FX_PROVIDER) {
    case "fake":
      return new FakeFxRateProvider(BigInt(configuration.FX_FAKE_EUR_TOMAN));
    case "manual":
      return new ManualFxRateProvider(manualRate ?? (() => null));
    case "api":
      throw new FxRateUnavailableError(
        "api",
        "no production FX adapter is implemented yet",
      );
  }
}
