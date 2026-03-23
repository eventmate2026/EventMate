import Mailjet from "node-mailjet";

const mailjet = new Mailjet({
  apiKey: process.env.MAILJET_API_KEY,
  apiSecret: process.env.MAILJET_SECRET_KEY
});

const sendEmail = async (to, subject, html) => {
  try {
    await mailjet.post("send", { version: "v3.1" }).request({
      Messages: [
        {
          From: {
            Email: process.env.EMAIL_FROM_EMAIL || "eventmate2026@gmail.com",
            Name: process.env.EMAIL_FROM_NAME || "EventMate"
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
};

export default sendEmail;
