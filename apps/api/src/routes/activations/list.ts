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

  const members = await c.env.DB.prepare(
    `SELECT org_id FROM org_members WHERE user_id = ? LIMIT 100`
  )
    .bind(userId)
    .all() as { results: { org_id: string }[] };

  const orgIds = (members.results || []).map((m) => m.org_id);

  if (orgIds.length === 0) {
    return c.json({
      data: [],
      pagination: { cursor: null, has_more: false },
    });
  }

  const orgPlaceholders = orgIds.map(() => '?').join(',');
  let sql = `
    SELECT a.id, a.license_id, a.device_id, a.created_at, a.metadata,
           d.name as device_name, d.platform, d.app_version, d.last_seen_at,
           l.type as license_type
    FROM activations a
    INNER JOIN devices d ON a.device_id = d.id
    INNER JOIN licenses l ON a.license_id = l.id
    WHERE l.organization_id IN (${orgPlaceholders})
  `;
  const params: unknown[] = orgIds;

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

  const result = await c.env.DB.prepare(sql)
    .bind(...params)
    .all() as {
      results: {
        id: string;
        license_id: string;
        device_id: string;
        created_at: string;
        metadata: string | null;
        device_name: string;
        platform: string;
        app_version: string | null;
        last_seen_at: string;
        license_type: string;
      }[];
    };

  const activations = result.results || [];
  let hasMore = false;
  let data = activations;

  if (activations.length > limit) {
    hasMore = true;
    data = activations.slice(0, limit);
  }

  const nextCursor = hasMore && data.length > 0 ? data[data.length - 1]!.id : null;

  return c.json({
    data: data.map((a) => {
      let metadata = null;
      if (a.metadata) {
        try {
          metadata = JSON.parse(a.metadata);
        } catch {
          metadata = null;
        }
      }
      return {
        id: a.id,
        license_id: a.license_id,
        device_id: a.device_id,
        device_name: a.device_name,
        device_platform: a.platform,
        device_app_version: a.app_version,
        device_last_seen_at: a.last_seen_at,
        license_type: a.license_type,
        created_at: a.created_at,
        metadata,
      };
    }),
    pagination: {
      cursor: nextCursor,
      has_more: hasMore,
    },
  });
}
