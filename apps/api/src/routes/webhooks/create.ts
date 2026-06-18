import type { Context } from "hono";
import { AppError } from "../../middleware/error";
import { createWebhookSchema } from "@keyra/shared-validation";
import { hashApiKey } from "../../lib/password";
import { generateWebhookSecret } from "../../lib/webhooks";

export async function createWebhookHandler(c: Context) {
  const userId = c.get("userId");
  if (!userId) {
    throw new AppError("UNAUTHORIZED", "Authentication required", 401);
  }
  const orgId = c.get("orgId");
  if (!orgId) {
    throw new AppError("FORBIDDEN", "Admin or owner role required", 403);
  }
  const body = await c.req.json();
  const parsed = createWebhookSchema.safeParse(body);
  if (!parsed.success) {
    throw parsed.error;
  }

  const id = crypto.randomUUID();
  const secret = generateWebhookSecret();
  const secretHash = await hashApiKey(secret);
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO webhook_configs (id, organization_id, url, secret_hash, events, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      orgId,
      parsed.data.url,
      secretHash,
      JSON.stringify(parsed.data.events),
      parsed.data.active ? 1 : 0,
      now,
      now,
    )
    .run();

  return c.json(
    {
      data: {
        id,
        organization_id: orgId,
        url: parsed.data.url,
        events: parsed.data.events,
        active: parsed.data.active,
        created_at: now,
        secret,
      },
    },
    201,
  );
}
