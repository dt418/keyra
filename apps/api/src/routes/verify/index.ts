import type { Context } from "hono";
import { verifyLicenseSchema } from "@keyra/shared-validation";
import { AppError } from "../../middleware/error";
import { hashApiKey } from "../../lib/password";
import { verifyLicenseHmac } from "../../lib/license";

export async function verifyLicenseHandler(c: Context) {
  const body = await c.req.json();
  const parsed = verifyLicenseSchema.safeParse(body);
  if (!parsed.success) {
    throw parsed.error;
  }

  const { license_key, device_id } = parsed.data;

  const hmacOk = await verifyLicenseHmac(
    license_key,
    c.env.LICENSE_HMAC_SECRET,
  );
  if (hmacOk === false) {
    throw new AppError(
      "INVALID_LICENSE_KEY",
      "License key signature mismatch",
      400,
    );
  }

  const keyHash = await hashApiKey(license_key);

  const license = (await c.env.DB.prepare(
    `SELECT l.id, l.product_id, l.status, l.max_devices, l.expires_at, l.feature_flags,
            l.type, p.name as product_name
     FROM licenses l
     INNER JOIN products p ON l.product_id = p.id
     WHERE l.key_hash = ?`,
  )
    .bind(keyHash)
    .first()) as {
    id: string;
    product_id: string;
    status: string;
    max_devices: number;
    expires_at: string | null;
    feature_flags: string | null;
    type: string;
    product_name: string;
  } | null;

  if (!license) {
    throw new AppError("NOT_FOUND", "Invalid license key", 404);
  }

  if (license.status !== "active") {
    return c.json({
      data: {
        valid: false,
        reason: `License is ${license.status}`,
      },
    });
  }

  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    return c.json({
      data: {
        valid: false,
        reason: "License has expired",
      },
    });
  }

  if (device_id) {
    const device = (await c.env.DB.prepare(
      `SELECT id FROM devices WHERE id = ? AND license_id = ?`,
    )
      .bind(device_id, license.id)
      .first()) as { id: string } | null;

    if (!device) {
      return c.json({
        data: {
          valid: false,
          reason: "Device not activated on this license",
        },
      });
    }
  }

  return c.json({
    data: {
      valid: true,
      expires_at: license.expires_at,
      product_id: license.product_id,
      license_type: license.type,
    },
  });
}
