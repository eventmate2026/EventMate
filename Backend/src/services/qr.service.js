import QRCode from "qrcode";
import { v2 as cloudinary } from "cloudinary";
import crypto from "crypto";
import ParticipantQR from "../models/ParticipantQR.model.js";
import User from "../models/User.model.js";
import { getPrimaryFrontendUrl } from "../config/clientOrigins.js";
import { sendNotification } from "./notification.service.js";

export const buildAttendanceVerificationUrl = (
  token,
  frontendUrl = getPrimaryFrontendUrl()
) => {
  const normalizedToken = String(token || "").trim();
  const baseUrl = String(frontendUrl || "").trim().replace(/\/+$/, "");

  if (!normalizedToken) return "";
  if (!baseUrl) return normalizedToken;

  return `${baseUrl}/attendance/verify?token=${encodeURIComponent(normalizedToken)}`;
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const generateAndUploadQR = async (token) => {
  const verifyUrl = buildAttendanceVerificationUrl(token);

  const qrBuffer = await QRCode.toBuffer(verifyUrl, {
    type: "png",
    width: 400,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#FFFFFF"
    }
  });

  const uploadResult = await new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "eventmate/qrcodes",
        public_id: `qr_${token}`,
        format: "png"
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(qrBuffer);
  });

  return {
    qrImageUrl: uploadResult.secure_url,
    qrBuffer,
    verifyUrl
  };
};

const qrEmailTemplate = ({
  participantName,
  eventName,
  eventDate,
  venue,
  qrImageSrc,
  verifyUrl
}) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9f9f9;">
    <div style="background: #4f46e5; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">You're Registered!</h1>
    </div>

    <div style="background: white; padding: 32px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
      <p style="font-size: 16px; color: #374151;">Hi <strong>${participantName}</strong>,</p>

      <p style="font-size: 15px; color: #374151;">
        You've been successfully registered for <strong>${eventName}</strong>.
        Present this QR code at the event entrance for attendance verification.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <img
          src="${qrImageSrc}"
          alt="Your Attendance QR Code"
          style="width: 220px; height: 220px; border: 3px solid #e5e7eb; border-radius: 12px; padding: 8px;"
        />
        <p style="color: #6b7280; font-size: 13px; margin-top: 8px;">
          Your unique QR code, do not share it.
        </p>
        ${
          /^https?:\/\//i.test(String(verifyUrl || "").trim())
            ? `<p style="margin-top: 12px;">
                <a
                  href="${verifyUrl}"
                  style="display: inline-block; padding: 10px 18px; border-radius: 8px; background: #4f46e5; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700;"
                >
                  Open QR Link
                </a>
              </p>`
            : ""
        }
      </div>

      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin-top: 16px;">
        <p style="margin: 0 0 8px; font-size: 14px; color: #374151;">
          <strong>Event:</strong> ${eventName}
        </p>
        <p style="margin: 0 0 8px; font-size: 14px; color: #374151;">
          <strong>Date:</strong> ${eventDate}
        </p>
        <p style="margin: 0; font-size: 14px; color: #374151;">
          <strong>Venue:</strong> ${venue}
        </p>
      </div>

      <p style="font-size: 13px; color: #9ca3af; margin-top: 24px; text-align: center;">
        You can also view your QR code anytime on your EventMate dashboard.
      </p>
    </div>

    <p style="text-align: center; font-size: 12px; color: #9ca3af; margin-top: 16px;">
      EventMate Team
    </p>
  </div>
`;

export const generateQRsForRegistration = async (registration, event) => {
  const isTeam = event.isTeamEvent;

  const participants = isTeam
    ? [
        {
          name: registration.teamLeader.name,
          email: registration.teamLeader.email,
          role: "leader"
        },
        ...registration.teamMembers.map((member) => ({
          name: member.name,
          email: member.email,
          role: "participant"
        }))
      ]
    : [
        {
          name: registration.teamLeader.name,
          email: registration.teamLeader.email,
          role: "participant"
        }
      ];

  const eventDate = event.schedule?.startDate
    ? new Date(event.schedule.startDate).toDateString()
    : "TBA";

  const venue = event.venue?.location || event.venue?.mode || "TBA";
  const participantEmails = participants
    .map((participant) => String(participant?.email || "").trim().toLowerCase())
    .filter(Boolean);
  const users = participantEmails.length
    ? await User.find({ email: { $in: participantEmails } }).select("_id fullName role email")
    : [];
  const userByEmail = new Map(
    users.map((user) => [String(user?.email || "").trim().toLowerCase(), user])
  );

  for (const participant of participants) {
    const token = crypto.randomBytes(32).toString("hex");
    const { qrImageUrl, qrBuffer, verifyUrl } = await generateAndUploadQR(token);

    await ParticipantQR.create({
      registration: registration._id,
      eventId: event._id,
      name: participant.name,
      email: participant.email,
      role: participant.role,
      token,
      qrImageUrl
    });

    const normalizedEmail = String(participant?.email || "").trim().toLowerCase();
    const participantUser = userByEmail.get(normalizedEmail);

    await sendNotification({
      recipientId: participantUser?._id || null,
      recipientName: participantUser?.fullName || participant.name || "Participant",
      recipientRole: participantUser?.role || "STUDENT",
      recipientEmail: participantUser?.email || normalizedEmail,
      title: "QR Pass Ready",
      message: `Your QR pass for ${event.title} is ready on the website and has been queued for email delivery.`,
      type: "REGISTRATION",
      refId: event._id,
      sendEmailCopy: true,
      emailPayload: {
        subject: `You're Registered! - ${event.title}`,
        html: qrEmailTemplate({
          participantName: participant.name,
          eventName: event.title,
          eventDate,
          venue,
          qrImageSrc: "cid:eventmate-registration-qr",
          verifyUrl
        }),
        attachments: [
          {
            content: qrBuffer.toString("base64"),
            filename: `eventmate-qr-${token}.png`,
            type: "image/png",
            disposition: "inline",
            contentId: "eventmate-registration-qr"
          }
        ]
      }
    });
  }
};
