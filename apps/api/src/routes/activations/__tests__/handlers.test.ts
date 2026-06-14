import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listActivationsHandler } from '../list';
import { activateDeviceHandler } from '../activate';

const mockDB = {
  prepare: vi.fn().mockReturnThis(),
  bind: vi.fn().mockReturnThis(),
  first: vi.fn(),
  all: vi.fn().mockResolvedValue({ results: [] }),
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
    executionCtx: { waitUntil: vi.fn() },
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

describe('listActivationsHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDB.prepare.mockClear();
    mockDB.bind.mockClear();
    mockDB.first.mockReset();
    mockDB.all.mockReset();
    mockDB.all.mockResolvedValue({ results: [] });
    mockDB.run.mockReset();
    mockDB.run.mockResolvedValue({ success: true });
  });

  it('should list activations for admin user', async () => {
    mockDB.all.mockResolvedValueOnce({
      results: [
        { org_id: 'org-1' },
      ],
    });
    mockDB.all.mockResolvedValueOnce({
      results: [
        { id: 'act-1', license_id: 'lic-1', device_id: 'dev-1', created_at: '2024-01-01', metadata: null, device_name: 'MacBook', platform: 'macos', app_version: '1.0.0', last_seen_at: '2024-01-01', license_type: 'professional' },
      ],
    });

    const ctx = createMockContext() as any;
    await listActivationsHandler(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ id: 'act-1', license_id: 'lic-1' }),
        ]),
      })
    );
  });

  it('should throw if user not authenticated', async () => {
    const ctx = createMockContext({
      get: vi.fn().mockReturnValue(undefined),
    }) as any;

    await expect(listActivationsHandler(ctx)).rejects.toThrow('Authentication required');
  });
});

describe('activateDeviceHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDB.prepare.mockClear();
    mockDB.bind.mockClear();
    mockDB.first.mockReset();
    mockDB.all.mockReset();
    mockDB.run.mockReset();
    mockDB.run.mockResolvedValue({ success: true });
  });

  it('should activate device successfully', async () => {
    mockDB.first.mockResolvedValueOnce({ id: 'lic-1', product_id: 'prod-1', status: 'active', max_devices: 3, expires_at: null, feature_flags: null, type: 'professional', product_name: 'Product 1' });
    mockDB.first.mockResolvedValueOnce({ count: 0 });
    mockDB.first.mockResolvedValueOnce(null);
    mockDB.run.mockResolvedValue({ success: true });

    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({ license_key: 'XXXXX-XXXXX-XXXXX-XXXXX', device_name: 'MacBook Pro', platform: 'macos', app_version: '1.0.0' }),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({}),
        header: vi.fn().mockReturnValue('Bearer token'),
      },
    }) as any;

    await activateDeviceHandler(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          license_id: 'lic-1',
          product_name: 'Product 1',
          license_type: 'professional',
        }),
      }),
      201
    );
  });

  it('should reject invalid license key', async () => {
    mockDB.first.mockResolvedValueOnce(null);

    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({ license_key: 'INVALID-KEY', device_name: 'MacBook', platform: 'macos' }),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({}),
        header: vi.fn().mockReturnValue('Bearer token'),
      },
    }) as any;

    await expect(activateDeviceHandler(ctx)).rejects.toThrow('Invalid license key');
  });

  it('should reject revoked license', async () => {
    mockDB.first.mockResolvedValueOnce({ id: 'lic-1', product_id: 'prod-1', status: 'revoked', max_devices: 3, expires_at: null, feature_flags: null, type: 'professional', product_name: 'Product 1' });

    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({ license_key: 'XXXXX-XXXXX-XXXXX-XXXXX', device_name: 'MacBook', platform: 'macos' }),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({}),
        header: vi.fn().mockReturnValue('Bearer token'),
      },
    }) as any;

    await expect(activateDeviceHandler(ctx)).rejects.toThrow('License is revoked');
  });

  it('should reject when device limit reached', async () => {
    mockDB.first.mockResolvedValueOnce({ id: 'lic-1', product_id: 'prod-1', status: 'active', max_devices: 1, expires_at: null, feature_flags: null, type: 'professional', product_name: 'Product 1' });
    mockDB.first.mockResolvedValueOnce({ count: 1 });

    const ctx = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({ license_key: 'XXXXX-XXXXX-XXXXX-XXXXX', device_name: 'MacBook', platform: 'macos' }),
        query: vi.fn().mockReturnValue({}),
        param: vi.fn().mockReturnValue({}),
        header: vi.fn().mockReturnValue('Bearer token'),
      },
    }) as any;

    await expect(activateDeviceHandler(ctx)).rejects.toThrow('Maximum device limit');
  });
});
