import type { Context, Next } from 'hono';
import { verifyToken } from '../lib/jwt';
import { AppError } from './error';

export interface AuthVariables {
  userId: string;
  userEmail: string;
  sessionId?: string;
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json(
      { error: { code: 'UNAUTHORIZED', message: 'Missing authorization header' } },
      401
    );
  }

  const token = authHeader.slice(7);
  let payload;
  try {
    payload = await verifyToken(token, c.env.JWT_SECRET);
  } catch {
    return c.json(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } },
      401
    );
  }
  if (payload.type !== 'access') {
    return c.json(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid token type' } },
      401
    );
  }
  c.set('userId', payload.sub);
  c.set('userEmail', payload.email as string);
  c.set('sessionId', (payload as { sessionId?: string }).sessionId);
  await next();
}