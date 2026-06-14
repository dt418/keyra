import type { Context } from 'hono';
import { createLicenseSchema } from '@keyra/shared-validation';
import { AppError } from '../../middleware/error';
import { hashApiKey } from '../../lib/password';

export async function createLicenseHandler(c: Context) {
  const userId = c.get('userId');
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }

  const body = await c.req.json();
  const parsed = createLicenseSchema.safeParse(body);
  if (!parsed.success) {
    throw parsed.error;
  }

  const { product_id, type, max_devices, expires_at, feature_flags } = parsed.data;

  const member = await c.env.DB.prepare(
    `SELECT org_id FROM org_members WHERE user_id = ? AND role IN ('owner', 'admin') LIMIT 1`
  )
    .bind(userId)
    .first() as { org_id: string } | null;

  if (!member) {
    throw new AppError('FORBIDDEN', 'Admin or owner role required', 403);
  }

  const product = await c.env.DB.prepare(
    `SELECT id FROM products WHERE id = ? AND organization_id = ?`
  )
    .bind(product_id, member.org_id)
    .first() as { id: string } | null;

  if (!product) {
    throw new AppError('NOT_FOUND', 'Product not found', 404);
  }

  const licenseId = crypto.randomUUID();
  const licenseKey = generateLicenseKey();
  const keyHash = await hashApiKey(licenseKey);
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO licenses (id, product_id, organization_id, key_hash, type, status, max_devices, expires_at, feature_flags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`
  )
    .bind(
      licenseId,
      product_id,
      member.org_id,
      keyHash,
      type,
      max_devices ?? 1,
      expires_at ?? null,
      feature_flags ? JSON.stringify(feature_flags) : null,
      now,
      now
    )
    .run();

  return c.json(
    {
      data: {
        id: licenseId,
        product_id,
        key: licenseKey,
        type,
        status: 'active',
        max_devices: max_devices ?? 1,
        expires_at: expires_at ?? null,
        feature_flags: feature_flags ?? null,
        created_at: now,
      },
    },
    201
  );
}

function generateLicenseKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments = [];
  for (let s = 0; s < 4; s++) {
    let segment = '';
    for (let i = 0; i < 5; i++) {
      segment += chars[Math.floor(Math.random() * chars.length)];
    }
    segments.push(segment);
  }
  return segments.join('-');
}
