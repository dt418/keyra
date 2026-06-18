import type { Context } from "hono";
import { loginSchema } from "@keyra/shared-validation";
import { verifyPassword } from "../../lib/password";
import { signAccessToken, signRefreshToken } from "../../lib/jwt";
import { storeRefreshToken } from "../../lib/sessions";
import { AppError } from "../../middleware/error";
import { logAuditEvent, extractRequestInfo } from "../../lib/audit";

interface LoginBody {
  email: string;
  password: string;
}

export async function loginHandler(c: Context) {
  const body = await c.req.json<LoginBody>();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    throw parsed.error;
  }

  const { email, password } = parsed.data;

  const user = (await c.env.DB.prepare(
    "SELECT id, email, password_hash, name FROM users WHERE email = ?",
  )
    .bind(email.toLowerCase())
    .first()) as {
    id: string;
    email: string;
    password_hash: string;
    name: string;
  } | null;

  if (!user) {
    await verifyPassword(
      password,
      "$2b$12$/ycwPOmj3UPVnnysJ/gu3.yGORfFF4OUysPXBea18Bi//813WgU9.",
    );
    throw new AppError("UNAUTHORIZED", "Invalid email or password", 401);
  }

  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    throw new AppError("UNAUTHORIZED", "Invalid email or password", 401);
  }

  const sessionId = crypto.randomUUID();
  const accessToken = await signAccessToken(
    { sub: user.id, email: user.email, sessionId },
    c.env.JWT_SECRET,
  );
  const refreshToken = await signRefreshToken(
    { sub: user.id, email: user.email, jti: sessionId },
    c.env.JWT_REFRESH_SECRET,
  );

  const requestInfo = extractRequestInfo(c);
  await storeRefreshToken(c, {
    userId: user.id,
    refreshToken,
    sessionId,
    userAgent: requestInfo.userAgent,
    ipAddress: requestInfo.ipAddress,
  });

  logAuditEvent(c, {
    action: "user.login",
    userId: user.id,
    resourceType: "user",
    resourceId: user.id,
    ipAddress: requestInfo.ipAddress,
    userAgent: requestInfo.userAgent,
    metadata: { email: user.email },
  });

  return c.json(
    {
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: { id: user.id, email: user.email, name: user.name },
      },
    },
    200,
  );
}
