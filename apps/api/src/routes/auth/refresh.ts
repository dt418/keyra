import type { Context } from 'hono';
import { refreshSchema } from '@keyra/shared-validation';
import { verifyToken, signAccessToken, signRefreshToken } from '../../lib/jwt';
import { AppError } from '../../middleware/error';

interface RefreshBody {
  refreshToken: string;
}

export async function refreshHandler(c: Context) {
  const body = await c.req.json<RefreshBody>();
  const parsed = refreshSchema.safeParse(body);
  if (!parsed.success) {
    throw parsed.error;
  }

  const { refreshToken } = parsed.data;

  let payload;
  try {
    payload = await verifyToken(refreshToken, c.env.JWT_SECRET);
  } catch {
    throw new AppError('UNAUTHORIZED', 'Invalid or expired refresh token', 401);
  }

  if (payload.type !== 'refresh') {
    throw new AppError('UNAUTHORIZED', 'Invalid token type', 401);
  }

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?')
    .bind(payload.sub)
    .first();

  if (!user) {
    throw new AppError('UNAUTHORIZED', 'User not found', 401);
  }

  const newAccessToken = await signAccessToken(
    { sub: payload.sub, email: payload.email as string },
    c.env.JWT_SECRET
  );
  const newRefreshToken = await signRefreshToken(
    { sub: payload.sub, email: payload.email as string },
    c.env.JWT_SECRET
  );

  return c.json({
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  });
}