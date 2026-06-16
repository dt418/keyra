import type { Context } from "hono";
import { AppError } from "../../middleware/error";

export async function getTopProductsHandler(c: Context) {
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

  const limit = Math.min(parseInt(c.req.query("limit") || "5", 10), 20);

  const rows = (await c.env.DB.prepare(
    `SELECT p.id, p.name, COUNT(l.id) as license_count,
            SUM(CASE WHEN l.status = 'active' THEN 1 ELSE 0 END) as active_count
     FROM products p
     LEFT JOIN licenses l ON l.product_id = p.id
     WHERE p.organization_id = ?
     GROUP BY p.id, p.name
     ORDER BY license_count DESC
     LIMIT ?`,
  )
    .bind(member.org_id, limit)
    .all()  ) as { results: { id: string; name: string; license_count: number; active_count: number }[] };

  return c.json({
    data: (rows.results || []).map((r) => ({
      id: r.id,
      name: r.name,
      license_count: r.license_count ?? 0,
      active_count: r.active_count ?? 0,
    })),
  });
}
