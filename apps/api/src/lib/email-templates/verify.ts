export interface VerifyEmailTemplateInput {
  verifyUrl: string;
  expiresInMinutes: number;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function formatExpiry(minutes: number): { primary: string; hours: string } {
  const hours = Math.max(1, Math.round(minutes / 60));
  return {
    primary: `${hours} hour${hours === 1 ? "" : "s"}`,
    hours: `${hours} hour${hours === 1 ? "" : "s"}`,
  };
}

/**
 * Pure template renderer for the email verification message.
 * No env, no I/O — given the same inputs, returns the same output.
 */
export function verifyEmailTemplate(
  input: VerifyEmailTemplateInput,
): EmailTemplate {
  const { verifyUrl, expiresInMinutes } = input;
  const expiry = formatExpiry(expiresInMinutes);

  const subject = "Verify your Keyra email";

  const text = [
    "Welcome to Keyra.",
    "",
    `Confirm your email by opening the link below (valid for ${expiry.primary}):`,
    verifyUrl,
    "",
    "If you did not sign up, you can safely ignore this message.",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.5;padding:24px;color:#111">
    <h1 style="margin:0 0 16px;font-size:20px">Verify your Keyra email</h1>
    <p style="margin:0 0 12px">Welcome to Keyra. Click the button below to confirm your email address.</p>
    <p style="margin:24px 0">
      <a href="${verifyUrl}" style="background:#5b21b6;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Verify email</a>
    </p>
    <p style="color:#6b7280;font-size:13px;margin:0 0 8px">This link expires in ${expiry.hours}.</p>
    <p style="color:#6b7280;font-size:13px;margin:0">If the button does not work, paste this URL into your browser:<br><span style="word-break:break-all">${verifyUrl}</span></p>
  </body>
</html>`;

  return { subject, html, text };
}