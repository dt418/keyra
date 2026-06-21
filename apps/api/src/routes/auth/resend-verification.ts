import { z } from "zod";
import type { Context } from "hono";
import { issueVerificationToken } from "./verify-email";
import { sendEmail } from "../../lib/email";
import { verifyEmailTemplate } from "../../lib/email-templates/verify";
import { AppError } from "../../middleware/error";

const schema = z.object({ email: z.string().email() });

const GENERIC_MESSAGE =
  "If the email exists, a verification link has been sent.";

interface UserLookupRow {
  id: string;
  email: string;
  email_verified: number;
}

export async function resendVerificationHandler(c: Context) {
  const raw = await c.req.json().catch(() => ({}));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("BAD_REQUEST", "Invalid email", 400);
  }

  const email = parsed.data.email.toLowerCase();
  const row = (await c.env.DB.prepare(
    "SELECT id, email, email_verified FROM users WHERE email = ?",
  )
    .bind(email)
    .first()) as UserLookupRow | null;

  // Always 200 — anti-enumeration. Skip side effects when the account is
  // missing or already verified.
  if (row && row.email_verified === 0) {
    const token = await issueVerificationToken(c.env.SESSIONS, row.id);
    const appUrl = c.env.APP_URL || "http://localhost:5173";
    const verifyUrl = `${appUrl}/verify-email/${token}`;
    const template = verifyEmailTemplate({
      verifyUrl,
      expiresInMinutes: 60 * 24,
    });
    try {
      await sendEmail(c.env, { to: row.email, ...template });
    } catch (err) {
      console.error("[resend-verification] send failed", err);
    }
  }

  return c.json({ data: { message: GENERIC_MESSAGE } });
}
