import type { Context } from "hono";
import { AppError } from "../../middleware/error";
import { dispatchWebhookEvent } from "../../lib/webhooks";

export async function deactivateDeviceHandler(c: Context) {
  const userId = c.get("userId");
  if (!userId) {
    throw new AppError("UNAUTHORIZED", "Authentication required", 401);
  }

  const { id } = c.req.param();
  const orgId = c.get("orgId");
  if (!orgId) {
    throw new AppError("FORBIDDEN", "Admin or owner role required", 403);
  }
  const device = (await c.env.DB.prepare(
    `SELECT d.id, d.license_id, l.organization_id 
     FROM devices d
     INNER JOIN licenses l ON d.license_id = l.id
     WHERE d.id = ?`,
  )
    .bind(id)
    .first()) as {
    id: string;
    license_id: string;
    organization_id: string;
  } | null;

  if (!device) {
    throw new AppError("NOT_FOUND", "Device not found", 404);
  }

  if (device.organization_id !== orgId) {
    throw new AppError(
      "FORBIDDEN",
      "You do not have access to this device",
      403,
    );
  }

  await c.env.DB.prepare(`DELETE FROM activations WHERE device_id = ?`)
    .bind(id)
    .run();

  const result = await c.env.DB.prepare(`DELETE FROM devices WHERE id = ?`)
    .bind(id)
    .run();

  if (result.meta?.changes === 0) {
    throw new AppError(
      "NOT_FOUND",
      "Device not found or already deactivated",
      404,
    );
  }

  dispatchWebhookEvent(c, orgId, "device.deactivated", {
    device_id: id,
    license_id: device.license_id,
  });

  return c.json({
    data: {
      id,
      status: "deactivated",
    },
  });
}
