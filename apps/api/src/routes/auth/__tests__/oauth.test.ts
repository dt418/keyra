import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { oauthInitiateHandler, oauthCallbackHandler } from '../oauth';

const mockDB = {
  prepare: vi.fn().mockReturnThis(),
  bind: vi.fn().mockReturnThis(),
  first: vi.fn(),
  run: vi.fn().mockResolvedValue({ success: true }),
};

const mockKV = {
  get: vi.fn(),
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
};

const mockEnv = {
  DB: mockDB,
  SESSIONS: mockKV,
  JWT_SECRET: 'test-secret',
  JWT_REFRESH_SECRET: 'test-refresh',
  OAUTH_REDIRECT_URI: 'https://app.example.com/auth/callback',
  OAUTH_GOOGLE_CLIENT_ID: 'google-client-id',
  OAUTH_GITHUB_CLIENT_ID: 'github-client-id',
  OAUTH_GOOGLE_CLIENT_SECRET: 'google-client-secret',
  OAUTH_GITHUB_CLIENT_CLIENT_SECRET: 'github-client-secret',
};

function createMockContext(overrides: Record<string, unknown> = {}) {
  const reqOverrides = (overrides.req || {}) as Record<string, unknown>;
  return {
    env: mockEnv,
    json: vi.fn().mockReturnValue(new Response(JSON.stringify({}), { status: 200 })),
    get: vi.fn(),
    set: vi.fn(),
    executionCtx: { waitUntil: vi.fn() },
    ...overrides,
    req: {
      json: (reqOverrides.json as typeof vi.fn) || vi.fn().mockResolvedValue({}),
      param: (reqOverrides.param as typeof vi.fn) || vi.fn().mockReturnValue({}),
      header: (name?: string) => {
        if (name === 'cf-connecting-ip') return '127.0.0.1';
        if (name === 'user-agent') return 'test-agent';
        return undefined;
      },
    },
  };
}

describe('oauthInitiateHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValue('test-state-uuid'),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return auth_url and state for google provider', async () => {
    const ctx = createMockContext({
      req: { param: vi.fn().mockReturnValue('google') },
    }) as any;

    await oauthInitiateHandler(ctx);

    expect(mockKV.put).toHaveBeenCalledWith(
      'oauth_state:test-state-uuid',
      'google',
      { expirationTtl: 600 }
    );
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          auth_url: expect.stringContaining('accounts.google.com'),
          state: 'test-state-uuid',
        }),
      })
    );
  });

  it('should return auth_url and state for github provider', async () => {
    const ctx = createMockContext({
      req: { param: vi.fn().mockReturnValue('github') },
    }) as any;

    await oauthInitiateHandler(ctx);

    expect(mockKV.put).toHaveBeenCalledWith(
      'oauth_state:test-state-uuid',
      'github',
      { expirationTtl: 600 }
    );
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          auth_url: expect.stringContaining('github.com/login/oauth/authorize'),
          state: 'test-state-uuid',
        }),
      })
    );
  });

  it('should return 400 for invalid provider', async () => {
    const ctx = createMockContext({
      req: { param: vi.fn().mockReturnValue('invalid') },
    }) as any;

    await expect(oauthInitiateHandler(ctx)).rejects.toThrow('Invalid provider');
  });

  it('should store state in KV with correct TTL', async () => {
    const ctx = createMockContext({
      req: { param: vi.fn().mockReturnValue('google') },
    }) as any;

    await oauthInitiateHandler(ctx);

    expect(mockKV.put).toHaveBeenCalledWith(
      'oauth_state:test-state-uuid',
      'google',
      { expirationTtl: 600 }
    );
  });
});

describe('oauthCallbackHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValue('test-session-uuid'),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return tokens for new user (google)', async () => {
    const ctx = createMockContext({
      req: {
        param: vi.fn().mockReturnValue('google'),
        json: vi.fn().mockResolvedValue({ code: 'valid-code', state: 'valid-state' }),
      },
    }) as any;

    mockKV.get.mockResolvedValueOnce('google');
    mockDB.first.mockResolvedValueOnce(null);

    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(new Response(new URLSearchParams({ access_token: 'provider-token' }).toString(), { status: 200 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: '123', email: 'new@example.com', name: 'New User' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await oauthCallbackHandler(ctx);

    expect(mockKV.delete).toHaveBeenCalledWith('oauth_state:valid-state');
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          access_token: expect.any(String),
          refresh_token: expect.any(String),
          user: expect.objectContaining({ email: 'new@example.com' }),
        }),
      })
    );
  });

  it('should return tokens for existing user (github)', async () => {
    const ctx = createMockContext({
      req: {
        param: vi.fn().mockReturnValue('github'),
        json: vi.fn().mockResolvedValue({ code: 'valid-code', state: 'valid-state' }),
      },
    }) as any;

    mockKV.get.mockResolvedValueOnce('github');
    mockDB.first.mockResolvedValueOnce({ id: 'existing-oauth-user', email: 'existing@example.com', name: 'Existing User' });

    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(new Response(new URLSearchParams({ access_token: 'provider-token' }).toString(), { status: 200 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: '456', email: 'existing@example.com', name: 'Existing' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await oauthCallbackHandler(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          access_token: expect.any(String),
          refresh_token: expect.any(String),
          user: expect.objectContaining({ id: 'existing-oauth-user', email: 'existing@example.com' }),
        }),
      })
    );
  });

  it('should return 400 for invalid state (CSRF)', async () => {
    const ctx = createMockContext({
      req: {
        param: vi.fn().mockReturnValue('google'),
        json: vi.fn().mockResolvedValue({ code: 'valid-code', state: 'invalid-state' }),
      },
    }) as any;

    mockKV.get.mockResolvedValueOnce(null);

    await expect(oauthCallbackHandler(ctx)).rejects.toThrow('Invalid or expired state parameter');
  });

  it('should return 400 for invalid provider', async () => {
    const ctx = createMockContext({
      req: {
        param: vi.fn().mockReturnValue('invalid'),
        json: vi.fn().mockResolvedValue({ code: 'valid-code', state: 'valid-state' }),
      },
    }) as any;

    await expect(oauthCallbackHandler(ctx)).rejects.toThrow('Invalid provider');
  });

  it('should return 400 for invalid code', async () => {
    const ctx = createMockContext({
      req: {
        param: vi.fn().mockReturnValue('google'),
        json: vi.fn().mockResolvedValue({ code: 'invalid-code', state: 'valid-state' }),
      },
    }) as any;

    mockKV.get.mockResolvedValueOnce('google');

    const fetchMock = vi.fn();
    fetchMock.mockResolvedValue(new Response('error=bad_verification_code', { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(oauthCallbackHandler(ctx)).rejects.toThrow('Failed to exchange code for token');
  });

  it('should link OAuth to existing email account', async () => {
    const ctx = createMockContext({
      req: {
        param: vi.fn().mockReturnValue('google'),
        json: vi.fn().mockResolvedValue({ code: 'valid-code', state: 'valid-state' }),
      },
    }) as any;

    mockKV.get.mockResolvedValueOnce('google');
    mockDB.first
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'linked-user', email: 'linked@example.com', name: 'Linked User' });

    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(new Response(new URLSearchParams({ access_token: 'provider-token' }).toString(), { status: 200 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: '789', email: 'linked@example.com', name: 'Linked' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await oauthCallbackHandler(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user: expect.objectContaining({ id: 'linked-user', email: 'linked@example.com' }),
        }),
      })
    );
  });

  it('should reject callback without state (CSRF protection)', async () => {
    const ctx = createMockContext({
      req: {
        param: vi.fn().mockReturnValue('google'),
        json: vi.fn().mockResolvedValue({ code: 'valid-code' }),
      },
    }) as any;

    await expect(oauthCallbackHandler(ctx)).rejects.toThrow('Missing state parameter');
  });

  it('should reject account takeover: existing user linked to different provider', async () => {
    const ctx = createMockContext({
      req: {
        param: vi.fn().mockReturnValue('google'),
        json: vi.fn().mockResolvedValue({ code: 'valid-code', state: 'valid-state' }),
      },
    }) as any;

    mockKV.get.mockResolvedValueOnce('google');
    mockDB.first
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'victim-user',
        email: 'victim@example.com',
        name: 'Victim',
        oauth_provider: 'github',
        oauth_id: '999',
      });

    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(new Response(new URLSearchParams({ access_token: 'provider-token' }).toString(), { status: 200 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: 'attacker-123', email: 'victim@example.com', name: 'Attacker' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(oauthCallbackHandler(ctx)).rejects.toThrow('This email is linked to github');
  });

  it('should write OAuth session to KV so logout can revoke it', async () => {
    const ctx = createMockContext({
      req: {
        param: vi.fn().mockReturnValue('google'),
        json: vi.fn().mockResolvedValue({ code: 'valid-code', state: 'valid-state' }),
      },
    }) as any;

    mockKV.get.mockResolvedValueOnce('google');
    mockDB.first.mockResolvedValueOnce(null);

    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(new Response(new URLSearchParams({ access_token: 'provider-token' }).toString(), { status: 200 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: '123', email: 'new@example.com', name: 'New User' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await oauthCallbackHandler(ctx);

    const sessionPutCall = mockKV.put.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].startsWith('session:') && call[1] === 'active',
    );
    expect(sessionPutCall).toBeDefined();
    expect(sessionPutCall?.[2]).toEqual({ expirationTtl: 7 * 24 * 60 * 60 });
  });
});
