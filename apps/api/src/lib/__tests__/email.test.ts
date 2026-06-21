import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AppError } from "../../middleware/error";

interface EmailEnv {
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
}

type SendEmailFn = (
  env: EmailEnv,
  msg: { to: string; subject: string; html: string; text?: string },
) => Promise<void>;

async function loadSendEmail(): Promise<SendEmailFn> {
  const mod = await import("../email");
  return mod.sendEmail as SendEmailFn;
}

describe("sendEmail", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("no-ops and logs when RESEND_API_KEY is missing", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const sendEmail = await loadSendEmail();

    await sendEmail(
      { RESEND_FROM_EMAIL: "Keyra <noreply@keyra.example>" },
      { to: "user@example.com", subject: "Hi", html: "<p>x</p>" },
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalled();
    const logArgs = infoSpy.mock.calls[0] ?? [];
    expect(String(logArgs[0])).toMatch(/email/);
    expect(String(logArgs[0])).toMatch(/scaffold/i);
  });

  it("posts to Resend with bearer auth when RESEND_API_KEY is set", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "em_123" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const sendEmail = await loadSendEmail();

    await sendEmail(
      {
        RESEND_API_KEY: "re_test_key",
        RESEND_FROM_EMAIL: "Keyra <noreply@keyra.example>",
      },
      {
        to: "user@example.com",
        subject: "Verify",
        html: "<p>click</p>",
        text: "click",
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer re_test_key");
    expect(headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(init.body as string);
    expect(body.from).toBe("Keyra <noreply@keyra.example>");
    expect(body.to).toEqual(["user@example.com"]);
    expect(body.subject).toBe("Verify");
    expect(body.html).toBe("<p>click</p>");
    expect(body.text).toBe("click");
  });

  it("throws AppError EMAIL_SEND_FAILED with status 502 on non-2xx response", async () => {
    fetchMock.mockResolvedValue(
      new Response("upstream boom", { status: 500 }),
    );
    const sendEmail = await loadSendEmail();

    let caught: unknown;
    try {
      await sendEmail(
        {
          RESEND_API_KEY: "re_test_key",
          RESEND_FROM_EMAIL: "Keyra <noreply@keyra.example>",
        },
        { to: "user@example.com", subject: "x", html: "<p>x</p>" },
      );
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(AppError);
    const e = caught as AppError;
    expect(e.code).toBe("EMAIL_SEND_FAILED");
    expect(e.status).toBe(502);
  });
});