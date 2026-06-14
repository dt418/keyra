import type { Context } from 'hono';
import { activateDeviceSchema } from '@keyra/shared-validation';
import { AppError } from '../../middleware/error';
import { hashApiKey } from '../../lib/password';

export async function activateDeviceHandler(c: Context) {
  const body = await c.req.json();
  const parsed = activateDeviceSchema.safeParse(body);
  if (!parsed.success) {
    throw parsed.error;
  }

  const { license_key, device_name, platform, app_version, metadata } = parsed.data;

  const keyHash = await hashApiKey(license_key);

  const license = await c.env.DB.prepare(
    `SELECT l.id, l.product_id, l.status, l.max_devices, l.expires_at, l.feature_flags,
            l.type, p.name as product_name
     FROM licenses l
     INNER JOIN products p ON l.product_id = p.id
     WHERE l.key_hash = ?`
  )
    .bind(keyHash)
    .first() as {
      id: string;
      product_id: string;
      status: string;
      max_devices: number;
      expires_at: string | null;
      feature_flags: string | null;
      type: string;
      product_name: string;
    } | null;

  if (!license) {
    throw new AppError('NOT_FOUND', 'Invalid license key', 404);
  }

  if (license.status !== 'active') {
    throw new AppError('FORBIDDEN', `License is ${license.status}`, 403);
  }

  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    await c.env.DB.prepare(
      `UPDATE licenses SET status = 'expired', updated_at = ? WHERE id = ?`
    )
      .bind(new Date().toISOString(), license.id)
      .run();
    throw new AppError('FORBIDDEN', 'License has expired', 403);
  }

  const deviceCount = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM devices WHERE license_id = ?`
  )
    .bind(license.id)
    .first() as { count: number } | null;

  if (deviceCount && deviceCount.count >= license.max_devices) {
    throw new AppError('FORBIDDEN', `Maximum device limit (${license.max_devices}) reached`, 403);
  }

  const userId = c.get('userId') ?? crypto.randomUUID();

  let device = await c.env.DB.prepare(
    `SELECT id FROM devices WHERE license_id = ? AND name = ? AND platform = ?`
  )
    .bind(license.id, device_name, platform)
    .first() as { id: string } | null;

  if (!device) {
    const deviceId = crypto.randomUUID();
    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `INSERT INTO devices (id, license_id, user_id, name, platform, app_version, last_seen_at, activated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(deviceId, license.id, userId, device_name, platform, app_version ?? null, now, now)
      .run();
    device = { id: deviceId };
  } else {
    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `UPDATE devices SET last_seen_at = ?, app_version = ? WHERE id = ?`
    )
      .bind(now, app_version ?? null, device.id)
      .run();
  }

  const activationId = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO activations (id, license_id, device_id, created_at, metadata)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(activationId, license.id, device.id, now, metadata ? JSON.stringify(metadata) : null)
    .run();

  return c.json(
    {
      data: {
        activation_id: activationId,
        device_id: device.id,
        license_id: license.id,
        product_name: license.product_name,
        license_type: license.type,
        feature_flags: license.feature_flags ? JSON.parse(license.feature_flags) : null,
        expires_at: license.expires_at,
        activated_at: now,
      },
    },
    201
  );
}
