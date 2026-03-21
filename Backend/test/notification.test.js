import test from "node:test";
import assert from "node:assert/strict";
import {
  buildNotificationEmailDeliveryState,
  EMAIL_DELIVERY_STATUS,
  EMAIL_TRACKING_MODE
} from "../src/services/notification.service.js";
import { buildAttendanceVerificationUrl } from "../src/services/qr.service.js";
import {
  buildCertificateDownloadUrl,
  createCertificateDownloadToken,
  isCertificateDownloadTokenValid
} from "../src/services/certificate.service.js";
import {
  buildTeamNoticeRecipientMap,
  collectOrganizerEventAudience
} from "../src/controllers/notification.controller.js";
import {
  createCorsOriginValidator,
  getAllowedFrontendOrigins,
  getPrimaryFrontendUrl
} from "../src/config/clientOrigins.js";
import errorMiddleware from "../src/middleware/error.middleware.js";

const createMockResponse = () => {
  const record = { statusCode: 200, payload: null };
  return {
    record,
    res: {
      status(code) {
        record.statusCode = code;
        return this;
      },
      json(payload) {
        record.payload = payload;
        return this;
      }
    }
  };
};

test("buildNotificationEmailDeliveryState returns NOT_REQUESTED when email copy is disabled", () => {
  const result = buildNotificationEmailDeliveryState({
    sendEmailCopy: false,
    recipientEmail: "student@example.com"
  });

  assert.equal(result.requested, false);
  assert.equal(result.trackingMode, EMAIL_TRACKING_MODE.PROVIDER_ACCEPTANCE);
  assert.equal(result.status, EMAIL_DELIVERY_STATUS.NOT_REQUESTED);
  assert.equal(result.attempts, 0);
  assert.equal(result.lastError, "");
});

test("buildNotificationEmailDeliveryState returns SKIPPED when email copy is requested without an email", () => {
  const result = buildNotificationEmailDeliveryState({
    sendEmailCopy: true,
    recipientEmail: ""
  });

  assert.equal(result.requested, true);
  assert.equal(result.trackingMode, EMAIL_TRACKING_MODE.PROVIDER_ACCEPTANCE);
  assert.equal(result.status, EMAIL_DELIVERY_STATUS.SKIPPED);
  assert.ok(result.queuedAt instanceof Date);
  assert.match(result.lastError, /missing/i);
});

test("buildNotificationEmailDeliveryState queues email when email copy is requested", () => {
  const result = buildNotificationEmailDeliveryState({
    sendEmailCopy: true,
    recipientEmail: "student@example.com"
  });

  assert.equal(result.requested, true);
  assert.equal(result.trackingMode, EMAIL_TRACKING_MODE.PROVIDER_ACCEPTANCE);
  assert.equal(result.status, EMAIL_DELIVERY_STATUS.PENDING);
  assert.ok(result.queuedAt instanceof Date);
  assert.equal(result.acceptedAt, null);
  assert.equal(result.deliveredAt, null);
});

test("collectOrganizerEventAudience includes team leader and all team members", () => {
  const registrations = [
    {
      registeredBy: "leader-user-id",
      teamLeader: { email: "leader@example.com" },
      teamMembers: [
        { email: "member-one@example.com" },
        { email: "member-two@example.com" }
      ]
    },
    {
      registeredBy: "second-leader",
      teamLeader: { email: "second@example.com" },
      teamMembers: [{ email: "member-one@example.com" }]
    }
  ];

  const result = collectOrganizerEventAudience(registrations, true);

  assert.deepEqual(Array.from(result.allowedIds).sort(), [
    "leader-user-id",
    "second-leader"
  ]);
  assert.deepEqual(Array.from(result.participantEmails).sort(), [
    "leader@example.com",
    "member-one@example.com",
    "member-two@example.com",
    "second@example.com"
  ]);
});

test("collectOrganizerEventAudience ignores team members for non-team events", () => {
  const registrations = [
    {
      registeredBy: "solo-user",
      teamLeader: { email: "solo@example.com" },
      teamMembers: [{ email: "should-not-be-used@example.com" }]
    }
  ];

  const result = collectOrganizerEventAudience(registrations, false);

  assert.deepEqual(Array.from(result.allowedIds), ["solo-user"]);
  assert.deepEqual(Array.from(result.participantEmails), ["solo@example.com"]);
});

test("buildTeamNoticeRecipientMap expands a selected leader to the full team roster", () => {
  const recipientMap = buildTeamNoticeRecipientMap([
    {
      registeredBy: "leader-user-id",
      teamLeader: { name: "Leader One", email: "leader@example.com" },
      teamMembers: [
        { name: "Member One", email: "member-one@example.com" },
        { name: "Member Two", email: "member-two@example.com" }
      ]
    }
  ]);

  assert.deepEqual(recipientMap.get("leader-user-id"), [
    { email: "leader@example.com", name: "Leader One", role: "leader" },
    { email: "member-one@example.com", name: "Member One", role: "member" },
    { email: "member-two@example.com", name: "Member Two", role: "member" }
  ]);
});

test("buildAttendanceVerificationUrl prefers a public frontend URL when available", () => {
  const result = buildAttendanceVerificationUrl("team-token-123", "https://eventmate.example.com/");

  assert.equal(
    result,
    "https://eventmate.example.com/attendance/verify?token=team-token-123"
  );
});

test("buildAttendanceVerificationUrl falls back to the raw token when no public frontend URL exists", () => {
  const result = buildAttendanceVerificationUrl("team-token-123", "");

  assert.equal(result, "team-token-123");
});

test("buildCertificateDownloadUrl builds a direct certificate URL when backend URL is configured", () => {
  const previousCertificateSecret = process.env.CERTIFICATE_DOWNLOAD_SECRET;
  process.env.CERTIFICATE_DOWNLOAD_SECRET = "test-certificate-secret";

  const result = buildCertificateDownloadUrl(
    "event123",
    "student@example.com",
    "https://api.eventmate.example.com/"
  );

  const parsed = new URL(result);

  assert.equal(
    `${parsed.origin}${parsed.pathname}`,
    "https://api.eventmate.example.com/api/certificates/download/event123/student_example_com"
  );
  assert.equal(
    parsed.searchParams.get("token"),
    createCertificateDownloadToken("event123", "student@example.com")
  );

  if (previousCertificateSecret === undefined) {
    delete process.env.CERTIFICATE_DOWNLOAD_SECRET;
  } else {
    process.env.CERTIFICATE_DOWNLOAD_SECRET = previousCertificateSecret;
  }
});

test("buildCertificateDownloadUrl returns empty string when no backend URL is configured", () => {
  const result = buildCertificateDownloadUrl("event123", "student@example.com", "");

  assert.equal(result, "");
});

test("isCertificateDownloadTokenValid accepts only the matching certificate download token", () => {
  const previousCertificateSecret = process.env.CERTIFICATE_DOWNLOAD_SECRET;
  process.env.CERTIFICATE_DOWNLOAD_SECRET = "test-certificate-secret";

  const token = createCertificateDownloadToken("event123", "student@example.com");

  assert.equal(isCertificateDownloadTokenValid(token, "event123", "student@example.com"), true);
  assert.equal(isCertificateDownloadTokenValid(token, "event123", "other@example.com"), false);
  assert.equal(isCertificateDownloadTokenValid("bad-token", "event123", "student@example.com"), false);

  if (previousCertificateSecret === undefined) {
    delete process.env.CERTIFICATE_DOWNLOAD_SECRET;
  } else {
    process.env.CERTIFICATE_DOWNLOAD_SECRET = previousCertificateSecret;
  }
});

test("getAllowedFrontendOrigins falls back to Vercel deployment URL", () => {
  const previousFrontendUrl = process.env.FRONTEND_URL;
  const previousVercelUrl = process.env.VERCEL_URL;

  process.env.FRONTEND_URL = "";
  process.env.VERCEL_URL = "eventmate-app.vercel.app";

  const result = getAllowedFrontendOrigins();

  if (previousFrontendUrl === undefined) {
    delete process.env.FRONTEND_URL;
  } else {
    process.env.FRONTEND_URL = previousFrontendUrl;
  }

  if (previousVercelUrl === undefined) {
    delete process.env.VERCEL_URL;
  } else {
    process.env.VERCEL_URL = previousVercelUrl;
  }

  assert.ok(result.includes("https://eventmate-app.vercel.app"));
});

test("getPrimaryFrontendUrl prefers deployed https origins over localhost", () => {
  const previousFrontendUrls = process.env.FRONTEND_URLS;
  const previousFrontendUrl = process.env.FRONTEND_URL;
  const previousVercelUrl = process.env.VERCEL_URL;

  process.env.FRONTEND_URLS =
    "http://localhost:5173,http://127.0.0.1:4173,https://eventmate-app.vercel.app";
  process.env.FRONTEND_URL = "";
  process.env.VERCEL_URL = "eventmate-app.vercel.app";

  const result = getPrimaryFrontendUrl();

  if (previousFrontendUrls === undefined) {
    delete process.env.FRONTEND_URLS;
  } else {
    process.env.FRONTEND_URLS = previousFrontendUrls;
  }

  if (previousFrontendUrl === undefined) {
    delete process.env.FRONTEND_URL;
  } else {
    process.env.FRONTEND_URL = previousFrontendUrl;
  }

  if (previousVercelUrl === undefined) {
    delete process.env.VERCEL_URL;
  } else {
    process.env.VERCEL_URL = previousVercelUrl;
  }

  assert.equal(result, "https://eventmate-app.vercel.app");
});

test("createCorsOriginValidator allows localhost development origins by default", async () => {
  const previousFrontendUrls = process.env.FRONTEND_URLS;
  const previousFrontendUrl = process.env.FRONTEND_URL;
  const previousVercelUrl = process.env.VERCEL_URL;

  process.env.FRONTEND_URLS = "";
  process.env.FRONTEND_URL = "";
  process.env.VERCEL_URL = "";

  const validator = createCorsOriginValidator();

  const result = await new Promise((resolve) => {
    validator("http://localhost:5173", (error, allowed) => {
      resolve({ error, allowed });
    });
  });

  if (previousFrontendUrls === undefined) {
    delete process.env.FRONTEND_URLS;
  } else {
    process.env.FRONTEND_URLS = previousFrontendUrls;
  }

  if (previousFrontendUrl === undefined) {
    delete process.env.FRONTEND_URL;
  } else {
    process.env.FRONTEND_URL = previousFrontendUrl;
  }

  if (previousVercelUrl === undefined) {
    delete process.env.VERCEL_URL;
  } else {
    process.env.VERCEL_URL = previousVercelUrl;
  }

  assert.equal(result.error, null);
  assert.equal(result.allowed, true);
});

test("createCorsOriginValidator allows matching Vercel preview deployments", async () => {
  const previousFrontendUrls = process.env.FRONTEND_URLS;
  process.env.FRONTEND_URLS = "https://eventmate-app.vercel.app";

  const validator = createCorsOriginValidator();

  const result = await new Promise((resolve) => {
    validator("https://eventmate-app-git-main-user.vercel.app", (error, allowed) => {
      resolve({ error, allowed });
    });
  });

  if (previousFrontendUrls === undefined) {
    delete process.env.FRONTEND_URLS;
  } else {
    process.env.FRONTEND_URLS = previousFrontendUrls;
  }

  assert.equal(result.error, null);
  assert.equal(result.allowed, true);
});

test("createCorsOriginValidator allows matching Vercel team preview deployments", async () => {
  const previousFrontendUrls = process.env.FRONTEND_URLS;
  process.env.FRONTEND_URLS =
    "https://eventmate-app.vercel.app,https://eventmate-app-eventmate2026s-projects.vercel.app";

  const validator = createCorsOriginValidator();

  const result = await new Promise((resolve) => {
    validator("https://eventmate-6xwy0bwvx-eventmate2026s-projects.vercel.app", (error, allowed) => {
      resolve({ error, allowed });
    });
  });

  if (previousFrontendUrls === undefined) {
    delete process.env.FRONTEND_URLS;
  } else {
    process.env.FRONTEND_URLS = previousFrontendUrls;
  }

  assert.equal(result.error, null);
  assert.equal(result.allowed, true);
});

test("createCorsOriginValidator allows requests without an origin header", async () => {
  const validator = createCorsOriginValidator();

  const result = await new Promise((resolve) => {
    validator(undefined, (error, allowed) => {
      resolve({ error, allowed });
    });
  });

  assert.equal(result.error, null);
  assert.equal(result.allowed, true);
});

test("error middleware hides internal 500 details from clients", () => {
  const originalConsoleError = console.error;
  console.error = () => {};

  const error = new Error("MongoServerError: E11000 duplicate key error collection: eventmate.users");
  error.statusCode = 500;

  const { res, record } = createMockResponse();
  errorMiddleware(error, {}, res, () => {});

  console.error = originalConsoleError;

  assert.equal(record.statusCode, 500);
  assert.deepEqual(record.payload, {
    success: false,
    message: "Something went wrong. Please try again."
  });
});

test("error middleware hides provider outage details from clients", () => {
  const originalConsoleError = console.error;
  console.error = () => {};

  const error = new Error("SendGrid rejected sender because of DMARC alignment failure");
  error.statusCode = 503;

  const { res, record } = createMockResponse();
  errorMiddleware(error, {}, res, () => {});

  console.error = originalConsoleError;

  assert.equal(record.statusCode, 503);
  assert.deepEqual(record.payload, {
    success: false,
    message: "This service is temporarily unavailable. Please try again."
  });
});

test("createCorsOriginValidator returns 403 for blocked origins", async () => {
  const previousFrontendUrls = process.env.FRONTEND_URLS;
  process.env.FRONTEND_URLS = "https://eventmate-app.vercel.app";

  const validator = createCorsOriginValidator();

  const result = await new Promise((resolve) => {
    validator("https://blocked.example.com", (error, allowed) => {
      resolve({ error, allowed });
    });
  });

  if (previousFrontendUrls === undefined) {
    delete process.env.FRONTEND_URLS;
  } else {
    process.env.FRONTEND_URLS = previousFrontendUrls;
  }

  assert.equal(result.allowed, undefined);
  assert.ok(result.error instanceof Error);
  assert.equal(result.error.message, "Origin not allowed by CORS");
  assert.equal(result.error.statusCode, 403);
});

test("createCorsOriginValidator blocks unrelated Vercel projects", async () => {
  const previousFrontendUrls = process.env.FRONTEND_URLS;
  process.env.FRONTEND_URLS = "https://eventmate-app.vercel.app";

  const validator = createCorsOriginValidator();

  const result = await new Promise((resolve) => {
    validator("https://another-project.vercel.app", (error, allowed) => {
      resolve({ error, allowed });
    });
  });

  if (previousFrontendUrls === undefined) {
    delete process.env.FRONTEND_URLS;
  } else {
    process.env.FRONTEND_URLS = previousFrontendUrls;
  }

  assert.equal(result.allowed, undefined);
  assert.ok(result.error instanceof Error);
  assert.equal(result.error.message, "Origin not allowed by CORS");
  assert.equal(result.error.statusCode, 403);
});

test("createCorsOriginValidator blocks unrelated Vercel team preview deployments", async () => {
  const previousFrontendUrls = process.env.FRONTEND_URLS;
  process.env.FRONTEND_URLS =
    "https://eventmate-app.vercel.app,https://eventmate-app-eventmate2026s-projects.vercel.app";

  const validator = createCorsOriginValidator();

  const result = await new Promise((resolve) => {
    validator("https://anotherapp-6xwy0bwvx-eventmate2026s-projects.vercel.app", (error, allowed) => {
      resolve({ error, allowed });
    });
  });

  if (previousFrontendUrls === undefined) {
    delete process.env.FRONTEND_URLS;
  } else {
    process.env.FRONTEND_URLS = previousFrontendUrls;
  }

  assert.equal(result.allowed, undefined);
  assert.ok(result.error instanceof Error);
  assert.equal(result.error.message, "Origin not allowed by CORS");
  assert.equal(result.error.statusCode, 403);
});
