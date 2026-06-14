import type { Context } from 'hono';
import { listActivationsSchema } from '@keyra/shared-validation';
import { AppError } from '../../middleware/error';

export async function listActivationsHandler(c: Context) {
  const userId = c.get('userId');
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }

  const query = c.req.query();
  const parsed = listActivationsSchema.safeParse(query);
  if (!parsed.success) {
    throw parsed.error;
  }

  const { limit, cursor, license_id } = parsed.data;

  const member = await c.env.DB.prepare(
    `SELECT org_id FROM org_members WHERE user_id = ? AND role IN ('owner', 'admin') LIMIT 1`
  )
    .bind(userId)
    .first() as { org_id: string } | null;

  if (!member) {
    throw new AppError('FORBIDDEN', 'Admin or owner role required', 403);
  }

  let sql = `
    SELECT a.id, a.license_id, a.device_id, a.created_at, a.metadata,
           d.name as device_name, d.platform, d.app_version,
           l.type as license_type, l.key_hash
    FROM activations a
    INNER JOIN devices d ON a.device_id = d.id
    INNER JOIN licenses l ON a.license_id = l.id
    WHERE l.organization_id = ?
  `;
  const params: unknown[] = [member.org_id];

  if (license_id) {
    sql += ` AND a.license_id = ?`;
    params.push(license_id);
  }

  if (cursor) {
    sql += ` AND a.id < ?`;
    params.push(cursor);
  }

  sql += ` ORDER BY a.created_at DESC, a.id DESC LIMIT ?`;
  params.push(limit + 1);

  const activations = await c.env.DB.prepare(sql)
    .bind(...params)
    .all() as {
      id: string;
      license_id: string;
      device_id: string;
      created_at: string;
      metadata: string | null;
      device_name: string;
      platform: string;
      app_version: string | null;
      license_type: string;
    }[];

  let hasMore = false;
  let data = activations;

  if (activations.length > limit) {
    hasMore = true;
    data = activations.slice(0, limit);
  }

  const last = data[data.length - 1]!;
  const nextCursor = hasMore ? last.id : null;

  return c.json({
    data: data.map((a) => ({
      id: a.id,
      license_id: a.license_id,
      device_id: a.device_id,
      created_at: a.created_at,
      metadata: a.metadata ? JSON.parse(a.metadata) : null,
      device: {
        name: a.device_name,
        platform: a.platform,
        app_version: a.app_version,
      },
      license_type: a.license_type,
    })),
    pagination: {
      cursor: nextCursor,
      has_more: hasMore,
    },
  });
}
