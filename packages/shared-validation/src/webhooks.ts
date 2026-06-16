import { z } from "zod";

export const webhookEventTypes = [
  "license.created",
  "license.updated",
  "license.revoked",
  "license.expired",
  "device.activated",
  "device.deactivated",
] as const;

export const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum(webhookEventTypes)).min(1),
  active: z.boolean().default(true),
});

export const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.enum(webhookEventTypes)).min(1).optional(),
  active: z.boolean().optional(),
});
