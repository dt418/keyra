import type { Context } from "hono";
import { AppError } from "../../middleware/error";
import { transferLicenseSchema } from "@keyra/shared-validation";

export async function transferLicenseHandler(c: Context) {
  const userId = c.get("userId");
  if (!userId) {
    throw new AppError("UNAUTHORIZED", "Authentication required", 401);
  }

  const { id } = c.req.param();

  const body = await c.req.json();
  const parsed = transferLicenseSchema.safeParse(body);
  if (!parsed.success) {
    throw parsed.error;
  }

  const { target_org_id } = parsed.data;
  const orgId = c.get("orgId");
  if (!orgId) {
    throw new AppError("FORBIDDEN", "Admin or owner role required", 403);
  }
  const license = (await c.env.DB.prepare(
    `SELECT id, status, organization_id FROM licenses WHERE id = ? AND organization_id = ?`,
  )
    .bind(id, orgId)
    .first()) as { id: string; status: string; organization_id: string } | null;

  if (!license) {
    throw new AppError("NOT_FOUND", "License not found", 404);
  }

  if (license.status !== "active") {
    throw new AppError("BAD_REQUEST", "Can only transfer active licenses", 400);
  }

  const targetOrg = (await c.env.DB.prepare(
    `SELECT id, name FROM organizations WHERE id = ?`,
  )
    .bind(target_org_id)
    .first()) as { id: string; name: string } | null;

  if (!targetOrg) {
    throw new AppError("NOT_FOUND", "Target organization not found", 404);
  }

  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `UPDATE licenses SET status = 'transferred', transferred_at = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(now, now, id)
    .run();

  const transferredLicense = (await c.env.DB.prepare(
    `SELECT product_id, key_hash, type, max_devices, expires_at, feature_flags FROM licenses WHERE id = ?`,
  )
    .bind(id)
    .first()) as {
    product_id: string;
    key_hash: string;
    type: string;
    max_devices: number;
    expires_at: string | null;
    feature_flags: string | null;
  };

  const newLicenseId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO licenses (id, product_id, organization_id, key_hash, type, status, max_devices, expires_at, feature_flags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
  )
    .bind(
      newLicenseId,
      transferredLicense.product_id,
      target_org_id,
      transferredLicense.key_hash,
      transferredLicense.type,
      transferredLicense.max_devices,
      transferredLicense.expires_at,
      transferredLicense.feature_flags,
      now,
      now,
    )
    .run();

  return c.json({
    data: {
      originalLicenseId: id,
      newLicenseId,
      targetOrganization: targetOrg.name,
      transferredAt: now,
    },
  });
}
