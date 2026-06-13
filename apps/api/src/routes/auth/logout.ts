import type { Context } from 'hono';

export async function logoutHandler(c: Context) {
  const sessionId = c.get('sessionId');

  if (sessionId) {
    await c.env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL')
      .bind(new Date().toISOString(), sessionId)
      .run();
  }

  return c.json({ data: { success: true } });
}
