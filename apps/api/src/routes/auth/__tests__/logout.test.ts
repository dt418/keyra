import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logoutHandler } from '../logout';

const mockDB = {
  prepare: vi.fn().mockReturnThis(),
  bind: vi.fn().mockReturnThis(),
  first: vi.fn(),
  run: vi.fn().mockResolvedValue({ success: true }),
};

function createMockContext(sessionId?: string) {
  const ctx = {
    req: {
      header: vi.fn().mockImplementation((name?: string) => {
        if (name === 'cf-connecting-ip') return '127.0.0.1';
        if (name === 'user-agent') return 'test-agent';
        return undefined;
      }),
    },
    env: { DB: mockDB },
    executionCtx: { waitUntil: vi.fn() },
    json: vi.fn().mockReturnValue(new Response(JSON.stringify({}), { status: 200 })),
    get: vi.fn((key: string) => {
      if (key === 'sessionId') return sessionId;
      return undefined;
    }),
    set: vi.fn(),
  } as unknown as Parameters<typeof logoutHandler>[0];
  return ctx;
}

describe('logoutHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should revoke session and return success', async () => {
    const ctx = createMockContext('session-456');

    await logoutHandler(ctx);

    expect(mockDB.prepare).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE sessions SET revoked_at')
    );
    expect(mockDB.bind).toHaveBeenCalledWith(
      expect.any(String),
      'session-456'
    );
    expect(mockDB.run).toHaveBeenCalled();
    expect(ctx.json).toHaveBeenCalledWith({ data: { success: true } });
  });

  it('should succeed without sessionId (no DB call needed)', async () => {
    const ctx = createMockContext(undefined);

    await logoutHandler(ctx);

    expect(mockDB.prepare).not.toHaveBeenCalled();
    expect(ctx.json).toHaveBeenCalledWith({ data: { success: true } });
  });
});