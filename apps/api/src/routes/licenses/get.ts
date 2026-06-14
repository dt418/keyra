import type { Context } from 'hono';
import { AppError } from '../../middleware/error';

export async function getLicenseHandler(c: Context) {
  const userId = c.get('userId');
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }

  const { id } = c.req.param();

  const member = await c.env.DB.prepare(
    `SELECT org_id FROM org_members WHERE user_id = ? AND role IN ('owner', 'admin') LIMIT 1`
  )
    .bind(userId)
    .first() as { org_id: string } | null;

  if (!member) {
    throw new AppError('FORBIDDEN', 'Admin or owner role required', 403);
  }

  const license = await c.env.DB.prepare(
    `SELECT l.id, l.product_id, l.type, l.status, l.max_devices, l.expires_at,
            l.feature_flags, l.created_at, l.updated_at, l.revoked_at, l.revoked_reason,
            p.name as product_name
     FROM licenses l
     INNER JOIN products p ON l.product_id = p.id
     WHERE l.id = ? AND l.organization_id = ?`
  )
    .bind(id, member.org_id)
    .first() as {
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
    } | null;

  if (!license) {
    throw new AppError('NOT_FOUND', 'License not found', 404);
  }

  return c.json({
    data: {
      id: license.id,
      product_id: license.product_id,
      product_name: license.product_name,
      type: license.type,
      status: license.status,
      max_devices: license.max_devices,
      expires_at: license.expires_at,
      feature_flags: license.feature_flags ? JSON.parse(license.feature_flags) : null,
      created_at: license.created_at,
      updated_at: license.updated_at,
      revoked_at: license.revoked_at,
      revoked_reason: license.revoked_reason,
    },
  });
}
