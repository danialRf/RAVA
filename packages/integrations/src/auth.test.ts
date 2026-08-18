import { describe, expect, it, vi } from "vitest";

import { ConsoleEmailProvider, verificationEmail } from "./email";
import { hashPassword, verifyPassword } from "./password";
import { FakeSmsProvider } from "./sms";
import { InMemoryPrivateStorage } from "./storage";

describe("authentication and account providers", () => {
  it("hashes passwords with Argon2 and verifies only the right secret", async () => {
    const encoded = await hashPassword("a-correct-long-password");
    expect(encoded).toMatch(/^\$argon2/);
    await expect(
      verifyPassword("a-correct-long-password", encoded),
    ).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", encoded)).resolves.toBe(
      false,
    );
    await expect(verifyPassword("anything", null)).resolves.toBe(false);
  });

  it("keeps development email and OTP delivery deterministic and observable", async () => {
    const emailLog = vi.fn();
    const smsLog = vi.fn();
    await new ConsoleEmailProvider(emailLog).send(
      verificationEmail("customer@example.com", "https://rava.test/verify"),
    );
    await new FakeSmsProvider(smsLog).sendOtpSms({
      phoneE164: "+989123456789",
      code: "123456",
      validForMinutes: 5,
    });
    expect(emailLog).toHaveBeenCalledOnce();
    expect(emailLog.mock.calls[0]?.[0]).toContain("customer@example.com");
    expect(smsLog.mock.calls[0]?.[0]).toContain("123456");
  });

  it("stores private uploads without publishing or mutating bytes", async () => {
    const storage = new InMemoryPrivateStorage();
    const bytes = new Uint8Array([1, 2, 3, 4]);
    await expect(
      storage.putPrivate("requests/user/image.png", bytes, "image/png"),
    ).resolves.toEqual({
      objectKey: "requests/user/image.png",
      contentType: "image/png",
      sizeBytes: 4,
    });
    await expect(
      storage.getPrivate("requests/user/image.png"),
    ).resolves.toEqual({ body: bytes, contentType: "image/png" });
    await expect(storage.getPrivate("missing")).resolves.toBeNull();
  });
});
