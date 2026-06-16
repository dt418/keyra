import type { Context } from "hono";
import { AppError } from "../../middleware/error";
import { updateWebhookSchema } from "@keyra/shared-validation";

export async function updateWebhookHandler(c: Context) {
  const userId = c.get("userId");
  if (!userId) {
    throw new AppError("UNAUTHORIZED", "Authentication required", 401);
  }

  const { id } = c.req.param();

  const member = (await c.env.DB.prepare(
    `SELECT org_id FROM org_members WHERE user_id = ? AND role IN ('owner', 'admin') LIMIT 1`,
  )
    .bind(userId)
    .first()) as { org_id: string } | null;

  if (!member) {
    throw new AppError("FORBIDDEN", "Admin or owner role required", 403);
  }

  const body = await c.req.json();
  const parsed = updateWebhookSchema.safeParse(body);
  if (!parsed.success) {
    throw parsed.error;
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (parsed.data.url !== undefined) {
    updates.push("url = ?");
    params.push(parsed.data.url);
  }
  if (parsed.data.events !== undefined) {
    updates.push("events = ?");
    params.push(JSON.stringify(parsed.data.events));
  }
  if (parsed.data.active !== undefined) {
    updates.push("active = ?");
    params.push(parsed.data.active ? 1 : 0);
  }

  if (updates.length === 0) {
    const current = (await c.env.DB.prepare(
      `SELECT id, organization_id, url, events, active, created_at, updated_at FROM webhook_configs WHERE id = ? AND organization_id = ?`,
    )
      .bind(id, member.org_id)
      .first()) as
      | {
          id: string;
          organization_id: string;
          url: string;
          events: string;
          active: number;
          created_at: string;
          updated_at: string;
        }
      | null;
    if (!current) {
      throw new AppError("NOT_FOUND", "Webhook not found", 404);
    }
    let events: string[] = [];
    try {
      events = JSON.parse(current.events) as string[];
    } catch {
      events = [];
    }
    return c.json({
      data: {
        id: current.id,
        organization_id: current.organization_id,
        url: current.url,
        events,
        active: current.active === 1,
        created_at: current.created_at,
        updated_at: current.updated_at,
      },
    });
  }

  const now = new Date().toISOString();
  updates.push("updated_at = ?");
  params.push(now);
  params.push(id);
  params.push(member.org_id);

  const result = await c.env.DB.prepare(
    `UPDATE webhook_configs SET ${updates.join(", ")} WHERE id = ? AND organization_id = ?`,
  )
    .bind(...params)
    .run();

  if (result.meta?.changes === 0) {
    throw new AppError("NOT_FOUND", "Webhook not found", 404);
  }

  return c.json({ data: { id, updated_at: now } });
}
