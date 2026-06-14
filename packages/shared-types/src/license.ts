export type LicenseType = 'trial' | 'free' | 'personal' | 'professional' | 'business' | 'enterprise';
export type LicenseStatus = 'active' | 'revoked' | 'expired';

export type License = {
  id: string;
  productId: string;
  organizationId: string;
  keyHash: string;
  type: LicenseType;
  status: LicenseStatus;
  maxDevices: number;
  expiresAt: Date | null;
  featureFlags: Record<string, boolean> | null;
  createdAt: Date;
  updatedAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
};

export type CreateLicenseInput = {
  productId: string;
  type: LicenseType;
  maxDevices?: number;
  expiresAt?: string;
  featureFlags?: Record<string, boolean>;
};

export type UpdateLicenseInput = {
  type?: LicenseType;
  maxDevices?: number;
  expiresAt?: string;
  featureFlags?: Record<string, boolean>;
};

export type RevokeLicenseInput = {
  reason?: string;
};
