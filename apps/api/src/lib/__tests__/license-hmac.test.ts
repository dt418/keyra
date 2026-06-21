import { describe, it, expect } from "vitest";
import { generateLicenseKey, verifyLicenseHmac } from "../license";

describe("license HMAC", () => {
  it("round-trips a freshly generated key", async () => {
    const key = await generateLicenseKey("test-secret-xyz");
    expect(key).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}\.[A-Z0-9]{12}$/);
    expect(await verifyLicenseHmac(key, "test-secret-xyz")).toBe(true);
  });

  it("rejects a tampered key", async () => {
    const key = await generateLicenseKey("test-secret-xyz");
    const tampered = "ZZZZ" + key.slice(4);
    expect(await verifyLicenseHmac(tampered, "test-secret-xyz")).toBe(false);
  });

  it("rejects a key signed with a different secret", async () => {
    const key = await generateLicenseKey("secret-a");
    expect(await verifyLicenseHmac(key, "secret-b")).toBe(false);
  });

  it("returns 'legacy' for keys without a tag", async () => {
    const legacyKey = "AAAA-BBBB-CCCC-DDDD";
    expect(await verifyLicenseHmac(legacyKey, "any-secret")).toBe("legacy");
  });
});
