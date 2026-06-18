import { Hono } from "hono";
import { authMiddleware } from "../../middleware/auth";
import { requireOrgMember } from "../../middleware/org";
import { listAuditLogsHandler } from "./list";

export const auditLogsRouter = new Hono();

auditLogsRouter.use("/*", authMiddleware);
auditLogsRouter.use("/*", requireOrgMember);

auditLogsRouter.get("/", listAuditLogsHandler);
