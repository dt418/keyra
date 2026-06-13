import type { Context } from 'hono';
import { createOrgSchema } from '@keyra/shared-validation';
import { AppError } from '../../middleware/error';

export async function createOrgHandler(c: Context) {
  const userId = c.get('userId');

  const body = await c.req.json();
  const parsed = createOrgSchema.safeParse(body);
  if (!parsed.success) {
    throw parsed.error;
  }

  const { name, slug } = parsed.data;

  const orgId = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    await c.env.DB.prepare(
      `INSERT INTO organizations (id, name, slug, plan, created_at, updated_at)
       VALUES (?, ?, ?, 'free', ?, ?)`
    )
      .bind(orgId, name, slug.toLowerCase(), now, now)
      .run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('UNIQUE constraint failed: organizations.slug')) {
      throw new AppError('SLUG_EXISTS', 'Organization slug already exists', 409);
    }
    throw err;
  }

  const memberId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO org_members (id, org_id, user_id, role, created_at)
     VALUES (?, ?, ?, 'owner', ?)`
  )
    .bind(memberId, orgId, userId, now)
    .run();

  return c.json(
    {
      data: {
        id: orgId,
        name,
        slug: slug.toLowerCase(),
        plan: 'free',
        created_at: now,
      },
    },
    201
  );
}
