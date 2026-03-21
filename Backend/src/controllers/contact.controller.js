import Contact from "../models/Contact.model.js";
import { sendNotification } from "../services/notification.service.js";
import User from "../models/User.model.js";
import sendEmail from "../config/sendEmail.js";

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizeText = (value, maxLength = 4000) => String(value || "").trim().slice(0, maxLength);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const escapeHtml = (value) =>
  String(value || "").replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
const sanitizeSubjectLine = (value) =>
  normalizeText(value, 160)
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const getSettledFailureMessage = (result) =>
  String(result?.reason?.message || result?.reason || "Unknown email error").trim();

/* ================================================
   POST /api/contact
   Anyone can submit — logged in or not
================================================ */
export const submitContact = async (req, res, next) => {
  try {
    const fullName = normalizeText(req.body?.fullName, 120);
    const email = normalizeEmail(req.body?.email);
    const message = normalizeText(req.body?.message, 5000);

    if (!fullName || !email || !message)
      return res.status(400).json({
        success: false,
        message: "Full name, email and message are required"
      });

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address"
      });
    }

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

    let emailDeliveryPending = false;

    if (adminEmails.length) {
      const rawMessage = String(message || "").trim();
      const subjectMatch = rawMessage.match(/^Subject:\s*(.+)$/im);
      const extractedSubject = sanitizeSubjectLine(subjectMatch?.[1]);
      const emailSubject = `EventMate Contact${extractedSubject ? ` - ${extractedSubject}` : ""}`;
      const submittedRole = String(req.user?.role || "GUEST").trim();
      const safeFullName = escapeHtml(fullName);
      const safeEmail = escapeHtml(email);
      const safeRole = escapeHtml(submittedRole);
      const safeMessage = escapeHtml(rawMessage);

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; background: #f8fafc;">
          <h2 style="margin: 0 0 12px; color: #0f172a;">New Contact Message</h2>
          <p style="margin: 0 0 12px; color: #334155;">
            <strong>Name:</strong> ${safeFullName}<br />
            <strong>Email:</strong> ${safeEmail}<br />
            <strong>Role:</strong> ${safeRole}
          </p>
          <div style="margin-top: 12px; padding: 12px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
            <p style="margin: 0 0 8px; color: #475569; font-size: 13px;">Message</p>
            <pre style="margin: 0; white-space: pre-wrap; font-family: inherit; color: #0f172a; font-size: 14px;">${safeMessage}</pre>
          </div>
        </div>
      `;

      const emailResults = await Promise.allSettled(
        adminEmails.map((recipient) => sendEmail(recipient, emailSubject, html))
      );
      const failedEmailResults = emailResults.filter((result) => result.status === "rejected");
      emailDeliveryPending = failedEmailResults.length > 0;

      if (failedEmailResults.length) {
        console.error(
          `Contact email delivery delayed for ${failedEmailResults.length}/${adminEmails.length} admin recipient(s): ${failedEmailResults
            .map((result) => getSettledFailureMessage(result))
            .filter(Boolean)
            .join(" | ")}`
        );
      }
    }

    return res.status(emailDeliveryPending ? 202 : 201).json({
      success: true,
      message: emailDeliveryPending
        ? "Your message was saved, but email delivery to admins is delayed right now. It is still available in the EventMate contact center."
        : "Your message has been submitted. We'll get back to you soon!",
      emailDeliveryPending,
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

export const getMyContacts = async (req, res, next) => {
  try {
    const userId = req.user?._id || null;
    const email = normalizeEmail(req.user?.email);
    const filters = [];

    if (userId) {
      filters.push({ "submittedBy.userId": userId });
    }

    if (email) {
      filters.push({ email });
    }

    if (!filters.length) {
      return res.status(400).json({
        success: false,
        message: "Unable to identify the current user."
      });
    }

    const query = filters.length === 1 ? filters[0] : { $or: filters };
    const contacts = await Contact.find(query).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: contacts.length,
      data: contacts
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminContacts = async (req, res, next) => {
  try {
    const admins = await User.find({ role: "MAIN_ADMIN" })
      .select("fullName email role avatar")
      .sort({ fullName: 1 });

    return res.status(200).json({
      success: true,
      count: admins.length,
      data: admins
    });
  } catch (error) {
    next(error);
  }
};
