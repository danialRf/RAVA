import { describe, expect, it } from "vitest";
import { createHeartbeat } from "./health";

describe("createHeartbeat", () => {
  it("creates a deterministic healthy worker heartbeat", () => {
    const now = new Date("2026-08-14T00:00:00.000Z");

    expect(createHeartbeat(now)).toEqual({
      service: "rava-worker",
      status: "ok",
      timestamp: "2026-08-14T00:00:00.000Z",
    });
  });
});
