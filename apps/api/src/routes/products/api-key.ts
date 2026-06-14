import type { Context } from 'hono';
import { AppError } from '../../middleware/error';
import { hashApiKey } from '../../lib/password';

export async function getApiKeyHandler(c: Context) {
  const userId = c.get('userId');
  if (!userId) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const { id } = c.req.param();

  const member = await c.env.DB.prepare(
    `SELECT org_id FROM org_members WHERE user_id = ? AND role IN ('owner', 'admin') LIMIT 1`
  )
    .bind(userId)
    .first() as { org_id: string } | null;

  if (!member) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Admin or owner role required' } }, 403);
  }

  const product = await c.env.DB.prepare(
    `SELECT id, name, api_key_hash FROM products WHERE id = ? AND organization_id = ?`
  )
    .bind(id, member.org_id)
    .first() as { id: string; name: string; api_key_hash: string } | null;

  if (!product) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Product not found' } }, 404);
  }

  return c.json({
    data: {
      productId: product.id,
      name: product.name,
      hasApiKey: !!product.api_key_hash,
    },
  });
}

export async function regenerateApiKeyHandler(c: Context) {
  const userId = c.get('userId');
  if (!userId) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const { id } = c.req.param();

  const member = await c.env.DB.prepare(
    `SELECT org_id FROM org_members WHERE user_id = ? AND role IN ('owner', 'admin') LIMIT 1`
  )
    .bind(userId)
    .first() as { org_id: string } | null;

  if (!member) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Admin or owner role required' } }, 403);
  }

  const product = await c.env.DB.prepare(
    `SELECT id, name FROM products WHERE id = ? AND organization_id = ?`
  )
    .bind(id, member.org_id)
    .first() as { id: string; name: string } | null;

  if (!product) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Product not found' } }, 404);
  }

  const newApiKey = crypto.randomUUID() + '-' + crypto.randomUUID();
  const newApiKeyHash = await hashApiKey(newApiKey);
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `UPDATE products SET api_key_hash = ?, updated_at = ? WHERE id = ?`
  )
    .bind(newApiKeyHash, now, id)
    .run();

  return c.json({
    data: {
      apiKey: newApiKey,
      productId: product.id,
      name: product.name,
    },
  });
}
