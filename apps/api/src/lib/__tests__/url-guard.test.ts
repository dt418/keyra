import { describe, it, expect, vi, afterEach } from "vitest";
import { assertPublicUrl } from "../url-guard";

describe("assertPublicUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("accepts a public https URL", async () => {
    await expect(
      assertPublicUrl("https://example.com/webhook", false),
    ).resolves.toBeUndefined();
  });

  it("rejects http://", async () => {
    await expect(
      assertPublicUrl("http://example.com/x", false),
    ).rejects.toThrow(/https/i);
  });

  it("rejects localhost", async () => {
    await expect(assertPublicUrl("https://localhost/x", false)).rejects.toThrow(
      /blocked/i,
    );
  });

  it("rejects 127.0.0.1", async () => {
    await expect(assertPublicUrl("https://127.0.0.1/x", false)).rejects.toThrow(
      /blocked/i,
    );
  });

  it("rejects 10.0.0.0/8", async () => {
    await expect(assertPublicUrl("https://10.1.2.3/x", false)).rejects.toThrow(
      /blocked/i,
    );
  });

  it("rejects 192.168.0.0/16", async () => {
    await expect(
      assertPublicUrl("https://192.168.1.1/x", false),
    ).rejects.toThrow(/blocked/i);
  });

  it("rejects 169.254.169.254 (cloud metadata)", async () => {
    await expect(
      assertPublicUrl("https://169.254.169.254/latest/meta-data", false),
    ).rejects.toThrow(/blocked/i);
  });

  it("rejects *.internal", async () => {
    await expect(
      assertPublicUrl("https://api.internal/x", false),
    ).rejects.toThrow(/blocked/i);
  });

  it("rejects *.local", async () => {
    await expect(
      assertPublicUrl("https://myhost.local/x", false),
    ).rejects.toThrow(/blocked/i);
  });

  it("rejects *.localhost", async () => {
    await expect(
      assertPublicUrl("https://box.localhost/x", false),
    ).rejects.toThrow(/blocked/i);
  });

  it("rejects 172.16.0.0/12 boundary", async () => {
    await expect(
      assertPublicUrl("https://172.20.5.6/x", false),
    ).rejects.toThrow(/blocked/i);
  });

  it("rejects ::1 IPv6 loopback", async () => {
    await expect(assertPublicUrl("https://[::1]/x", false)).rejects.toThrow(
      /blocked/i,
    );
  });

  it("rejects fe80 IPv6 link-local", async () => {
    await expect(assertPublicUrl("https://[fe80::1]/x", false)).rejects.toThrow(
      /blocked/i,
    );
  });

  it("rejects URL that resolves to private IP when resolveDns=true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ Answer: [{ data: "10.0.0.5" }] }), {
            headers: { "content-type": "application/dns-json" },
          }),
      ),
    );
    await expect(
      assertPublicUrl("https://attacker.example.com/x", true),
    ).rejects.toThrow(/resolves to blocked/i);
  });

  it("accepts URL whose DNS resolves to a public IP", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ Answer: [{ data: "1.1.1.1" }] }), {
            headers: { "content-type": "application/dns-json" },
          }),
      ),
    );
    await expect(
      assertPublicUrl("https://attacker.example.com/x", true),
    ).resolves.toBeUndefined();
  });

  it("rejects malformed URL", async () => {
    await expect(assertPublicUrl("not-a-url", false)).rejects.toThrow();
  });
});
