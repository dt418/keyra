import type { Context } from 'hono';
import { updateProductSchema } from '@keyra/shared-validation';
import { AppError } from '../../middleware/error';

export async function updateProductHandler(c: Context) {
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

  const body = await c.req.json();
  const parsed = updateProductSchema.safeParse(body);
  if (!parsed.success) {
    throw parsed.error;
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (parsed.data.name !== undefined) {
    updates.push('name = ?');
    params.push(parsed.data.name);
  }
  if (parsed.data.description !== undefined) {
    updates.push('description = ?');
    params.push(parsed.data.description);
  }

  if (updates.length === 0) {
    const product = await c.env.DB.prepare(
      `SELECT id, name, description, created_at, updated_at FROM products WHERE id = ?`
    )
      .bind(id)
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

  const now = new Date().toISOString();
  updates.push('updated_at = ?');
  params.push(now);
  params.push(id);

  const result = await c.env.DB.prepare(
    `UPDATE products SET ${updates.join(', ')} WHERE id = ?`
  )
    .bind(...params)
    .run();

  if (result.meta?.changes === 0) {
    throw new AppError('NOT_FOUND', 'Product not found', 404);
  }

  const product = await c.env.DB.prepare(
    `SELECT id, name, description, created_at, updated_at FROM products WHERE id = ?`
  )
    .bind(id)
    .first() as { id: string; name: string; description: string | null; created_at: string; updated_at: string } | null;

  return c.json({
    data: {
      id: product!.id,
      name: product!.name,
      description: product!.description,
      created_at: product!.created_at,
      updated_at: product!.updated_at,
    },
  });
}
