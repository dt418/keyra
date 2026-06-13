import type { Context } from 'hono';
import { updateOrgSchema } from '@keyra/shared-validation';
import { AppError } from '../../middleware/error';

export async function updateOrgHandler(c: Context) {
  const userId = c.get('userId');
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }

  const { id } = c.req.param();

  const membership = await c.env.DB.prepare(
    'SELECT role FROM org_members WHERE org_id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .first() as { role: string } | null;

  if (!membership) {
    throw new AppError('NOT_FOUND', 'Organization not found or access denied', 404);
  }

  if (membership.role !== 'owner' && membership.role !== 'admin') {
    throw new AppError('FORBIDDEN', 'Admin or owner role required', 403);
  }

  const body = await c.req.json();
  const parsed = updateOrgSchema.safeParse(body);
  if (!parsed.success) {
    throw parsed.error;
  }

  const { name, slug } = parsed.data;
  const now = new Date().toISOString();

  const updates: string[] = [];
  const values: unknown[] = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (slug !== undefined) {
    updates.push('slug = ?');
    values.push(slug.toLowerCase());
  }

  if (updates.length === 0) {
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

  updates.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await c.env.DB.prepare(
    `UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`
  )
    .bind(...values)
    .run();

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
