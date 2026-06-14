import type { Context } from 'hono';
import { AppError } from '../../middleware/error';

export async function getProductHandler(c: Context) {
  const userId = c.get('userId');
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }

  const { id } = c.req.param();

  const member = await c.env.DB.prepare(
    `SELECT role FROM org_members WHERE user_id = ? AND role IN ('owner', 'admin') LIMIT 1`
  )
    .bind(userId)
    .first() as { role: string } | null;

  if (!member) {
    throw new AppError('FORBIDDEN', 'Admin or owner role required', 403);
  }

  const product = await c.env.DB.prepare(
    `SELECT id, name, description, created_at, updated_at
     FROM products WHERE id = ? AND organization_id = (
       SELECT org_id FROM org_members WHERE user_id = ? AND role IN ('owner', 'admin')
     )`
  )
    .bind(id, userId)
    .first() as { id: string; name: string; description: string | null; created_at: string; updated_at: string } | null;

  if (!product) {
    throw new AppError('NOT_FOUND', 'Product not found', 404);
  }

  return c.json({
    data: {
      id: product.id,
      name: product.name,
      description: product.description,
      created_at: product.created_at,
      updated_at: product.updated_at,
    },
  });
}
