import { describe, it, expect, vi, beforeEach } from 'vitest';
import { meHandler } from '../me';

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

describe('meHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return current user profile', async () => {
    mockDB.first.mockResolvedValueOnce({
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      avatar_url: 'https://example.com/avatar.png',
      email_verified: true,
      created_at: '2024-01-01T00:00:00.000Z',
    });

    const ctx = createMockContext() as any;
    await meHandler(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          avatar_url: 'https://example.com/avatar.png',
          email_verified: true,
          created_at: '2024-01-01T00:00:00.000Z',
        }),
      })
    );
  });

  it('should return null name when user has no name set', async () => {
    mockDB.first.mockResolvedValueOnce({
      id: 'user-123',
      email: 'test@example.com',
      name: null,
      avatar_url: null,
      email_verified: false,
      created_at: '2024-01-01T00:00:00.000Z',
    });

    const ctx = createMockContext() as any;
    await meHandler(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: 'user-123',
          email: 'test@example.com',
          name: null,
          avatar_url: null,
          email_verified: false,
        }),
      })
    );
  });

  it('should throw if user not found in database', async () => {
    mockDB.first.mockResolvedValueOnce(null);

    const ctx = createMockContext() as any;
    await expect(meHandler(ctx)).rejects.toThrow('User not found');
  });

  it('should use userId from context', async () => {
    mockDB.first.mockResolvedValueOnce({
      id: 'user-456',
      email: 'other@example.com',
      name: 'Other User',
      avatar_url: null,
      email_verified: true,
      created_at: '2024-01-01T00:00:00.000Z',
    });

    const ctx = createMockContext({
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'userId') return 'user-456';
        if (key === 'userEmail') return 'other@example.com';
        return undefined;
      }),
    }) as any;
    await meHandler(ctx);

    expect(mockDB.bind).toHaveBeenCalledWith('user-456');
  });

  it('should NOT return updated_at field', async () => {
    mockDB.first.mockResolvedValueOnce({
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      avatar_url: 'https://example.com/avatar.png',
      email_verified: true,
      created_at: '2024-01-01T00:00:00.000Z',
    });

    const ctx = createMockContext() as any;
    await meHandler(ctx);

    const response = ctx.json.mock.calls[0][0];
    expect(response.data).not.toHaveProperty('updated_at');
  });
});
