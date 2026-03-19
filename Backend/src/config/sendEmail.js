import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = async (to, subject, html) => {
  try {
    await sgMail.send({
      to,
      from: process.env.EMAIL_USERNAME, // verified sender
      replyTo: process.env.EMAIL_USERNAME,
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