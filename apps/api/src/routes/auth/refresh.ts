import type { Context } from 'hono';
import { refreshSchema } from '@keyra/shared-validation';
import { verifyToken, signAccessToken, signRefreshToken } from '../../lib/jwt';
import { revokeSession, storeRefreshToken } from '../../lib/sessions';
import { AppError } from '../../middleware/error';

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
    await revokeSession(c, payload.jti);
  }

  await storeRefreshToken(c, {
    userId: user.id,
    refreshToken: newRefreshToken,
    sessionId: newSessionId,
  });

  return c.json({
    data: {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    },
  });
}
