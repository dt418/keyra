import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logAuditEvent, extractRequestInfo } from '../../lib/audit';
import type { Context } from 'hono';

function createMockContext(headers: Record<string, string> = {}) {
  const waitUntil = vi.fn();
  const run = vi.fn().mockResolvedValue(undefined);
  const prepare = vi.fn().mockReturnValue({ bind: vi.fn().mockReturnValue({ run }) });

  const mockCtx = {
    req: {
      json: vi.fn(),
      param: vi.fn(),
      header: vi.fn((name: string) => headers[name] ?? undefined),
    },
    env: {
      DB: { prepare },
    },
    executionCtx: { waitUntil },
  } as unknown as Context;

  return mockCtx;
}

describe('logAuditEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should insert audit log with all fields', async () => {
    const c = createMockContext({
      'user-agent': 'Mozilla/5.0',
      'cf-connecting-ip': '192.168.1.1',
    });
    const event = {
      action: 'user.register',
      userId: 'user-123',
      resourceType: 'user',
      resourceId: 'user-123',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      metadata: { email: 'test@example.com' },
    };

    await logAuditEvent(c, event);

    expect(c.executionCtx.waitUntil).toHaveBeenCalledTimes(1);
    const calls = (c.executionCtx.waitUntil as ReturnType<typeof vi.fn>).mock.calls;
    const promise = calls[0]?.[0] as Promise<unknown>;
    await promise;
    expect(c.env.DB.prepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_logs')
    );
  });

  it('should handle missing optional fields', async () => {
    const c = createMockContext();
    const event = {
      action: 'user.logout',
      resourceType: 'session',
      resourceId: 'session-456',
      ipAddress: undefined,
      userAgent: undefined,
    };

    await logAuditEvent(c, event);

    expect(c.executionCtx.waitUntil).toHaveBeenCalledTimes(1);
  });

  it('should use waitUntil for fire-and-forget', async () => {
    const c = createMockContext();
    const event = {
      action: 'user.login',
      userId: 'user-789',
      resourceType: 'user',
      resourceId: 'user-789',
      ipAddress: undefined,
      userAgent: undefined,
    };

    await logAuditEvent(c, event);

    expect(c.executionCtx.waitUntil).toHaveBeenCalled();
  });
});

describe('extractRequestInfo', () => {
  it('should extract cf-connecting-ip first', () => {
    const c = createMockContext({
      'cf-connecting-ip': '192.168.1.1',
      'x-forwarded-for': '10.0.0.1',
    });
    const info = extractRequestInfo(c);
    expect(info.ipAddress).toBe('192.168.1.1');
  });

  it('should extract user-agent', () => {
    const c = createMockContext({
      'user-agent': 'Mozilla/5.0 Test Browser',
    });
    const info = extractRequestInfo(c);
    expect(info.userAgent).toBe('Mozilla/5.0 Test Browser');
  });

  it('should return undefined for missing headers', () => {
    const c = createMockContext();
    const info = extractRequestInfo(c);
    expect(info.ipAddress).toBeUndefined();
    expect(info.userAgent).toBeUndefined();
  });
});
