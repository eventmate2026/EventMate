import nodemailer from "nodemailer";

const DEFAULT_FROM_NAME = "EventMate";
const CONSUMER_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
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

const normalizeRecipients = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const getEmailDomain = (value) => {
  const email = String(value || "").trim().toLowerCase();
  const atIndex = email.lastIndexOf("@");
  if (atIndex === -1) return "";
  return email.slice(atIndex + 1);
};

const canUseSendGridFromAddress = (value) => {
  const domain = getEmailDomain(value);
  return Boolean(domain) && !CONSUMER_MAIL_DOMAINS.has(domain);
};

const resolveMailConfig = () => {
  const emailUsername = String(process.env.EMAIL_USERNAME || "").trim();
  const emailPassword = String(process.env.EMAIL_PASSWORD || "").trim();
  const smtpHost = String(process.env.SMTP_HOST || process.env.EMAIL_HOST || "smtp.gmail.com").trim();
  const smtpPort = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 465);
  const smtpSecure = String(
    process.env.SMTP_SECURE || process.env.EMAIL_SECURE || (smtpPort === 465 ? "true" : "false")
  )
    .trim()
    .toLowerCase() === "true";

  const fromName = String(
    process.env.EMAIL_FROM_NAME || process.env.SMTP_FROM_NAME || process.env.SENDGRID_FROM_NAME || DEFAULT_FROM_NAME
  ).trim() || DEFAULT_FROM_NAME;
  const fromEmail = String(
    process.env.EMAIL_FROM ||
      process.env.SMTP_FROM_EMAIL ||
      process.env.SENDGRID_FROM_EMAIL ||
      emailUsername
  ).trim();
  const sendgridApiKey = String(process.env.SENDGRID_API_KEY || "").trim();
  const sendgridFromEmail = String(
    process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_FROM || emailUsername
  ).trim();
  const sendgridFromName = String(process.env.SENDGRID_FROM_NAME || fromName || DEFAULT_FROM_NAME).trim()
    || DEFAULT_FROM_NAME;

  return {
    emailUsername,
    emailPassword,
    smtpHost,
    smtpPort,
    smtpSecure,
    fromName,
    fromEmail,
    sendgridApiKey,
    sendgridFromEmail,
    sendgridFromName,
  };
};

const sendViaSmtp = async ({ to, subject, html, config }) => {
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: {
      user: config.emailUsername,
      pass: config.emailPassword,
    },
  });

  await transporter.sendMail({
    from: `"${config.fromName}" <${config.fromEmail || config.emailUsername}>`,
    to,
    subject,
    html,
  });
};

const sendViaSendGrid = async ({ to, subject, html, config }) => {
  const recipients = normalizeRecipients(to).map((email) => ({ email }));

  if (!recipients.length) {
    const error = new Error("Recipient email is required.");
    error.statusCode = 400;
    throw error;
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.sendgridApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: recipients }],
      from: {
        email: config.sendgridFromEmail,
        name: config.sendgridFromName,
      },
      subject,
      content: [
        {
          type: "text/html",
          value: html,
        },
      ],
    }),
  });

  if (response.ok) return;

  const responseText = await response.text();
  const error = new Error("SendGrid email delivery failed.");
  error.statusCode = response.status || 503;
  error.provider = "sendgrid";
  error.details = responseText;
  throw error;
};

const sendEmail = async (to, subject, html) => {
  const config = resolveMailConfig();
  const hasSmtpConfig = Boolean(config.emailUsername && config.emailPassword);
  const sendgridFromEligible = canUseSendGridFromAddress(config.sendgridFromEmail);
  const hasSendGridConfig = Boolean(
    config.sendgridApiKey && config.sendgridFromEmail && sendgridFromEligible
  );

  if (config.sendgridApiKey && config.sendgridFromEmail && !sendgridFromEligible && !hasSmtpConfig) {
    const error = new Error(
      "SendGrid requires a domain-based From address. Consumer mailbox senders like gmail.com must use SMTP or a custom domain."
    );
    error.statusCode = 503;
    throw error;
  }

  if (!hasSmtpConfig && !hasSendGridConfig) {
    const error = new Error("Email service is not configured.");
    error.statusCode = 503;
    throw error;
  }

  let smtpError = null;

  if (hasSmtpConfig) {
    try {
      await sendViaSmtp({ to, subject, html, config });
      return;
    } catch (error) {
      smtpError = error;
    }
  }

  if (hasSendGridConfig) {
    await sendViaSendGrid({ to, subject, html, config });
    return;
  }

  if (smtpError) {
    smtpError.statusCode = smtpError.statusCode || 503;
    throw smtpError;
  }

  const error = new Error("Email service is not configured.");
  error.statusCode = 503;
  throw error;
};

export default sendEmail;
