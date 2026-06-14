import type { Context } from 'hono';
import { AppError } from '../../middleware/error';

export async function deactivateDeviceHandler(c: Context) {
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

  const device = await c.env.DB.prepare(
    `SELECT d.id, d.license_id, l.organization_id 
     FROM devices d
     INNER JOIN licenses l ON d.license_id = l.id
     WHERE d.id = ?`
  )
    .bind(id)
    .first() as { id: string; license_id: string; organization_id: string } | null;

  if (!device) {
    throw new AppError('NOT_FOUND', 'Device not found', 404);
  }

  if (device.organization_id !== member.org_id) {
    throw new AppError('FORBIDDEN', 'You do not have access to this device', 403);
  }

  await c.env.DB.prepare(`DELETE FROM activations WHERE device_id = ?`)
    .bind(id)
    .run();

  const result = await c.env.DB.prepare(`DELETE FROM devices WHERE id = ?`)
    .bind(id)
    .run();

  if (result.meta?.changes === 0) {
    throw new AppError('NOT_FOUND', 'Device not found or already deactivated', 404);
  }

  return c.json({
    data: {
      id,
      status: 'deactivated',
    },
  });
}
