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

  const { name, slug: providedSlug } = parsed.data;

  const orgId = crypto.randomUUID();
  const now = new Date().toISOString();

  const baseSlug = providedSlug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'org';
  let slug = baseSlug;
  let suffix = 0;

  while (suffix < 100) {
    try {
      await c.env.DB.prepare(
        `INSERT INTO organizations (id, name, slug, plan, created_at, updated_at)
         VALUES (?, ?, ?, 'free', ?, ?)`
      )
        .bind(orgId, name, slug, now, now)
        .run();
      break;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('UNIQUE constraint failed: organizations.slug')) {
        suffix++;
        slug = `${baseSlug}-${suffix}`;
        if (suffix >= 100) {
          throw new AppError('CONFLICT', 'Could not generate unique slug', 409);
        }
      } else {
        throw err;
      }
    }
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
