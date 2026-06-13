import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authMiddleware } from '../auth';
import { signAccessToken, signRefreshToken } from '../../lib/jwt';

const TEST_SECRET = 'test-secret-key';
const TEST_REFRESH_SECRET = 'test-refresh-secret-key';

function createMockContext(overrides: {
  authHeader?: string;
  nextFn?: () => Promise<void>;
} = {}) {
  const nextFn = overrides.nextFn ?? vi.fn().mockResolvedValue(undefined);
  const ctx = {
    req: {
      header: vi.fn((name: string) => {
        if (name === 'Authorization') return overrides.authHeader;
        return undefined;
      }),
    },
    env: { JWT_SECRET: TEST_SECRET },
    set: vi.fn(),
  } as unknown as Parameters<typeof authMiddleware>[0];
  return { ctx, nextFn };
}

describe('authMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call next() when valid access token provided', async () => {
    const token = await signAccessToken(
      { sub: 'user-123', email: 'test@example.com' },
      TEST_SECRET
    );
    const { ctx, nextFn } = createMockContext({ authHeader: `Bearer ${token}` });

    await authMiddleware(ctx, nextFn);

    expect(ctx.set).toHaveBeenCalledWith('userId', 'user-123');
    expect(ctx.set).toHaveBeenCalledWith('userEmail', 'test@example.com');
    expect(nextFn).toHaveBeenCalled();
  });

  it('should set sessionId when present in token', async () => {
    const token = await signAccessToken(
      { sub: 'user-123', email: 'test@example.com', sessionId: 'session-456' },
      TEST_SECRET
    );
    const { ctx, nextFn } = createMockContext({ authHeader: `Bearer ${token}` });

    await authMiddleware(ctx, nextFn);

    expect(ctx.set).toHaveBeenCalledWith('sessionId', 'session-456');
    expect(nextFn).toHaveBeenCalled();
  });

  it('should throw UNAUTHORIZED when Authorization header missing', async () => {
    const { ctx, nextFn } = createMockContext({});

    await expect(authMiddleware(ctx, nextFn)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Missing authorization header',
      status: 401,
    });
    expect(nextFn).not.toHaveBeenCalled();
  });

  it('should throw UNAUTHORIZED when Authorization header not Bearer format', async () => {
    const { ctx, nextFn } = createMockContext({ authHeader: 'Basic sometoken' });

    await expect(authMiddleware(ctx, nextFn)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Missing authorization header',
      status: 401,
    });
    expect(nextFn).not.toHaveBeenCalled();
  });

  it('should throw UNAUTHORIZED when token is invalid', async () => {
    const { ctx, nextFn } = createMockContext({ authHeader: 'Bearer invalid-token' });

    await expect(authMiddleware(ctx, nextFn)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
      status: 401,
    });
    expect(nextFn).not.toHaveBeenCalled();
  });

  it('should throw UNAUTHORIZED when token is expired', async () => {
    const token = await signAccessToken(
      { sub: 'user-123', email: 'test@example.com' },
      TEST_SECRET,
      '-1s'
    );
    const { ctx, nextFn } = createMockContext({ authHeader: `Bearer ${token}` });

    await expect(authMiddleware(ctx, nextFn)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
      status: 401,
    });
    expect(nextFn).not.toHaveBeenCalled();
  });

  it('should throw UNAUTHORIZED when token type is not access', async () => {
    const token = await signRefreshToken(
      { sub: 'user-123', email: 'test@example.com' },
      TEST_SECRET // using access secret to isolate the type check
    );
    const { ctx, nextFn } = createMockContext({ authHeader: `Bearer ${token}` });

    await expect(authMiddleware(ctx, nextFn)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Invalid token type',
      status: 401,
    });
    expect(nextFn).not.toHaveBeenCalled();
  });

  it('should throw UNAUTHORIZED when token signed with wrong secret', async () => {
    const token = await signAccessToken(
      { sub: 'user-123', email: 'test@example.com' },
      'wrong-secret'
    );
    const { ctx, nextFn } = createMockContext({ authHeader: `Bearer ${token}` });

    await expect(authMiddleware(ctx, nextFn)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
      status: 401,
    });
    expect(nextFn).not.toHaveBeenCalled();
  });
});