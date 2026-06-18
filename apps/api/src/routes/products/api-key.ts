import type { Context } from "hono";
import { hashApiKey } from "../../lib/password";
import { AppError } from "../../middleware/error";

export async function getApiKeyHandler(c: Context) {
  const orgId = c.get("orgId");
  if (!orgId) {
    throw new AppError("FORBIDDEN", "Admin or owner role required", 403);
  }
  const { id } = c.req.param();

  const product = (await c.env.DB.prepare(
    `SELECT id, name, api_key_hash FROM products WHERE id = ? AND organization_id = ?`,
  )
    .bind(id, orgId)
    .first()) as { id: string; name: string; api_key_hash: string } | null;

  if (!product) {
    throw new AppError("NOT_FOUND", "Product not found", 404);
  }

  return c.json({
    data: {
      productId: product.id,
      name: product.name,
      hasApiKey: !!product.api_key_hash,
    },
  });
}

export async function regenerateApiKeyHandler(c: Context) {
  const orgId = c.get("orgId");
  if (!orgId) {
    throw new AppError("FORBIDDEN", "Admin or owner role required", 403);
  }
  const { id } = c.req.param();

  const product = (await c.env.DB.prepare(
    `SELECT id, name FROM products WHERE id = ? AND organization_id = ?`,
  )
    .bind(id, orgId)
    .first()) as { id: string; name: string } | null;

  if (!product) {
    throw new AppError("NOT_FOUND", "Product not found", 404);
  }

  const newApiKey = crypto.randomUUID() + "-" + crypto.randomUUID();
  const newApiKeyHash = await hashApiKey(newApiKey);
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `UPDATE products SET api_key_hash = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(newApiKeyHash, now, id)
    .run();

  return c.json({
    data: {
      apiKey: newApiKey,
      productId: product.id,
      name: product.name,
    },
  });
}
