import type { Context } from 'hono';
import { AppError } from '../../middleware/error';

export async function logoutHandler(c: Context) {
  const userId = c.get('userId');
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    'UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL'
  )
    .bind(now, userId)
    .run();

  return c.json({ data: { success: true } });
}
