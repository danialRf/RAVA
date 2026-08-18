/**
 * Persian-first formatting helpers.
 *
 * Every customer-facing number goes through here so digits, grouping and the
 * Jalali calendar stay consistent across the storefront.
 */

const numberFormatter = new Intl.NumberFormat("fa-IR");
const dateFormatter = new Intl.DateTimeFormat("fa-IR", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

/** Integer Toman with Persian digits and grouping. */
export function formatToman(value: bigint | number): string {
  return numberFormatter.format(value);
}

/** Persian percentage from basis points, e.g. 1_250 → "۱۲٪". */
export function formatDiscountBps(bps: number): string {
  return `${numberFormatter.format(Math.round(bps / 100))}٪`;
}

export function formatDate(value: Date): string {
  return dateFormatter.format(value);
}

/** "امروز" / "دیروز" / a Jalali date, for price-observation timestamps. */
export function formatObservedAt(value: Date, now = new Date()): string {
  const days = Math.floor(
    (now.getTime() - value.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (days <= 0) return "امروز";
  if (days === 1) return "دیروز";
  return formatDate(value);
}

export function formatCount(value: number): string {
  return numberFormatter.format(value);
}

/**
 * Converts Latin digits inside a stored string to Persian digits.
 *
 * Used for catalog attributes such as sizes and volumes, which retailers
 * publish in Latin digits but Persian shoppers expect to read in Persian.
 */
export function toPersianDigits(value: string): string {
  return value.replace(/[0-9]/g, (digit) =>
    numberFormatter.format(Number(digit)),
  );
}
