import nodemailer from "nodemailer";

let transporterPromise = null;
let transportVerificationPromise = null;
const DEFAULT_EMAIL_VERIFY_TIMEOUT_MS = 10000;
const DEFAULT_EMAIL_SEND_TIMEOUT_MS = 15000;
const DEFAULT_SMTP_CONNECTION_TIMEOUT_MS = 10000;
const DEFAULT_SMTP_GREETING_TIMEOUT_MS = 10000;
const DEFAULT_SMTP_SOCKET_TIMEOUT_MS = 20000;
const DEFAULT_SMTP_DNS_TIMEOUT_MS = 10000;
const DEFAULT_RESEND_API_BASE_URL = "https://api.resend.com";

function parseBoolean(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function parsePositiveInteger(value, fallback) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return Math.trunc(parsedValue);
}

function getConnectionUrl() {
  return process.env.SMTP_CONNECTION_URL?.trim() || "";
}

function getEmailFromAddress() {
  return process.env.SMTP_FROM?.trim() || "";
}

function getEmailVerifyTimeoutMs() {
  return parsePositiveInteger(
    process.env.EMAIL_VERIFY_TIMEOUT_MS,
    DEFAULT_EMAIL_VERIFY_TIMEOUT_MS,
  );
}

function getEmailSendTimeoutMs() {
  return parsePositiveInteger(
    process.env.EMAIL_SEND_TIMEOUT_MS,
    DEFAULT_EMAIL_SEND_TIMEOUT_MS,
  );
}

function getSmtpFieldConfig() {
  return {
    host: process.env.SMTP_HOST?.trim() || "",
    port: Number(process.env.SMTP_PORT),
    user: process.env.SMTP_USER?.trim() || "",
    pass: process.env.SMTP_PASS || "",
    from: getEmailFromAddress(),
    secure: parseBoolean(process.env.SMTP_SECURE),
    connectionTimeout: parsePositiveInteger(
      process.env.SMTP_CONNECTION_TIMEOUT_MS,
      DEFAULT_SMTP_CONNECTION_TIMEOUT_MS,
    ),
    greetingTimeout: parsePositiveInteger(
      process.env.SMTP_GREETING_TIMEOUT_MS,
      DEFAULT_SMTP_GREETING_TIMEOUT_MS,
    ),
    socketTimeout: parsePositiveInteger(
      process.env.SMTP_SOCKET_TIMEOUT_MS,
      DEFAULT_SMTP_SOCKET_TIMEOUT_MS,
    ),
    dnsTimeout: parsePositiveInteger(
      process.env.SMTP_DNS_TIMEOUT_MS,
      DEFAULT_SMTP_DNS_TIMEOUT_MS,
    ),
  };
}

function getResendConfig() {
  return {
    apiKey: process.env.RESEND_API_KEY?.trim() || "",
    apiBaseUrl:
      process.env.RESEND_API_BASE_URL?.trim() || DEFAULT_RESEND_API_BASE_URL,
    from: getEmailFromAddress(),
  };
}

function createTimeoutError(label, timeoutMs) {
  const error = new Error(`${label} timed out after ${timeoutMs}ms`);
  error.code = "ETIMEDOUT";
  return error;
}

async function withTimeout(promise, label, timeoutMs) {
  let timeoutId;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(createTimeoutError(label, timeoutMs)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithTimeout(url, options, label, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw createTimeoutError(label, timeoutMs);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function safeParseResponseBody(response) {
  const rawText = await response.text();
  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return rawText;
  }
}

function hasSmtpConfig() {
  const connectionUrl = getConnectionUrl();
  const smtp = getSmtpFieldConfig();

  return Boolean(
    smtp.from &&
      (connectionUrl || (smtp.host && smtp.port && smtp.user && smtp.pass)),
  );
}

function hasResendConfig() {
  const resend = getResendConfig();

  return Boolean(resend.apiKey && resend.from);
}

export function getEmailTransportProvider() {
  if (hasResendConfig()) {
    return "resend";
  }

  if (hasSmtpConfig()) {
    return "smtp";
  }

  return "none";
}

export function hasEmailTransportConfig() {
  return getEmailTransportProvider() !== "none";
}

function buildTransportOptions() {
  const connectionUrl = getConnectionUrl();
  if (connectionUrl) {
    return connectionUrl;
  }

  const smtp = getSmtpFieldConfig();

  return {
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    connectionTimeout: smtp.connectionTimeout,
    greetingTimeout: smtp.greetingTimeout,
    socketTimeout: smtp.socketTimeout,
    dnsTimeout: smtp.dnsTimeout,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  };
}

export function resetEmailTransport() {
  transporterPromise = null;
  transportVerificationPromise = null;
}

async function getTransporter() {
  if (!hasSmtpConfig()) {
    return null;
  }

  if (!transporterPromise) {
    transporterPromise = Promise.resolve(
      nodemailer.createTransport(buildTransportOptions()),
    );
  }

  return transporterPromise;
}

async function verifyResendTransport() {
  const resend = getResendConfig();

  if (!hasResendConfig()) {
    return {
      configured: false,
      verified: false,
      provider: "resend",
    };
  }

  const response = await fetchWithTimeout(
    `${resend.apiBaseUrl}/domains`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${resend.apiKey}`,
      },
    },
    "Resend transport verification",
    getEmailVerifyTimeoutMs(),
  );

  if (!response.ok) {
    const payload = await safeParseResponseBody(response);
    const error = new Error(
      `Resend transport verification failed with ${response.status} ${response.statusText}`,
    );
    error.code = "ERESEND_VERIFY";
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return {
    configured: true,
    verified: true,
    provider: "resend",
  };
}

export async function verifyEmailTransport() {
  const provider = getEmailTransportProvider();

  if (provider === "none") {
    return {
      configured: false,
      verified: false,
      provider: "none",
    };
  }

  if (!transportVerificationPromise) {
    transportVerificationPromise =
      provider === "resend"
        ? verifyResendTransport().catch((error) => {
            resetEmailTransport();
            throw error;
          })
        : (async () => {
            const transporter = await getTransporter();

            await withTimeout(
              transporter.verify().then(() => true),
              "SMTP transport verification",
              getEmailVerifyTimeoutMs(),
            );

            return {
              configured: true,
              verified: true,
              provider: "smtp",
            };
          })().catch((error) => {
            resetEmailTransport();
            throw error;
          });
  }

  return transportVerificationPromise;
}

function isRailwayEnvironment() {
  return Boolean(
    process.env.RAILWAY_ENVIRONMENT_ID ||
      process.env.RAILWAY_PROJECT_ID ||
      process.env.RAILWAY_PUBLIC_DOMAIN,
  );
}

function logRailwaySmtpHint(error) {
  if (
    error?.code === "ETIMEDOUT" &&
    isRailwayEnvironment() &&
    !hasResendConfig()
  ) {
    console.error(
      "Railway SMTP hint: Railway's Resend SMTP Gateway template says Railway doesn't provide an SMTP gateway for non-PRO accounts. Configure RESEND_API_KEY and keep SMTP_FROM as the sender identity to deliver mail over HTTPS instead of direct Gmail SMTP.",
    );
  }
}

async function sendWithResend({ to, subject, text, html }) {
  const resend = getResendConfig();
  const payload = {
    from: resend.from,
    to: Array.isArray(to) ? to : [to],
    subject,
  };

  if (text !== undefined) {
    payload.text = text;
  }

  if (html !== undefined) {
    payload.html = html;
  }

  const response = await fetchWithTimeout(
    `${resend.apiBaseUrl}/emails`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resend.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    `Resend send to ${Array.isArray(to) ? to.join(", ") : to}`,
    getEmailSendTimeoutMs(),
  );

  const responseBody = await safeParseResponseBody(response);
  if (!response.ok) {
    const error = new Error(
      `Resend send failed with ${response.status} ${response.statusText}`,
    );
    error.code = "ERESEND_SEND";
    error.status = response.status;
    error.payload = responseBody;
    throw error;
  }

  return {
    sent: true,
    skipped: false,
    messageId:
      responseBody && typeof responseBody === "object" ? responseBody.id || null : null,
    error: null,
    provider: "resend",
  };
}

async function sendWithSmtp({ to, subject, text, html }) {
  const transporter = await getTransporter();

  if (!transporter) {
    return {
      sent: false,
      skipped: true,
      provider: "smtp",
    };
  }

  const info = await withTimeout(
    transporter.sendMail({
      from: getEmailFromAddress(),
      to,
      subject,
      text,
      html,
    }),
    `SMTP send to ${to}`,
    getEmailSendTimeoutMs(),
  );

  return {
    sent: true,
    skipped: false,
    messageId: info.messageId || null,
    error: null,
    provider: "smtp",
  };
}

export async function sendEmail({ to, subject, text, html }) {
  const provider = getEmailTransportProvider();

  if (provider === "none") {
    return {
      sent: false,
      skipped: true,
      provider: "none",
    };
  }

  try {
    return provider === "resend"
      ? await sendWithResend({ to, subject, text, html })
      : await sendWithSmtp({ to, subject, text, html });
  } catch (error) {
    console.error("sendEmail error:", error);
    logRailwaySmtpHint(error);
    resetEmailTransport();

    return {
      sent: false,
      skipped: false,
      messageId: null,
      error,
      provider,
    };
  }
}
