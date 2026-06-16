import type { Context } from "hono";
import { AppError } from "../../middleware/error";

export async function getActivationsOverTimeHandler(c: Context) {
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

  const period = c.req.query("period") || "7d";
  const days = period === "90d" ? 90 : period === "30d" ? 30 : 7;

  const rows = (await c.env.DB.prepare(
    `SELECT date(a.created_at) as day, COUNT(*) as count
     FROM activations a
     INNER JOIN licenses l ON a.license_id = l.id
     WHERE l.organization_id = ? AND a.created_at >= datetime('now', ?)
     GROUP BY day
     ORDER BY day ASC`,
  )
    .bind(member.org_id, `-${days} days`)
    .all()) as { results: { day: string; count: number }[] };

  const map = new Map<string, number>();
  for (const r of rows.results || []) {
    map.set(r.day, r.count);
  }

  const series: { date: string; count: number }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const day = d.toISOString().slice(0, 10);
    series.push({ date: day, count: map.get(day) || 0 });
  }

  return c.json({ data: series, period });
}
