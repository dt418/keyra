import type { Context } from 'hono';
import { loginSchema } from '@keyra/shared-validation';
import { verifyPassword, hashPassword } from '../../lib/password';
import { signAccessToken, signRefreshToken } from '../../lib/jwt';
import { AppError } from '../../middleware/error';

interface LoginBody {
  email: string;
  password: string;
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

export async function loginHandler(c: Context) {
  const body = await c.req.json<LoginBody>();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    throw parsed.error;
  }

  const { email, password } = parsed.data;

  const user = await c.env.DB.prepare(
    'SELECT id, email, password_hash, name FROM users WHERE email = ?'
  )
    .bind(email.toLowerCase())
    .first() as { id: string; email: string; password_hash: string; name: string } | null;

  if (!user) {
    throw new AppError('UNAUTHORIZED', 'Invalid email or password', 401);
  }

  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    throw new AppError('UNAUTHORIZED', 'Invalid email or password', 401);
  }

  const sessionId = crypto.randomUUID();
  const accessToken = await signAccessToken(
    { sub: user.id, email: user.email, sessionId },
    c.env.JWT_SECRET
  );
  const refreshToken = await signRefreshToken(
    { sub: user.id, email: user.email, jti: sessionId },
    c.env.JWT_REFRESH_SECRET
  );

  await storeRefreshToken(c, user.id, refreshToken);

  return c.json({
    data: {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: { id: user.id, email: user.email, name: user.name },
    },
  });
}
