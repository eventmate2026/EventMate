import sgMail from "@sendgrid/mail";
import nodemailer from "nodemailer";

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const CONSUMER_MAILBOX_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.in",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]);

let senderConfigurationWarningShown = false;
let smtpTransporter = null;

const decodeHtmlEntities = (value) =>
  String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

const htmlToPlainText = (html) =>
  decodeHtmlEntities(
    String(html || "")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|tr|section)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim()
  );

const extractDomainFromEmail = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  return atIndex >= 0 ? normalized.slice(atIndex + 1) : "";
};

const warnIfSenderLooksUnsafe = (senderEmail, replyTo) => {
  if (senderConfigurationWarningShown) return;

  const senderDomain = extractDomainFromEmail(senderEmail);
  if (!CONSUMER_MAILBOX_DOMAINS.has(senderDomain)) return;

  senderConfigurationWarningShown = true;
  console.warn(
    [
      `Email sender "${senderEmail}" uses a consumer mailbox domain.`,
      "Major inbox providers often reject or spam-folder SendGrid mail sent from Gmail/Outlook/Yahoo-style addresses.",
      "Use a SendGrid-authenticated custom-domain sender such as noreply@your-domain.com.",
      replyTo && replyTo !== senderEmail
        ? `You can keep "${replyTo}" as the reply-to address if needed.`
        : null,
    ]
      .filter(Boolean)
      .join(" ")
  );
};

const getSendGridErrorMessage = (error) => {
  const errors = error?.response?.body?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    return errors
      .map((entry) => String(entry?.message || "").trim())
      .filter(Boolean)
      .join("; ");
  }
  return String(error?.message || "").trim();
};

const canUseSendGrid = () => Boolean(String(process.env.SENDGRID_API_KEY || "").trim());

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return fallback;
};

const normalizeNumber = (value, fallback) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const getSmtpConfig = () => {
  const legacyUser = String(process.env.EMAIL_USERNAME || "").trim();
  const legacyPass = String(process.env.EMAIL_PASSWORD || "").trim();
  const host = String(process.env.SMTP_HOST || "").trim();
  const service = String(
    process.env.SMTP_SERVICE ||
      process.env.EMAIL_SERVICE ||
      (!host && legacyUser && legacyPass ? "gmail" : "")
  ).trim();
  const user = String(process.env.SMTP_USER || legacyUser).trim();
  const pass = String(process.env.SMTP_PASS || legacyPass).trim();
  const port = normalizeNumber(process.env.SMTP_PORT, 465);
  const secure = normalizeBoolean(process.env.SMTP_SECURE, port === 465);
  const family = normalizeNumber(process.env.SMTP_FAMILY, 4);
  const connectionTimeout = normalizeNumber(process.env.SMTP_CONNECTION_TIMEOUT_MS, 10000);
  const greetingTimeout = normalizeNumber(process.env.SMTP_GREETING_TIMEOUT_MS, 10000);
  const socketTimeout = normalizeNumber(process.env.SMTP_SOCKET_TIMEOUT_MS, 15000);

  return {
    host,
    service,
    user,
    pass,
    port,
    secure,
    family,
    connectionTimeout,
    greetingTimeout,
    socketTimeout,
  };
};

const getEmailProvider = () => {
  const explicitProvider = String(process.env.EMAIL_PROVIDER || "").trim().toLowerCase();
  if (["smtp", "gmail", "googlemail", "outlook", "hotmail"].includes(explicitProvider)) {
    return "smtp";
  }
  if (explicitProvider === "sendgrid") return "sendgrid";

  const smtpConfig = getSmtpConfig();
  if ((smtpConfig.host || smtpConfig.service) && smtpConfig.user && smtpConfig.pass) {
    return "smtp";
  }

  return canUseSendGrid() ? "sendgrid" : "";
};

const createSmtpTransporter = () => {
  if (smtpTransporter) return smtpTransporter;

  const smtpConfig = getSmtpConfig();

  if ((!smtpConfig.host && !smtpConfig.service) || !smtpConfig.user || !smtpConfig.pass) {
    const err = new Error("Missing SMTP configuration");
    err.statusCode = 500;
    throw err;
  }

  const transportOptions = {
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    family: smtpConfig.family,
    connectionTimeout: smtpConfig.connectionTimeout,
    greetingTimeout: smtpConfig.greetingTimeout,
    socketTimeout: smtpConfig.socketTimeout,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
  };

  if (smtpConfig.service) {
    transportOptions.service = smtpConfig.service;
  } else {
    transportOptions.host = smtpConfig.host;
    transportOptions.tls = {
      servername: smtpConfig.host,
    };
  }

  smtpTransporter = nodemailer.createTransport(transportOptions);

  return smtpTransporter;
};

const getSmtpErrorMessage = (error) => {
  if (error?.code === "ETIMEDOUT") {
    return "SMTP connection timed out. Check your SMTP host, port, firewall/network access, or switch to an API-based provider.";
  }
  return String(error?.message || "").trim();
};

const sendWithSendGrid = async ({
  to,
  subject,
  text,
  html,
  attachments,
  senderEmail,
  senderName,
  replyTo,
}) => {
  warnIfSenderLooksUnsafe(senderEmail, replyTo);

  await sgMail.send({
    to,
    from: {
      email: senderEmail,
      name: senderName,
    },
    replyTo,
    subject,
    text,
    html,
    attachments,
  });
};

const sendEmail = async (to, subject, html, options = {}) => {
  const emailProvider = getEmailProvider();
  const senderName = process.env.EMAIL_FROM_NAME || "EventMate";
  const senderEmail =
    process.env.EMAIL_FROM_EMAIL ||
    process.env.SMTP_FROM_EMAIL ||
    process.env.EMAIL_USERNAME ||
    process.env.SMTP_USER;
  const replyTo = process.env.EMAIL_REPLY_TO || senderEmail;
  const attachments = Array.isArray(options?.attachments) ? options.attachments : [];
  const text = String(options?.text || htmlToPlainText(html)).trim();

  if (!senderEmail) {
    const err = new Error("Missing sender email configuration");
    err.statusCode = 500;
    throw err;
  }

  if (!emailProvider) {
    const err = new Error("Missing email provider configuration");
    err.statusCode = 500;
    throw err;
  }

  if (emailProvider === "smtp") {
    try {
      const transporter = createSmtpTransporter();
      await transporter.sendMail({
        to,
        from: {
          name: senderName,
          address: senderEmail,
        },
        replyTo,
        subject,
        text,
        html,
        attachments,
      });
      return;
    } catch (error) {
      console.error("SMTP Error:", error);

      if (canUseSendGrid()) {
        console.warn("SMTP delivery failed. Falling back to SendGrid.");
        try {
          await sendWithSendGrid({
            to,
            subject,
            text,
            html,
            attachments,
            senderEmail,
            senderName,
            replyTo,
          });
          return;
        } catch (fallbackError) {
          console.error("SendGrid Fallback Error:", fallbackError.response?.body || fallbackError);
        }
      }

      const providerMessage = getSmtpErrorMessage(error);
      const err = new Error(
        providerMessage
          ? `Failed to send email: ${providerMessage}`
          : "Failed to send email"
      );
      err.statusCode = 503;
      throw err;
    }
  }

  try {
    await sendWithSendGrid({
      to,
      subject,
      text,
      html,
      attachments,
      senderEmail,
      senderName,
      replyTo,
    });
  } catch (error) {
    console.error("SendGrid Error:", error.response?.body || error);

    const providerMessage = getSendGridErrorMessage(error);
    const err = new Error(
      providerMessage
        ? `Failed to send email: ${providerMessage}`
        : "Failed to send email"
    );
    err.statusCode = 503;
    throw err;
  }
};

export default sendEmail;
