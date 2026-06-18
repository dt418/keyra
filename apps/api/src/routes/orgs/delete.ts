import type { Context } from "hono";
import { AppError } from "../../middleware/error";

export async function deleteOrgHandler(c: Context) {
  const userId = c.get("userId");

  const orgId = c.req.param("id");

  const membership = (await c.env.DB.prepare(
    "SELECT role FROM org_members WHERE org_id = ? AND user_id = ?",
  )
    .bind(orgId, userId)
    .first()) as { role: string } | null | undefined;

  if (!membership) {
    throw new AppError("FORBIDDEN", "Not a member of this organization", 403);
  }

  if (membership.role !== "owner") {
    throw new AppError(
      "FORBIDDEN",
      "Only owners can delete organizations",
      403,
    );
  }

  await c.env.DB.prepare("DELETE FROM audit_logs WHERE org_id = ?")
    .bind(orgId)
    .run();
  await c.env.DB.prepare("DELETE FROM org_members WHERE org_id = ?")
    .bind(orgId)
    .run();
  await c.env.DB.prepare("DELETE FROM organizations WHERE id = ?")
    .bind(orgId)
    .run();

  return c.json({ data: { success: true } });
}
