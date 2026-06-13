import type { Context } from 'hono';
import { registerSchema } from '@keyra/shared-validation';
import { hashPassword } from '../../lib/password';
import { signAccessToken, signRefreshToken } from '../../lib/jwt';
import { AppError } from '../../middleware/error';
import { logAuditEvent, extractRequestInfo } from '../../lib/audit';

interface RegisterBody {
  email: string;
  password: string;
  name: string;
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

export async function registerHandler(c: Context) {
  const body = await c.req.json<RegisterBody>();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    throw parsed.error;
  }

  const { email, password, name } = parsed.data;

  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  )
    .bind(email.toLowerCase())
    .first();

  if (existing) {
    throw new AppError('USER_EXISTS', 'User already exists', 409);
  }

  const hashedPassword = await hashPassword(password);
  const userId = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?)`
  )
    .bind(userId, email.toLowerCase(), hashedPassword, name, now, now)
    .run();

  const sessionId = crypto.randomUUID();
  const accessToken = await signAccessToken(
    { sub: userId, email: email.toLowerCase(), sessionId },
    c.env.JWT_SECRET
  );
  const refreshToken = await signRefreshToken(
    { sub: userId, email: email.toLowerCase(), jti: sessionId },
    c.env.JWT_REFRESH_SECRET
  );

  await storeRefreshToken(c, userId, refreshToken);

  const requestInfo = extractRequestInfo(c);
  logAuditEvent(c, {
    action: 'user.register',
    userId,
    resourceType: 'user',
    resourceId: userId,
    ipAddress: requestInfo.ipAddress,
    userAgent: requestInfo.userAgent,
    metadata: { email: email.toLowerCase() },
  });

  return c.json({
    data: {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: { id: userId, email: email.toLowerCase(), name },
    },
  });
}
