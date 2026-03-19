import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = async (to, subject, html) => {
  const senderName = process.env.EMAIL_FROM_NAME || "EventMate";
  const senderEmail = process.env.EMAIL_USERNAME;

  try {
    await sgMail.send({
      to,
      from: `${senderName} <${senderEmail}>`,
      replyTo: senderEmail,
      subject,
      html,
    });
  } catch (error) {
    console.error("SendGrid Error:", error.response?.body || error);

    const err = new Error("Failed to send email");
    err.statusCode = 503;
    throw err;
  }
};

export default sendEmail;