/**
 * Money primitives for RAVA.
 *
 * Two currencies exist in the domain and they are never mixed implicitly:
 *
 * - EUR is what source retailers charge. Persisted as integer cents.
 * - Toman is what Iranian customers pay. Persisted as integer Toman (bigint).
 *
 * Floating point is never used for persisted money. Rates and ratios are
 * expressed in basis points (bps, 1/10000) so every input is an integer too.
 */

export type EurCents = bigint;
export type Toman = bigint;

/** 1 basis point = 0.01%. 10_000 bps = 100%. */
export const BPS_DENOMINATOR = 10_000n;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

function assertInteger(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new MoneyError(`${label} must be an integer, received ${value}`);
  }
}

/** Builds EUR cents from an integer number of cents. */
export function eurCents(value: number | bigint): EurCents {
  if (typeof value === "number") assertInteger(value, "EUR cents");
  return BigInt(value);
}

/** Builds Toman from an integer amount. */
export function toman(value: number | bigint): Toman {
  if (typeof value === "number") assertInteger(value, "Toman");
  return BigInt(value);
}

/**
 * Parses a decimal EUR string such as "129.99" into integer cents without
 * going through a float. Retailer scrapers hand us text, never numbers.
 */
export function parseEurToCents(input: string): EurCents {
  const normalized = input.trim().replace(",", ".");
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (match === null) {
    throw new MoneyError(`Cannot parse EUR amount: ${input}`);
  }
  const [, sign = "", whole = "0", fraction = ""] = match;
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return sign === "-" ? -cents : cents;
}

/** Renders integer cents back to a plain decimal string (audit/debug use). */
export function formatEurCents(value: EurCents): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole.toString()}.${fraction}`;
}

/**
 * Converts EUR cents to Toman using an integer Toman-per-EUR rate.
 *
 * The result is rounded half-up because it feeds cost calculations that are
 * later rounded again for display; truncating here would systematically
 * under-price every order.
 */
export function convertEurCentsToToman(
  amount: EurCents,
  tomanPerEur: bigint,
): Toman {
  if (tomanPerEur <= 0n) {
    throw new MoneyError("Toman per EUR rate must be positive");
  }
  return divideRoundHalfUp(amount * tomanPerEur, 100n);
}

/** Applies a basis-point rate, e.g. applyBps(1_000n, 250) === 25n. */
export function applyBps(amount: bigint, bps: number): bigint {
  assertInteger(bps, "Basis points");
  return divideRoundHalfUp(amount * BigInt(bps), BPS_DENOMINATOR);
}

/** Adds a basis-point surcharge on top of an amount. */
export function addBps(amount: bigint, bps: number): bigint {
  return amount + applyBps(amount, bps);
}

/**
 * Divides while rounding half away from zero. Used instead of Math.round so
 * that no bigint ever transits through a double.
 */
export function divideRoundHalfUp(
  numerator: bigint,
  denominator: bigint,
): bigint {
  if (denominator === 0n) {
    throw new MoneyError("Division by zero");
  }
  const negative = numerator < 0n !== denominator < 0n;
  const absoluteNumerator = numerator < 0n ? -numerator : numerator;
  const absoluteDenominator = denominator < 0n ? -denominator : denominator;
  const quotient =
    (absoluteNumerator * 2n + absoluteDenominator) / (absoluteDenominator * 2n);
  return negative ? -quotient : quotient;
}

/** Rounds up to the nearest multiple of `unit` (customer-facing rounding). */
export function roundUpToUnit(amount: Toman, unit: bigint): Toman {
  if (unit <= 0n) {
    throw new MoneyError("Rounding unit must be positive");
  }
  const remainder = amount % unit;
  if (remainder === 0n) return amount;
  return amount > 0n ? amount + (unit - remainder) : amount - remainder;
}

/**
 * Splits an amount into `parts` shares that sum exactly back to the original.
 * Remainder Toman are handed to the earliest shares so nothing is lost.
 */
export function allocate(amount: Toman, parts: number): readonly Toman[] {
  assertInteger(parts, "Allocation parts");
  if (parts <= 0) {
    throw new MoneyError("Allocation requires at least one part");
  }
  const divisor = BigInt(parts);
  const base = amount / divisor;
  let remainder = amount - base * divisor;
  const step = remainder < 0n ? -1n : 1n;
  const shares: Toman[] = [];
  for (let index = 0; index < parts; index += 1) {
    if (remainder !== 0n) {
      shares.push(base + step);
      remainder -= step;
    } else {
      shares.push(base);
    }
  }
  return shares;
}

/** Deposit amount for a locked total, honouring a configured minimum. */
export function depositAmount(input: {
  readonly total: Toman;
  readonly depositBps: number;
  readonly minimumToman: Toman;
  readonly roundingUnit: bigint;
}): Toman {
  const proportional = applyBps(input.total, input.depositBps);
  const raw =
    proportional > input.minimumToman ? proportional : input.minimumToman;
  const rounded = roundUpToUnit(raw, input.roundingUnit);
  // A deposit can never exceed the amount actually owed.
  return rounded > input.total ? input.total : rounded;
}
