const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatOtp = (value) => escapeHtml(String(value || "").trim()).split("").join(" ");

export default function buildOtpEmailTemplate({
  name,
  title,
  intro,
  otpLabel,
  otp,
  validityText,
  preheader,
  accent = "#4f46e5",
  accentSoft = "#eef2ff",
}) {
  const safeName = escapeHtml(name || "there");
  const safeTitle = escapeHtml(title || "Your verification code");
  const safeIntro = escapeHtml(intro || "Use the code below to continue.");
  const safeOtpLabel = escapeHtml(otpLabel || "One-Time Password");
  const safeValidityText = escapeHtml(validityText || "This code will expire soon.");
  const safePreheader = escapeHtml(preheader || safeTitle);
  const safeAccent = escapeHtml(accent);
  const safeAccentSoft = escapeHtml(accentSoft);
  const safeOtp = formatOtp(otp);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">
      ${safePreheader}
    </span>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f7fb;margin:0;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;margin:0 auto;">
            <tr>
              <td style="padding:0 16px;">
                <table
                  role="presentation"
                  cellpadding="0"
                  cellspacing="0"
                  width="100%"
                  style="background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 18px 45px rgba(15,23,42,0.08);"
                >
                  <tr>
                    <td style="padding:32px 32px 20px;background:linear-gradient(135deg,#0f172a 0%,${safeAccent} 100%);">
                      <p style="margin:0 0 10px;font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:rgba(255,255,255,0.75);font-weight:700;">
                        EventMate
                      </p>
                      <h1 style="margin:0;font-size:28px;line-height:1.25;color:#ffffff;font-weight:700;">
                        ${safeTitle}
                      </h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:32px;">
                      <p style="margin:0 0 12px;font-size:16px;line-height:1.7;color:#0f172a;">
                        Hello ${safeName},
                      </p>
                      <p style="margin:0 0 24px;font-size:15px;line-height:1.8;color:#475569;">
                        ${safeIntro}
                      </p>

                      <table
                        role="presentation"
                        cellpadding="0"
                        cellspacing="0"
                        width="100%"
                        style="margin:0 0 24px;background:${safeAccentSoft};border:1px solid #cbd5e1;border-radius:18px;"
                      >
                        <tr>
                          <td style="padding:24px;text-align:center;">
                            <p style="margin:0 0 10px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#475569;font-weight:700;">
                              ${safeOtpLabel}
                            </p>
                            <p style="margin:0;font-size:32px;line-height:1.2;font-weight:700;letter-spacing:0.28em;color:${safeAccent};">
                              ${safeOtp}
                            </p>
                          </td>
                        </tr>
                      </table>

                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px;">
                        <tr>
                          <td style="padding:0 0 12px;font-size:14px;line-height:1.7;color:#334155;">
                            <strong style="color:#0f172a;">Important:</strong> ${safeValidityText}
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:0 0 12px;font-size:14px;line-height:1.7;color:#334155;">
                            For your security, do not share this code with anyone.
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:0;font-size:14px;line-height:1.7;color:#334155;">
                            If you did not request this email, you can safely ignore it.
                          </td>
                        </tr>
                      </table>

                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-top:1px solid #e2e8f0;padding-top:18px;">
                        <tr>
                          <td style="font-size:13px;line-height:1.7;color:#64748b;">
                            This is an automated message from EventMate. Please do not reply directly to this email.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                <p style="margin:16px 0 0;text-align:center;font-size:12px;line-height:1.6;color:#94a3b8;">
                  EventMate • Secure event management for modern campuses
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
