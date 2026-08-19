import { describe, expect, it } from "vitest";

import { hasAdminPermission, isStaffRole } from "./admin";

describe("admin RBAC", () => {
  it("never grants a customer admin access", () => {
    expect(isStaffRole("CUSTOMER")).toBe(false);
    expect(hasAdminPermission("CUSTOMER", "ORDERS_READ")).toBe(false);
  });

  it("grants owners and admins the complete operating surface", () => {
    expect(hasAdminPermission("OWNER", "PRICING_WRITE")).toBe(true);
    expect(hasAdminPermission("ADMIN", "PAYMENTS_REVIEW")).toBe(true);
  });

  it("keeps specialist roles least-privileged", () => {
    expect(hasAdminPermission("BUYER_GERMANY", "PROCUREMENT_WRITE")).toBe(true);
    expect(hasAdminPermission("BUYER_GERMANY", "PRICING_WRITE")).toBe(false);
    expect(hasAdminPermission("FINANCE", "PAYMENTS_REVIEW")).toBe(true);
    expect(hasAdminPermission("CONTENT_EDITOR", "PAYMENTS_READ")).toBe(false);
  });
});
