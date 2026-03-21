import sgMail from "@sendgrid/mail";
import { promises as dnsPromises, setDefaultResultOrder } from "node:dns";
import nodemailer from "nodemailer";

try {
  setDefaultResultOrder("ipv4first");
} catch {
  // Ignore when the current Node runtime does not support overriding DNS order.
}

const getSendGridApiKey = () => {
  const rawKey = String(process.env.SENDGRID_API_KEY || "").trim();
  if (!rawKey) return "";

  // Strip accidental surrounding quotes and whitespace/newlines.
  return rawKey.replace(/^"|"$/g, "").replace(/^'|'$/g, "").trim();
};

const SENDGRID_API_KEY = getSendGridApiKey();

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

const CONSUMER_MAILBOX_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.in",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]);

let senderConfigurationWarningShown = false;
const smtpTransporters = new Map();
const MAX_RESOLVED_SMTP_ADDRESSES = 1;
const SMTP_CONNECTION_ERROR_CODES = new Set([
  "ECONNABORTED",
  "ECONNECTION",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ESOCKET",
  "ETIMEDOUT",
]);

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

const extractDomainFromEmail = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  return atIndex >= 0 ? normalized.slice(atIndex + 1) : "";
};

const isConsumerMailboxDomain = (email) =>
  CONSUMER_MAILBOX_DOMAINS.has(extractDomainFromEmail(email));

const warnIfSenderLooksUnsafe = (senderEmail, replyTo) => {
  if (senderConfigurationWarningShown) return;

  const senderDomain = extractDomainFromEmail(senderEmail);
  if (!CONSUMER_MAILBOX_DOMAINS.has(senderDomain)) return;

  senderConfigurationWarningShown = true;
  console.warn(
    [
      `Email sender "${senderEmail}" uses a consumer mailbox domain.`,
      "Major inbox providers often reject or spam-folder SendGrid mail sent from Gmail/Outlook/Yahoo-style addresses.",
      "Use a SendGrid-authenticated custom-domain sender such as noreply@your-domain.com.",
      replyTo && replyTo !== senderEmail
        ? `You can keep "${replyTo}" as the reply-to address if needed.`
        : null,
    ]
      .filter(Boolean)
      .join(" ")
  );
};

const getSendGridErrorMessage = (error) => {
  const errors = error?.response?.body?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    return errors
      .map((entry) => String(entry?.message || "").trim())
      .filter(Boolean)
      .join("; ");
  }
  return String(error?.message || "").trim();
};

const canUseSendGrid = () => Boolean(SENDGRID_API_KEY);
const canUseSmtp = () => {
  const smtpConfig = getSmtpConfig();
  return Boolean((smtpConfig.host || smtpConfig.service) && smtpConfig.user && smtpConfig.pass);
};

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return fallback;
};

const normalizeNumber = (value, fallback) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const hasTransientConnectionMessage = (error) => {
  const message = String(error?.message || "").trim().toLowerCase();
  return /connection timeout|greeting timeout|connection closed|network timeout|network is unreachable|temporarily unavailable/.test(
    message
  );
};

const getSmtpConfig = () => {
  const legacyUser = String(process.env.EMAIL_USERNAME || "").trim();
  const legacyPass = String(process.env.EMAIL_PASSWORD || "").trim();
  const host = String(process.env.SMTP_HOST || "").trim();
  const service = String(
    process.env.SMTP_SERVICE ||
      process.env.EMAIL_SERVICE ||
      (!host && legacyUser && legacyPass ? "gmail" : "")
  ).trim();
  const user = String(process.env.SMTP_USER || legacyUser).trim();
  const pass = String(process.env.SMTP_PASS || legacyPass).trim();
  const port = normalizeNumber(process.env.SMTP_PORT, 465);
  const secure = normalizeBoolean(process.env.SMTP_SECURE, port === 465);
  const family = normalizeNumber(process.env.SMTP_FAMILY, 4);
  // Increased timeouts for production reliability (30s connection, 30s greeting, 45s socket)
  const connectionTimeout = normalizeNumber(process.env.SMTP_CONNECTION_TIMEOUT_MS, 30000);
  const greetingTimeout = normalizeNumber(process.env.SMTP_GREETING_TIMEOUT_MS, 30000);
  const socketTimeout = normalizeNumber(process.env.SMTP_SOCKET_TIMEOUT_MS, 45000);
  const pool = normalizeBoolean(process.env.SMTP_POOL, true);
  const maxConnections = normalizeNumber(process.env.SMTP_MAX_CONNECTIONS, 5);

  return {
    host,
    service,
    user,
    pass,
    port,
    secure,
    family,
    connectionTimeout,
    greetingTimeout,
    socketTimeout,
    pool,
    maxConnections,
  };
};

const getExplicitEmailProvider = () => {
  const explicitProvider = String(process.env.EMAIL_PROVIDER || "").trim().toLowerCase();
  if (["smtp", "gmail", "googlemail", "outlook", "hotmail"].includes(explicitProvider)) {
    return "smtp";
  }
  if (explicitProvider === "sendgrid") return "sendgrid";
  return "";
};

const getEmailProvider = () => {
  const explicitProvider = getExplicitEmailProvider();
  if (explicitProvider) return explicitProvider;

  if (canUseSmtp()) {
    return "smtp";
  }

  return canUseSendGrid() ? "sendgrid" : "";
};

const buildUnsafeSendGridSenderError = (senderEmail) => {
  const senderDomain = extractDomainFromEmail(senderEmail) || "this mailbox domain";
  const err = new Error(
    [
      `Failed to send email: "${senderEmail}" cannot be used as a SendGrid From address.`,
      `Inbox providers require SPF/DKIM alignment for ${senderDomain}.`,
      "Use SMTP for this mailbox or switch EMAIL_FROM_EMAIL to an authenticated custom-domain sender such as noreply@yourdomain.com.",
    ].join(" ")
  );
  err.statusCode = 503;
  err.code = "EEMAILALIGNMENT";
  return err;
};

const buildSmtpTransportCacheKey = (smtpConfig) =>
  [
    String(smtpConfig.service || "").trim().toLowerCase(),
    String(smtpConfig.host || "").trim().toLowerCase(),
    Number(smtpConfig.port || 0),
    smtpConfig.secure ? "secure" : "starttls",
    smtpConfig.requireTLS ? "requiretls" : "optional",
    String(smtpConfig.user || "").trim().toLowerCase(),
  ].join("::");

const isGmailSmtpConfig = (smtpConfig) => {
  const normalizedService = String(smtpConfig?.service || "").trim().toLowerCase();
  const normalizedHost = String(smtpConfig?.host || "").trim().toLowerCase();
  return (
    normalizedService === "gmail" ||
    normalizedService === "googlemail" ||
    normalizedHost === "smtp.gmail.com"
  );
};

const resolveSmtpProfiles = () => {
  const smtpConfig = getSmtpConfig();
  const preferredHost = smtpConfig.host || (isGmailSmtpConfig(smtpConfig) ? "smtp.gmail.com" : "");
  const normalizedConfig = {
    ...smtpConfig,
    service: preferredHost ? "" : smtpConfig.service,
    host: preferredHost,
  };
  const profiles = [];

  if (isGmailSmtpConfig(normalizedConfig)) {
    const gmailHost = normalizedConfig.host || "smtp.gmail.com";
    const useSecurePort = Number(normalizedConfig.port || 0) === 465 || normalizedConfig.secure;

    profiles.push({
      ...normalizedConfig,
      service: "",
      host: gmailHost,
      port: useSecurePort ? 465 : 587,
      secure: useSecurePort,
      requireTLS: !useSecurePort,
      pool: false,
      maxConnections: 1,
      label: useSecurePort ? "smtp-gmail-ssl-primary" : "smtp-gmail-starttls-primary",
      useCache: true,
    });
  } else {
    profiles.push({
      ...normalizedConfig,
      requireTLS: !normalizedConfig.secure,
      label: normalizedConfig.secure ? "smtp-primary-secure" : "smtp-primary-starttls",
      useCache: true,
    });
  }

  return Array.from(
    new Map(
      profiles.map((profile) => [buildSmtpTransportCacheKey(profile), profile])
    ).values()
  );
};

const expandSmtpProfilesForConnection = async (smtpProfiles) => {
  const expandedProfiles = [];

  for (const profile of smtpProfiles) {
    const normalizedHost = String(profile?.host || "").trim();
    const shouldResolveIpv4 = Boolean(normalizedHost) && Number(profile?.family || 0) === 4;

    if (!shouldResolveIpv4) {
      expandedProfiles.push(profile);
      continue;
    }

    try {
      const ipv4Addresses = (await dnsPromises.resolve4(normalizedHost)).slice(
        0,
        MAX_RESOLVED_SMTP_ADDRESSES
      );
      if (!ipv4Addresses.length) {
        if (!shouldResolveIpv4) {
          expandedProfiles.push(profile);
        }
        continue;
      }

      expandedProfiles.push(
        ...ipv4Addresses.map((address, index) => ({
          ...profile,
          service: "",
          host: address,
          tlsServername: normalizedHost,
          label: `${profile.label || "smtp"}-ipv4-${index + 1}`,
          useCache: false,
        }))
      );
    } catch (error) {
      console.warn(
        `Could not resolve IPv4 address for SMTP host "${normalizedHost}".`
      );
      if (!shouldResolveIpv4) {
        expandedProfiles.push(profile);
      }
    }
  }

  return expandedProfiles;
};

const createSmtpTransporter = (smtpProfile = {}, { useCache = true } = {}) => {
  const smtpConfig = { ...getSmtpConfig(), ...smtpProfile };

  if ((!smtpConfig.host && !smtpConfig.service) || !smtpConfig.user || !smtpConfig.pass) {
    const err = new Error("Missing SMTP configuration");
    err.statusCode = 500;
    throw err;
  }

  const cacheKey = buildSmtpTransportCacheKey(smtpConfig);
  if (useCache && smtpTransporters.has(cacheKey)) {
    return smtpTransporters.get(cacheKey);
  }

  const transportOptions = {
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    requireTLS: Boolean(smtpConfig.requireTLS),
    family: smtpConfig.family,
    connectionTimeout: smtpConfig.connectionTimeout,
    greetingTimeout: smtpConfig.greetingTimeout,
    socketTimeout: smtpConfig.socketTimeout,
    pool: smtpConfig.pool,
    maxConnections: smtpConfig.maxConnections,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 14, // 14 messages per second max
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
  };

  if (smtpConfig.service) {
    transportOptions.service = smtpConfig.service;
  } else {
    transportOptions.host = smtpConfig.host;
    transportOptions.tls = {
      servername: smtpConfig.tlsServername || smtpConfig.host,
    };
  }

  const transporter = nodemailer.createTransport(transportOptions);
  if (useCache) {
    smtpTransporters.set(cacheKey, transporter);
  }

  return transporter;
};

const getSmtpErrorMessage = (error) => {
  const code = String(error?.code || "").trim().toUpperCase();

  if (code === "ETIMEDOUT") {
    return "SMTP connection timed out. Please retry in a few minutes.";
  }
  if (code === "ENETUNREACH" || code === "EHOSTUNREACH") {
    return "SMTP network is temporarily unreachable. Please retry in a few minutes.";
  }
  return String(error?.message || "").trim();
};

const isSmtpConnectionError = (error) => {
  const code = String(error?.code || "").trim().toUpperCase();

  return SMTP_CONNECTION_ERROR_CODES.has(code) || hasTransientConnectionMessage(error);
};

const normalizeOptionalNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const resolveSmtpDeliveryOptions = (options = {}) => {
  const deliveryProfile = String(options?.deliveryProfile || "").trim().toLowerCase();

  if (deliveryProfile === "interactive") {
    return {
      // OTP and password reset emails should still favor responsiveness, but
      // Render-to-Gmail SMTP handshakes can exceed the previous low ceiling.
      maxElapsedMs: 20000,
      maxProfiles: 1,
      retryAttempts: 1,
      retryDelayMs: 500,
      smtpOverrides: {
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        pool: false,
        maxConnections: 1,
      },
    };
  }

  return {
    maxElapsedMs: normalizeOptionalNumber(options?.maxElapsedMs),
    maxProfiles: normalizeOptionalNumber(options?.maxProfiles),
    retryAttempts: normalizeOptionalNumber(options?.retryAttempts),
    retryDelayMs: normalizeOptionalNumber(options?.retryDelayMs) || 2000,
    smtpOverrides: {},
  };
};

/**
 * Retry logic with exponential backoff for transient email delivery failures
 * @param {Function} fn - Async function to retry
 * @param {number} maxAttempts - Maximum number of attempts
 * @param {number} initialDelayMs - Initial delay in milliseconds
 * @returns {Promise<any>}
 */
const retryWithBackoff = async (fn, maxAttempts = 3, initialDelayMs = 1000) => {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isTransient = isSmtpConnectionError(error);

      if (!isTransient || attempt === maxAttempts) {
        throw error;
      }

      const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
      console.warn(
        `Email delivery attempt ${attempt} failed (${error?.code || error?.message}). Retrying in ${delayMs}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
};


const sendWithSendGrid = async ({
  to,
  subject,
  text,
  html,
  attachments,
  senderEmail,
  senderName,
  replyTo,
  customArgs,
}) => {
  warnIfSenderLooksUnsafe(senderEmail, replyTo);

  return sgMail.send({
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
    customArgs,
  });
};

const sendEmail = async (to, subject, html, options = {}) => {
  const explicitProvider = getExplicitEmailProvider();
  const configuredProvider = getEmailProvider();
  const senderName = process.env.EMAIL_FROM_NAME || "EventMate";
  const senderEmail =
    process.env.EMAIL_FROM_EMAIL ||
    process.env.SMTP_FROM_EMAIL ||
    process.env.EMAIL_USERNAME ||
    process.env.SMTP_USER;
  const replyTo = process.env.EMAIL_REPLY_TO || senderEmail;
  const attachments = Array.isArray(options?.attachments) ? options.attachments : [];
  const text = String(options?.text || htmlToPlainText(html)).trim();
  const sendGridCustomArgs =
    options?.sendGridCustomArgs && typeof options.sendGridCustomArgs === "object"
      ? Object.fromEntries(
          Object.entries(options.sendGridCustomArgs)
            .map(([key, value]) => [String(key).trim(), String(value ?? "").trim()])
            .filter(([key, value]) => key && value)
        )
      : undefined;

  if (!senderEmail) {
    const err = new Error("Missing sender email configuration");
    err.statusCode = 500;
    throw err;
  }

  if (!configuredProvider) {
    const err = new Error("Missing email provider configuration");
    err.statusCode = 500;
    throw err;
  }

  const senderUsesConsumerMailbox = isConsumerMailboxDomain(senderEmail);
  const smtpConfigured = canUseSmtp();
  let emailProvider = configuredProvider;

  // Consumer mailbox domains such as Gmail must not go through SendGrid unless
  // the sender domain is authenticated there. Prefer SMTP for those mailboxes.
  if (senderUsesConsumerMailbox && emailProvider === "sendgrid" && smtpConfigured) {
    emailProvider = "smtp";
    console.warn(
      `Consumer mailbox sender "${senderEmail}" detected. Routing email through SMTP instead of SendGrid to avoid DMARC alignment failures.`
    );
  }

  const shouldUseSendGrid = emailProvider === "sendgrid";

  if (shouldUseSendGrid && senderUsesConsumerMailbox) {
    warnIfSenderLooksUnsafe(senderEmail, replyTo);
    if (!smtpConfigured) {
      throw buildUnsafeSendGridSenderError(senderEmail);
    }
  }

  if (shouldUseSendGrid) {
    try {
      const [response] = await retryWithBackoff(
        () =>
          sendWithSendGrid({
            to,
            subject,
            text,
            html,
            attachments,
            senderEmail,
            senderName,
            replyTo,
            customArgs: sendGridCustomArgs,
          }),
        3,
        1000
      );
      return response;
    } catch (error) {
      console.error("SendGrid Error (Primary):", error.response?.body || error);
      const providerMessage = getSendGridErrorMessage(error);
      const alignmentFailure =
        providerMessage.includes("4.7.32") ||
        /dmarc|alignment|spf|dkim/i.test(providerMessage);

      if (smtpConfigured && alignmentFailure) {
        console.warn("SendGrid delivery failed due to sender alignment. Falling back to SMTP.");
        emailProvider = "smtp";
      } else {
        const err = new Error(
          providerMessage
            ? `Failed to send email: ${providerMessage}`
            : "Failed to send email"
        );
        err.statusCode = 503;
        throw err;
      }
    }
  }

  if (emailProvider === "smtp") {
    const smtpDeliveryOptions = resolveSmtpDeliveryOptions(options);
    let smtpProfiles = await expandSmtpProfilesForConnection(resolveSmtpProfiles());
    smtpProfiles = smtpProfiles.map((profile) => ({
      ...profile,
      ...smtpDeliveryOptions.smtpOverrides,
    }));
    if (smtpDeliveryOptions.maxProfiles) {
      smtpProfiles = smtpProfiles.slice(0, smtpDeliveryOptions.maxProfiles);
    }
    let lastSmtpError = null;
    const startedAt = Date.now();

    if (!smtpProfiles.length) {
      lastSmtpError = new Error("SMTP host could not be resolved over IPv4.");
      lastSmtpError.code = "ENETUNREACH";
    }

    for (let index = 0; index < smtpProfiles.length; index += 1) {
      const elapsedMs = Date.now() - startedAt;
      if (smtpDeliveryOptions.maxElapsedMs && elapsedMs >= smtpDeliveryOptions.maxElapsedMs) {
        break;
      }

      const smtpProfile = { ...smtpProfiles[index] };
      if (smtpDeliveryOptions.maxElapsedMs) {
        const remainingMs = Math.max(1500, smtpDeliveryOptions.maxElapsedMs - elapsedMs);
        smtpProfile.connectionTimeout = Math.max(
          1500,
          Math.min(Number(smtpProfile.connectionTimeout || 0) || remainingMs, remainingMs)
        );
        smtpProfile.greetingTimeout = Math.max(
          1500,
          Math.min(Number(smtpProfile.greetingTimeout || 0) || remainingMs, remainingMs)
        );
        smtpProfile.socketTimeout = Math.max(
          3000,
          Math.min(Number(smtpProfile.socketTimeout || 0) || remainingMs, remainingMs)
        );
      }

      try {
        const transporter = createSmtpTransporter(smtpProfile, {
          useCache: smtpProfile.useCache !== false,
        });
        const retryAttempts = smtpDeliveryOptions.retryAttempts || (index === 0 ? 2 : 1);
        const retryDelayMs = smtpDeliveryOptions.retryDelayMs || 2000;
        const smtpResult = await retryWithBackoff(
          () =>
            transporter.sendMail({
              to,
              from: {
                name: senderName,
                address: senderEmail,
              },
              replyTo,
              subject,
              text,
              html,
              attachments,
            }),
          retryAttempts,
          retryDelayMs
        );
        return smtpResult;
      } catch (error) {
        lastSmtpError = error;
        console.error(`SMTP Error (${smtpProfile.label || `profile-${index + 1}`}):`, error);

        const hasFallbackProfile = index < smtpProfiles.length - 1;
        const timedOut =
          smtpDeliveryOptions.maxElapsedMs &&
          Date.now() - startedAt >= smtpDeliveryOptions.maxElapsedMs;
        if (hasFallbackProfile && isSmtpConnectionError(error) && !timedOut) {
          console.warn(
            `SMTP profile "${smtpProfile.label || index + 1}" failed. Trying alternate SMTP settings.`
          );
          continue;
        }

        break;
      }
    }

    if (!lastSmtpError && smtpDeliveryOptions.maxElapsedMs) {
      lastSmtpError = new Error("SMTP connection timed out.");
      lastSmtpError.code = "ETIMEDOUT";
    }

    const providerMessage = getSmtpErrorMessage(lastSmtpError);
    const err = new Error(
      providerMessage
        ? `Failed to send email: ${providerMessage}`
        : "Failed to send email"
    );
    err.statusCode = 503;
    throw err;
  }

  // Final fallback: use SendGrid only when it is the only configured provider.
  if (!canUseSendGrid()) {
    const err = new Error("Missing email provider configuration");
    err.statusCode = 500;
    throw err;
  }

  if (senderUsesConsumerMailbox) {
    warnIfSenderLooksUnsafe(senderEmail, replyTo);
    throw buildUnsafeSendGridSenderError(senderEmail);
  }

  try {
    const [fallbackResponse] = await sendWithSendGrid({
      to,
      subject,
      text,
      html,
      attachments,
      senderEmail,
      senderName,
      replyTo,
      customArgs: sendGridCustomArgs,
    });
    return fallbackResponse;
  } catch (error) {
    console.error("SendGrid Error (Fallback):", error.response?.body || error);

    const providerMessage = getSendGridErrorMessage(error);
    const err = new Error(
      providerMessage
        ? `Failed to send email: ${providerMessage}`
        : "Failed to send email"
    );
    err.statusCode = 503;
    throw err;
  }
};

export default sendEmail;
