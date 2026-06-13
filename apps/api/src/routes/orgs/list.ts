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

  const { page, pageSize } = parsed.data;
  const offset = (page - 1) * pageSize;

  const countResult = await c.env.DB.prepare(`
    SELECT COUNT(*) as total
    FROM organizations o
    INNER JOIN org_members om ON o.id = om.org_id
    WHERE om.user_id = ?
  `)
    .bind(userId)
    .first() as { total: number } | null;

  const total = countResult?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  const orgs = await c.env.DB.prepare(`
    SELECT o.id, o.name, o.slug, o.plan, o.created_at, o.updated_at
    FROM organizations o
    INNER JOIN org_members om ON o.id = om.org_id
    WHERE om.user_id = ?
    ORDER BY o.created_at DESC
    LIMIT ? OFFSET ?
  `)
    .bind(userId, pageSize, offset)
    .all() as { id: string; name: string; slug: string; plan: string; created_at: string; updated_at: string }[];

  return c.json({
    data: orgs.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      created_at: org.created_at,
      updated_at: org.updated_at,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  });
}
