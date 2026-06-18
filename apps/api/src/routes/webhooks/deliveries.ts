import type { Context } from "hono";
import { AppError } from "../../middleware/error";

interface DeliveryRow {
  id: string;
  webhook_config_id: string;
  event_type: string;
  payload: string;
  status: string;
  response_code: number | null;
  response_body: string | null;
  attempts: number;
  last_attempt_at: string | null;
  created_at: string;
}

function rowToDelivery(row: DeliveryRow) {
  let payload: unknown = null;
  try {
    payload = JSON.parse(row.payload);
  } catch {
    payload = row.payload;
  }
  return {
    id: row.id,
    webhook_config_id: row.webhook_config_id,
    event_type: row.event_type,
    payload,
    status: row.status,
    response_code: row.response_code,
    response_body: row.response_body,
    attempts: row.attempts,
    last_attempt_at: row.last_attempt_at,
    created_at: row.created_at,
  };
}

export async function listDeliveriesHandler(c: Context) {
  const userId = c.get("userId");
  if (!userId) {
    throw new AppError("UNAUTHORIZED", "Authentication required", 401);
  }

  const { id } = c.req.param();
  const orgId = c.get("orgId");
  if (!orgId) {
    throw new AppError("FORBIDDEN", "Admin or owner role required", 403);
  }
const webhook = await c.env.DB.prepare(
    `SELECT id FROM webhook_configs WHERE id = ? AND organization_id = ?`,
  )
    .bind(id, orgId)
    .first();

  if (!webhook) {
    throw new AppError("NOT_FOUND", "Webhook not found", 404);
  }

  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);
  const cursor = c.req.query("cursor");
  const offset = cursor
    ? parseInt(Buffer.from(cursor, "base64").toString("utf8"), 10)
    : 0;

  const rows = (await c.env.DB.prepare(
    `SELECT id, webhook_config_id, event_type, payload, status, response_code, response_body, attempts, last_attempt_at, created_at
     FROM webhook_deliveries
     WHERE webhook_config_id = ? AND is_test = 0
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
  )
    .bind(id, limit + 1, offset)
    .all()) as { results: DeliveryRow[] };

  const items = (rows.results || []).slice(0, limit).map(rowToDelivery);
  const hasMore = (rows.results || []).length > limit;
  const nextCursor = hasMore
    ? Buffer.from(String(offset + limit)).toString("base64")
    : null;

  return c.json({
    data: items,
    pagination: { cursor: nextCursor, has_more: hasMore },
  });
}
