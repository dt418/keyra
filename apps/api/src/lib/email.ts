import { AppError } from "../middleware/error";

export interface EmailEnv {
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const RESEND_API_URL = "https://api.resend.com/emails";

/**
 * Sends a transactional email via the Resend HTTP API.
 *
 * Scaffold mode: when `RESEND_API_KEY` is not set, the would-be email is
 * logged via `console.info` and the function resolves successfully. This
 * keeps local dev / CI flows runnable without a Resend account. Configure
 * `RESEND_API_KEY` + `RESEND_FROM_EMAIL` to actually deliver.
 *
 * On non-2xx responses from Resend, throws `AppError("EMAIL_SEND_FAILED", ..., 502)`.
 */
export async function sendEmail(
  env: EmailEnv,
  msg: SendEmailInput,
): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.info(
      "[email:scaffold] would send to",
      msg.to,
      "subject",
      msg.subject,
    );
    return;
  }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new AppError(
      "EMAIL_SEND_FAILED",
      `Resend send failed: ${res.status}${detail ? ` ${detail}` : ""}`,
      502,
    );
  }
}
