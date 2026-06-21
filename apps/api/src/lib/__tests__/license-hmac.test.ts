import { describe, it, expect } from 'vitest';
import {
  generateLicenseKey,
  verifyLicenseHmac,
  isLegacyLicenseKey,
} from '../license';

describe('license HMAC', () => {
  it('round-trips a freshly generated key', async () => {
    const key = await generateLicenseKey('test-secret-xyz');
    expect(key).toMatch(
      /^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}\.[A-Z0-9]{12}$/,
    );
    expect(await verifyLicenseHmac(key, 'test-secret-xyz')).toBe(true);
  });

  it('rejects a tampered key', async () => {
    const key = await generateLicenseKey('test-secret-xyz');
    const tampered = 'ZZZZ' + key.slice(4);
    expect(await verifyLicenseHmac(tampered, 'test-secret-xyz')).toBe(false);
  });

  it('rejects a key signed with a different secret', async () => {
    const key = await generateLicenseKey('secret-a');
    expect(await verifyLicenseHmac(key, 'secret-b')).toBe(false);
  });

  it('reports legacy keys via isLegacyLicenseKey and returns false from verifyLicenseHmac', async () => {
    const legacyKey = 'AAAA-BBBB-CCCC-DDDD';
    expect(isLegacyLicenseKey(legacyKey)).toBe(true);
    expect(await verifyLicenseHmac(legacyKey, 'any-secret')).toBe(false);
  });

  it('rejects an empty secret (WebCrypto refuses zero-length HMAC keys)', async () => {
    await expect(generateLicenseKey('')).rejects.toThrow();
  });

  it('returns false for signed-shape keys with a wrong-length tag', async () => {
    const malformed = 'AAAA-BBBB-CCCC-DDDD.WRONGLEN';
    expect(isLegacyLicenseKey(malformed)).toBe(false);
    expect(await verifyLicenseHmac(malformed, 'secret')).toBe(false);
  });

  it('round-trips with a unicode/emoji secret', async () => {
    const secret = 'пароль-🔐-πάσχα';
    const key = await generateLicenseKey(secret);
    expect(await verifyLicenseHmac(key, secret)).toBe(true);
    expect(await verifyLicenseHmac(key, 'other-secret')).toBe(false);
  });

  it('rejects a signed key verified with a different secret (tampering path)', async () => {
    const key = await generateLicenseKey('test-secret-xyz');
    expect(await verifyLicenseHmac(key, 'different-secret')).toBe(false);
  });
});
