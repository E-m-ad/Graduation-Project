import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { SMTPServer } from "smtp-server";
import db from "../../src/database/db.js";
import { startServer } from "../../src/app.js";
import { resetEmailTransport } from "../../src/utils/email.js";
import { isEmailVerificationEnabled } from "../../src/utils/runtime-config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../..");

export const QA_PREFIX = "qa-";
export const PASSWORDS = Object.freeze({
  primary: "Password1",
  secondary: "Password2",
  reset: "Password3",
});
export const TINY_PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sotWb8AAAAASUVORK5CYII=",
  "base64",
);

export function createTestContext(label) {
  const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const runPrefix = `${QA_PREFIX}${label}-${runId}`;
  const port = 3100 + Math.floor(Math.random() * 500);
  const smtpPort = 3600 + Math.floor(Math.random() * 500);
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;
  const log = (message) => {
    console.log(`[${label}] ${message}`);
  };

  return {
    label,
    log,
    port,
    smtpPort,
    baseUrl,
    runPrefix,
  };
}

export function formatPayload(payload) {
  if (payload === undefined) {
    return "";
  }

  if (typeof payload === "string") {
    return payload;
  }

  return JSON.stringify(payload, null, 2);
}

export function assert(condition, message, payload) {
  if (!condition) {
    throw new Error(
      payload === undefined
        ? message
        : `${message}\n${formatPayload(payload)}`,
    );
  }
}

function normalizeEmailContent(raw) {
  return String(raw || "")
    .replace(/=\r?\n/g, "")
    .replace(/=3D/g, "=");
}

export function extractVerificationLink(raw) {
  const normalized = normalizeEmailContent(raw);
  const match = normalized.match(
    /https?:\/\/[^\s<>"']+\/html\/verify-email\.html\?token=[a-f0-9]+/i,
  );

  return match?.[0] || null;
}

async function waitForCondition(check, timeoutMs = 5000, intervalMs = 50) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = check();
    if (result) {
      return result;
    }

    await delay(intervalMs);
  }

  return null;
}

async function startSmtpTestServer(context) {
  const messages = [];

  const server = new SMTPServer({
    disabledCommands: ["STARTTLS"],
    authOptional: false,
    onAuth(auth, session, callback) {
      callback(null, {
        user: auth.username || session.envelope.mailFrom?.address || "qa-user",
      });
    },
    onData(stream, session, callback) {
      const chunks = [];

      stream.on("data", (chunk) => {
        chunks.push(chunk);
      });

      stream.on("end", () => {
        messages.push({
          createdAt: new Date().toISOString(),
          envelope: {
            from: session.envelope.mailFrom?.address || "",
            to: session.envelope.rcptTo?.map((entry) => entry.address) || [],
          },
          raw: Buffer.concat(chunks).toString("utf8"),
        });
        callback(null);
      });
    },
  });

  await new Promise((resolve, reject) => {
    server.listen(context.smtpPort, "127.0.0.1", (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

  const mailbox = {
    messages,
    async waitForMessage(predicate, timeoutMs = 5000) {
      return waitForCondition(
        () => messages.find((message) => predicate(message)) || null,
        timeoutMs,
      );
    },
    async waitForCount(count, timeoutMs = 5000) {
      return waitForCondition(
        () => (messages.length >= count ? messages.length : null),
        timeoutMs,
      );
    },
  };

  return {
    mailbox,
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    },
  };
}

async function removeUpload(uploadUrl) {
  if (!uploadUrl || !uploadUrl.startsWith("/uploads/")) {
    return;
  }

  const filePath = path.resolve(ROOT_DIR, uploadUrl.replace(/^\//, ""));

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

async function deleteManyIf(model, where) {
  if (!where) {
    return;
  }

  await model.deleteMany({ where });
}

function setEnvValue(key, value) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

export async function cleanupQaData(prefix = QA_PREFIX) {
  const users = await db.user.findMany({
    where: {
      email: {
        startsWith: prefix,
      },
    },
    select: {
      id: true,
      avatarUrl: true,
    },
  });
  const userIds = users.map((user) => user.id);

  const categories = await db.category.findMany({
    where: {
      name: {
        startsWith: prefix,
      },
    },
    select: {
      id: true,
    },
  });
  const categoryIds = categories.map((category) => category.id);

  const productOr = [
    {
      title: {
        startsWith: prefix,
      },
    },
  ];

  if (userIds.length > 0) {
    productOr.push({
      ownerId: {
        in: userIds,
      },
    });
  }

  const products = await db.product.findMany({
    where: { OR: productOr },
    select: {
      id: true,
      images: {
        select: {
          imageUrl: true,
          thumbnailUrl: true,
        },
      },
    },
  });
  const productIds = products.map((product) => product.id);

  const rentalOr = [];
  if (productIds.length > 0) {
    rentalOr.push({
      productId: {
        in: productIds,
      },
    });
  }

  if (userIds.length > 0) {
    rentalOr.push({
      renterId: {
        in: userIds,
      },
    });
    rentalOr.push({
      ownerId: {
        in: userIds,
      },
    });
  }

  const rentals =
    rentalOr.length > 0
      ? await db.rental.findMany({
          where: { OR: rentalOr },
          select: {
            id: true,
          },
        })
      : [];
  const rentalIds = rentals.map((rental) => rental.id);

  const notificationOr = [];
  if (userIds.length > 0) {
    notificationOr.push({
      userId: {
        in: userIds,
      },
    });
  }

  if (rentalIds.length > 0) {
    notificationOr.push({
      rentalId: {
        in: rentalIds,
      },
    });
  }

  const behaviorOr = [];
  if (userIds.length > 0) {
    behaviorOr.push({
      userId: {
        in: userIds,
      },
    });
  }

  if (productIds.length > 0) {
    behaviorOr.push({
      productId: {
        in: productIds,
      },
    });
  }

  if (categoryIds.length > 0) {
    behaviorOr.push({
      categoryId: {
        in: categoryIds,
      },
    });
  }

  const wishlistOr = [];
  if (userIds.length > 0) {
    wishlistOr.push({
      userId: {
        in: userIds,
      },
    });
  }

  if (productIds.length > 0) {
    wishlistOr.push({
      productId: {
        in: productIds,
      },
    });
  }

  const reviewOr = [];
  if (userIds.length > 0) {
    reviewOr.push({
      reviewerId: {
        in: userIds,
      },
    });
  }

  if (productIds.length > 0) {
    reviewOr.push({
      productId: {
        in: productIds,
      },
    });
  }

  if (rentalIds.length > 0) {
    reviewOr.push({
      rentalId: {
        in: rentalIds,
      },
    });
  }

  await deleteManyIf(
    db.notification,
    notificationOr.length > 0 ? { OR: notificationOr } : null,
  );
  await deleteManyIf(
    db.userBehavior,
    behaviorOr.length > 0 ? { OR: behaviorOr } : null,
  );
  await deleteManyIf(
    db.wishlist,
    wishlistOr.length > 0 ? { OR: wishlistOr } : null,
  );
  await deleteManyIf(
    db.review,
    reviewOr.length > 0 ? { OR: reviewOr } : null,
  );
  await deleteManyIf(
    db.availabilityCalendar,
    productIds.length > 0
      ? {
          productId: {
            in: productIds,
          },
        }
      : null,
  );
  await deleteManyIf(
    db.productImage,
    productIds.length > 0
      ? {
          productId: {
            in: productIds,
          },
        }
      : null,
  );
  await deleteManyIf(
    db.rental,
    rentalIds.length > 0
      ? {
          id: {
            in: rentalIds,
          },
        }
      : null,
  );
  await deleteManyIf(
    db.product,
    productIds.length > 0
      ? {
          id: {
            in: productIds,
          },
        }
      : null,
  );
  await deleteManyIf(
    db.refreshToken,
    userIds.length > 0
      ? {
          userId: {
            in: userIds,
          },
        }
      : null,
  );
  await deleteManyIf(
    db.passwordResetToken,
    userIds.length > 0
      ? {
          userId: {
            in: userIds,
          },
        }
      : null,
  );
  await deleteManyIf(
    db.emailVerificationToken,
    userIds.length > 0
      ? {
          userId: {
            in: userIds,
          },
        }
      : null,
  );
  await deleteManyIf(
    db.user,
    userIds.length > 0
      ? {
          id: {
            in: userIds,
          },
        }
      : null,
  );
  await deleteManyIf(
    db.category,
    categoryIds.length > 0
      ? {
          id: {
            in: categoryIds,
          },
        }
      : null,
  );

  await Promise.all([
    ...users.map((user) => removeUpload(user.avatarUrl)),
    ...products.flatMap((product) =>
      product.images.flatMap((image) =>
        [image.imageUrl, image.thumbnailUrl].filter(Boolean).map(removeUpload),
      ),
    ),
  ]);
}

export class ApiClient {
  constructor(name, baseUrl) {
    this.name = name;
    this.baseUrl = baseUrl;
    this.accessToken = null;
    this.cookies = new Map();
  }

  setAccessToken(token) {
    this.accessToken = token;
  }

  getCookieHeader() {
    return [...this.cookies.entries()]
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }

  updateCookies(response) {
    const setCookies =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [];
    const fallbackSetCookie = response.headers.get("set-cookie");
    const cookieHeaders =
      setCookies.length > 0
        ? setCookies
        : fallbackSetCookie
          ? [fallbackSetCookie]
          : [];

    for (const cookieHeader of cookieHeaders) {
      const [pair] = cookieHeader.split(";");
      const separatorIndex = pair.indexOf("=");
      const name = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1);

      if (!name) {
        continue;
      }

      if (value === "") {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }
  }

  async request(method, pathName, options = {}) {
    const headers = { ...(options.headers ?? {}) };

    if (options.useAccessToken !== false && this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    const cookieHeader = options.cookieHeader ?? this.getCookieHeader();
    if (options.useCookies !== false && cookieHeader) {
      headers.Cookie = cookieHeader;
    }

    let body;
    if (options.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.json);
    } else if (options.form) {
      body = options.form;
    }

    const response = await fetch(`${this.baseUrl}${pathName}`, {
      method,
      headers,
      body,
    });

    this.updateCookies(response);

    const rawText = await response.text();
    let parsedBody = null;

    if (rawText) {
      try {
        parsedBody = JSON.parse(rawText);
      } catch {
        parsedBody = rawText;
      }
    }

    return {
      response,
      body: parsedBody,
    };
  }
}

export function createClient(context, name) {
  return new ApiClient(name, context.baseUrl);
}

export function expectStatus(result, expectedStatus, label) {
  assert(
    result.response.status === expectedStatus,
    `${label} expected status ${expectedStatus} but received ${result.response.status}`,
    result.body,
  );
}

export async function waitForServer(baseUrl) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/categories`);
      if (response.status < 500) {
        return;
      }
    } catch {
      // Ignore until the server is ready.
    }

    await delay(500);
  }

  throw new Error("Server did not become ready in time");
}

async function closeServer(server) {
  if (!server?.listening) {
    return;
  }

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

export async function withTestServer(context, run) {
  let server = null;
  let smtpServer = null;
  let runError = null;
  const emailVerificationEnabled = isEmailVerificationEnabled();
  const previousEmailEnv = {
    EMAIL_VERIFICATION_ENABLED: process.env.EMAIL_VERIFICATION_ENABLED,
    APP_BASE_URL: process.env.APP_BASE_URL,
    SMTP_CONNECTION_URL: process.env.SMTP_CONNECTION_URL,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_FROM: process.env.SMTP_FROM,
    SMTP_SECURE: process.env.SMTP_SECURE,
  };

  try {
    context.log("Cleaning old QA fixtures");
    await cleanupQaData();

    setEnvValue("APP_BASE_URL", `http://127.0.0.1:${context.port}`);
    setEnvValue(
      "EMAIL_VERIFICATION_ENABLED",
      previousEmailEnv.EMAIL_VERIFICATION_ENABLED,
    );
    setEnvValue("SMTP_CONNECTION_URL", undefined);

    if (emailVerificationEnabled) {
      context.log(`Starting SMTP test server on port ${context.smtpPort}`);
      smtpServer = await startSmtpTestServer(context);

      setEnvValue("SMTP_HOST", "127.0.0.1");
      setEnvValue("SMTP_PORT", String(context.smtpPort));
      setEnvValue("SMTP_USER", "qa-mailer");
      setEnvValue("SMTP_PASS", "qa-mailer-pass");
      setEnvValue("SMTP_FROM", "AI Rent QA <no-reply@example.com>");
      setEnvValue("SMTP_SECURE", "false");
    } else {
      setEnvValue("SMTP_HOST", undefined);
      setEnvValue("SMTP_PORT", undefined);
      setEnvValue("SMTP_USER", undefined);
      setEnvValue("SMTP_PASS", undefined);
      setEnvValue("SMTP_FROM", undefined);
      setEnvValue("SMTP_SECURE", undefined);
    }

    resetEmailTransport();

    context.log(`Starting server on port ${context.port}`);
    server = startServer(context.port);
    await waitForServer(context.baseUrl);
    context.log("Server is ready");

    return await run({
      ...context,
      server,
      emailInbox: smtpServer?.mailbox ?? null,
      emailVerificationEnabled,
    });
  } catch (error) {
    runError = error;
    throw error;
  } finally {
    if (server) {
      try {
        await closeServer(server);
      } catch (closeError) {
        if (runError) {
          console.error(`[${context.label}] Server shutdown error:`, closeError);
        } else {
          throw closeError;
        }
      }
    }

    if (smtpServer) {
      try {
        await smtpServer.close();
      } catch (closeError) {
        if (runError) {
          console.error(`[${context.label}] SMTP shutdown error:`, closeError);
        } else {
          throw closeError;
        }
      }
    }

    setEnvValue(
      "EMAIL_VERIFICATION_ENABLED",
      previousEmailEnv.EMAIL_VERIFICATION_ENABLED,
    );
    setEnvValue("APP_BASE_URL", previousEmailEnv.APP_BASE_URL);
    setEnvValue("SMTP_CONNECTION_URL", previousEmailEnv.SMTP_CONNECTION_URL);
    setEnvValue("SMTP_HOST", previousEmailEnv.SMTP_HOST);
    setEnvValue("SMTP_PORT", previousEmailEnv.SMTP_PORT);
    setEnvValue("SMTP_USER", previousEmailEnv.SMTP_USER);
    setEnvValue("SMTP_PASS", previousEmailEnv.SMTP_PASS);
    setEnvValue("SMTP_FROM", previousEmailEnv.SMTP_FROM);
    setEnvValue("SMTP_SECURE", previousEmailEnv.SMTP_SECURE);
    resetEmailTransport();

    try {
      context.log("Cleaning QA fixtures");
      await cleanupQaData();
    } catch (cleanupError) {
      if (runError) {
        console.error(`[${context.label}] Cleanup error:`, cleanupError);
      } else {
        throw cleanupError;
      }
    }
  }
}

export async function registerUser(
  guestClient,
  { label, name, email, password = PASSWORDS.primary },
) {
  const result = await guestClient.request("POST", "/auth/register", {
    json: {
      name,
      email,
      password,
      confirmPassword: password,
    },
    useCookies: false,
    useAccessToken: false,
  });
  expectStatus(result, 201, `Register ${label ?? email} user`);
  return result.body;
}

export async function verifyEmailToken(
  guestClient,
  token,
  label = "Verify email token",
) {
  const result = await guestClient.request("POST", "/auth/verify-email", {
    json: { token },
    useCookies: false,
    useAccessToken: false,
  });

  expectStatus(result, 200, label);
  return result.body;
}

export async function loginUser(
  client,
  email,
  password = PASSWORDS.primary,
) {
  const result = await client.request("POST", "/auth/login", {
    json: { email, password },
    useCookies: true,
    useAccessToken: false,
  });

  expectStatus(result, 200, `Login ${client.name}`);
  assert(
    result.body?.accessToken,
    `Login ${client.name} must return an access token`,
    result.body,
  );
  client.setAccessToken(result.body.accessToken);

  return result.body;
}

export function makeImageForm(fieldName, filename) {
  const form = new FormData();
  form.append(
    fieldName,
    new Blob([TINY_PNG_BUFFER], { type: "image/png" }),
    filename,
  );
  return form;
}

export function makeImagesForm(filenames) {
  const form = new FormData();

  for (const filename of filenames) {
    form.append(
      "images",
      new Blob([TINY_PNG_BUFFER], { type: "image/png" }),
      filename,
    );
  }

  return form;
}

export { db, delay };
