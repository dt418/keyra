import type { Context } from 'hono';
import { logAuditEvent, extractRequestInfo } from '../../lib/audit';
import { revokeSession } from '../../lib/sessions';

export async function logoutHandler(c: Context) {
  const sessionId = c.get('sessionId');
  const userId = c.get('userId');

  if (sessionId) {
    await revokeSession(c, sessionId);

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
