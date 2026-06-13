import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerHandler } from '../register';
import { loginHandler } from '../login';
import { refreshHandler } from '../refresh';
import { signAccessToken, signRefreshToken } from '../../../lib/jwt';

const TEST_SECRET = 'test-secret-key';

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
  list: vi.fn().mockResolvedValue({ keys: [] }),
};

const mockEnv = {
  DB: mockDB,
  SESSIONS: mockKV,
  JWT_SECRET: TEST_SECRET,
};

function createMockContext(body: unknown) {
  return {
    req: {
      json: vi.fn().mockResolvedValue(body),
      param: vi.fn().mockReturnValue({}),
      header: vi.fn().mockReturnValue(undefined),
    },
    env: mockEnv,
    json: vi.fn().mockReturnThis(),
    get: vi.fn(),
    set: vi.fn(),
  };
}

describe('registerHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register a new user successfully', async () => {
    mockDB.first.mockResolvedValueOnce(null);
    const ctx = createMockContext({ email: 'test@example.com', password: 'password123', name: 'Test User' }) as any;
    
    await registerHandler(ctx);
    
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ email: 'test@example.com' }),
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      })
    );
  });

  it('should reject duplicate email', async () => {
    mockDB.first.mockResolvedValueOnce({ id: 'existing-user' });
    const ctx = createMockContext({ email: 'existing@example.com', password: 'password123', name: 'Existing' }) as any;
    
    await expect(registerHandler(ctx)).rejects.toThrow('User already exists');
  });
});

describe('loginHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should login user with valid credentials', async () => {
    const { hashPassword } = await import('../../../lib/password');
    const hashedPassword = await hashPassword('password123');
    
    mockDB.first.mockResolvedValueOnce({
      id: 'user-123',
      email: 'test@example.com',
      password_hash: hashedPassword,
      name: 'Test User',
    });
    
    const ctx = createMockContext({ email: 'test@example.com', password: 'password123' }) as any;
    
    await loginHandler(ctx);
    
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ email: 'test@example.com' }),
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      })
    );
  });

  it('should reject invalid email', async () => {
    mockDB.first.mockResolvedValueOnce(null);
    const ctx = createMockContext({ email: 'notfound@example.com', password: 'password123' }) as any;
    
    await expect(loginHandler(ctx)).rejects.toThrow('Invalid email or password');
  });
});

describe('refreshHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should refresh tokens with valid refresh token', async () => {
    const refreshToken = await signRefreshToken(
      { sub: 'user-123', email: 'test@example.com' },
      TEST_SECRET
    );
    
    mockDB.first.mockResolvedValueOnce({ id: 'user-123' });
    const ctx = createMockContext({ refreshToken }) as any;
    
    await refreshHandler(ctx);
    
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      })
    );
  });

  it('should reject invalid refresh token', async () => {
    const ctx = createMockContext({ refreshToken: 'invalid-token' }) as any;
    
    await expect(refreshHandler(ctx)).rejects.toThrow('Invalid or expired refresh token');
  });
});