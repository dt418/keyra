import type { Context } from 'hono';
import { AppError } from '../../middleware/error';

export async function resetDevicesHandler(c: Context) {
  const userId = c.get('userId');
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }

  const { id } = c.req.param();
  const orgId = c.get("orgId");
  if (!orgId) {
    throw new AppError("FORBIDDEN", "Admin or owner role required", 403);
  }
const license = await c.env.DB.prepare(
    `SELECT id, organization_id FROM licenses WHERE id = ? AND organization_id = ?`
  )
    .bind(id, orgId)
    .first() as { id: string; organization_id: string } | null;

  if (!license) {
    throw new AppError('NOT_FOUND', 'License not found', 404);
  }

  const devices = await c.env.DB.prepare(
    `SELECT id FROM devices WHERE license_id = ?`
  )
    .bind(id)
    .all() as { id: string }[];

  const deviceIds = devices.map((d) => d.id);

  if (deviceIds.length > 0) {
    await c.env.DB.prepare(`DELETE FROM activations WHERE device_id IN (${deviceIds.map(() => '?').join(',')})`)
      .bind(...deviceIds)
      .run();

    await c.env.DB.prepare(`DELETE FROM devices WHERE license_id = ?`)
      .bind(id)
      .run();
  }

  return c.json({
    data: {
      licenseId: id,
      devicesReset: deviceIds.length,
    },
  });
}
