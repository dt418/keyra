import type { Context } from 'hono';
import { AppError } from '../../middleware/error';

export async function meHandler(c: Context) {
  const userId = c.get('userId');

  const user = await c.env.DB.prepare(
    'SELECT id, email, name, avatar_url, email_verified, created_at FROM users WHERE id = ?'
  )
    .bind(userId)
    .first() as { id: string; email: string; name: string | null; avatar_url: string | null; email_verified: boolean; created_at: string } | null;

  if (!user) {
    throw new AppError('NOT_FOUND', 'User not found', 404);
  }

  return c.json({
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      email_verified: user.email_verified,
      created_at: user.created_at,
    },
  });
}
