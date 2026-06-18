import type { Context } from "hono";
import { AppError } from "../../middleware/error";

interface WebhookRow {
  id: string;
  organization_id: string;
  url: string;
  events: string;
  active: number;
  created_at: string;
  updated_at: string;
}

export async function getWebhookHandler(c: Context) {
  const userId = c.get("userId");
  if (!userId) {
    throw new AppError("UNAUTHORIZED", "Authentication required", 401);
  }

  const { id } = c.req.param();
  const orgId = c.get("orgId");
  if (!orgId) {
    throw new AppError("FORBIDDEN", "Admin or owner role required", 403);
  }
const row = (await c.env.DB.prepare(
    `SELECT id, organization_id, url, events, active, created_at, updated_at
     FROM webhook_configs WHERE id = ? AND organization_id = ?`,
  )
    .bind(id, orgId)
    .first()) as WebhookRow | null;

  if (!row) {
    throw new AppError("NOT_FOUND", "Webhook not found", 404);
  }

  let events: string[] = [];
  try {
    events = JSON.parse(row.events) as string[];
  } catch {
    events = [];
  }

  return c.json({
    data: {
      id: row.id,
      organization_id: row.organization_id,
      url: row.url,
      events,
      active: row.active === 1,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
  });
}
