import { Hono } from "hono";
import { authRouter } from "./routes/auth/router";
import { orgsRouter } from "./routes/orgs/router";
import { usersRouter } from "./routes/users/router";
import { productsRouter } from "./routes/products/router";
import { licensesRouter } from "./routes/licenses/router";
import { activationsRouter } from "./routes/activations/router";
import { verifyRouter } from "./routes/verify/router";
import { devicesRouter } from "./routes/devices/router";
import { auditLogsRouter } from "./routes/audit-logs/router";
import { analyticsRouter } from "./routes/analytics/router";
import { webhooksRouter } from "./routes/webhooks/router";

export const router = new Hono()
  .route("/auth", authRouter)
  .route("/organizations", orgsRouter)
  .route("/users", usersRouter)
  .route("/products", productsRouter)
  .route("/licenses", licensesRouter)
  .route("/", activationsRouter)
  .route("/verify", verifyRouter)
  .route("/devices", devicesRouter)
  .route("/audit-logs", auditLogsRouter)
  .route("/analytics", analyticsRouter)
  .route("/webhooks", webhooksRouter);
