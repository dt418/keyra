import type { Context } from "hono";
import { AppError } from "../../middleware/error";
import { signWebhookPayload } from "../../lib/webhooks";

interface WebhookRow {
  id: string;
  organization_id: string;
  url: string;
  secret_hash: string;
  events: string;
  active: number;
}

export async function testWebhookHandler(c: Context) {
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
    `SELECT id, organization_id, url, secret_hash, events, active
     FROM webhook_configs WHERE id = ? AND organization_id = ?`,
  )
    .bind(id, orgId)
    .first()) as WebhookRow | null;

  if (!row) {
    throw new AppError("NOT_FOUND", "Webhook not found", 404);
  }

  const timestamp = new Date().toISOString();
  const deliveryId = crypto.randomUUID();
  const payload = {
    event: "webhook.test",
    data: { message: "This is a test delivery from Keyra" },
    timestamp,
    delivery_id: deliveryId,
  };
  const body = JSON.stringify(payload);

  let responseCode: number | null = null;
  let responseBody: string | null = null;
  let success = false;
  let error: string | null = null;

  try {
    const signature = signWebhookPayload(row.secret_hash, body, timestamp);
    const response = await fetch(row.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Keyra-Event": "webhook.test",
        "X-Keyra-Delivery": deliveryId,
        "X-Keyra-Timestamp": timestamp,
        "X-Keyra-Signature": `sha256=${signature}`,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    responseCode = response.status;
    responseBody = (await response.text()).slice(0, 4000);
    success = response.ok;
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error";
  }

  await c.env.DB.prepare(
    `INSERT INTO webhook_deliveries (id, webhook_config_id, event_type, payload, status, response_code, response_body, attempts, is_test, last_attempt_at, created_at)
     VALUES (?, ?, 'webhook.test', ?, ?, ?, ?, 1, 1, ?, ?)`,
  )
    .bind(
      deliveryId,
      id,
      body,
      success ? "success" : "failed",
      responseCode,
      responseBody || error,
      timestamp,
      timestamp,
    )
    .run();

  return c.json({
    data: {
      success,
      response_code: responseCode,
      error,
    },
  });
}
