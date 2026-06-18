import type { Context } from "hono";
import { updateLicenseSchema } from "@keyra/shared-validation";
import { AppError } from "../../middleware/error";
import { dispatchWebhookEvent } from "../../lib/webhooks";

export async function updateLicenseHandler(c: Context) {
  const userId = c.get("userId");
  if (!userId) {
    throw new AppError("UNAUTHORIZED", "Authentication required", 401);
  }

  const { id } = c.req.param();
  const orgId = c.get("orgId");
  if (!orgId) {
    throw new AppError("FORBIDDEN", "Admin or owner role required", 403);
  }
const body = await c.req.json();
  const parsed = updateLicenseSchema.safeParse(body);
  if (!parsed.success) {
    throw parsed.error;
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (parsed.data.type !== undefined) {
    updates.push("type = ?");
    params.push(parsed.data.type);
  }
  if (parsed.data.max_devices !== undefined) {
    updates.push("max_devices = ?");
    params.push(parsed.data.max_devices);
  }
  if (parsed.data.expires_at !== undefined) {
    updates.push("expires_at = ?");
    params.push(parsed.data.expires_at);
  }
  if (parsed.data.feature_flags !== undefined) {
    updates.push("feature_flags = ?");
    params.push(JSON.stringify(parsed.data.feature_flags));
  }

  if (updates.length === 0) {
    const license = await c.env.DB.prepare(
      `SELECT l.id, l.product_id, l.type, l.status, l.max_devices, l.expires_at,
              l.feature_flags, l.created_at, l.updated_at, l.revoked_at, l.revoked_reason,
              p.name as product_name
       FROM licenses l
       INNER JOIN products p ON l.product_id = p.id
       WHERE l.id = ? AND l.organization_id = ?`,
    )
      .bind(id, orgId)
      .first();

    if (!license) {
      throw new AppError("NOT_FOUND", "License not found", 404);
    }

    return c.json({ data: license });
  }

  const now = new Date().toISOString();
  updates.push("updated_at = ?");
  params.push(now);
  params.push(id);
  params.push(orgId);

  const result = await c.env.DB.prepare(
    `UPDATE licenses SET ${updates.join(", ")} WHERE id = ? AND organization_id = ?`,
  )
    .bind(...params)
    .run();

  if (result.meta?.changes === 0) {
    throw new AppError("NOT_FOUND", "License not found", 404);
  }

  dispatchWebhookEvent(c, orgId, "license.updated", {
    license_id: id,
    changes: {
      type: parsed.data.type,
      max_devices: parsed.data.max_devices,
      expires_at: parsed.data.expires_at,
    },
  });

  const license = await c.env.DB.prepare(
    `SELECT l.id, l.product_id, l.type, l.status, l.max_devices, l.expires_at,
            l.feature_flags, l.created_at, l.updated_at, l.revoked_at, l.revoked_reason,
            p.name as product_name
     FROM licenses l
     INNER JOIN products p ON l.product_id = p.id
     WHERE l.id = ? AND l.organization_id = ?`,
  )
    .bind(id, orgId)
    .first();

  return c.json({ data: license });
}
