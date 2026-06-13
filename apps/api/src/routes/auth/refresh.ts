import type { Context } from 'hono';
import { refreshSchema } from '@keyra/shared-validation';
import { verifyToken, signAccessToken, signRefreshToken } from '../../lib/jwt';
import { AppError } from '../../middleware/error';
import { hashPassword } from '../../lib/password';

interface RefreshBody {
  refreshToken: string;
}

async function storeRefreshToken(
  c: Context,
  userId: string,
  refreshToken: string,
  userAgent?: string,
  ipAddress?: string
): Promise<void> {
  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const tokenHash = await hashPassword(refreshToken);

  await c.env.DB.prepare(
    `INSERT INTO sessions (id, user_id, refresh_token_hash, user_agent, ip_address, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(sessionId, userId, tokenHash, userAgent ?? null, ipAddress ?? null, expiresAt, now)
    .run();
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
    payload = await verifyToken(refreshToken, c.env.JWT_REFRESH_SECRET);
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

  const newAccessToken = await signAccessToken(
    { sub: user.id, email: user.email },
    c.env.JWT_SECRET
  );
  const newRefreshToken = await signRefreshToken(
    { sub: user.id, email: user.email },
    c.env.JWT_REFRESH_SECRET
  );

  await storeRefreshToken(c, user.id, newRefreshToken);

  return c.json({
    data: {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    },
  });
}
