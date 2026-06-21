import type { Context } from "hono";
import { AppError } from "../../middleware/error";

interface StoredToken {
  user_id: string;
  expires_at: number;
}

const TOKEN_KEY_PREFIX = "verify-email:";
const TOKEN_TTL_SECONDS = 60 * 60 * 24;

export async function issueVerificationToken(
  kv: KVNamespace,
  userId: string,
  ttlSeconds = TOKEN_TTL_SECONDS,
): Promise<string> {
  const token = crypto.randomUUID();
  await kv.put(
    `${TOKEN_KEY_PREFIX}${token}`,
    JSON.stringify({
      user_id: userId,
      expires_at: Date.now() + ttlSeconds * 1000,
    }),
    { expirationTtl: ttlSeconds },
  );
  return token;
}

export async function verifyEmailHandler(c: Context) {
  const token = c.req.param("token");
  if (!token) {
    throw new AppError("BAD_REQUEST", "Missing token", 400);
  }

  const raw = await c.env.SESSIONS.get(`${TOKEN_KEY_PREFIX}${token}`);
  if (!raw) {
    throw new AppError(
      "INVALID_VERIFICATION_TOKEN",
      "Verification link is invalid or has already been used",
      400,
    );
  }

  let stored: StoredToken;
  try {
    stored = JSON.parse(raw) as StoredToken;
  } catch {
    await c.env.SESSIONS.delete(`${TOKEN_KEY_PREFIX}${token}`);
    throw new AppError(
      "INVALID_VERIFICATION_TOKEN",
      "Verification link is invalid or has already been used",
      400,
    );
  }

  await c.env.SESSIONS.delete(`${TOKEN_KEY_PREFIX}${token}`);

  if (stored.expires_at < Date.now()) {
    throw new AppError(
      "INVALID_VERIFICATION_TOKEN",
      "Verification link has expired",
      400,
    );
  }

  await c.env.DB.prepare("UPDATE users SET email_verified = 1 WHERE id = ?")
    .bind(stored.user_id)
    .run();

  return c.json({ data: { verified: true } });
}
