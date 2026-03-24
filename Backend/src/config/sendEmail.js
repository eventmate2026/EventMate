import nodemailer from "nodemailer";

const sendEmail = async (to, subject, html) => {
  const emailUsername = String(process.env.EMAIL_USERNAME || "").trim();
  const emailPassword = String(process.env.EMAIL_PASSWORD || "").trim();
  const smtpHost = String(process.env.SMTP_HOST || process.env.EMAIL_HOST || "smtp.gmail.com").trim();
  const smtpPort = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 465);
  const smtpSecure = String(
    process.env.SMTP_SECURE || process.env.EMAIL_SECURE || (smtpPort === 465 ? "true" : "false")
  )
    .trim()
    .toLowerCase() === "true";

  if (!emailUsername || !emailPassword) {
    const error = new Error("Email service is not configured.");
    error.statusCode = 503;
    throw error;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: {
      user: emailUsername,
      pass: emailPassword
    }
  });

  await transporter.sendMail({
    from: `"EventMate" <${emailUsername}>`,
    to,
    subject,
    html
  });
};

export default sendEmail;
