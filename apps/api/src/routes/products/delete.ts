import type { Context } from 'hono';
import { AppError } from '../../middleware/error';

export async function deleteProductHandler(c: Context) {
  const userId = c.get('userId');
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }

  const { id } = c.req.param();

  const member = await c.env.DB.prepare(
    `SELECT org_id FROM org_members WHERE user_id = ? AND role = 'owner' LIMIT 1`
  )
    .bind(userId)
    .first() as { org_id: string } | null;

  if (!member) {
    throw new AppError('FORBIDDEN', 'Only owners can delete products', 403);
  }

  const result = await c.env.DB.prepare(
    `DELETE FROM products WHERE id = ? AND organization_id = ?`
  )
    .bind(id, member.org_id)
    .run();

  if (result.meta?.changes === 0) {
    throw new AppError('NOT_FOUND', 'Product not found', 404);
  }

  return c.json({ data: { success: true } });
}
