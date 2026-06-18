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
  const orgId = c.get("orgId");
  if (!orgId) {
    throw new AppError("FORBIDDEN", "Admin or owner role required", 403);
  }
const productId = crypto.randomUUID();
  const apiKey = crypto.randomUUID() + '-' + crypto.randomUUID();
  const apiKeyHash = await hashApiKey(apiKey);
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO products (id, organization_id, name, description, api_key_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(productId, orgId, name, description ?? null, apiKeyHash, now, now)
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
