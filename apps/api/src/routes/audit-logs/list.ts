import type { Context } from "hono";
import { AppError } from "../../middleware/error";

interface AuditLogRow {
  id: string;
  action: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  org_id: string | null;
  resource_type: string;
  resource_id: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: string | null;
  created_at: string;
}

function rowToLog(row: AuditLogRow) {
  let metadata: unknown = null;
  if (row.metadata) {
    try {
      metadata = JSON.parse(row.metadata);
    } catch {
      metadata = row.metadata;
    }
  }
  return {
    id: row.id,
    action: row.action,
    user_id: row.user_id,
    user_name: row.user_name,
    user_email: row.user_email,
    org_id: row.org_id,
    resource_type: row.resource_type,
    resource_id: row.resource_id,
    ip_address: row.ip_address,
    user_agent: row.user_agent,
    metadata,
    created_at: row.created_at,
  };
}

export async function listAuditLogsHandler(c: Context) {
  const userId = c.get("userId");
  if (!userId) {
    throw new AppError("UNAUTHORIZED", "Authentication required", 401);
  }

  const member = (await c.env.DB.prepare(
    `SELECT org_id FROM org_members WHERE user_id = ? AND role IN ('owner', 'admin') LIMIT 1`,
  )
    .bind(userId)
    .first()) as { org_id: string } | null;

  if (!member) {
    throw new AppError("FORBIDDEN", "Admin or owner role required", 403);
  }

  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);
  const cursor = c.req.query("cursor");
  const action = c.req.query("action");
  const resourceType = c.req.query("resource_type");
  const filterUserId = c.req.query("user_id");

  const offset = cursor
    ? parseInt(Buffer.from(cursor, "base64").toString("utf8"), 10)
    : 0;

  const conditions: string[] = [
    "(a.org_id = ? OR (a.org_id IS NULL AND a.user_id = ?))",
  ];
  const params: unknown[] = [member.org_id, userId];

  if (action) {
    conditions.push("a.action = ?");
    params.push(action);
  }
  if (resourceType) {
    conditions.push("a.resource_type = ?");
    params.push(resourceType);
  }
  if (filterUserId) {
    conditions.push("a.user_id = ?");
    params.push(filterUserId);
  }

  const where = conditions.join(" AND ");

  const rows = (await c.env.DB.prepare(
    `SELECT a.id, a.action, a.user_id, u.name as user_name, u.email as user_email,
            a.org_id, a.resource_type, a.resource_id, a.ip_address, a.user_agent,
            a.metadata, a.created_at
     FROM audit_logs a
     LEFT JOIN users u ON a.user_id = u.id
     WHERE ${where}
     ORDER BY a.created_at DESC
     LIMIT ? OFFSET ?`,
  )
    .bind(...params, limit + 1, offset)
    .all()) as { results: AuditLogRow[] };

  const items = (rows.results || []).slice(0, limit).map(rowToLog);
  const hasMore = (rows.results || []).length > limit;
  const nextCursor = hasMore
    ? Buffer.from(String(offset + limit)).toString("base64")
    : null;

  return c.json({
    data: items,
    pagination: { cursor: nextCursor, has_more: hasMore },
  });
}
