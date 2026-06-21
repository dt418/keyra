import { Hono } from "hono";
import { registerHandler } from "./register";
import { loginHandler } from "./login";
import { logoutHandler } from "./logout";
import { refreshHandler } from "./refresh";
import { oauthCallbackHandler, oauthInitiateHandler } from "./oauth";
import { verifyEmailHandler } from "./verify-email";
import { resendVerificationHandler } from "./resend-verification";
import { authMiddleware } from "../../middleware/auth";
import { rateLimit } from "../../middleware/rateLimit";

export const authRouter = new Hono()
  .post(
    "/register",
    rateLimit({ window: 60, max: 10, scope: "register", respectDevFlag: true }),
    registerHandler,
  )
  .post(
    "/login",
    rateLimit({ window: 60, max: 20, scope: "login", respectDevFlag: true }),
    loginHandler,
  )
  .post(
    "/logout",
    authMiddleware,
    rateLimit({ window: 60, max: 10, scope: "logout", respectDevFlag: true }),
    logoutHandler,
  )
  .post(
    "/refresh",
    rateLimit({ window: 60, max: 30, scope: "refresh", respectDevFlag: true }),
    refreshHandler,
  )
  .post(
    "/oauth/:provider/initiate",
    rateLimit({
      window: 60,
      max: 20,
      scope: "oauth-init",
      respectDevFlag: true,
    }),
    oauthInitiateHandler,
  )
  .post(
    "/oauth/:provider/callback",
    rateLimit({ window: 60, max: 20, scope: "oauth-cb", respectDevFlag: true }),
    oauthCallbackHandler,
  )
  .get("/verify-email/:token", verifyEmailHandler)
  .post(
    "/resend-verification",
    rateLimit({
      window: 60,
      max: 5,
      scope: "resend-verification",
      respectDevFlag: true,
    }),
    resendVerificationHandler,
  );
