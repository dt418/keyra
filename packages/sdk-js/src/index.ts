export interface VerifyResult {
  valid: boolean;
  reason?: string;
  licenseId?: string;
  productName?: string;
  licenseType?: string;
  featureFlags?: Record<string, boolean>;
  expiresAt?: string;
}

export interface ActivateOptions {
  licenseKey: string;
  deviceName: string;
  platform: 'windows' | 'linux' | 'macos' | 'ios' | 'android';
  appVersion?: string;
  metadata?: Record<string, unknown>;
}

export interface ActivateResult {
  deviceToken: string;
  expiresAt?: string;
}

export interface DeactivateOptions {
  deviceToken: string;
}

export interface KeyraOptions {
  apiUrl: string;
  apiKey: string;
}

export class KeyraClient {
  private apiUrl: string;
  private apiKey: string;

  constructor(options: KeyraOptions) {
    this.apiUrl = options.apiUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
  }

  async verify(licenseKey: string, deviceToken?: string): Promise<VerifyResult> {
    const response = await fetch(`${this.apiUrl}/api/v1/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify({ license_key: licenseKey, device_id: deviceToken }),
    });

    if (!response.ok) {
      throw new Error(`Verify failed: ${response.status}`);
    }

    const data = await response.json();
    return data.data;
  }

  async activate(options: ActivateOptions): Promise<ActivateResult> {
    const response = await fetch(`${this.apiUrl}/api/v1/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify({
        license_key: options.licenseKey,
        device_name: options.deviceName,
        platform: options.platform,
        app_version: options.appVersion,
        metadata: options.metadata,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `Activate failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      deviceToken: data.data.device_token,
      expiresAt: data.data.expires_at,
    };
  }

  async deactivate(deviceToken: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/api/v1/devices/${deviceToken}`, {
      method: 'DELETE',
      headers: {
        'X-API-Key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Deactivate failed: ${response.status}`);
    }
  }

  async getStoredDeviceToken(): Promise<string | null> {
    return localStorage.getItem('keyra_device_token');
  }

  async setStoredDeviceToken(token: string): Promise<void> {
    localStorage.setItem('keyra_device_token', token);
  }

  async clearStoredDeviceToken(): Promise<void> {
    localStorage.removeItem('keyra_device_token');
  }
}

export function createClient(options: KeyraOptions): KeyraClient {
  return new KeyraClient(options);
}
