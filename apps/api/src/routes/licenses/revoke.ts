import type { Context } from 'hono';
import { revokeLicenseSchema } from '@keyra/shared-validation';
import { AppError } from '../../middleware/error';

export async function revokeLicenseHandler(c: Context) {
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
  const parsed = revokeLicenseSchema.safeParse(body);
  if (!parsed.success) {
    throw parsed.error;
  }

  const { reason } = parsed.data;
  const now = new Date().toISOString();

  const result = await c.env.DB.prepare(
    `UPDATE licenses SET status = 'revoked', revoked_at = ?, revoked_reason = ?, updated_at = ?
     WHERE id = ? AND organization_id = ? AND status = 'active'`
  )
    .bind(now, reason ?? null, now, id, member.org_id)
    .run();

  if (result.meta?.changes === 0) {
    throw new AppError('NOT_FOUND', 'License not found or already revoked', 404);
  }

  return c.json({
    data: {
      id,
      status: 'revoked',
      revoked_at: now,
      revoked_reason: reason ?? null,
    },
  });
}
