import nodemailer from "nodemailer";

let transporterPromise = null;
let transportVerificationPromise = null;

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
    transportVerificationPromise = transporter.verify().then(() => true);
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

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text,
    html,
  });

  return {
    sent: true,
    skipped: false,
    messageId: info.messageId || null,
  };
}
