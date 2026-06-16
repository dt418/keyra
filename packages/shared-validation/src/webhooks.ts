import { z } from "zod";

export const WEBHOOK_EVENT_TYPES = [
  "license.created",
  "license.updated",
  "license.revoked",
  "license.expired",
  "device.activated",
  "device.deactivated",
] as const;

export const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  secret: z.string().min(16).max(128).optional(),
  active: z.boolean().default(true),
});

export const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string()).min(1).optional(),
  active: z.boolean().optional(),
});
