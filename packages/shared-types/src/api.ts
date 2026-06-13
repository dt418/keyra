export type ApiError = {
  error: string;
  code?: string;
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type PaginatedResponse<T> = {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type CloudflareBindings = {
  Bindings: {
    DB: D1Database;
    SESSIONS: KVNamespace;
  };
};

export interface AuditEvent {
  action: string;
  userId?: string;
  orgId?: string;
  resourceType: string;
  resourceId: string;
  ipAddress: string | undefined;
  userAgent: string | undefined;
  metadata?: Record<string, unknown>;
}

export interface AuditLog {
  id: string;
  action: string;
  user_id: string | null;
  org_id: string | null;
  resource_type: string;
  resource_id: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: string | null;
  created_at: string;
}
