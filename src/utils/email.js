import nodemailer from "nodemailer";

let transporterPromise = null;

function parseBoolean(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

export function hasEmailTransportConfig() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM,
  );
}

async function getTransporter() {
  if (!hasEmailTransportConfig()) {
    return null;
  }

  if (!transporterPromise) {
    transporterPromise = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: parseBoolean(process.env.SMTP_SECURE),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return transporterPromise;
}

export async function sendEmail({ to, subject, text, html }) {
  const transporter = await getTransporter();
  if (!transporter) {
    return {
      sent: false,
      skipped: true,
    };
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text,
    html,
  });

  return {
    sent: true,
    skipped: false,
  };
}
