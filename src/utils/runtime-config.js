import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultUploadsRootDir = path.resolve(__dirname, "../../uploads");

function trimEnv(value) {
  return typeof value === "string" ? value.trim() : "";
}

function stripTrailingSlashes(value) {
  return value.replace(/\/+$/, "");
}

function normalizeUrl(value) {
  const trimmed = trimEnv(value);
  if (!trimmed) {
    return "";
  }

  try {
    return stripTrailingSlashes(new URL(trimmed).toString());
  } catch {
    return "";
  }
}

function normalizeOrigin(value) {
  const normalizedUrl = normalizeUrl(value);
  if (!normalizedUrl) {
    return "";
  }

  return new URL(normalizedUrl).origin;
}

function parseBooleanEnv(value) {
  const normalizedValue = trimEnv(value).toLowerCase();

  if (!normalizedValue) {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(normalizedValue);
}

export function isEmailVerificationEnabled(env = process.env) {
  return parseBooleanEnv(env.EMAIL_VERIFICATION_ENABLED);
}

export function normalizeUserVerification(user, env = process.env) {
  if (!user || isEmailVerificationEnabled(env)) {
    return user;
  }

  return {
    ...user,
    isVerified: true,
  };
}

export function getAppBaseUrl(env = process.env) {
  const configuredBaseUrl = normalizeUrl(env.APP_BASE_URL);
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  const railwayPublicDomain = trimEnv(env.RAILWAY_PUBLIC_DOMAIN)
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");

  if (railwayPublicDomain) {
    return `https://${railwayPublicDomain}`;
  }

  return "";
}

export function buildRequestBaseUrl(req, env = process.env) {
  const configuredBaseUrl = getAppBaseUrl(env);
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  const origin = trimEnv(req.get("origin"));
  if (origin) {
    return stripTrailingSlashes(origin);
  }

  return `${req.protocol}://${req.get("host")}`;
}

export function getAllowedCorsOrigins(env = process.env) {
  const origins = new Set();
  const appBaseUrl = getAppBaseUrl(env);

  if (appBaseUrl) {
    origins.add(new URL(appBaseUrl).origin);
  }

  const rawOrigins = trimEnv(env.CORS_ALLOWED_ORIGINS);
  if (rawOrigins) {
    rawOrigins
      .split(",")
      .map((entry) => normalizeOrigin(entry))
      .filter(Boolean)
      .forEach((origin) => origins.add(origin));
  }

  return [...origins];
}

export function isOriginAllowed(origin, env = process.env) {
  if (!origin) {
    return true;
  }

  if (trimEnv(env.NODE_ENV) !== "production") {
    return true;
  }

  return getAllowedCorsOrigins(env).includes(origin);
}

export function getUploadsRootDir(env = process.env) {
  const configuredRoot =
    trimEnv(env.UPLOADS_DIR) || trimEnv(env.RAILWAY_VOLUME_MOUNT_PATH);

  return path.resolve(configuredRoot || defaultUploadsRootDir);
}

export function getAvatarUploadsDir(env = process.env) {
  return path.join(getUploadsRootDir(env), "avatars");
}

export function getProductUploadsDir(env = process.env) {
  return path.join(getUploadsRootDir(env), "products");
}
