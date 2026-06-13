import type { Context } from 'hono';
import { logAuditEvent, extractRequestInfo } from '../../lib/audit';

export async function logoutHandler(c: Context) {
  const sessionId = c.get('sessionId');
  const userId = c.get('userId');

  if (sessionId) {
    await c.env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL')
      .bind(new Date().toISOString(), sessionId)
      .run();

    const requestInfo = extractRequestInfo(c);
    logAuditEvent(c, {
      action: 'user.logout',
      userId,
      resourceType: 'session',
      resourceId: sessionId,
      ipAddress: requestInfo.ipAddress,
      userAgent: requestInfo.userAgent,
    });
  }

  return c.json({ data: { success: true } });
}
