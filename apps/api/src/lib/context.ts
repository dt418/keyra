import type { Context } from 'hono';

export interface OrgContext {
  userId: string;
  orgId: string;
  orgRole: 'owner' | 'admin' | 'member';
}

declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
    sessionId?: string;
    orgId?: string;
    orgRole?: 'owner' | 'admin' | 'member';
  }
}

export function getOrgContext(c: Context): OrgContext {
  const userId = c.get('userId');
  const orgId = c.get('orgId');
  const orgRole = c.get('orgRole');
  if (!userId || !orgId || !orgRole) {
    throw new Error('orgContext not set — apply requireOrgMember() first');
  }
  return { userId, orgId, orgRole };
}
