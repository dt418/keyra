import type { Context } from "hono";
import { AppError } from "../../middleware/error";

async function getOrgId(c: Context, userId: string): Promise<string> {
  const member = (await c.env.DB.prepare(
    `SELECT org_id FROM org_members WHERE user_id = ? AND role IN ('owner', 'admin') LIMIT 1`,
  )
    .bind(userId)
    .first()) as { org_id: string } | null;

  if (!member) {
    throw new AppError("FORBIDDEN", "Admin or owner role required", 403);
  }
  return member.org_id;
}

export async function getOverviewHandler(c: Context) {
  const userId = c.get("userId");
  if (!userId) {
    throw new AppError("UNAUTHORIZED", "Authentication required", 401);
  }
  const orgId = await getOrgId(c, userId);

  const [licensesRow, devicesRow, activationsRow, productsRow] =
    await Promise.all([
      c.env.DB.prepare(
        `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
         SUM(CASE WHEN status = 'revoked' THEN 1 ELSE 0 END) as revoked,
         SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired
       FROM licenses WHERE organization_id = ?`,
      )
        .bind(orgId)
        .first() as {
        total: number;
        active: number;
        revoked: number;
        expired: number;
      } | null,
      c.env.DB.prepare(
        `SELECT COUNT(DISTINCT d.id) as count
       FROM devices d
       INNER JOIN licenses l ON d.license_id = l.id
       WHERE l.organization_id = ?`,
      )
        .bind(orgId)
        .first() as { count: number } | null,
      c.env.DB.prepare(
        `SELECT COUNT(*) as count
       FROM activations a
       INNER JOIN licenses l ON a.license_id = l.id
       WHERE l.organization_id = ?`,
      )
        .bind(orgId)
        .first() as { count: number } | null,
      c.env.DB.prepare(
        `SELECT COUNT(*) as count FROM products WHERE organization_id = ?`,
      )
        .bind(orgId)
        .first() as { count: number } | null,
    ]);

  return c.json({
    data: {
      licenses: {
        total: licensesRow?.total ?? 0,
        active: licensesRow?.active ?? 0,
        revoked: licensesRow?.revoked ?? 0,
        expired: licensesRow?.expired ?? 0,
      },
      devices: devicesRow?.count ?? 0,
      activations: activationsRow?.count ?? 0,
      products: productsRow?.count ?? 0,
    },
  });
}
