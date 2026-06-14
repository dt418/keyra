import type { Context } from 'hono';
import { listOrgsSchema } from '@keyra/shared-validation';
import { AppError } from '../../middleware/error';

export async function listOrgsHandler(c: Context) {
  const userId = c.get('userId');
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }

  const query = c.req.query();
  const parsed = listOrgsSchema.safeParse(query);
  if (!parsed.success) {
    throw parsed.error;
  }

  const { limit, cursor } = parsed.data;

  let sql = `
    SELECT o.id, o.name, o.slug, o.plan, o.created_at, o.updated_at
    FROM organizations o
    INNER JOIN org_members om ON o.id = om.org_id
    WHERE om.user_id = ?
  `;
  const params: unknown[] = [userId];

  if (cursor) {
    sql += ` AND o.id < ?`;
    params.push(cursor);
  }

  sql += ` ORDER BY o.created_at DESC, o.id DESC LIMIT ?`;

  const fetchLimit = limit + 1;
  params.push(fetchLimit);

  const result = await c.env.DB.prepare(sql)
    .bind(...params)
    .all<{ id: string; name: string; slug: string; plan: string; created_at: string; updated_at: string }>();

  const orgs = result.results || [];

  let hasMore = false;
  let data = orgs;

  if (orgs.length > limit) {
    hasMore = true;
    data = orgs.slice(0, limit);
  }

  const last = data[data.length - 1]!;
  const nextCursor = hasMore ? last.id : null;

  return c.json({
    data: data.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      created_at: org.created_at,
      updated_at: org.updated_at,
    })),
    pagination: {
      cursor: nextCursor,
      has_more: hasMore,
    },
  });
}
