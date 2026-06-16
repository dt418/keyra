import type { Context, Next } from 'hono';
import { verifyToken } from '../lib/jwt';
import { SESSION_KV_PREFIX } from '../lib/sessions';

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
      { error: { code: 'UNAUTHORIZED', message: 'Expected access token' } },
      401
    );
  }
  const payloadSessionId = (payload as { sessionId?: string }).sessionId;
  c.set('userId', payload.sub);
  c.set('userEmail', payload.email as string);
  c.set('sessionId', payloadSessionId);

  if (payloadSessionId) {
    const status = await c.env.SESSIONS.get(`${SESSION_KV_PREFIX}${payloadSessionId}`);
    if (status === 'revoked') {
      return c.json(
        { error: { code: 'UNAUTHORIZED', message: 'Session has been revoked' } },
        401
      );
    }
  }

  return next();
}