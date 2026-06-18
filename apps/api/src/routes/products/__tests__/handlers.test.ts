import { describe, it, expect, vi, beforeEach } from "vitest";
import { listProductsHandler } from "../list";
import { createProductHandler } from "../create";
import { getProductHandler } from "../get";
import { updateProductHandler } from "../update";
import { deleteProductHandler } from "../delete";

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

describe("listProductsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDB.prepare.mockClear();
    mockDB.bind.mockClear();
    mockDB.first.mockReset();
    mockDB.all.mockReset();
    mockDB.run.mockReset();
    mockDB.run.mockResolvedValue({ success: true });
  });

  it("should list products for admin user", async () => {
    mockDB.first.mockResolvedValueOnce({ org_id: "org-1" });
    mockDB.all.mockResolvedValueOnce([
      {
        id: "prod-1",
        name: "Product 1",
        description: "Desc 1",
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
      },
      {
        id: "prod-2",
        name: "Product 2",
        description: null,
        created_at: "2024-01-02",
        updated_at: "2024-01-02",
      },
    ]);

    const ctx = createMockContext() as any;
    await listProductsHandler(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ id: "prod-1", name: "Product 1" }),
          expect.objectContaining({ id: "prod-2", name: "Product 2" }),
        ]),
        pagination: expect.objectContaining({
          cursor: null,
          has_more: false,
        }),
      }),
    );
  });

  it("should throw if user not authenticated", async () => {
    const ctx = createMockContext({
      get: vi.fn().mockReturnValue(undefined),
    }) as any;

    await expect(listProductsHandler(ctx)).rejects.toThrow(
      "Authentication required",
    );
  });

  it("should throw if user is not admin", async () => {
    const ctx = createMockContext({
      get: vi.fn().mockImplementation((key: string) => {
        if (key === "userId") return "user-123";
        if (key === "orgId") return undefined;
        return undefined;
      }),
      req: {
        json: vi.fn().mockResolvedValue({}),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({}),
        header: vi.fn().mockReturnValue("Bearer token"),
      },
    }) as any;
    await expect(listProductsHandler(ctx)).rejects.toThrow(
      "Admin or owner role required",
    );
  });
});

describe("createProductHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDB.prepare.mockClear();
    mockDB.bind.mockClear();
    mockDB.first.mockReset();
    mockDB.all.mockReset();
    mockDB.run.mockReset();
    mockDB.run.mockResolvedValue({ success: true });
  });

  it("should create product successfully", async () => {
    mockDB.first.mockResolvedValueOnce({ org_id: "org-1" });
    mockDB.run.mockResolvedValue({ success: true });

    const ctx = createMockContext({
      req: {
        json: vi
          .fn()
          .mockResolvedValue({
            name: "Test Product",
            description: "Test desc",
          }),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({}),
        header: vi.fn().mockReturnValue("Bearer token"),
      },
    }) as any;

    await createProductHandler(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Test Product",
          description: "Test desc",
          api_key: expect.stringMatching(/^[a-f0-9-]+$/),
        }),
      }),
      201,
    );
  });

  it("should reject if user is not admin", async () => {
    const ctx = createMockContext({
      get: vi.fn().mockImplementation((key: string) => {
        if (key === "userId") return "user-123";
        if (key === "orgId") return undefined;
        return undefined;
      }),
      req: {
        json: vi.fn().mockResolvedValue({ name: "Test Product" }),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({}),
        header: vi.fn().mockReturnValue("Bearer token"),
      },
    }) as any;

    await expect(createProductHandler(ctx)).rejects.toThrow(
      "Admin or owner role required",
    );
  });
});

describe("getProductHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDB.prepare.mockClear();
    mockDB.bind.mockClear();
    mockDB.first.mockReset();
    mockDB.all.mockReset();
    mockDB.run.mockReset();
    mockDB.run.mockResolvedValue({ success: true });
  });

  it("should return product details for admin", async () => {
    mockDB.first.mockResolvedValueOnce({
      id: "prod-1",
      name: "Test Product",
      description: "Desc",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
    });

    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({}),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({ id: "prod-1" }),
        header: vi.fn().mockReturnValue("Bearer token"),
      },
    }) as any;

    await getProductHandler(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: "prod-1",
          name: "Test Product",
        }),
      }),
    );
  });

  it("should throw if product not found", async () => {
    mockDB.first.mockResolvedValueOnce(null);

    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({}),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({ id: "non-existent" }),
        header: vi.fn().mockReturnValue("Bearer token"),
      },
    }) as any;

    await expect(getProductHandler(ctx)).rejects.toThrow("Product not found");
  });
});

describe("updateProductHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDB.prepare.mockClear();
    mockDB.bind.mockClear();
    mockDB.first.mockReset();
    mockDB.all.mockReset();
    mockDB.run.mockReset();
    mockDB.run.mockResolvedValue({ success: true });
  });

  it("should update product successfully", async () => {
    mockDB.run.mockResolvedValue({ meta: { changes: 1 } });
    mockDB.first.mockResolvedValueOnce({
      id: "prod-1",
      name: "Updated",
      description: "New desc",
      created_at: "2024-01-01",
      updated_at: "2024-01-02",
    });

    const ctx = createMockContext({
      req: {
        json: vi
          .fn()
          .mockResolvedValue({ name: "Updated", description: "New desc" }),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({ id: "prod-1" }),
        header: vi.fn().mockReturnValue("Bearer token"),
      },
    }) as any;

    await updateProductHandler(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Updated",
          description: "New desc",
        }),
      }),
    );
  });

  it("should return unchanged when no updates provided", async () => {
    mockDB.first.mockResolvedValueOnce({
      id: "prod-1",
      name: "Product",
      description: "Desc",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
    });

    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({}),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({ id: "prod-1" }),
        header: vi.fn().mockReturnValue("Bearer token"),
      },
    }) as any;

    await updateProductHandler(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: "prod-1",
          name: "Product",
        }),
      }),
    );
  });
});

describe("deleteProductHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDB.prepare.mockClear();
    mockDB.bind.mockClear();
    mockDB.first.mockReset();
    mockDB.all.mockReset();
    mockDB.run.mockReset();
    mockDB.run.mockResolvedValue({ success: true });
  });

  it("should delete product as owner", async () => {
    mockDB.first.mockResolvedValueOnce({ org_id: "org-1" });
    mockDB.run.mockResolvedValue({ meta: { changes: 1 } });

    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({}),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({ id: "prod-1" }),
        header: vi.fn().mockReturnValue("Bearer token"),
      },
    }) as any;

    await deleteProductHandler(ctx);

    expect(ctx.json).toHaveBeenCalledWith({ data: { success: true } });
  });

  it("should return 403 for non-owner", async () => {
    const ctx = createMockContext({
      get: vi.fn().mockImplementation((key: string) => {
        if (key === "userId") return "user-123";
        if (key === "orgId") return "org-1";
        if (key === "orgRole") return "admin";
        return undefined;
      }),
      req: {
        json: vi.fn().mockResolvedValue({}),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({ id: "prod-1" }),
        header: vi.fn().mockReturnValue("Bearer token"),
      },
    }) as any;

    await expect(deleteProductHandler(ctx)).rejects.toThrow(
      "Only owners can delete products",
    );
  });
});
