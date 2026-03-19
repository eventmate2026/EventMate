import nodemailer from "nodemailer";

const sendEmail = async (to, subject, html) => {
  const emailUsername = String(process.env.EMAIL_USERNAME || "").trim();
  const emailPassword = String(process.env.EMAIL_PASSWORD || "").trim();

  if (!emailUsername || !emailPassword) {
    const error = new Error("Email service is not configured.");
    error.statusCode = 503;
    throw error;
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: emailUsername,
      pass: emailPassword,
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  await transporter.sendMail({
    from: `"EventMate" <${emailUsername}>`,
    to,
    subject,
    html,
  });
};

export default sendEmail;
