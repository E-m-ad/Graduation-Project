import nodemailer from "nodemailer";

let transporterPromise = null;
let transportVerificationPromise = null;
const EMAIL_OPERATION_TIMEOUT_MS = 10000;

function parseBoolean(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function getConnectionUrl() {
  return process.env.SMTP_CONNECTION_URL?.trim() || "";
}

function getSmtpFieldConfig() {
  return {
    host: process.env.SMTP_HOST?.trim() || "",
    port: Number(process.env.SMTP_PORT),
    user: process.env.SMTP_USER?.trim() || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM?.trim() || "",
    secure: parseBoolean(process.env.SMTP_SECURE),
  };
}

function createTimeoutError(label) {
  const error = new Error(`${label} timed out after ${EMAIL_OPERATION_TIMEOUT_MS}ms`);
  error.code = "ETIMEDOUT";
  return error;
}

async function withTimeout(promise, label) {
  let timeoutId;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(createTimeoutError(label)),
          EMAIL_OPERATION_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

export function hasEmailTransportConfig() {
  const connectionUrl = getConnectionUrl();
  const smtp = getSmtpFieldConfig();

  return Boolean(
    smtp.from &&
      (connectionUrl || (smtp.host && smtp.port && smtp.user && smtp.pass)),
  );
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
  if (!hasEmailTransportConfig()) {
    return null;
  }

  if (!transporterPromise) {
    transporterPromise = Promise.resolve(
      nodemailer.createTransport(buildTransportOptions()),
    );
  }

  return transporterPromise;
}

export async function verifyEmailTransport() {
  const transporter = await getTransporter();
  if (!transporter) {
    return {
      configured: false,
      verified: false,
    };
  }

  if (!transportVerificationPromise) {
    transportVerificationPromise = withTimeout(
      transporter.verify().then(() => true),
      "SMTP transport verification",
    );
  }

  await transportVerificationPromise;

  return {
    configured: true,
    verified: true,
  };
}

export async function sendEmail({ to, subject, text, html }) {
  const transporter = await getTransporter();
  if (!transporter) {
    return {
      sent: false,
      skipped: true,
    };
  }

  try {
    const info = await withTimeout(
      transporter.sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject,
        text,
        html,
      }),
      `SMTP send to ${to}`,
    );

    return {
      sent: true,
      skipped: false,
      messageId: info.messageId || null,
      error: null,
    };
  } catch (error) {
    console.error("sendEmail error:", error);

    return {
      sent: false,
      skipped: false,
      messageId: null,
      error,
    };
  }
}
