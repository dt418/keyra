import { Hono } from "hono";
import { verifyLicenseHandler } from "./index";
import { rateLimit } from "../../middleware/rateLimit";

export const verifyRouter = new Hono();

verifyRouter.post(
  "/",
  rateLimit({ window: 60, max: 60, scope: "verify", respectDevFlag: true }),
  verifyLicenseHandler,
);
