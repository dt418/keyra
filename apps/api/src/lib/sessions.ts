import type { Context } from 'hono';
import { hashPassword } from './password';

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_KV_PREFIX = 'session:';

export interface StoreSessionOptions {
  userId: string;
  refreshToken: string;
  sessionId: string;
  userAgent?: string | undefined;
  ipAddress?: string | undefined;
}

export async function storeRefreshToken(
  c: Context,
  opts: StoreSessionOptions
): Promise<void> {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const tokenHash = await hashPassword(opts.refreshToken);

  await c.env.DB.prepare(
    `INSERT INTO sessions (id, user_id, refresh_token_hash, user_agent, ip_address, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      opts.sessionId,
      opts.userId,
      tokenHash,
      opts.userAgent ?? null,
      opts.ipAddress ?? null,
      expiresAt,
      now
    )
    .run();

  await c.env.SESSIONS.put(`${SESSION_KV_PREFIX}${opts.sessionId}`, 'active', {
    expirationTtl: Math.ceil(SESSION_TTL_MS / 1000),
  });
}

export async function revokeSession(c: Context, sessionId: string): Promise<void> {
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    'UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL'
  )
    .bind(now, sessionId)
    .run();
  await c.env.SESSIONS.put(`${SESSION_KV_PREFIX}${sessionId}`, 'revoked', {
    expirationTtl: Math.ceil(SESSION_TTL_MS / 1000),
  });
}
