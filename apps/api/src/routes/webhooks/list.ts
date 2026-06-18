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

function rowToWebhook(row: WebhookRow) {
  let events: string[] = [];
  try {
    events = JSON.parse(row.events) as string[];
  } catch {
    events = [];
  }
  return {
    id: row.id,
    organization_id: row.organization_id,
    url: row.url,
    events,
    active: row.active === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listWebhooksHandler(c: Context) {
  const userId = c.get("userId");
  if (!userId) {
    throw new AppError("UNAUTHORIZED", "Authentication required", 401);
  }
  const orgId = c.get("orgId");
  if (!orgId) {
    throw new AppError("FORBIDDEN", "Admin or owner role required", 403);
  }
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);
  const cursor = c.req.query("cursor");

  const offset = cursor
    ? parseInt(Buffer.from(cursor, "base64").toString("utf8"), 10)
    : 0;

  const rows = (await c.env.DB.prepare(
    `SELECT id, organization_id, url, events, active, created_at, updated_at
     FROM webhook_configs
     WHERE organization_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
  )
    .bind(orgId, limit + 1, offset)
    .all()) as { results: WebhookRow[] };

  const items = (rows.results || []).slice(0, limit).map(rowToWebhook);
  const hasMore = (rows.results || []).length > limit;
  const nextCursor = hasMore
    ? Buffer.from(String(offset + limit)).toString("base64")
    : null;

  return c.json({
    data: items,
    pagination: { cursor: nextCursor, has_more: hasMore },
  });
}
