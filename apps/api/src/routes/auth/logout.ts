import type { Context } from 'hono';

export async function logoutHandler(c: Context) {
  const userId = c.get('userId');
  const kv = c.env.SESSIONS;

  const keys = await kv.list({ prefix: `session:${userId}:` });
  await Promise.all(keys.keys.map((k: { name: string }) => kv.delete(k.name)));

  return c.json({ success: true });
}