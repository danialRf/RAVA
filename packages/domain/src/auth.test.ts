import { describe, expect, it } from "vitest";

import {
  isEmail,
  normalizeEmail,
  normalizeIranianMobile,
  passwordPolicyIssues,
  TOKEN_TTL_SECONDS,
} from "./auth";

describe("authentication domain rules", () => {
  it("normalizes email addresses without accepting malformed input", () => {
    expect(normalizeEmail("  Customer@Example.COM ")).toBe(
      "customer@example.com",
    );
    expect(isEmail("customer@example.com")).toBe(true);
    expect(isEmail("not-an-email")).toBe(false);
  });

  it.each([
    ["09123456789", "+989123456789"],
    ["+989123456789", "+989123456789"],
    ["(0912) 345-6789", "+989123456789"],
  ])("normalizes Iranian mobile %s", (input, expected) => {
    expect(normalizeIranianMobile(input)).toBe(expected);
  });

  it("rejects unsupported or malformed phone numbers", () => {
    expect(normalizeIranianMobile("+49123456789")).toBeNull();
    expect(normalizeIranianMobile("02112345678")).toBeNull();
  });

  it("enforces bounded passwords and short-lived OTPs", () => {
    expect(passwordPolicyIssues("short")).toHaveLength(1);
    expect(passwordPolicyIssues("a".repeat(10))).toEqual([]);
    expect(passwordPolicyIssues("a".repeat(129))).toHaveLength(1);
    expect(TOKEN_TTL_SECONDS.PHONE_OTP).toBe(300);
    expect(TOKEN_TTL_SECONDS.PASSWORD_RESET).toBe(3600);
  });
});
