import { z } from 'zod';

export const activateDeviceSchema = z.object({
  license_key: z.string().min(1),
  device_name: z.string().min(1).max(100),
  platform: z.string().min(1).max(50),
  app_version: z.string().max(20).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const verifyLicenseSchema = z.object({
  license_key: z.string().min(1),
  device_id: z.string().optional(),
});

export const listActivationsSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().optional(),
  license_id: z.string().optional(),
});
