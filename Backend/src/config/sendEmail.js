import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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

const sendEmail = async (to, subject, html, options = {}) => {
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

    const err = new Error("Failed to send email");
    err.statusCode = 503;
    throw err;
  }
};

export default sendEmail;
