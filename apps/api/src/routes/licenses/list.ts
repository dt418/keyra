import type { Context } from 'hono';
import { listLicensesSchema } from '@keyra/shared-validation';
import { AppError } from '../../middleware/error';

export async function listLicensesHandler(c: Context) {
  const userId = c.get('userId');
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }

  const query = c.req.query();
  const parsed = listLicensesSchema.safeParse(query);
  if (!parsed.success) {
    throw parsed.error;
  }

  const { limit, cursor, product_id, status } = parsed.data;

  const member = await c.env.DB.prepare(
    `SELECT org_id FROM org_members WHERE user_id = ? AND role IN ('owner', 'admin') LIMIT 1`
  )
    .bind(userId)
    .first() as { org_id: string } | null;

  if (!member) {
    throw new AppError('FORBIDDEN', 'Admin or owner role required', 403);
  }

  let sql = `
    SELECT l.id, l.product_id, l.type, l.status, l.max_devices, l.expires_at,
           l.feature_flags, l.created_at, l.updated_at, l.revoked_at, l.revoked_reason,
           p.name as product_name
    FROM licenses l
    INNER JOIN products p ON l.product_id = p.id
    WHERE l.organization_id = ?
  `;
  const params: unknown[] = [member.org_id];

  if (product_id) {
    sql += ` AND l.product_id = ?`;
    params.push(product_id);
  }

  if (status) {
    sql += ` AND l.status = ?`;
    params.push(status);
  }

  if (cursor) {
    sql += ` AND l.id < ?`;
    params.push(cursor);
  }

  sql += ` ORDER BY l.created_at DESC, l.id DESC LIMIT ?`;
  params.push(limit + 1);

  const licenses = await c.env.DB.prepare(sql)
    .bind(...params)
    .all() as {
      id: string;
      product_id: string;
      type: string;
      status: string;
      max_devices: number;
      expires_at: string | null;
      feature_flags: string | null;
      created_at: string;
      updated_at: string;
      revoked_at: string | null;
      revoked_reason: string | null;
      product_name: string;
    }[];

  let hasMore = false;
  let data = licenses;

  if (licenses.length > limit) {
    hasMore = true;
    data = licenses.slice(0, limit);
  }

  const last = data[data.length - 1];
  const nextCursor = hasMore && last ? last.id : null;

  return c.json({
    data: data.map((l) => ({
      id: l.id,
      product_id: l.product_id,
      product_name: l.product_name,
      type: l.type,
      status: l.status,
      max_devices: l.max_devices,
      expires_at: l.expires_at,
      feature_flags: l.feature_flags ? JSON.parse(l.feature_flags) : null,
      created_at: l.created_at,
      updated_at: l.updated_at,
      revoked_at: l.revoked_at,
      revoked_reason: l.revoked_reason,
    })),
    pagination: {
      cursor: nextCursor,
      has_more: hasMore,
    },
  });
}
