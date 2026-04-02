import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import db from "../../src/database/db.js";
import { startServer } from "../../src/app.js";

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
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;
  const log = (message) => {
    console.log(`[${label}] ${message}`);
  };

  return {
    label,
    log,
    port,
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
  let runError = null;

  try {
    context.log("Cleaning old QA fixtures");
    await cleanupQaData();

    context.log(`Starting server on port ${context.port}`);
    server = startServer(context.port);
    await waitForServer(context.baseUrl);
    context.log("Server is ready");

    return await run({ ...context, server });
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
