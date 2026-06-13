import type { Context } from 'hono';
import { AppError } from '../../middleware/error';

export async function getOrgHandler(c: Context) {
  const userId = c.get('userId');
  const { id } = c.req.param();

  const membership = await c.env.DB.prepare(
    'SELECT id FROM org_members WHERE org_id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .first();

  if (!membership) {
    throw new AppError('NOT_FOUND', 'Organization not found or access denied', 404);
  }

  const org = await c.env.DB.prepare(
    'SELECT id, name, slug, plan, created_at, updated_at FROM organizations WHERE id = ?'
  )
    .bind(id)
    .first() as { id: string; name: string; slug: string; plan: string; created_at: string; updated_at: string } | null;

  if (!org) {
    throw new AppError('NOT_FOUND', 'Organization not found', 404);
  }

  return c.json({
    data: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      created_at: org.created_at,
      updated_at: org.updated_at,
    },
  });
}
