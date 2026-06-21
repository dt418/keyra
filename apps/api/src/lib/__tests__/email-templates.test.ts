import { describe, it, expect } from "vitest";
import { verifyEmailTemplate } from "../email-templates/verify";

describe("verifyEmailTemplate", () => {
  it("returns a stable subject", () => {
    const t = verifyEmailTemplate({
      verifyUrl: "https://app.keyra.dev/verify-email/tok_abc",
      expiresInMinutes: 60 * 24,
    });
    expect(t.subject).toBe("Verify your Keyra email");
    expect(typeof t.subject).toBe("string");
    expect(t.subject.length).toBeGreaterThan(0);
  });

  it("returns html that includes the verify url and mentions expiry", () => {
    const url = "https://app.keyra.dev/verify-email/tok_xyz";
    const t = verifyEmailTemplate({ verifyUrl: url, expiresInMinutes: 1440 });
    expect(t.html).toContain(url);
    expect(t.html.toLowerCase()).toMatch(/24\s*hours|1440\s*minutes|expires/i);
  });

  it("returns a text fallback that includes the verify url and expiry", () => {
    const url = "https://app.keyra.dev/verify-email/tok_txt";
    const t = verifyEmailTemplate({ verifyUrl: url, expiresInMinutes: 60 * 24 });
    expect(t.text).toContain(url);
    expect(t.text).toMatch(/24\s*hours|1440/i);
  });

  it("is a pure function: same inputs produce structurally equal outputs", () => {
    const args = { verifyUrl: "https://x/y", expiresInMinutes: 30 };
    const a = verifyEmailTemplate(args);
    const b = verifyEmailTemplate(args);
    expect(a).toEqual(b);
  });
});