import { describe, it, expect, vi, beforeEach } from "vitest";
import { listLicensesHandler } from "../list";
import { createLicenseHandler } from "../create";
import { getLicenseHandler } from "../get";
import { updateLicenseHandler } from "../update";
import { revokeLicenseHandler } from "../revoke";

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
      if (key === "orgRole") return "admin";
      return undefined;
    }),
    set: vi.fn(),
    ...overrides,
  };
}

describe("listLicensesHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDB.prepare.mockClear();
    mockDB.bind.mockClear();
    mockDB.first.mockReset();
    mockDB.all.mockReset();
    mockDB.run.mockReset();
    mockDB.run.mockResolvedValue({ success: true });
  });

  it("should list licenses for admin user", async () => {
    mockDB.all.mockResolvedValueOnce([
      {
        id: "lic-1",
        product_id: "prod-1",
        product_name: "Product 1",
        type: "professional",
        status: "active",
        max_devices: 3,
        expires_at: null,
        feature_flags: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        revoked_at: null,
        revoked_reason: null,
      },
    ]);

    const ctx = createMockContext() as any;
    await listLicensesHandler(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: "lic-1",
            type: "professional",
            status: "active",
          }),
        ]),
      }),
    );
  });

  it("should throw if user not authenticated", async () => {
    const ctx = createMockContext({
      get: vi.fn().mockReturnValue(undefined),
    }) as any;

    await expect(listLicensesHandler(ctx)).rejects.toThrow(
      "Authentication required",
    );
  });
});

describe("createLicenseHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDB.prepare.mockClear();
    mockDB.bind.mockClear();
    mockDB.first.mockReset();
    mockDB.all.mockReset();
    mockDB.run.mockReset();
    mockDB.run.mockResolvedValue({ success: true });
  });

  it("should create license successfully", async () => {
    mockDB.first.mockResolvedValueOnce({ id: "prod-1" });
    mockDB.run.mockResolvedValue({ success: true });

    const ctx = createMockContext({
      req: {
        json: vi
          .fn()
          .mockResolvedValue({
            product_id: "prod-1",
            type: "professional",
            max_devices: 3,
          }),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({}),
        header: vi.fn().mockReturnValue("Bearer token"),
      },
    }) as any;

    await createLicenseHandler(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          product_id: "prod-1",
          type: "professional",
          status: "active",
          max_devices: 3,
          key: expect.stringMatching(/^[A-Z0-9-]+$/),
        }),
      }),
      201,
    );
  });

  it("should reject if product not found", async () => {
    mockDB.first.mockResolvedValueOnce(null);

    const ctx = createMockContext({
      req: {
        json: vi
          .fn()
          .mockResolvedValue({
            product_id: "non-existent",
            type: "professional",
          }),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({}),
        header: vi.fn().mockReturnValue("Bearer token"),
      },
    }) as any;

    await expect(createLicenseHandler(ctx)).rejects.toThrow(
      "Product not found",
    );
  });
});

describe("getLicenseHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDB.prepare.mockClear();
    mockDB.bind.mockClear();
    mockDB.first.mockReset();
    mockDB.all.mockReset();
    mockDB.run.mockReset();
    mockDB.run.mockResolvedValue({ success: true });
  });

  it("should return license details", async () => {
    mockDB.first.mockResolvedValueOnce({
      id: "lic-1",
      product_id: "prod-1",
      product_name: "Product 1",
      type: "professional",
      status: "active",
      max_devices: 3,
      expires_at: null,
      feature_flags: null,
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
      revoked_at: null,
      revoked_reason: null,
    });

    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({}),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({ id: "lic-1" }),
        header: vi.fn().mockReturnValue("Bearer token"),
      },
    }) as any;

    await getLicenseHandler(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: "lic-1",
          type: "professional",
        }),
      }),
    );
  });

  it("should throw if license not found", async () => {
    mockDB.first.mockResolvedValueOnce(null);

    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({}),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({ id: "non-existent" }),
        header: vi.fn().mockReturnValue("Bearer token"),
      },
    }) as any;

    await expect(getLicenseHandler(ctx)).rejects.toThrow("License not found");
  });
});

describe("updateLicenseHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDB.prepare.mockClear();
    mockDB.bind.mockClear();
    mockDB.first.mockReset();
    mockDB.all.mockReset();
    mockDB.run.mockReset();
    mockDB.run.mockResolvedValue({ success: true });
  });

  it("should update license successfully", async () => {
    mockDB.run.mockResolvedValue({ meta: { changes: 1 } });
    mockDB.first.mockResolvedValueOnce({
      id: "lic-1",
      product_id: "prod-1",
      product_name: "Product 1",
      type: "enterprise",
      status: "active",
      max_devices: 5,
      expires_at: null,
      feature_flags: null,
      created_at: "2024-01-01",
      updated_at: "2024-01-02",
      revoked_at: null,
      revoked_reason: null,
    });

    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({ type: "enterprise", max_devices: 5 }),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({ id: "lic-1" }),
        header: vi.fn().mockReturnValue("Bearer token"),
      },
    }) as any;

    await updateLicenseHandler(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "enterprise",
          max_devices: 5,
        }),
      }),
    );
  });
});

describe("revokeLicenseHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDB.prepare.mockClear();
    mockDB.bind.mockClear();
    mockDB.first.mockReset();
    mockDB.all.mockReset();
    mockDB.run.mockReset();
    mockDB.run.mockResolvedValue({ success: true });
  });

  it("should revoke license successfully", async () => {
    mockDB.run.mockResolvedValue({ meta: { changes: 1 } });

    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({ reason: "Policy violation" }),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({ id: "lic-1" }),
        header: vi.fn().mockReturnValue("Bearer token"),
      },
    }) as any;

    await revokeLicenseHandler(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: "lic-1",
          status: "revoked",
          revoked_reason: "Policy violation",
        }),
      }),
    );
  });

  it("should throw if license already revoked", async () => {
    mockDB.run.mockResolvedValue({ meta: { changes: 0 } });

    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({}),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({ id: "lic-1" }),
        header: vi.fn().mockReturnValue("Bearer token"),
      },
    }) as any;

    await expect(revokeLicenseHandler(ctx)).rejects.toThrow(
      "License not found or already revoked",
    );
  });
});
