import { describe, expect, it } from "vitest";

import { matchesImageSignature } from "./storage";

describe("matchesImageSignature", () => {
  it("recognizes supported image magic bytes", () => {
    expect(
      matchesImageSignature(new Uint8Array([0xff, 0xd8, 0xff]), "image/jpeg"),
    ).toBe(true);
    expect(
      matchesImageSignature(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        "image/png",
      ),
    ).toBe(true);
    expect(
      matchesImageSignature(
        new TextEncoder().encode("RIFF1234WEBP"),
        "image/webp",
      ),
    ).toBe(true);
  });

  it("rejects a file whose declared type does not match its contents", () => {
    expect(
      matchesImageSignature(
        new TextEncoder().encode("not an image"),
        "image/png",
      ),
    ).toBe(false);
    expect(
      matchesImageSignature(new Uint8Array([0xff, 0xd8, 0xff]), "image/webp"),
    ).toBe(false);
  });
});
