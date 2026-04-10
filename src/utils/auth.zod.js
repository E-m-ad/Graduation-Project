import zod from "zod";

function parseBooleanEnv(value) {
  const normalizedValue = String(value ?? "").trim().toLowerCase();
  if (!normalizedValue) {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(normalizedValue);
}

const registerSchema = zod
  .object({
    name: zod
      .string("Please enter your name")
      .min(3, "Name must be at least 3 characters long"),
    email: zod.email("Invalid email address"),
    password: zod
      .string("Password is required")
      .min(6, "Password must be at least 6 characters long")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter"),
    confirmPassword: zod
      .string("Confirm Password is required")
      .min(6, "Confirm Password must be at least 6 characters long"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const loginSchema = zod.object({
  email: zod.email("Invalid email address"),
  password: zod.string("Password is required"),
});

const forgotPasswordSchema = zod.object({
  email: zod.email("Invalid email address"),
});

const requestEmailVerificationSchema = zod.object({
  email: zod.email("Invalid email address"),
});

const resetPasswordSchema = zod
  .object({
    token: zod
      .string("Reset token is required")
      .min(1, "Reset token is required"),
    password: zod
      .string("Password is required")
      .min(6, "Password must be at least 6 characters long")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter"),
    confirmPassword: zod
      .string("Confirm Password is required")
      .min(6, "Confirm Password must be at least 6 characters long"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const verifyEmailSchema = zod.object({
  token: zod
    .string("Verification token is required")
    .min(1, "Verification token is required"),
});

const envProcessSchema = zod
  .object({
    NODE_ENV: zod.string().optional(),
    JWT_SECRET: zod.string("JWT_SECRET is required"),
    REFRESH_TOKEN_SECRET: zod.string("REFRESH_TOKEN_SECRET is required"),
    ACCESS_TOKEN_EXPIRATION: zod.string("ACCESS_TOKEN_EXPIRATION is required"),
    REFRESH_TOKEN_EXPIRATION: zod.string("REFRESH_TOKEN_EXPIRATION is required"),
    EMAIL_VERIFICATION_ENABLED: zod
      .string()
      .trim()
      .regex(/^(true|false|1|0|yes|no|on|off)$/i, {
        message:
          "EMAIL_VERIFICATION_ENABLED must be true, false, 1, 0, yes, no, on, or off",
      })
      .optional()
      .or(zod.literal("")),
    APP_BASE_URL: zod.string().trim().optional(),
    RAILWAY_PUBLIC_DOMAIN: zod.string().trim().optional(),
    CORS_ALLOWED_ORIGINS: zod.string().trim().optional(),
    UPLOADS_DIR: zod.string().trim().optional(),
    RESEND_API_KEY: zod.string().trim().optional(),
    SMTP_CONNECTION_URL: zod.string().trim().optional(),
    SMTP_HOST: zod.string().trim().optional(),
    SMTP_PORT: zod
      .string()
      .trim()
      .regex(/^\d+$/, "SMTP_PORT must be a valid number")
      .optional()
      .or(zod.literal("")),
    SMTP_USER: zod.string().trim().optional(),
    SMTP_PASS: zod.string().trim().optional(),
    SMTP_FROM: zod.string().trim().optional(),
    SMTP_SECURE: zod
      .string()
      .trim()
      .regex(/^(true|false)$/i, "SMTP_SECURE must be true or false")
      .optional()
      .or(zod.literal("")),
  })
  .superRefine((env, ctx) => {
    const hasResendApiKey = Boolean(env.RESEND_API_KEY?.trim());
    const hasConnectionUrl = Boolean(env.SMTP_CONNECTION_URL?.trim());
    const hasSmtpFields = Boolean(
      env.SMTP_HOST?.trim() &&
        env.SMTP_PORT?.trim() &&
        env.SMTP_USER?.trim() &&
        env.SMTP_PASS?.trim(),
    );
    const hasFrom = Boolean(env.SMTP_FROM?.trim());
    const isProduction = env.NODE_ENV === "production";
    const hasAppBaseUrl = Boolean(env.APP_BASE_URL?.trim());
    const hasRailwayPublicDomain = Boolean(env.RAILWAY_PUBLIC_DOMAIN?.trim());
    const emailVerificationEnabled = parseBooleanEnv(
      env.EMAIL_VERIFICATION_ENABLED,
    );

    if (hasAppBaseUrl) {
      const urlCheck = zod.string().url().safeParse(env.APP_BASE_URL.trim());
      if (!urlCheck.success) {
        ctx.addIssue({
          code: "custom",
          path: ["APP_BASE_URL"],
          message: "APP_BASE_URL must be a valid URL",
        });
      }
    }

    if (env.CORS_ALLOWED_ORIGINS?.trim()) {
      env.CORS_ALLOWED_ORIGINS.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
        .forEach((origin) => {
          const originCheck = zod.string().url().safeParse(origin);
          if (!originCheck.success) {
            ctx.addIssue({
              code: "custom",
              path: ["CORS_ALLOWED_ORIGINS"],
              message: "CORS_ALLOWED_ORIGINS must contain comma-separated absolute URLs",
            });
          }
        });
    }

    if ((hasResendApiKey || hasConnectionUrl || hasSmtpFields) && !hasFrom) {
      ctx.addIssue({
        code: "custom",
        path: ["SMTP_FROM"],
        message: "SMTP_FROM is required when email delivery is configured",
      });
    }

    if (
      isProduction &&
      emailVerificationEnabled &&
      !hasAppBaseUrl &&
      !hasRailwayPublicDomain
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["APP_BASE_URL"],
        message: "APP_BASE_URL or RAILWAY_PUBLIC_DOMAIN is required in production",
      });
    }

    if (
      isProduction &&
      emailVerificationEnabled &&
      !hasResendApiKey &&
      !hasConnectionUrl &&
      !hasSmtpFields
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message:
          "Production requires RESEND_API_KEY or SMTP_CONNECTION_URL or SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS",
      });
    }

    if (isProduction && emailVerificationEnabled && !hasFrom) {
      ctx.addIssue({
        code: "custom",
        path: ["SMTP_FROM"],
        message: "SMTP_FROM is required in production",
      });
    }
  });

export default {
  envProcessSchema,
  forgotPasswordSchema,
  loginSchema,
  requestEmailVerificationSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
};
