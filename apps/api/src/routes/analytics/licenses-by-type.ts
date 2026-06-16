import type { Context } from "hono";
import { AppError } from "../../middleware/error";

export async function getLicensesByTypeHandler(c: Context) {
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

  const rows = (await c.env.DB.prepare(
    `SELECT type, COUNT(*) as count
     FROM licenses
     WHERE organization_id = ?
     GROUP BY type
     ORDER BY count DESC`,
  )
    .bind(member.org_id)
    .all()) as { results: { type: string; count: number }[] };

  return c.json({
    data: (rows.results || []).map((r) => ({ type: r.type, count: r.count })),
  });
}
