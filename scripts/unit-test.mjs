import path from "node:path";
import authSchema from "../src/utils/auth.zod.js";
import productSchema from "../src/utils/product.zod.js";
import rentalSchema from "../src/utils/rental.zod.js";
import {
  getAiRecommenderTimeoutMs,
  getAiRecommenderUrl,
  getAllowedCorsOrigins,
  getAppBaseUrl,
  getUploadsRootDir,
  isOriginAllowed,
} from "../src/utils/runtime-config.js";
import wishlistSchema from "../src/utils/wishlist.zod.js";

const VALID_ID = "11111111-1111-4111-8111-111111111111";

function assert(condition, message, payload) {
  if (!condition) {
    throw new Error(
      payload === undefined
        ? message
        : `${message}\n${JSON.stringify(payload, null, 2)}`,
    );
  }
}

function log(message) {
  console.log(`[unit] ${message}`);
}

async function run() {
  log("Running isolated schema checks");

  const registerPayload = authSchema.registerSchema.parse({
    name: "Valid User",
    email: "valid.user@example.com",
    password: "Password1",
    confirmPassword: "Password1",
  });
  assert(
    registerPayload.email === "valid.user@example.com",
    "Register schema should accept a valid payload",
    registerPayload,
  );

  const mismatchedPasswords = authSchema.registerSchema.safeParse({
    name: "Mismatch User",
    email: "mismatch.user@example.com",
    password: "Password1",
    confirmPassword: "Password2",
  });
  assert(
    mismatchedPasswords.success === false,
    "Register schema should reject mismatched passwords",
  );
  assert(
    mismatchedPasswords.error.issues.some(
      (issue) =>
        issue.path.join(".") === "confirmPassword" &&
        issue.message === "Passwords do not match",
    ),
    "Register schema should report the confirmPassword mismatch",
    mismatchedPasswords.error.issues,
  );

  const verifyEmailPayload = authSchema.verifyEmailSchema.parse({
    token: "verification-token-value",
  });
  assert(
    verifyEmailPayload.token === "verification-token-value",
    "Verify email schema should accept a non-empty token",
    verifyEmailPayload,
  );

  const missingVerifyEmailToken = authSchema.verifyEmailSchema.safeParse({
    token: "",
  });
  assert(
    missingVerifyEmailToken.success === false,
    "Verify email schema should reject an empty token",
  );

  const requestEmailVerificationPayload =
    authSchema.requestEmailVerificationSchema.parse({
      email: "verify.me@example.com",
    });
  assert(
    requestEmailVerificationPayload.email === "verify.me@example.com",
    "Request email verification schema should accept a valid email payload",
    requestEmailVerificationPayload,
  );

  const productionEnvWithoutEmailVerification = authSchema.envProcessSchema.parse({
    NODE_ENV: "production",
    JWT_SECRET: "jwt-secret",
    REFRESH_TOKEN_SECRET: "refresh-secret",
    ACCESS_TOKEN_EXPIRATION: "15d",
    REFRESH_TOKEN_EXPIRATION: "7d",
    EMAIL_VERIFICATION_ENABLED: "false",
  });
  assert(
    productionEnvWithoutEmailVerification.EMAIL_VERIFICATION_ENABLED === "false",
    "Production env parsing should allow email verification to be disabled without SMTP settings",
    productionEnvWithoutEmailVerification,
  );

  const productionEnvWithResend = authSchema.envProcessSchema.parse({
    NODE_ENV: "production",
    JWT_SECRET: "jwt-secret",
    REFRESH_TOKEN_SECRET: "refresh-secret",
    ACCESS_TOKEN_EXPIRATION: "15d",
    REFRESH_TOKEN_EXPIRATION: "7d",
    EMAIL_VERIFICATION_ENABLED: "true",
    APP_BASE_URL: "https://rent.example.com",
    RESEND_API_KEY: "re_test_123",
    SMTP_FROM: "AI Rent <noreply@rent.example.com>",
  });
  assert(
    productionEnvWithResend.RESEND_API_KEY === "re_test_123",
    "Production env parsing should allow Resend to satisfy email delivery requirements",
    productionEnvWithResend,
  );

  const railwayRuntimeBaseUrl = getAppBaseUrl({
    RAILWAY_PUBLIC_DOMAIN: "demo-market.up.railway.app",
  });
  assert(
    railwayRuntimeBaseUrl === "https://demo-market.up.railway.app",
    "Runtime config should build the Railway public app URL automatically",
    railwayRuntimeBaseUrl,
  );

  const explicitBaseUrl = getAppBaseUrl({
    APP_BASE_URL: "https://rent.example.com/",
    RAILWAY_PUBLIC_DOMAIN: "demo-market.up.railway.app",
  });
  assert(
    explicitBaseUrl === "https://rent.example.com",
    "Runtime config should prefer APP_BASE_URL over Railway fallback",
    explicitBaseUrl,
  );

  const defaultAiRecommenderUrl = getAiRecommenderUrl({
    AI_RECOMMENDER_ENABLED: "true",
  });
  assert(
    defaultAiRecommenderUrl === "http://127.0.0.1:5050",
    "Runtime config should default the AI recommender URL when the feature is enabled",
    defaultAiRecommenderUrl,
  );

  const explicitAiRecommenderUrl = getAiRecommenderUrl({
    AI_RECOMMENDER_URL: "http://ai.internal:6000/",
  });
  assert(
    explicitAiRecommenderUrl === "http://ai.internal:6000",
    "Runtime config should normalize an explicit AI recommender URL",
    explicitAiRecommenderUrl,
  );

  const aiRecommenderTimeout = getAiRecommenderTimeoutMs({
    AI_RECOMMENDER_TIMEOUT_MS: "2500",
  });
  assert(
    aiRecommenderTimeout === 2500,
    "Runtime config should parse the AI recommender timeout",
    aiRecommenderTimeout,
  );

  const allowedOrigins = getAllowedCorsOrigins({
    NODE_ENV: "production",
    APP_BASE_URL: "https://rent.example.com",
    CORS_ALLOWED_ORIGINS: "https://admin.example.com/, https://portal.example.com/app",
  });
  assert(
    allowedOrigins.includes("https://rent.example.com") &&
      allowedOrigins.includes("https://admin.example.com") &&
      allowedOrigins.includes("https://portal.example.com"),
    "Runtime config should normalize allowed CORS origins",
    allowedOrigins,
  );

  assert(
    isOriginAllowed("https://rent.example.com", {
      NODE_ENV: "production",
      APP_BASE_URL: "https://rent.example.com",
    }) === true,
    "Production CORS should allow the app base URL origin",
  );

  assert(
    isOriginAllowed("https://blocked.example.com", {
      NODE_ENV: "production",
      APP_BASE_URL: "https://rent.example.com",
    }) === false,
    "Production CORS should reject origins outside the configured allowlist",
  );

  const platformVolumePath =
    process.platform === "win32" ? "D:/railway-volume" : "/data/railway-volume";
  const railwayUploadsRoot = getUploadsRootDir({
    RAILWAY_VOLUME_MOUNT_PATH: platformVolumePath,
  });
  assert(
    railwayUploadsRoot === path.resolve(platformVolumePath),
    "Runtime config should use the Railway volume mount as the upload root",
    railwayUploadsRoot,
  );

  const productPayload = productSchema.createProductSchema.parse({
    categoryId: VALID_ID,
    title: "Canon Lens",
    description: "Well maintained rental lens for focused unit validation.",
    pricePerDay: "250",
    securityDeposit: "100",
    city: " Cairo ",
    locationAddress: " 15 Example Street ",
    minRentalPeriod: "1",
    maxRentalPeriod: "7",
    tags: "camera, lens, qa",
  });
  assert(
    productPayload.pricePerDay === 250,
    "Create product schema should coerce numeric strings",
    productPayload,
  );
  assert(
    productPayload.securityDeposit === 100,
    "Security deposit should be converted to a number",
    productPayload,
  );
  assert(productPayload.city === "Cairo", "City should be trimmed", productPayload);
  assert(
    Array.isArray(productPayload.tags) && productPayload.tags.length === 3,
    "Comma-separated tags should be normalized into an array",
    productPayload,
  );

  const missingPrice = productSchema.createProductSchema.safeParse({
    categoryId: VALID_ID,
    title: "Tripod Stand",
    description: "Detailed product description without a rental price set.",
  });
  assert(
    missingPrice.success === false,
    "Create product schema should require at least one rental price",
  );
  assert(
    missingPrice.error.issues.some(
      (issue) =>
        issue.path.join(".") === "pricePerDay" &&
        issue.message === "At least one rental price must be provided",
    ),
    "Missing price validation should target pricePerDay",
    missingPrice.error.issues,
  );

  const updatePayload = productSchema.updateProductSchema.parse({
    city: " ",
    locationAddress: "",
    pricePerDay: "450",
    tags: "updated, qa",
  });
  assert(
    updatePayload.city === null,
    "Blank city should normalize to null on updates",
    updatePayload,
  );
  assert(
    updatePayload.locationAddress === null,
    "Blank address should normalize to null on updates",
    updatePayload,
  );
  assert(
    updatePayload.pricePerDay === 450,
    "Update schema should coerce price strings",
    updatePayload,
  );
  assert(
    Array.isArray(updatePayload.tags) && updatePayload.tags[0] === "updated",
    "Update schema should normalize string tags into an array",
    updatePayload,
  );

  const createRentalPayload = rentalSchema.createRentalSchema.parse({
    productId: VALID_ID,
    startDate: "2026-05-01T10:00:00.000Z",
    endDate: "2026-05-03T10:00:00.000Z",
    rentalPeriodType: "daily",
    quantity: "1",
    renterNotes: "  Need the charger too.  ",
  });
  assert(
    createRentalPayload.startDate instanceof Date &&
      createRentalPayload.endDate instanceof Date,
    "Rental schema should coerce ISO strings into Date objects",
    createRentalPayload,
  );
  assert(
    createRentalPayload.quantity === 1,
    "Rental quantity should be coerced into a number",
    createRentalPayload,
  );
  assert(
    createRentalPayload.renterNotes === "Need the charger too.",
    "Renter notes should be trimmed",
    createRentalPayload,
  );

  const invalidRentalWindow = rentalSchema.createRentalSchema.safeParse({
    productId: VALID_ID,
    startDate: "2026-05-03T10:00:00.000Z",
    endDate: "2026-05-01T10:00:00.000Z",
    rentalPeriodType: "daily",
  });
  assert(
    invalidRentalWindow.success === false,
    "Rental schema should reject an end date before the start date",
  );
  assert(
    invalidRentalWindow.error.issues.some(
      (issue) =>
        issue.path.join(".") === "endDate" &&
        issue.message === "Rental end date must be after the start date",
    ),
    "Invalid rental windows should raise an endDate validation issue",
    invalidRentalWindow.error.issues,
  );

  const availabilityQuery = rentalSchema.availabilityQuerySchema.parse({
    startDate: "2026-06-10T08:00:00.000Z",
    endDate: "2026-06-11T08:00:00.000Z",
    rentalPeriodType: " daily ",
    quantity: "1",
  });
  assert(
    availabilityQuery.rentalPeriodType === "daily",
    "Availability query schema should trim enum values",
    availabilityQuery,
  );
  assert(
    availabilityQuery.quantity === 1,
    "Availability query schema should coerce quantity",
    availabilityQuery,
  );

  const wishlistNotifyPayload = wishlistSchema.wishlistNotifyBodySchema.parse({
    title: "  Back in stock  ",
    message: "  The owner says the item is ready again.  ",
  });
  assert(
    wishlistNotifyPayload.title === "Back in stock",
    "Wishlist notify schema should trim the title",
    wishlistNotifyPayload,
  );
  assert(
    wishlistNotifyPayload.message === "The owner says the item is ready again.",
    "Wishlist notify schema should trim the message",
    wishlistNotifyPayload,
  );

  const wishlistIdParams = wishlistSchema.wishlistOwnerParamSchema.parse({
    wishlistId: VALID_ID,
  });
  assert(
    wishlistIdParams.wishlistId === VALID_ID,
    "Wishlist owner param schema should accept a valid wishlist id",
    wishlistIdParams,
  );

  log("Unit test suite completed successfully");
}

let exitCode = 0;

try {
  await run();
} catch (error) {
  exitCode = 1;
  console.error("[unit] FAILURE");
  console.error(error);
}

process.exit(exitCode);
