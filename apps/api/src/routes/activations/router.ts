import { Hono } from "hono";
import { authMiddleware } from "../../middleware/auth";
import { rateLimit } from "../../middleware/rateLimit";
import { listActivationsHandler } from "./list";
import { activateDeviceHandler } from "./activate";

const activationsRouter = new Hono();

activationsRouter.get("/activations", authMiddleware, listActivationsHandler);
activationsRouter.post(
  "/activate",
  rateLimit({ window: 60, max: 30, scope: "activate", respectDevFlag: true }),
  activateDeviceHandler,
);

export { activationsRouter };
