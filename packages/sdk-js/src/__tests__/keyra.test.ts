import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();

global.fetch = mockFetch;

const mockModule = await import('../index');

const { KeyraClient, createClient } = mockModule;

describe('KeyraClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('verify', () => {
    it('should verify valid license', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            valid: true,
            licenseId: 'lic-123',
            productName: 'Test Product',
            licenseType: 'professional',
            expiresAt: '2025-12-31T23:59:59Z',
          },
        }),
      });

      const client = createClient({ apiUrl: 'http://localhost:8788', apiKey: 'test-key' });
      const result = await client.verify('XXXX-XXXX-XXXX-XXXX');

      expect(result.valid).toBe(true);
      expect(result.licenseId).toBe('lic-123');
      expect(result.productName).toBe('Test Product');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8788/api/v1/verify',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-API-Key': 'test-key',
          }),
        })
      );
    });

    it('should return invalid for expired license', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            valid: false,
            reason: 'License has expired',
          },
        }),
      });

      const client = createClient({ apiUrl: 'http://localhost:8788', apiKey: 'test-key' });
      const result = await client.verify('XXXX-XXXX-XXXX-XXXX');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('License has expired');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const client = createClient({ apiUrl: 'http://localhost:8788', apiKey: 'test-key' });
      await expect(client.verify('XXXX-XXXX-XXXX-XXXX')).rejects.toThrow('Network error');
    });
  });

  describe('activate', () => {
    it('should activate device successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            device_token: 'device-token-123',
            expires_at: '2025-12-31T23:59:59Z',
          },
        }),
      });

      const client = createClient({ apiUrl: 'http://localhost:8788', apiKey: 'test-key' });
      const result = await client.activate({
        licenseKey: 'XXXX-XXXX-XXXX-XXXX',
        deviceName: 'My MacBook Pro',
        platform: 'macos',
        appVersion: '1.0.0',
      });

      expect(result.deviceToken).toBe('device-token-123');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8788/api/v1/activate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            license_key: 'XXXX-XXXX-XXXX-XXXX',
            device_name: 'My MacBook Pro',
            platform: 'macos',
            app_version: '1.0.0',
          }),
        })
      );
    });

    it('should throw on activation failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: { message: 'License is revoked' },
        }),
      });

      const client = createClient({ apiUrl: 'http://localhost:8788', apiKey: 'test-key' });
      await expect(client.activate({
        licenseKey: 'REVOKED-KEY',
        deviceName: 'Test Device',
        platform: 'windows',
      })).rejects.toThrow('License is revoked');
    });
  });

  describe('deactivate', () => {
    it('should deactivate device successfully', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const client = createClient({ apiUrl: 'http://localhost:8788', apiKey: 'test-key' });
      await client.deactivate('device-token-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8788/api/v1/devices/device-token-123',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('should throw on deactivate failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const client = createClient({ apiUrl: 'http://localhost:8788', apiKey: 'test-key' });
      await expect(client.deactivate('invalid-token')).rejects.toThrow('Deactivate failed: 404');
    });
  });

  describe('device token storage', () => {
    const originalStorage: Record<string, string> = {};

    beforeEach(() => {
      Object.defineProperty(global, 'localStorage', {
        value: {
          getItem: vi.fn((key: string) => originalStorage[key] || null),
          setItem: vi.fn((key: string, value: string) => { originalStorage[key] = value; }),
          removeItem: vi.fn((key: string) => { delete originalStorage[key]; }),
        },
        writable: true,
      });
    });

    it('should get stored device token', async () => {
      const client = createClient({ apiUrl: 'http://localhost:8788', apiKey: 'test-key' });
      const token = await client.getStoredDeviceToken();
      expect(token).toBeNull();
    });

    it('should set and clear stored device token', async () => {
      const client = createClient({ apiUrl: 'http://localhost:8788', apiKey: 'test-key' });
      
      await client.setStoredDeviceToken('my-token');
      expect(localStorage.setItem).toHaveBeenCalledWith('keyra_device_token', 'my-token');

      await client.clearStoredDeviceToken();
      expect(localStorage.removeItem).toHaveBeenCalledWith('keyra_device_token');
    });
  });
});
