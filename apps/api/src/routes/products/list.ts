import type { Context } from 'hono';
import { listProductsSchema } from '@keyra/shared-validation';
import { AppError } from '../../middleware/error';

export async function listProductsHandler(c: Context) {
  const userId = c.get('userId');
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }

  const query = c.req.query();
  const parsed = listProductsSchema.safeParse(query);
  if (!parsed.success) {
    throw parsed.error;
  }

  const { limit, cursor } = parsed.data;

  const member = await c.env.DB.prepare(
    `SELECT org_id FROM org_members WHERE user_id = ? AND role IN ('owner', 'admin') LIMIT 1`
  )
    .bind(userId)
    .first() as { org_id: string } | null;

  if (!member) {
    throw new AppError('FORBIDDEN', 'Admin or owner role required', 403);
  }

  let sql = `
    SELECT id, name, description, created_at, updated_at
    FROM products
    WHERE organization_id = ?
  `;
  const params: unknown[] = [member.org_id];

  if (cursor) {
    sql += ` AND id < ?`;
    params.push(cursor);
  }

  sql += ` ORDER BY created_at DESC, id DESC LIMIT ?`;
  params.push(limit + 1);

  const products = await c.env.DB.prepare(sql)
    .bind(...params)
    .all() as { id: string; name: string; description: string | null; created_at: string; updated_at: string }[];

  let hasMore = false;
  let data = products;

  if (products.length > limit) {
    hasMore = true;
    data = products.slice(0, limit);
  }

  const last = data[data.length - 1];
  const nextCursor = hasMore && last ? last.id : null;

  return c.json({
    data: data.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      created_at: p.created_at,
      updated_at: p.updated_at,
    })),
    pagination: {
      cursor: nextCursor,
      has_more: hasMore,
    },
  });
}
