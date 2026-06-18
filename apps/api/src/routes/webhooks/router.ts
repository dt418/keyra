import { Hono } from "hono";
import { authMiddleware } from "../../middleware/auth";
import { requireOrgMember } from "../../middleware/org";
import { listWebhooksHandler } from "./list";
import { createWebhookHandler } from "./create";
import { getWebhookHandler } from "./get";
import { updateWebhookHandler } from "./update";
import { deleteWebhookHandler } from "./delete";
import { testWebhookHandler } from "./test";
import { listDeliveriesHandler } from "./deliveries";

export const webhooksRouter = new Hono();

webhooksRouter.use("/*", authMiddleware);
webhooksRouter.use("/*", requireOrgMember);

webhooksRouter.get("/", listWebhooksHandler);
webhooksRouter.post("/", createWebhookHandler);
webhooksRouter.get("/:id", getWebhookHandler);
webhooksRouter.patch("/:id", updateWebhookHandler);
webhooksRouter.delete("/:id", deleteWebhookHandler);
webhooksRouter.post("/:id/test", testWebhookHandler);
webhooksRouter.get("/:id/deliveries", listDeliveriesHandler);
