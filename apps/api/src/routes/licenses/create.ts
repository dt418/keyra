import type { Context } from "hono";
import { createLicenseSchema } from "@keyra/shared-validation";
import { AppError } from "../../middleware/error";
import { hashApiKey } from "../../lib/password";
import { generateLicenseKey } from "../../lib/license";
import { dispatchWebhookEvent } from "../../lib/webhooks";

export async function createLicenseHandler(c: Context) {
  const userId = c.get("userId");
  if (!userId) {
    throw new AppError("UNAUTHORIZED", "Authentication required", 401);
  }

  const body = await c.req.json();
  const parsed = createLicenseSchema.safeParse(body);
  if (!parsed.success) {
    throw parsed.error;
  }

  const { product_id, type, max_devices, expires_at, feature_flags } =
    parsed.data;
  const orgId = c.get("orgId");
  if (!orgId) {
    throw new AppError("FORBIDDEN", "Admin or owner role required", 403);
  }
const product = (await c.env.DB.prepare(
    `SELECT id FROM products WHERE id = ? AND organization_id = ?`,
  )
    .bind(product_id, orgId)
    .first()) as { id: string } | null;

  if (!product) {
    throw new AppError("NOT_FOUND", "Product not found", 404);
  }

  const licenseId = crypto.randomUUID();
  const licenseKey = generateLicenseKey();
  const keyHash = await hashApiKey(licenseKey);
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO licenses (id, product_id, organization_id, key_hash, type, status, max_devices, expires_at, feature_flags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
  )
    .bind(
      licenseId,
      product_id,
      orgId,
      keyHash,
      type,
      max_devices ?? 1,
      expires_at ?? null,
      feature_flags ? JSON.stringify(feature_flags) : null,
      now,
      now,
    )
    .run();

  dispatchWebhookEvent(c, orgId, "license.created", {
    license_id: licenseId,
    product_id,
    type,
    max_devices: max_devices ?? 1,
    expires_at: expires_at ?? null,
  });

  return c.json(
    {
      data: {
        id: licenseId,
        product_id,
        key: licenseKey,
        type,
        status: "active",
        max_devices: max_devices ?? 1,
        expires_at: expires_at ?? null,
        feature_flags: feature_flags ?? null,
        created_at: now,
      },
    },
    201,
  );
}
