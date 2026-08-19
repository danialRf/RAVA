import { afterEach, describe, expect, it } from "vitest";

import { checkoutOrigin } from "./site";

const originalAppUrl = process.env.APP_URL;

afterEach(() => {
  if (originalAppUrl === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = originalAppUrl;
});

describe("checkoutOrigin", () => {
  it("uses the active loopback port for local production-build QA", () => {
    process.env.APP_URL = "http://localhost:3000";

    expect(checkoutOrigin("127.0.0.1:3001")).toBe("http://127.0.0.1:3001");
  });

  it("does not trust an arbitrary request host in deployed environments", () => {
    process.env.APP_URL = "https://rava.example";

    expect(checkoutOrigin("attacker.example")).toBe("https://rava.example");
  });
});
