import Contact from "../models/Contact.model.js";
import { sendNotification } from "../services/notification.service.js";
import User from "../models/User.model.js";
import sendEmail from "../config/sendEmail.js";

/* ================================================
   POST /api/contact
   Anyone can submit — logged in or not
================================================ */
export const submitContact = async (req, res, next) => {
  try {
    const { fullName, email, message } = req.body;

    if (!fullName || !email || !message)
      return res.status(400).json({
        success: false,
        message: "Full name, email and message are required"
      });

    const contact = await Contact.create({
      fullName,
      email,
      message,
      submittedBy: {
        userId: req.user?._id || null,
        role: req.user?.role || "GUEST"
      }
    });
    // Notify admin (in-app)
    const admin = await User.findOne({ role: "MAIN_ADMIN" });
    if (admin) {
      await sendNotification({
        recipientId: admin._id,
        recipientName: admin.fullName,
        recipientRole: "MAIN_ADMIN",
        title: "New Contact Message",
        message: `${fullName} (${email}) sent a message`,
        type: "CONTACT",
        refId: contact._id
      });
    }

    // Email all MAIN_ADMIN users
    const admins = await User.find({ role: "MAIN_ADMIN" }).select("fullName email role");
    const adminEmails = admins
      .map((item) => String(item?.email || "").trim())
      .filter(Boolean);

    if (adminEmails.length) {
      const rawMessage = String(message || "").trim();
      const subjectMatch = rawMessage.match(/^Subject:\s*(.+)$/im);
      const extractedSubject = subjectMatch?.[1]?.trim();
      const emailSubject = `EventMate Contact${extractedSubject ? ` - ${extractedSubject}` : ""}`;
      const submittedRole = String(req.user?.role || "GUEST").trim();

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; background: #f8fafc;">
          <h2 style="margin: 0 0 12px; color: #0f172a;">New Contact Message</h2>
          <p style="margin: 0 0 12px; color: #334155;">
            <strong>Name:</strong> ${fullName}<br />
            <strong>Email:</strong> ${email}<br />
            <strong>Role:</strong> ${submittedRole}
          </p>
          <div style="margin-top: 12px; padding: 12px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
            <p style="margin: 0 0 8px; color: #475569; font-size: 13px;">Message</p>
            <pre style="margin: 0; white-space: pre-wrap; font-family: inherit; color: #0f172a; font-size: 14px;">${rawMessage}</pre>
          </div>
        </div>
      `;

      await Promise.allSettled(
        adminEmails.map((recipient) => sendEmail(recipient, emailSubject, html))
      );
    }
    return res.status(201).json({
      success: true,
      message: "Your message has been submitted. We'll get back to you soon!",
      data: {
        fullName: contact.fullName,
        email: contact.email,
        message: contact.message,
        submittedAt: contact.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/* ================================================
   GET /api/contact
   MAIN_ADMIN only — view all submissions
================================================ */
export const getContacts = async (req, res, next) => {
  try {
    const contacts = await Contact.find()
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: contacts.length,
      data: contacts
    });
  } catch (error) {
    next(error);
  }
};
