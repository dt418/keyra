import type { Context } from 'hono';
import { registerSchema } from '@keyra/shared-validation';
import { hashPassword } from '../../lib/password';
import { signAccessToken, signRefreshToken } from '../../lib/jwt';
import { AppError } from '../../middleware/error';

interface RegisterBody {
  email: string;
  password: string;
  name: string;
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
    `INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(userId, email.toLowerCase(), hashedPassword, name, now, now)
    .run();

  const accessToken = await signAccessToken(
    { sub: userId, email: email.toLowerCase() },
    c.env.JWT_SECRET
  );
  const refreshToken = await signRefreshToken(
    { sub: userId, email: email.toLowerCase() },
    c.env.JWT_SECRET
  );

  return c.json({
    user: { id: userId, email: email.toLowerCase(), name },
    accessToken,
    refreshToken,
  });
}