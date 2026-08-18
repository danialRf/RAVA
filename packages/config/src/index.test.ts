import { describe, expect, it } from "vitest";
import { loadEnvironment, publicRuntimeSummary } from "./index";

describe("environment validation", () => {
  it("provides deterministic local providers without credentials", () => {
    const environment = loadEnvironment({});

    expect(publicRuntimeSummary(environment).providers).toEqual({
      fx: "fake",
      payment: "fake",
      sms: "fake",
      email: "console",
      ai: "disabled",
    });
  });

  it("rejects invalid integer money configuration", () => {
    expect(() => loadEnvironment({ FX_FAKE_EUR_TOMAN: "20.5" })).toThrow();
  });
});
