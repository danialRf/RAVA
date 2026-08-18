import { describe, expect, it } from "vitest";

import {
  addBps,
  allocate,
  applyBps,
  convertEurCentsToToman,
  depositAmount,
  divideRoundHalfUp,
  eurCents,
  formatEurCents,
  MoneyError,
  parseEurToCents,
  roundUpToUnit,
  toman,
} from "./money";

describe("money constructors", () => {
  it("rejects non-integer input", () => {
    expect(() => eurCents(12.5)).toThrow(MoneyError);
    expect(() => toman(0.1)).toThrow(MoneyError);
  });

  it("accepts integers and bigints", () => {
    expect(eurCents(1299)).toBe(1299n);
    expect(toman(9_500_000)).toBe(9_500_000n);
    expect(eurCents(10n ** 12n)).toBe(10n ** 12n);
  });
});

describe("parseEurToCents", () => {
  it("parses decimal and comma separated retailer strings", () => {
    expect(parseEurToCents("129.99")).toBe(12_999n);
    expect(parseEurToCents("129,99")).toBe(12_999n);
    expect(parseEurToCents("  8.5 ")).toBe(850n);
    expect(parseEurToCents("40")).toBe(4_000n);
    expect(parseEurToCents("-12.34")).toBe(-1_234n);
  });

  it("never loses a cent through floating point", () => {
    // 0.1 + 0.2 style inputs must stay exact.
    expect(parseEurToCents("0.1") + parseEurToCents("0.2")).toBe(30n);
  });

  it("rejects ambiguous or malformed amounts", () => {
    for (const input of ["", "abc", "1.234", "1.2.3", "€10", "1 000"]) {
      expect(() => parseEurToCents(input)).toThrow(MoneyError);
    }
  });

  it("round-trips through formatEurCents", () => {
    for (const input of ["0.00", "0.05", "129.99", "1000.10"]) {
      expect(formatEurCents(parseEurToCents(input))).toBe(input);
    }
    expect(formatEurCents(-1_234n)).toBe("-12.34");
  });
});

describe("divideRoundHalfUp", () => {
  it("rounds halves away from zero", () => {
    expect(divideRoundHalfUp(5n, 2n)).toBe(3n);
    expect(divideRoundHalfUp(-5n, 2n)).toBe(-3n);
    expect(divideRoundHalfUp(4n, 2n)).toBe(2n);
    expect(divideRoundHalfUp(1n, 3n)).toBe(0n);
    expect(divideRoundHalfUp(2n, 3n)).toBe(1n);
  });

  it("rejects division by zero", () => {
    expect(() => divideRoundHalfUp(1n, 0n)).toThrow(MoneyError);
  });
});

describe("convertEurCentsToToman", () => {
  it("converts using an integer Toman-per-EUR rate", () => {
    expect(convertEurCentsToToman(eurCents(12_999), 200_000n)).toBe(
      25_998_000n,
    );
    expect(convertEurCentsToToman(eurCents(1), 200_000n)).toBe(2_000n);
  });

  it("stays exact for very large amounts", () => {
    const amount = eurCents(99_999_999n);
    expect(convertEurCentsToToman(amount, 250_000n)).toBe(249_999_997_500n);
  });

  it("rejects a non-positive rate", () => {
    expect(() => convertEurCentsToToman(eurCents(100), 0n)).toThrow(MoneyError);
  });
});

describe("basis points", () => {
  it("applies rates as integers", () => {
    expect(applyBps(1_000n, 250)).toBe(25n);
    expect(applyBps(10_000_000n, 3_500)).toBe(3_500_000n);
    expect(addBps(1_000_000n, 150)).toBe(1_015_000n);
  });

  it("rounds half up", () => {
    expect(applyBps(5n, 5_000)).toBe(3n);
  });

  it("rejects fractional basis points", () => {
    expect(() => applyBps(100n, 1.5)).toThrow(MoneyError);
  });
});

describe("roundUpToUnit", () => {
  it("rounds customer prices up to the configured unit", () => {
    expect(roundUpToUnit(8_942_310n, 10_000n)).toBe(8_950_000n);
    expect(roundUpToUnit(8_950_000n, 10_000n)).toBe(8_950_000n);
    expect(roundUpToUnit(1n, 10_000n)).toBe(10_000n);
  });

  it("rejects a non-positive unit", () => {
    expect(() => roundUpToUnit(100n, 0n)).toThrow(MoneyError);
  });
});

describe("allocate", () => {
  it("splits without losing or inventing Toman", () => {
    const shares = allocate(toman(10_000), 3);
    expect(shares).toEqual([3_334n, 3_333n, 3_333n]);
    expect(shares.reduce((sum, share) => sum + share, 0n)).toBe(10_000n);
  });

  it("handles exact divisions and single parts", () => {
    expect(allocate(toman(900), 3)).toEqual([300n, 300n, 300n]);
    expect(allocate(toman(7), 1)).toEqual([7n]);
  });

  it("rejects invalid part counts", () => {
    expect(() => allocate(toman(100), 0)).toThrow(MoneyError);
    expect(() => allocate(toman(100), 1.5)).toThrow(MoneyError);
  });
});

describe("depositAmount", () => {
  const roundingUnit = 10_000n;

  it("uses the proportional deposit when it exceeds the minimum", () => {
    expect(
      depositAmount({
        total: toman(10_000_000),
        depositBps: 3_500,
        minimumToman: toman(500_000),
        roundingUnit,
      }),
    ).toBe(3_500_000n);
  });

  it("raises small orders to the configured minimum", () => {
    expect(
      depositAmount({
        total: toman(1_000_000),
        depositBps: 3_500,
        minimumToman: toman(500_000),
        roundingUnit,
      }),
    ).toBe(500_000n);
  });

  it("never exceeds the order total", () => {
    expect(
      depositAmount({
        total: toman(200_000),
        depositBps: 5_000,
        minimumToman: toman(500_000),
        roundingUnit,
      }),
    ).toBe(200_000n);
  });

  it("rounds up to the configured unit", () => {
    expect(
      depositAmount({
        total: toman(8_950_000),
        depositBps: 3_500,
        minimumToman: toman(0),
        roundingUnit,
      }),
    ).toBe(3_140_000n);
  });
});
