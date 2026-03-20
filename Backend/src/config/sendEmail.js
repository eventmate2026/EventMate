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

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return fallback;
};

const getEmailProvider = () => {
  const explicitProvider = String(process.env.EMAIL_PROVIDER || "").trim().toLowerCase();
  if (explicitProvider) return explicitProvider;

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return "smtp";
  }

  return process.env.SENDGRID_API_KEY ? "sendgrid" : "";
};

const createSmtpTransporter = () => {
  if (smtpTransporter) return smtpTransporter;

  const smtpHost = String(process.env.SMTP_HOST || "").trim();
  const smtpPort = Number(process.env.SMTP_PORT || 465);
  const smtpUser = String(process.env.SMTP_USER || "").trim();
  const smtpPass = String(process.env.SMTP_PASS || "").trim();
  const smtpSecure = normalizeBoolean(process.env.SMTP_SECURE, smtpPort === 465);

  if (!smtpHost || !smtpUser || !smtpPass) {
    const err = new Error("Missing SMTP configuration");
    err.statusCode = 500;
    throw err;
  }

  smtpTransporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  return smtpTransporter;
};

const getSmtpErrorMessage = (error) => String(error?.message || "").trim();

const sendEmail = async (to, subject, html, options = {}) => {
  const emailProvider = getEmailProvider();
  const senderName = process.env.EMAIL_FROM_NAME || "EventMate";
  const senderEmail = process.env.EMAIL_FROM_EMAIL || process.env.EMAIL_USERNAME;
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

  warnIfSenderLooksUnsafe(senderEmail, replyTo);

  try {
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
