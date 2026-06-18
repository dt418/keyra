import type { Context } from "hono";
import { AppError } from "../../middleware/error";

export async function getLicensesByTypeHandler(c: Context) {
  const userId = c.get("userId");
  if (!userId) {
    throw new AppError("UNAUTHORIZED", "Authentication required", 401);
  }
  const orgId = c.get("orgId");
  if (!orgId) {
    throw new AppError("FORBIDDEN", "Admin or owner role required", 403);
  }
const rows = (await c.env.DB.prepare(
    `SELECT type, COUNT(*) as count
     FROM licenses
     WHERE organization_id = ?
     GROUP BY type
     ORDER BY count DESC`,
  )
    .bind(orgId)
    .all()) as { results: { type: string; count: number }[] };

  return c.json({
    data: (rows.results || []).map((r) => ({ type: r.type, count: r.count })),
  });
}
