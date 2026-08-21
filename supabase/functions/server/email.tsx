/**
 * Email helper — sends transactional email via Resend.
 *
 * SETUP (production):
 *   1. Create an account at https://resend.com and verify your domain.
 *   2. Add these secrets to your Supabase Edge Function environment:
 *        RESEND_API_KEY  = re_xxxxxxxxxxxxxxxxxxxx   (from Resend dashboard)
 *        EMAIL_FROM      = "Arkivo <no-reply@yourdomain.gov.ph>"
 *        APP_URL         = https://yourdomain.gov.ph   (your live site origin)
 *
 * If RESEND_API_KEY is not set, emails are NOT sent — instead the message is
 * logged and the caller receives { sent: false, previewUrl } so an admin can
 * still copy the reset link manually. This keeps the flow working in demo mode.
 */

export const getAppUrl = (): string => {
  // Origin used to build links in emails. Defaults to the production domain.
  return Deno.env.get("APP_URL") || "https://arkivo-lguvictoria.online";
};

export interface SendEmailResult {
  sent: boolean;
  // When email delivery is not configured, the link is returned so the admin
  // can share it manually. Never returned once real delivery is enabled.
  fallbackLink?: string;
  error?: string;
}

export const sendEmail = async (opts: {
  to: string;
  subject: string;
  html: string;
  fallbackLink?: string;
}): Promise<SendEmailResult> => {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  // Sender must be on a domain verified in your Resend account.
  const from = Deno.env.get("EMAIL_FROM") || "Arkivo <no-reply@arkivo-lguvictoria.online>";

  // No provider configured — demo/dev mode. Log and return the link.
  if (!apiKey) {
    console.log(
      `📧 [email disabled] Would send to ${opts.to}: "${opts.subject}". ` +
        `Configure RESEND_API_KEY to enable delivery.`
    );
    return { sent: false, fallbackLink: opts.fallbackLink };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("❌ Resend send failed:", res.status, detail);
      return { sent: false, error: `Email provider error (${res.status})`, fallbackLink: opts.fallbackLink };
    }

    console.log(`✅ Email sent to ${opts.to}`);
    return { sent: true };
  } catch (err: any) {
    console.error("❌ Email send exception:", err.message);
    return { sent: false, error: err.message, fallbackLink: opts.fallbackLink };
  }
};

// Password-reset email template
export const passwordResetEmailHtml = (name: string, resetLink: string): string => `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1a1a1a;">
    <h2 style="margin:0 0 8px;">Reset your Arkivo password</h2>
    <p style="color:#555;line-height:1.6;">Hi ${name || "there"},</p>
    <p style="color:#555;line-height:1.6;">
      An administrator approved your password reset request. Click the button
      below to choose a new password. This link expires in 1 hour and can be
      used only once.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${resetLink}"
        style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;display:inline-block;">
        Reset Password
      </a>
    </p>
    <p style="color:#888;font-size:13px;line-height:1.6;">
      If the button doesn't work, copy and paste this URL into your browser:<br/>
      <span style="word-break:break-all;color:#4f46e5;">${resetLink}</span>
    </p>
    <p style="color:#888;font-size:13px;line-height:1.6;margin-top:24px;">
      If you didn't request this, you can safely ignore this email — your
      password will not change.
    </p>
  </div>
`;
