import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authMiddleware } from '../auth';
import { signAccessToken, signRefreshToken } from '../../lib/jwt';

const TEST_SECRET = 'test-secret-key';

function createMockContext(overrides: {
  authHeader?: string;
  nextFn?: () => Promise<void>;
} = {}) {
  const nextFn = overrides.nextFn ?? vi.fn().mockResolvedValue(undefined);
  const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const ctx = {
    req: {
      header: vi.fn((name: string) => {
        if (name === 'Authorization') return overrides.authHeader;
        return undefined;
      }),
    },
    env: { JWT_SECRET: TEST_SECRET },
    set: vi.fn(),
    json: vi.fn().mockImplementation((body: unknown, status?: number) => {
      return jsonResponse(body, status);
    }),
  } as unknown as Parameters<typeof authMiddleware>[0];
  return { ctx, nextFn };
}

async function readErrorResponse(result: Response) {
  const body = await result.json() as { error: { code: string; message: string } };
  return { code: body.error.code, message: body.error.message, status: result.status };
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

  it('should return 401 when Authorization header missing', async () => {
    const { ctx, nextFn } = createMockContext({});

    const result = (await authMiddleware(ctx, nextFn)) as Response;
    const error = await readErrorResponse(result);

    expect(error).toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Missing authorization header',
      status: 401,
    });
    expect(nextFn).not.toHaveBeenCalled();
  });

  it('should return 401 when Authorization header not Bearer format', async () => {
    const { ctx, nextFn } = createMockContext({ authHeader: 'Basic sometoken' });

    const result = (await authMiddleware(ctx, nextFn)) as Response;
    const error = await readErrorResponse(result);

    expect(error).toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Missing authorization header',
      status: 401,
    });
    expect(nextFn).not.toHaveBeenCalled();
  });

  it('should return 401 when token is invalid', async () => {
    const { ctx, nextFn } = createMockContext({ authHeader: 'Bearer invalid-token' });

    const result = (await authMiddleware(ctx, nextFn)) as Response;
    const error = await readErrorResponse(result);

    expect(error).toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
      status: 401,
    });
    expect(nextFn).not.toHaveBeenCalled();
  });

  it('should return 401 when token is expired', async () => {
    const token = await signAccessToken(
      { sub: 'user-123', email: 'test@example.com' },
      TEST_SECRET,
      '-1s'
    );
    const { ctx, nextFn } = createMockContext({ authHeader: `Bearer ${token}` });

    const result = (await authMiddleware(ctx, nextFn)) as Response;
    const error = await readErrorResponse(result);

    expect(error).toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
      status: 401,
    });
    expect(nextFn).not.toHaveBeenCalled();
  });

  it('should return 401 when token type is not access', async () => {
    const token = await signRefreshToken(
      { sub: 'user-123', email: 'test@example.com' },
      TEST_SECRET
    );
    const { ctx, nextFn } = createMockContext({ authHeader: `Bearer ${token}` });

    const result = (await authMiddleware(ctx, nextFn)) as Response;
    const error = await readErrorResponse(result);

    expect(error).toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Invalid token type',
      status: 401,
    });
    expect(nextFn).not.toHaveBeenCalled();
  });

  it('should return 401 when token signed with wrong secret', async () => {
    const token = await signAccessToken(
      { sub: 'user-123', email: 'test@example.com' },
      'wrong-secret'
    );
    const { ctx, nextFn } = createMockContext({ authHeader: `Bearer ${token}` });

    const result = (await authMiddleware(ctx, nextFn)) as Response;
    const error = await readErrorResponse(result);

    expect(error).toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
      status: 401,
    });
    expect(nextFn).not.toHaveBeenCalled();
  });
});
