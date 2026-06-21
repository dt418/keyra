import { describe, it, expect, vi, beforeEach } from "vitest";
import { createWebhookHandler } from "../create";
import { updateWebhookHandler } from "../update";
import { testWebhookHandler } from "../test";
import { AppError } from "../../../middleware/error";

const mockDB = {
  prepare: vi.fn().mockReturnThis(),
  bind: vi.fn().mockReturnThis(),
  first: vi.fn(),
  all: vi.fn(),
  run: vi.fn().mockResolvedValue({ success: true }),
};

const mockEnv = {
  DB: mockDB,
  JWT_SECRET: "test-secret",
  JWT_REFRESH_SECRET: "test-refresh",
};

function createMockContext(overrides: Record<string, unknown> = {}) {
  return {
    req: {
      json: vi.fn().mockResolvedValue({}),
      query: vi.fn().mockReturnValue({}),
      param: vi.fn().mockReturnValue({}),
      header: vi.fn().mockReturnValue("Bearer token"),
    },
    env: mockEnv,
    executionCtx: { waitUntil: vi.fn() },
    json: vi
      .fn()
      .mockReturnValue(new Response(JSON.stringify({}), { status: 200 })),
    get: vi.fn().mockImplementation((key: string) => {
      if (key === "userId") return "user-123";
      if (key === "userEmail") return "test@example.com";
      if (key === "orgId") return "org-1";
      if (key === "orgRole") return "owner";
      return undefined;
    }),
    set: vi.fn(),
    ...overrides,
  };
}

describe("createWebhookHandler — SSRF guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDB.prepare.mockClear();
    mockDB.bind.mockClear();
    mockDB.first.mockReset();
    mockDB.all.mockReset();
    mockDB.run.mockReset();
    mockDB.run.mockResolvedValue({ success: true });
  });

  it("creates webhook with public HTTPS URL", async () => {
    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({
          url: "https://api.example.com/webhook",
          events: ["license.created"],
          active: true,
        }),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({}),
        header: vi.fn().mockReturnValue("Bearer token"),
      },
    }) as any;

    await createWebhookHandler(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          url: "https://api.example.com/webhook",
        }),
      }),
      201,
    );
    expect(mockDB.run).toHaveBeenCalledTimes(1);
  });

  it("rejects http:// (non-https) with WEBHOOK_URL_BLOCKED", async () => {
    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({
          url: "http://api.example.com/webhook",
          events: ["license.created"],
          active: true,
        }),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({}),
        header: vi.fn().mockReturnValue("Bearer token"),
      },
    }) as any;

    await expect(createWebhookHandler(ctx)).rejects.toThrow(AppError);
    await expect(createWebhookHandler(ctx)).rejects.toMatchObject({
      code: "WEBHOOK_URL_BLOCKED",
      status: 400,
    });
  });

  it("rejects localhost with WEBHOOK_URL_BLOCKED", async () => {
    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({
          url: "https://localhost:8080/webhook",
          events: ["license.created"],
          active: true,
        }),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({}),
        header: vi.fn().mockReturnValue("Bearer token"),
      },
    }) as any;

    await expect(createWebhookHandler(ctx)).rejects.toMatchObject({
      code: "WEBHOOK_URL_BLOCKED",
      status: 400,
    });
    expect(mockDB.run).not.toHaveBeenCalled();
  });

  it("rejects 127.0.0.1 loopback with WEBHOOK_URL_BLOCKED", async () => {
    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({
          url: "https://127.0.0.1/hook",
          events: ["license.created"],
          active: true,
        }),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({}),
        header: vi.fn().mockReturnValue("Bearer token"),
      },
    }) as any;

    await expect(createWebhookHandler(ctx)).rejects.toMatchObject({
      code: "WEBHOOK_URL_BLOCKED",
      status: 400,
    });
  });

  it("rejects cloud metadata IP with WEBHOOK_URL_BLOCKED", async () => {
    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({
          url: "https://169.254.169.254/latest/meta-data/",
          events: ["license.created"],
          active: true,
        }),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({}),
        header: vi.fn().mockReturnValue("Bearer token"),
      },
    }) as any;

    await expect(createWebhookHandler(ctx)).rejects.toMatchObject({
      code: "WEBHOOK_URL_BLOCKED",
      status: 400,
    });
  });

  it("rejects 10.x RFC1918 with WEBHOOK_URL_BLOCKED", async () => {
    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({
          url: "https://10.0.0.5/internal",
          events: ["license.created"],
          active: true,
        }),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({}),
        header: vi.fn().mockReturnValue("Bearer token"),
      },
    }) as any;

    await expect(createWebhookHandler(ctx)).rejects.toMatchObject({
      code: "WEBHOOK_URL_BLOCKED",
      status: 400,
    });
  });

  it("rejects .internal host with WEBHOOK_URL_BLOCKED", async () => {
    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({
          url: "https://api.internal/webhook",
          events: ["license.created"],
          active: true,
        }),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({}),
        header: vi.fn().mockReturnValue("Bearer token"),
      },
    }) as any;

    await expect(createWebhookHandler(ctx)).rejects.toMatchObject({
      code: "WEBHOOK_URL_BLOCKED",
      status: 400,
    });
  });
});

describe("updateWebhookHandler — SSRF guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDB.prepare.mockClear();
    mockDB.bind.mockClear();
    mockDB.first.mockReset();
    mockDB.all.mockReset();
    mockDB.run.mockReset();
    mockDB.run.mockResolvedValue({ success: true });
  });

  it("updates webhook with public HTTPS URL", async () => {
    mockDB.run.mockResolvedValueOnce({ meta: { changes: 1 } });

    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({
          url: "https://api.example.com/v2",
          events: ["license.created", "license.revoked"],
        }),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({ id: "wh-1" }),
        header: vi.fn().mockReturnValue("Bearer token"),
      },
    }) as any;

    await updateWebhookHandler(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ id: "wh-1" }),
      }),
    );
  });

  it("does not call URL guard when body has no url field", async () => {
    mockDB.run.mockResolvedValueOnce({ meta: { changes: 1 } });

    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({ active: false }),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({ id: "wh-1" }),
        header: vi.fn().mockReturnValue("Bearer token"),
      },
    }) as any;

    await updateWebhookHandler(ctx);

    expect(ctx.json).toHaveBeenCalled();
    expect(mockDB.run).toHaveBeenCalledTimes(1);
  });

  it("rejects private URL update with WEBHOOK_URL_BLOCKED", async () => {
    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({
          url: "https://192.168.1.1/admin",
        }),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({ id: "wh-1" }),
        header: vi.fn().mockReturnValue("Bearer token"),
      },
    }) as any;

    await expect(updateWebhookHandler(ctx)).rejects.toMatchObject({
      code: "WEBHOOK_URL_BLOCKED",
      status: 400,
    });
    expect(mockDB.run).not.toHaveBeenCalled();
  });

  it("rejects metadata IP update with WEBHOOK_URL_BLOCKED", async () => {
    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({
          url: "https://169.254.169.254/latest",
        }),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({ id: "wh-1" }),
        header: vi.fn().mockReturnValue("Bearer token"),
      },
    }) as any;

    await expect(updateWebhookHandler(ctx)).rejects.toMatchObject({
      code: "WEBHOOK_URL_BLOCKED",
      status: 400,
    });
  });
});

describe("testWebhookHandler — SSRF guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDB.prepare.mockClear();
    mockDB.bind.mockClear();
    mockDB.first.mockReset();
    mockDB.all.mockReset();
    mockDB.run.mockReset();
    mockDB.run.mockResolvedValue({ success: true });
  });

  it("rejects test when stored URL points at private IP", async () => {
    mockDB.first.mockResolvedValueOnce({
      id: "wh-1",
      organization_id: "org-1",
      url: "https://10.0.0.5/internal",
      secret_hash: "hash",
      events: '["license.created"]',
      active: 1,
    });

    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({}),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({ id: "wh-1" }),
        header: vi.fn().mockReturnValue("Bearer token"),
      },
    }) as any;

    await expect(testWebhookHandler(ctx)).rejects.toMatchObject({
      code: "WEBHOOK_URL_BLOCKED",
      status: 400,
    });
    expect(mockDB.run).not.toHaveBeenCalled();
  });

  it("rejects test when stored URL is localhost", async () => {
    mockDB.first.mockResolvedValueOnce({
      id: "wh-1",
      organization_id: "org-1",
      url: "https://localhost:9000/hook",
      secret_hash: "hash",
      events: '["license.created"]',
      active: 1,
    });

    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({}),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({ id: "wh-1" }),
        header: vi.fn().mockReturnValue("Bearer token"),
      },
    }) as any;

    await expect(testWebhookHandler(ctx)).rejects.toMatchObject({
      code: "WEBHOOK_URL_BLOCKED",
      status: 400,
    });
  });
});
