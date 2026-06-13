import type { Context } from 'hono';
import type { AuditEvent } from '@keyra/shared-types';

export async function logAuditEvent(c: Context, event: AuditEvent): Promise<void> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const metadata = event.metadata ? JSON.stringify(event.metadata) : null;

  c.executionCtx.waitUntil(
    c.env.DB.prepare(
      `INSERT INTO audit_logs (id, action, user_id, org_id, resource_type, resource_id, ip_address, user_agent, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        event.action,
        event.userId ?? null,
        event.orgId ?? null,
        event.resourceType,
        event.resourceId,
        event.ipAddress ?? null,
        event.userAgent ?? null,
        metadata,
        now
      )
      .run()
  );
}

export function extractRequestInfo(c: Context): { ipAddress: string | undefined; userAgent: string | undefined } {
  return {
    ipAddress: c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? undefined,
    userAgent: c.req.header('user-agent') ?? undefined,
  };
}
