import { z } from 'zod';

export const webhookEventValues = [
  'license.created',
  'license.updated',
  'license.revoked',
  'license.expired',
  'device.activated',
  'device.deactivated',
] as const;

export const webhookEventOptions: Array<{
  value: (typeof webhookEventValues)[number];
  label: string;
}> = [
  { value: 'license.created', label: 'License created' },
  { value: 'license.updated', label: 'License updated' },
  { value: 'license.revoked', label: 'License revoked' },
  { value: 'license.expired', label: 'License expired' },
  { value: 'device.activated', label: 'Device activated' },
  { value: 'device.deactivated', label: 'Device deactivated' },
];

export const createWebhookFormSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  events: z
    .array(z.enum(webhookEventValues))
    .min(1, 'Select at least one event'),
  active: z.boolean().default(true),
});

export type CreateWebhookFormValues = z.infer<typeof createWebhookFormSchema>;

export const createWebhookDefaults: CreateWebhookFormValues = {
  url: '',
  events: [],
  active: true,
};
