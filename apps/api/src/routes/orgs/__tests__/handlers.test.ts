import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listOrgsHandler } from '../list';
import { createOrgHandler } from '../create';
import { getOrgHandler } from '../get';
import { updateOrgHandler } from '../update';

const mockDB = {
  prepare: vi.fn().mockReturnThis(),
  bind: vi.fn().mockReturnThis(),
  first: vi.fn(),
  all: vi.fn(),
  run: vi.fn().mockResolvedValue({ success: true }),
};

const mockEnv = {
  DB: mockDB,
  JWT_SECRET: 'test-secret',
  JWT_REFRESH_SECRET: 'test-refresh',
};

function createMockContext(overrides: Record<string, unknown> = {}) {
  return {
    req: {
      json: vi.fn().mockResolvedValue({}),
      query: vi.fn().mockReturnValue({}),
      param: vi.fn().mockReturnValue({}),
      header: vi.fn().mockReturnValue('Bearer token'),
    },
    env: mockEnv,
    json: vi.fn().mockReturnValue(new Response(JSON.stringify({}), { status: 200 })),
    get: vi.fn().mockImplementation((key: string) => {
      if (key === 'userId') return 'user-123';
      if (key === 'userEmail') return 'test@example.com';
      return undefined;
    }),
    set: vi.fn(),
    ...overrides,
  };
}

describe('listOrgsHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list user organizations with cursor pagination', async () => {
    mockDB.all.mockResolvedValueOnce([
      { id: 'org-1', name: 'Org 1', slug: 'org-1', plan: 'free', created_at: '2024-01-01', updated_at: '2024-01-01' },
      { id: 'org-2', name: 'Org 2', slug: 'org-2', plan: 'pro', created_at: '2024-01-02', updated_at: '2024-01-02' },
    ]);

    const ctx = createMockContext() as any;
    await listOrgsHandler(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ id: 'org-1', name: 'Org 1' }),
          expect.objectContaining({ id: 'org-2', name: 'Org 2' }),
        ]),
        pagination: expect.objectContaining({
          cursor: null,
          has_more: false,
        }),
      })
    );
  });

  it('should throw if user not authenticated', async () => {
    const ctx = createMockContext({
      get: vi.fn().mockReturnValue(undefined),
    }) as any;

    await expect(listOrgsHandler(ctx)).rejects.toThrow('Authentication required');
  });
});

describe('createOrgHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create organization successfully', async () => {
    mockDB.first.mockResolvedValueOnce(null);
    mockDB.run.mockResolvedValue({ success: true });

    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({ name: 'Test Org', slug: 'test-org' }),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({}),
        header: vi.fn().mockReturnValue('Bearer token'),
      },
    }) as any;

    await createOrgHandler(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Test Org',
          slug: 'test-org',
          plan: 'free',
        }),
      }),
      201
    );
  });

  it('should reject duplicate slug', async () => {
    mockDB.first.mockResolvedValueOnce({ id: 'existing-org' });

    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({ name: 'Test Org', slug: 'existing-slug' }),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({}),
        header: vi.fn().mockReturnValue('Bearer token'),
      },
    }) as any;

    await expect(createOrgHandler(ctx)).rejects.toThrow('Organization slug already exists');
  });
});

describe('getOrgHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return organization details for member', async () => {
    mockDB.first
      .mockResolvedValueOnce({ id: 'member-1' })
      .mockResolvedValueOnce({ id: 'org-1', name: 'Test Org', slug: 'test-org', plan: 'free', created_at: '2024-01-01', updated_at: '2024-01-01' });

    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({}),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({ id: 'org-1' }),
        header: vi.fn().mockReturnValue('Bearer token'),
      },
    }) as any;

    await getOrgHandler(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: 'org-1',
          name: 'Test Org',
          slug: 'test-org',
        }),
      })
    );
  });

  it('should throw if user is not a member', async () => {
    mockDB.first.mockResolvedValueOnce(null);

    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({}),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({ id: 'org-1' }),
        header: vi.fn().mockReturnValue('Bearer token'),
      },
    }) as any;

    await expect(getOrgHandler(ctx)).rejects.toThrow('Organization not found or access denied');
  });
});

describe('updateOrgHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update organization as owner', async () => {
    mockDB.first
      .mockResolvedValueOnce({ role: 'owner' })
      .mockResolvedValueOnce({ id: 'org-1', name: 'Updated Org', slug: 'updated-org', plan: 'free', created_at: '2024-01-01', updated_at: '2024-01-02' });

    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({ name: 'Updated Org' }),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({ id: 'org-1' }),
        header: vi.fn().mockReturnValue('Bearer token'),
      },
    }) as any;

    await updateOrgHandler(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: 'org-1',
          name: 'Updated Org',
        }),
      })
    );
  });

  it('should reject update from non-admin member', async () => {
    mockDB.first.mockResolvedValueOnce({ role: 'member' });

    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({ name: 'Updated Org' }),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({ id: 'org-1' }),
        header: vi.fn().mockReturnValue('Bearer token'),
      },
    }) as any;

    await expect(updateOrgHandler(ctx)).rejects.toThrow('Admin or owner role required');
  });

  it('should return unchanged org when no updates provided', async () => {
    mockDB.first
      .mockResolvedValueOnce({ role: 'owner' })
      .mockResolvedValueOnce({ id: 'org-1', name: 'Org', slug: 'org', plan: 'free', created_at: '2024-01-01', updated_at: '2024-01-01' });

    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({}),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({ id: 'org-1' }),
        header: vi.fn().mockReturnValue('Bearer token'),
      },
    }) as any;

    await updateOrgHandler(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: 'org-1',
          name: 'Org',
        }),
      })
    );
  });
});
