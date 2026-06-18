import type { Context } from 'hono';
import { listProductsSchema } from '@keyra/shared-validation';
import { AppError } from '../../middleware/error';

type ProductRow = { id: string; name: string; description: string | null; created_at: string; updated_at: string };

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
  const orgId = c.get("orgId");
  if (!orgId) {
    throw new AppError("FORBIDDEN", "Admin or owner role required", 403);
  }
let sql = `
    SELECT id, name, description, created_at, updated_at
    FROM products
    WHERE organization_id = ?
  `;
  const params: unknown[] = [orgId];

  if (cursor) {
    sql += ` AND id < ?`;
    params.push(cursor);
  }

  sql += ` ORDER BY created_at DESC, id DESC LIMIT ?`;
  params.push(limit + 1);

  const result = await c.env.DB.prepare(sql)
    .bind(...params)
    .all();
  const products = (result as { results?: ProductRow[] }).results || (result as ProductRow[]) || [];

  let hasMore = false;
  let data = products;

  if (data.length > limit) {
    hasMore = true;
    data = data.slice(0, limit);
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
