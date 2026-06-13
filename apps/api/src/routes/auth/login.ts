import type { Context } from 'hono';
import { loginSchema } from '@keyra/shared-validation';
import { verifyPassword } from '../../lib/password';
import { signAccessToken, signRefreshToken } from '../../lib/jwt';
import { AppError } from '../../middleware/error';

interface LoginBody {
  email: string;
  password: string;
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

  const accessToken = await signAccessToken(
    { sub: user.id, email: user.email },
    c.env.JWT_SECRET
  );
  const refreshToken = await signRefreshToken(
    { sub: user.id, email: user.email },
    c.env.JWT_SECRET
  );

  return c.json({
    user: { id: user.id, email: user.email, name: user.name },
    accessToken,
    refreshToken,
  });
}