import type { Context } from 'hono';
import { createProductSchema } from '@keyra/shared-validation';
import { AppError } from '../../middleware/error';
import { hashApiKey } from '../../lib/password';

export async function createProductHandler(c: Context) {
  const userId = c.get('userId');
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }

  const body = await c.req.json();
  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success) {
    throw parsed.error;
  }

  const { name, description } = parsed.data;

  const member = await c.env.DB.prepare(
    `SELECT org_id FROM org_members WHERE user_id = ? AND role IN ('owner', 'admin') LIMIT 1`
  )
    .bind(userId)
    .first() as { org_id: string } | null;

  if (!member) {
    throw new AppError('FORBIDDEN', 'Admin or owner role required', 403);
  }

  const productId = crypto.randomUUID();
  const apiKey = crypto.randomUUID() + '-' + crypto.randomUUID();
  const apiKeyHash = await hashApiKey(apiKey);
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO products (id, organization_id, name, description, api_key_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(productId, member.org_id, name, description ?? null, apiKeyHash, now, now)
    .run();

  return c.json(
    {
      data: {
        id: productId,
        name,
        description: description ?? null,
        api_key: apiKey,
        created_at: now,
      },
    },
    201
  );
}
