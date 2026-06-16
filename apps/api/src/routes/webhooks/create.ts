import type { Context } from "hono";
import { AppError } from "../../middleware/error";
import { createWebhookSchema } from "@keyra/shared-validation";
import { hashApiKey } from "../../lib/password";
import { WEBHOOK_EVENTS } from "../../lib/webhooks";

export async function createWebhookHandler(c: Context) {
  const userId = c.get("userId");
  if (!userId) {
    throw new AppError("UNAUTHORIZED", "Authentication required", 401);
  }

  const member = (await c.env.DB.prepare(
    `SELECT org_id FROM org_members WHERE user_id = ? AND role IN ('owner', 'admin') LIMIT 1`,
  )
    .bind(userId)
    .first()) as { org_id: string } | null;

  if (!member) {
    throw new AppError("FORBIDDEN", "Admin or owner role required", 403);
  }

  const body = await c.req.json();
  const parsed = createWebhookSchema.safeParse(body);
  if (!parsed.success) {
    throw parsed.error;
  }

  const invalidEvents = parsed.data.events.filter(
    (e) => !WEBHOOK_EVENTS.includes(e as (typeof WEBHOOK_EVENTS)[number]),
  );
  if (invalidEvents.length > 0) {
    throw new AppError(
      "BAD_REQUEST",
      `Unknown event types: ${invalidEvents.join(", ")}`,
      400,
    );
  }

  const id = crypto.randomUUID();
  const secret = parsed.data.secret || generateSecret();
  const secretHash = await hashApiKey(secret);
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO webhook_configs (id, organization_id, url, secret_hash, events, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      member.org_id,
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
        organization_id: member.org_id,
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

function generateSecret(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let s = "whsec_";
  for (let i = 0; i < 40; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}
