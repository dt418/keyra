import { Hono } from "hono";
import { authMiddleware } from "../../middleware/auth";
import { listAuditLogsHandler } from "./list";

export const auditLogsRouter = new Hono();

auditLogsRouter.use("/*", authMiddleware);

auditLogsRouter.get("/", listAuditLogsHandler);
