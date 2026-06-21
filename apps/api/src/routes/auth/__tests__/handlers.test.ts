import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../lib/email", async () => {
  const actual =
    await vi.importActual<typeof import("../../../lib/email")>(
      "../../../lib/email",
    );
  return {
    ...actual,
    sendEmail: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("../../../routes/auth/verify-email", async () => {
  const actual = await vi.importActual<
    typeof import("../../../routes/auth/verify-email")
  >("../../../routes/auth/verify-email");
  return {
    ...actual,
    issueVerificationToken: vi.fn(async () => "tok_mock"),
  };
});

import { registerHandler } from "../register";
import { loginHandler } from "../login";
import { refreshHandler } from "../refresh";
import { signRefreshToken } from "../../../lib/jwt";
import { sendEmail } from "../../../lib/email";
import { issueVerificationToken } from "../verify-email";

const TEST_SECRET = "test-secret-key";
const TEST_REFRESH_SECRET = "test-refresh-secret-key";

const mockDB = {
  prepare: vi.fn().mockReturnThis(),
  bind: vi.fn().mockReturnThis(),
  first: vi.fn(),
  run: vi.fn().mockResolvedValue({ success: true }),
  all: vi.fn().mockResolvedValue({ results: [] }),
};

const mockKV = {
  get: vi.fn(),
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  list: vi.fn().mockResolvedValue({ keys: [] }),
};

const mockEnv = {
  DB: mockDB,
  SESSIONS: mockKV,
  JWT_SECRET: TEST_SECRET,
  JWT_REFRESH_SECRET: TEST_REFRESH_SECRET,
  APP_URL: "http://localhost:5174",
};

function createMockContext(body: unknown) {
  return {
    req: {
      json: vi.fn().mockResolvedValue(body),
      param: vi.fn().mockReturnValue({}),
      header: vi.fn().mockReturnValue(undefined),
    },
    env: mockEnv,
    executionCtx: { waitUntil: vi.fn() },
    json: vi
      .fn()
      .mockReturnValue(new Response(JSON.stringify({}), { status: 200 })),
    get: vi.fn(),
    set: vi.fn(),
  };
}

describe("registerHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should register a new user successfully", async () => {
    mockDB.first.mockResolvedValueOnce(null);
    const ctx = createMockContext({
      email: "test@example.com",
      password: "password123",
      name: "Test User",
    }) as any;

    await registerHandler(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          access_token: expect.any(String),
          refresh_token: expect.any(String),
          user: expect.objectContaining({ email: "test@example.com" }),
        }),
      }),
      201,
    );
  });

  it("should reject duplicate email", async () => {
    mockDB.first.mockResolvedValueOnce({ id: "existing-user" });
    const ctx = createMockContext({
      email: "existing@example.com",
      password: "password123",
      name: "Existing",
    }) as any;

    await expect(registerHandler(ctx)).rejects.toThrow("User already exists");
  });

  it("should provision a default workspace and owner membership", async () => {
    mockDB.first.mockResolvedValueOnce(null);
    const ctx = createMockContext({
      email: "owner@example.com",
      password: "password123",
      name: "Owner User",
    }) as any;

    await registerHandler(ctx);

    const preparedSql = mockDB.prepare.mock.calls.map((c) => c[0]);
    expect(preparedSql).toEqual(
      expect.arrayContaining([
        expect.stringContaining("INSERT INTO organizations"),
        expect.stringContaining("INSERT INTO org_members"),
      ]),
    );

    const memberSql = mockDB.prepare.mock.calls
      .map((c) => String(c[0]))
      .find((sql) => sql.includes("INSERT INTO org_members"));
    expect(memberSql).toContain("'owner'");
  });

  it("should issue a verification token and send a verification email", async () => {
    mockDB.first.mockResolvedValueOnce(null);
    const ctx = createMockContext({
      email: "verify@example.com",
      password: "password123",
      name: "Verify User",
    }) as any;

    await registerHandler(ctx);

    expect(issueVerificationToken).toHaveBeenCalledTimes(1);
    const [kvArg, userIdArg] = (issueVerificationToken as any).mock.calls[0];
    expect(kvArg).toBe(mockKV);
    expect(userIdArg).toEqual(expect.any(String));

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [envArg, msgArg] = (sendEmail as any).mock.calls[0];
    expect(envArg).toBe(mockEnv);
    expect(msgArg.to).toBe("verify@example.com");
    expect(msgArg.subject).toBe("Verify your Keyra email");
    expect(msgArg.html).toContain("/verify-email/tok_mock");
    expect(msgArg.html).toContain("http://localhost:5174");
    expect(msgArg.text).toContain("/verify-email/tok_mock");
  });

  it("should still return 201 when sendEmail throws", async () => {
    (sendEmail as any).mockRejectedValueOnce(new Error("resend down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockDB.first.mockResolvedValueOnce(null);
    const ctx = createMockContext({
      email: "resilient@example.com",
      password: "password123",
      name: "Resilient User",
    }) as any;

    await expect(registerHandler(ctx)).resolves.not.toThrow();
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          access_token: expect.any(String),
          refresh_token: expect.any(String),
        }),
      }),
      201,
    );
    expect(issueVerificationToken).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalledWith(
      "[register] verification email send failed",
      expect.any(Error),
    );
  });
});

describe("loginHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockEnv as any).REQUIRE_EMAIL_VERIFICATION = "0";
  });

  it("should login user with valid credentials", async () => {
    const { hashPassword } = await import("../../../lib/password");
    const hashedPassword = await hashPassword("password123");

    mockDB.first.mockResolvedValueOnce({
      id: "user-123",
      email: "test@example.com",
      password_hash: hashedPassword,
      name: "Test User",
    });

    const ctx = createMockContext({
      email: "test@example.com",
      password: "password123",
    }) as any;

    await loginHandler(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          access_token: expect.any(String),
          refresh_token: expect.any(String),
          user: expect.objectContaining({ email: "test@example.com" }),
        }),
      }),
      200,
    );
  });

  it("should reject invalid email", async () => {
    mockDB.first.mockResolvedValueOnce(null);
    const ctx = createMockContext({
      email: "notfound@example.com",
      password: "password123",
    }) as any;

    await expect(loginHandler(ctx)).rejects.toThrow(
      "Invalid email or password",
    );
  });

  it("allows login when REQUIRE_EMAIL_VERIFICATION=0 even if email_verified=0", async () => {
    const { hashPassword } = await import("../../../lib/password");
    const hashedPassword = await hashPassword("password123");
    (mockEnv as any).REQUIRE_EMAIL_VERIFICATION = "0";

    mockDB.first.mockResolvedValueOnce({
      id: "user-gate-off",
      email: "gateoff@example.com",
      password_hash: hashedPassword,
      name: "Gate Off",
      email_verified: 0,
    });

    const ctx = createMockContext({
      email: "gateoff@example.com",
      password: "password123",
    }) as any;

    await loginHandler(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          access_token: expect.any(String),
          refresh_token: expect.any(String),
        }),
      }),
      200,
    );
  });

  it("allows login when REQUIRE_EMAIL_VERIFICATION=1 and email_verified=1", async () => {
    const { hashPassword } = await import("../../../lib/password");
    const hashedPassword = await hashPassword("password123");
    (mockEnv as any).REQUIRE_EMAIL_VERIFICATION = "1";

    mockDB.first.mockResolvedValueOnce({
      id: "user-verified",
      email: "verified@example.com",
      password_hash: hashedPassword,
      name: "Verified User",
      email_verified: 1,
    });

    const ctx = createMockContext({
      email: "verified@example.com",
      password: "password123",
    }) as any;

    await loginHandler(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          access_token: expect.any(String),
          refresh_token: expect.any(String),
        }),
      }),
      200,
    );
  });

  it("blocks login with 403 EMAIL_NOT_VERIFIED when REQUIRE_EMAIL_VERIFICATION=1 and email_verified=0", async () => {
    const { hashPassword } = await import("../../../lib/password");
    const hashedPassword = await hashPassword("password123");
    (mockEnv as any).REQUIRE_EMAIL_VERIFICATION = "1";

    mockDB.first.mockResolvedValueOnce({
      id: "user-unverified",
      email: "unverified@example.com",
      password_hash: hashedPassword,
      name: "Unverified User",
      email_verified: 0,
    });

    const ctx = createMockContext({
      email: "unverified@example.com",
      password: "password123",
    }) as any;

    await expect(loginHandler(ctx)).rejects.toMatchObject({
      code: "EMAIL_NOT_VERIFIED",
      status: 403,
      message: "Please verify your email before logging in",
    });
  });
});

describe("refreshHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should refresh tokens with valid refresh token", async () => {
    const refreshToken = await signRefreshToken(
      { sub: "user-123", email: "test@example.com", jti: "old-session" },
      TEST_REFRESH_SECRET,
    );

    mockDB.first.mockResolvedValueOnce({ revoked_at: null });
    mockDB.first.mockResolvedValueOnce({
      id: "user-123",
      email: "test@example.com",
    });
    const ctx = createMockContext({ refresh_token: refreshToken }) as any;

    await refreshHandler(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          access_token: expect.any(String),
          refresh_token: expect.any(String),
        }),
      }),
    );
    expect(mockKV.put).toHaveBeenCalledWith(
      "session:old-session",
      "revoked",
      expect.objectContaining({ expirationTtl: expect.any(Number) }),
    );
  });

  it("should reject invalid refresh token", async () => {
    const ctx = createMockContext({ refresh_token: "invalid-token" }) as any;

    await expect(refreshHandler(ctx)).rejects.toThrow(
      "Invalid or expired refresh token",
    );
  });

  it("should detect refresh token reuse and revoke all user sessions", async () => {
    const refreshToken = await signRefreshToken(
      { sub: "user-123", email: "test@example.com", jti: "reused-session" },
      TEST_REFRESH_SECRET,
    );

    mockDB.first.mockResolvedValueOnce({
      revoked_at: "2026-01-01T00:00:00.000Z",
    });
    const ctx = createMockContext({ refresh_token: refreshToken }) as any;

    await expect(refreshHandler(ctx)).rejects.toThrow(
      "Refresh token reuse detected",
    );
  });
});
