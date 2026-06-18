import { Hono } from "hono";
import { authMiddleware } from "../../middleware/auth";
import { requireOrgMember } from "../../middleware/org";
import { getOverviewHandler } from "./overview";
import { getLicensesByTypeHandler } from "./licenses-by-type";
import { getActivationsOverTimeHandler } from "./activations-over-time";
import { getTopProductsHandler } from "./top-products";

export const analyticsRouter = new Hono();

analyticsRouter.use("/*", authMiddleware);
analyticsRouter.use("/*", requireOrgMember);

analyticsRouter.get("/overview", getOverviewHandler);
analyticsRouter.get("/licenses-by-type", getLicensesByTypeHandler);
analyticsRouter.get("/activations-over-time", getActivationsOverTimeHandler);
analyticsRouter.get("/top-products", getTopProductsHandler);
