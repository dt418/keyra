import type { Context } from "hono";
import { createHmac } from "node:crypto";

export const WEBHOOK_EVENTS = [
  "license.created",
  "license.updated",
  "license.revoked",
  "license.expired",
  "device.activated",
  "device.deactivated",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number];

export interface WebhookDeliveryPayload {
  event: WebhookEventType;
  data: Record<string, unknown>;
  timestamp: string;
  delivery_id: string;
}

export function signWebhookPayload(
  secret: string,
  body: string,
  timestamp: string,
): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
}

export async function dispatchWebhookEvent(
  c: Context,
  orgId: string,
  event: WebhookEventType,
  data: Record<string, unknown>,
): Promise<void> {
  c.executionCtx.waitUntil(
    (async () => {
      try {
        const configsResult = await c.env.DB.prepare(
          `SELECT id, url, secret_hash, events FROM webhook_configs
           WHERE organization_id = ? AND active = 1`,
        )
          .bind(orgId)
          .all();
        const configs =
          (
            configsResult as
              | {
                  results?: {
                    id: string;
                    url: string;
                    secret_hash: string;
                    events: string;
                  }[];
                }
              | undefined
          )?.results || [];

        for (const cfg of configs) {
          let eventList: string[] = [];
          try {
            eventList = JSON.parse(cfg.events) as string[];
          } catch {
            eventList = [];
          }
          if (!eventList.includes(event)) continue;

          const deliveryId = crypto.randomUUID();
          const timestamp = new Date().toISOString();
          const payload: WebhookDeliveryPayload = {
            event,
            data,
            timestamp,
            delivery_id: deliveryId,
          };
          const body = JSON.stringify(payload);

          await c.env.DB.prepare(
            `INSERT INTO webhook_deliveries (id, webhook_config_id, event_type, payload, status, attempts, created_at)
             VALUES (?, ?, ?, ?, 'pending', 0, ?)`,
          )
            .bind(deliveryId, cfg.id, event, body, timestamp)
            .run();

          try {
            const signature = signWebhookPayload(
              cfg.secret_hash,
              body,
              timestamp,
            );
            const response = await fetch(cfg.url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Keyra-Event": event,
                "X-Keyra-Delivery": deliveryId,
                "X-Keyra-Timestamp": timestamp,
                "X-Keyra-Signature": `sha256=${signature}`,
              },
              body,
              signal: AbortSignal.timeout(10_000),
            });

            const responseText = await response.text();
            const responseBody = responseText.slice(0, 4000);
            const status = response.ok ? "success" : "failed";

            await c.env.DB.prepare(
              `UPDATE webhook_deliveries
               SET status = ?, response_code = ?, response_body = ?, attempts = attempts + 1, last_attempt_at = ?
               WHERE id = ?`,
            )
              .bind(
                status,
                response.status,
                responseBody,
                timestamp,
                deliveryId,
              )
              .run();
          } catch (err) {
            const errorMsg =
              err instanceof Error ? err.message : "Unknown error";
            await c.env.DB.prepare(
              `UPDATE webhook_deliveries
               SET status = 'failed', response_body = ?, attempts = attempts + 1, last_attempt_at = ?
               WHERE id = ?`,
            )
              .bind(errorMsg.slice(0, 4000), timestamp, deliveryId)
              .run();
          }
        }
      } catch (err) {
        console.error("webhook dispatch error", err);
      }
    })(),
  );
}
