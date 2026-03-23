import Mailjet from "node-mailjet";
import nodemailer from "nodemailer";

const getProvider = () => {
  const provider = String(process.env.EMAIL_PROVIDER || "").toLowerCase().trim();
  if (provider === "smtp" || process.env.SMTP_USER) {
    return "smtp";
  }
  return "mailjet";
};

let mailjetClient = null;
let transporter = null;

const initClients = () => {
  const provider = getProvider();
  if (provider === "mailjet") {
    if (!mailjetClient) {
      mailjetClient = new Mailjet({
        apiKey: process.env.MAILJET_API_KEY,
        apiSecret: process.env.MAILJET_SECRET_KEY
      });
    }
  } else if (provider === "smtp") {
    if (!transporter) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    }
  }
};

const sendEmail = async (to, subject, html) => {
  initClients();
  const provider = getProvider();
  const fromEmail = process.env.EMAIL_FROM_EMAIL || "eventmate2026@gmail.com";
  const fromName = process.env.EMAIL_FROM_NAME || "EventMate";

  if (provider === "smtp") {
    try {
      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        html
      });
    } catch (error) {
      console.error("SMTP error:", error.message);
      const err = new Error("Failed to send email");
      err.statusCode = 503;
      throw err;
    }
  } else {
    try {
      await mailjetClient.post("send", { version: "v3.1" }).request({
        Messages: [
          {
            From: {
              Email: fromEmail,
              Name: fromName
            },
            To: [{ Email: to }],
            Subject: subject,
            HTMLPart: html
          }
        ]
      });
    } catch (error) {
      console.error("Mailjet error:", error?.response?.body || error.message);
      const err = new Error("Failed to send email");
      err.statusCode = 503;
      throw err;
    }
  }
};

export default sendEmail;
