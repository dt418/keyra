import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../lib/password';
import { signAccessToken, signRefreshToken, verifyToken } from '../../lib/jwt';

const TEST_SECRET = 'test-jwt-secret-key-for-testing-purposes';

describe('password utilities', () => {
  it('should hash and verify password correctly', async () => {
    const password = 'securePassword123';
    const hashed = await hashPassword(password);

    expect(hashed).not.toBe(password);
    expect(hashed.length).toBeGreaterThan(0);

    const isValid = await verifyPassword(password, hashed);
    expect(isValid).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const password = 'securePassword123';
    const hashed = await hashPassword(password);

    const isValid = await verifyPassword('wrongPassword', hashed);
    expect(isValid).toBe(false);
  });
});

describe('JWT utilities', () => {
  it('should create and verify access token', async () => {
    const payload = { sub: 'user-123', email: 'test@example.com' };
    const token = await signAccessToken(payload, TEST_SECRET);

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    const verified = await verifyToken(token, TEST_SECRET);
    expect(verified.sub).toBe('user-123');
    expect(verified.email).toBe('test@example.com');
    expect(verified.type).toBe('access');
  });

  it('should create and verify refresh token', async () => {
    const payload = { sub: 'user-123', email: 'test@example.com' };
    const token = await signRefreshToken(payload, TEST_SECRET);

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    const verified = await verifyToken(token, TEST_SECRET);
    expect(verified.sub).toBe('user-123');
    expect(verified.email).toBe('test@example.com');
    expect(verified.type).toBe('refresh');
  });

  it('should reject token with wrong secret', async () => {
    const payload = { sub: 'user-123', email: 'test@example.com' };
    const token = await signAccessToken(payload, TEST_SECRET);

    await expect(verifyToken(token, 'wrong-secret')).rejects.toThrow();
  });
});