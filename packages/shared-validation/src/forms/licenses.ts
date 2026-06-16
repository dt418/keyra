import { z } from 'zod';

export const licenseTypeValues = [
  'trial',
  'free',
  'personal',
  'professional',
  'business',
  'enterprise',
] as const;

export const licenseTypeVariants = [
  'violet',
  'slate',
  'info',
  'success',
  'warning',
  'danger',
] as const;

export type LicenseTypeVariant = (typeof licenseTypeVariants)[number];

export const licenseTypeOptions: Array<{
  value: (typeof licenseTypeValues)[number];
  label: string;
  variant: LicenseTypeVariant;
}> = [
  { value: 'trial', label: 'Trial', variant: 'violet' },
  { value: 'free', label: 'Free', variant: 'slate' },
  { value: 'personal', label: 'Personal', variant: 'info' },
  { value: 'professional', label: 'Professional', variant: 'info' },
  { value: 'business', label: 'Business', variant: 'info' },
  { value: 'enterprise', label: 'Enterprise', variant: 'warning' },
];

export const createLicenseFormSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  type: z.enum(licenseTypeValues, { errorMap: () => ({ message: 'Pick a license type' }) }),
  maxDevices: z.coerce
    .number({ invalid_type_error: 'Must be a number' })
    .int('Must be a whole number')
    .positive('Must be at least 1')
    .max(100, 'Max 100 devices'),
  expiresAt: z.string().optional(),
});

export const editLicenseFormSchema = z.object({
  type: z.enum(licenseTypeValues).optional(),
  maxDevices: z.coerce
    .number()
    .int()
    .positive()
    .max(100)
    .optional(),
  expiresAt: z.string().optional(),
});

export type CreateLicenseFormValues = z.infer<typeof createLicenseFormSchema>;
export type EditLicenseFormValues = z.infer<typeof editLicenseFormSchema>;

export const createLicenseDefaults: CreateLicenseFormValues = {
  productId: '',
  type: 'trial',
  maxDevices: 1,
  expiresAt: '',
};

export const editLicenseDefaults: EditLicenseFormValues = {
  type: 'trial',
  maxDevices: 1,
  expiresAt: '',
};
