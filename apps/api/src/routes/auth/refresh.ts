import type { Context } from 'hono';
import { refreshSchema } from '@keyra/shared-validation';
import { verifyToken, signAccessToken, signRefreshToken } from '../../lib/jwt';
import { AppError } from '../../middleware/error';
import { hashPassword } from '../../lib/password';

export async function refreshHandler(c: Context) {
  const body = await c.req.json();
  const parsed = refreshSchema.safeParse(body);
  if (!parsed.success) {
    throw parsed.error;
  }

  const { refresh_token } = parsed.data;

  let payload;
  try {
    payload = await verifyToken(refresh_token, c.env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError('UNAUTHORIZED', 'Invalid or expired refresh token', 401);
  }

  if (payload.type !== 'refresh') {
    throw new AppError('UNAUTHORIZED', 'Invalid token type', 401);
  }

  const user = await c.env.DB.prepare('SELECT id, email FROM users WHERE id = ?')
    .bind(payload.sub)
    .first() as { id: string; email: string } | null;

  if (!user) {
    throw new AppError('UNAUTHORIZED', 'User not found', 401);
  }

  const newSessionId = crypto.randomUUID();
  const [newAccessToken, newRefreshToken] = await Promise.all([
    signAccessToken({ sub: user.id, email: user.email, sessionId: newSessionId }, c.env.JWT_SECRET),
    signRefreshToken({ sub: user.id, email: user.email, jti: newSessionId }, c.env.JWT_REFRESH_SECRET),
  ]);

  if (payload.jti) {
    await c.env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL')
      .bind(new Date().toISOString(), payload.jti)
      .run();
  }
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const tokenHash = await hashPassword(newRefreshToken);
  await c.env.DB.prepare(
    `INSERT INTO sessions (id, user_id, refresh_token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(newSessionId, user.id, tokenHash, expiresAt, now)
    .run();

  return c.json({
    data: {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    },
  });
}
