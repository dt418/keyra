import { z } from 'zod';

export const licenseTypes = ['trial', 'free', 'personal', 'professional', 'business', 'enterprise'] as const;

export const createLicenseSchema = z.object({
  product_id: z.string().min(1),
  type: z.enum(licenseTypes),
  max_devices: z.coerce.number().int().positive().max(100).default(1),
  expires_at: z.string().datetime().optional(),
  feature_flags: z.record(z.boolean()).optional(),
});

export const updateLicenseSchema = z.object({
  type: z.enum(licenseTypes).optional(),
  max_devices: z.coerce.number().int().positive().max(100).optional(),
  expires_at: z.string().datetime().optional(),
  feature_flags: z.record(z.boolean()).optional(),
});

export const revokeLicenseSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const transferLicenseSchema = z.object({
  target_org_id: z.string().min(1),
});

export const listLicensesSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().optional(),
  product_id: z.string().optional(),
  status: z.enum(['active', 'revoked', 'expired']).optional(),
});
