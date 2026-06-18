import type { Context } from "hono";
import { AppError } from "../../middleware/error";

export async function verifyEmailHandler(c: Context) {
  const { token } = c.req.param();
  if (!token) {
    throw new AppError("BAD_REQUEST", "Missing token", 400);
  }

  throw new AppError(
    "NOT_IMPLEMENTED",
    "Email verification is not yet enabled",
    501,
  );
}
