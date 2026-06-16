import type { Context } from "hono";
import { AppError } from "../../middleware/error";

export async function deleteWebhookHandler(c: Context) {
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

  const result = await c.env.DB.prepare(
    `DELETE FROM webhook_configs WHERE id = ? AND organization_id = ?`,
  )
    .bind(id, member.org_id)
    .run();

  if (result.meta?.changes === 0) {
    throw new AppError("NOT_FOUND", "Webhook not found", 404);
  }

  return c.json({ data: { id, deleted: true } });
}
