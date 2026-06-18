import type { MiddlewareHandler } from 'hono';
import { AppError } from './error';

/**
 * Requires the caller to be an owner or admin of at least one organization.
 * Stores orgId and orgRole on the Hono context.
 *
 * Apply AFTER authMiddleware. If the user has memberships but none with
 * owner/admin, returns 403.
 */
export const requireOrgMember: MiddlewareHandler = async (c, next) => {
  const userId = c.get('userId');
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }

  const member = (await c.env.DB.prepare(
    `SELECT org_id, role FROM org_members
     WHERE user_id = ? AND role IN ('owner', 'admin')
     ORDER BY (role = 'owner') DESC, created_at ASC
     LIMIT 1`
  )
    .bind(userId)
    .first()) as { org_id: string; role: 'owner' | 'admin' } | null;

  if (!member) {
    throw new AppError('FORBIDDEN', 'Admin or owner role required', 403);
  }

  c.set('orgId', member.org_id);
  c.set('orgRole', member.role);
  await next();
};
