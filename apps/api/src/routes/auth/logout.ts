import type { Context } from 'hono';
import { AppError } from '../../middleware/error';

export async function logoutHandler(c: Context) {
  const userId = c.get('userId');
  const sessionId = c.get('sessionId');
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }

  if (sessionId) {
    await c.env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL')
      .bind(new Date().toISOString(), sessionId)
      .run();
  }

  return c.json({ data: { success: true } });
}
