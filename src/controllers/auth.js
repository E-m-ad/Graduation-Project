import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import db from "../database/db.js";
import { sendEmail } from "../utils/email.js";
import {
  buildRequestBaseUrl,
  isEmailVerificationEnabled,
} from "../utils/runtime-config.js";
import z from "../utils/auth.zod.js";

const EMAIL_NOT_VERIFIED_CODE = "EMAIL_NOT_VERIFIED";
const EMAIL_VERIFICATION_PAUSED_MESSAGE =
  "Email verification is currently paused. You can continue without it.";
const READY_TO_SIGN_IN_MESSAGE = "Your account is ready. You can sign in now.";
const RESET_TOKEN_TTL_MINUTES = 30;
const RESET_TOKEN_TTL_MS = RESET_TOKEN_TTL_MINUTES * 60 * 1000;
const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

z.envProcessSchema.parse(process.env);

function getRefreshCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    path: "/",
  };
}

function hashToken(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function buildVerificationLink(req, rawToken) {
  return `${buildRequestBaseUrl(req)}/html/verify-email.html?token=${encodeURIComponent(rawToken)}`;
}

function buildPasswordResetLink(req, rawToken) {
  return `${buildRequestBaseUrl(req)}/html/reset-password.html?token=${encodeURIComponent(rawToken)}`;
}

async function createEmailVerificationToken(userId) {
  const rawToken = crypto.randomBytes(32).toString("hex");

  await db.emailVerificationToken.deleteMany({
    where: { userId },
  });

  await db.emailVerificationToken.create({
    data: {
      token: hashToken(rawToken),
      userId,
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS),
    },
  });

  return rawToken;
}

async function sendVerificationEmail({ req, user, rawToken }) {
  const verificationLink = buildVerificationLink(req, rawToken);
  const text = [
    `Hi ${user.name || "there"},`,
    "",
    "Welcome to AI Rent.",
    "Verify your email address by opening the link below:",
    verificationLink,
    "",
    "If you did not request this, you can ignore this email.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <p>Hi ${user.name || "there"},</p>
      <p>Welcome to AI Rent.</p>
      <p>Please verify your email address by using the link below:</p>
      <p>
        <a href="${verificationLink}" style="color: #da291c; font-weight: 700;">
          Verify your email
        </a>
      </p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>
  `;

  const result = await sendEmail({
    to: user.email,
    subject: "Verify your AI Rent email",
    text,
    html,
  });

  if (result.skipped) {
    console.info(
      `Email delivery is not configured. Verification link for ${user.email}: ${verificationLink}`,
    );
  }

  if (!result.sent) {
    console.error(
      `Verification email delivery failed for ${user.email}. Continuing without blocking auth flow.`,
      result.error,
    );
  }

  return {
    emailSent: result.sent,
    verificationLink,
  };
}

async function sendPasswordResetEmail({ req, user, rawToken }) {
  const resetLink = buildPasswordResetLink(req, rawToken);
  const expiryLabel = `${RESET_TOKEN_TTL_MINUTES} minutes`;
  const text = [
    `Hi ${user.name || "there"},`,
    "",
    "We received a request to reset your AI Rent password.",
    `Open the link below within ${expiryLabel} to choose a new password:`,
    resetLink,
    "",
    "If you did not request this, you can ignore this email.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <p>Hi ${user.name || "there"},</p>
      <p>We received a request to reset your AI Rent password.</p>
      <p>Please use the link below within ${expiryLabel} to choose a new password:</p>
      <p>
        <a href="${resetLink}" style="color: #da291c; font-weight: 700;">
          Reset your password
        </a>
      </p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>
  `;

  const result = await sendEmail({
    to: user.email,
    subject: "Reset your AI Rent password",
    text,
    html,
  });

  if (result.skipped) {
    console.info(
      `Email delivery is not configured. Password reset link for ${user.email}: ${resetLink}`,
    );
  }

  if (!result.sent) {
    console.error(
      `Password reset email delivery failed for ${user.email}.`,
      result.error,
    );
  }

  return {
    emailSent: result.sent,
    resetLink,
  };
}

async function issueEmailVerification({ req, user }) {
  const rawToken = await createEmailVerificationToken(user.id);
  const { emailSent, verificationLink } = await sendVerificationEmail({
    req,
    user,
    rawToken,
  });

  return {
    rawToken,
    emailSent,
    verificationLink,
  };
}

function getVerificationDeliveryMessage({
  emailSent,
  successMessage,
  developmentMessage,
  productionFallbackMessage,
}) {
  if (emailSent) {
    return successMessage;
  }

  if (process.env.NODE_ENV === "development") {
    return developmentMessage;
  }

  return productionFallbackMessage;
}

function appendDevelopmentVerificationPreview(
  responseBody,
  rawToken,
  verificationLink,
) {
  if (process.env.NODE_ENV === "development") {
    responseBody.verificationToken = rawToken;
    responseBody.verificationLink = verificationLink;
  }

  return responseBody;
}

function getGenericVerificationRequestMessage() {
  return "If an account with this email exists and still needs verification, a confirmation email will be sent shortly";
}

function buildVerificationRequestResponse({
  message,
  rawToken,
  verificationLink,
}) {
  return appendDevelopmentVerificationPreview(
    {
      success: true,
      message,
    },
    rawToken,
    verificationLink,
  );
}

function buildVerificationRequiredResponse({
  message,
  rawToken,
  verificationLink,
}) {
  return appendDevelopmentVerificationPreview(
    {
      success: false,
      code: EMAIL_NOT_VERIFIED_CODE,
      requiresEmailVerification: true,
      message,
    },
    rawToken,
    verificationLink,
  );
}

function appendDevelopmentResetPreview(responseBody, rawToken, resetLink) {
  if (process.env.NODE_ENV === "development") {
    responseBody.resetToken = rawToken;
    responseBody.resetLink = resetLink;
  }

  return responseBody;
}

function buildForgotPasswordResponse({ message, rawToken, resetLink }) {
  return appendDevelopmentResetPreview(
    {
      success: true,
      message,
    },
    rawToken,
    resetLink,
  );
}

function buildValidationErrorResponse(data) {
  return {
    success: false,
    error: {
      path: data.error.issues[0].path.join("."),
      message: data.error.issues[0].message,
    },
  };
}

async function markUserVerifiedIfNeeded(userId) {
  if (isEmailVerificationEnabled()) {
    return false;
  }

  const result = await db.user.updateMany({
    where: {
      id: userId,
      isVerified: false,
    },
    data: {
      isVerified: true,
    },
  });

  if (result.count > 0) {
    await db.emailVerificationToken.deleteMany({
      where: { userId },
    });
  }

  return result.count > 0;
}

async function register(req, res) {
  const data = z.registerSchema.safeParse(req.body);
  if (!data.success) {
    return res.status(400).json({
      success: false,
      error: buildValidationErrorResponse(data).error,
    });
  }

  const { name, email, password } = data.data;
  const emailVerificationEnabled = isEmailVerificationEnabled();

  try {
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      if (!emailVerificationEnabled && existingUser.isActive) {
        await markUserVerifiedIfNeeded(existingUser.id);
      } else if (existingUser.isActive && !existingUser.isVerified) {
        await issueEmailVerification({
          req,
          user: existingUser,
        });
      }

      return res.status(201).json({
        success: true,
        message: emailVerificationEnabled
          ? getGenericVerificationRequestMessage()
          : READY_TO_SIGN_IN_MESSAGE,
      });
    }

    const user = await db.user.create({
      data: {
        name,
        email,
        password: await bcrypt.hash(password, 10),
        isVerified: !emailVerificationEnabled,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!emailVerificationEnabled) {
      return res.status(201).json({
        success: true,
        message: READY_TO_SIGN_IN_MESSAGE,
      });
    }

    const { rawToken, emailSent, verificationLink } =
      await issueEmailVerification({
        req,
        user,
      });

    const message = getVerificationDeliveryMessage({
      emailSent,
      successMessage:
        "User registered successfully. Check your email to verify your account.",
      developmentMessage:
        "User registered successfully. Use the verification link below while testing locally.",
      productionFallbackMessage:
        "User registered successfully, but verification email delivery is unavailable right now.",
    });

    return res.status(201).json(
      buildVerificationRequestResponse({
        message,
        rawToken,
        verificationLink,
      }),
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

async function requestEmailVerification(req, res) {
  if (!isEmailVerificationEnabled()) {
    if (req.user?.id) {
      await markUserVerifiedIfNeeded(req.user.id);
    }

    return res.status(200).json({
      success: true,
      emailVerificationRequired: false,
      message: EMAIL_VERIFICATION_PAUSED_MESSAGE,
    });
  }

  try {
    const authUserId = req.user?.id;

    if (authUserId) {
      const user = await db.user.findUnique({
        where: { id: authUserId },
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          isVerified: true,
        },
      });

      if (!user || !user.isActive) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (user.isVerified) {
        return res.status(409).json({
          success: false,
          message: "Your email is already verified",
        });
      }

      const { rawToken, emailSent, verificationLink } =
        await issueEmailVerification({
          req,
          user,
        });

      const message = getVerificationDeliveryMessage({
        emailSent,
        successMessage: "Verification email sent successfully",
        developmentMessage: "Verification link generated for local testing",
        productionFallbackMessage:
          "Verification email delivery is unavailable on this server right now",
      });

      return res.status(200).json(
        buildVerificationRequestResponse({
          message,
          rawToken,
          verificationLink,
        }),
      );
    }

    const data = z.requestEmailVerificationSchema.safeParse(req.body);
    if (!data.success) {
      return res.status(400).json({
        success: false,
        error: buildValidationErrorResponse(data).error,
      });
    }

    const user = await db.user.findUnique({
      where: { email: data.data.email },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        isVerified: true,
      },
    });

    if (!user || !user.isActive || user.isVerified) {
      return res.status(200).json({
        success: true,
        message: getGenericVerificationRequestMessage(),
      });
    }

    const { rawToken, verificationLink } = await issueEmailVerification({
      req,
      user,
    });

    return res.status(200).json(
      buildVerificationRequestResponse({
        message: getGenericVerificationRequestMessage(),
        rawToken,
        verificationLink,
      }),
    );
  } catch (error) {
    console.error("requestEmailVerification error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

async function verifyEmail(req, res) {
  if (!isEmailVerificationEnabled()) {
    return res.status(200).json({
      success: true,
      emailVerificationRequired: false,
      message: EMAIL_VERIFICATION_PAUSED_MESSAGE,
    });
  }

  const data = z.verifyEmailSchema.safeParse(req.body);
  if (!data.success) {
    return res.status(400).json({
      success: false,
      error: buildValidationErrorResponse(data).error,
    });
  }

  try {
    const verificationToken = await db.emailVerificationToken.findUnique({
      where: {
        token: hashToken(data.data.token),
      },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        isUsed: true,
        user: {
          select: {
            id: true,
            email: true,
            isVerified: true,
          },
        },
      },
    });

    if (
      !verificationToken ||
      verificationToken.isUsed ||
      verificationToken.expiresAt < new Date()
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token",
      });
    }

    const user = await db.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: verificationToken.userId },
        data: { isVerified: true },
        select: {
          id: true,
          email: true,
          isVerified: true,
        },
      });

      await tx.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: {
          isUsed: true,
          usedAt: new Date(),
        },
      });

      await tx.emailVerificationToken.deleteMany({
        where: {
          userId: verificationToken.userId,
          id: { not: verificationToken.id },
        },
      });

      return updatedUser;
    });

    return res.status(200).json({
      success: true,
      message: "Email verified successfully",
      data: user,
    });
  } catch (error) {
    console.error("verifyEmail error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

async function login(req, res) {
  const data = z.loginSchema.safeParse(req.body);
  if (!data.success) {
    return res.status(400).json({
      success: false,
      error: buildValidationErrorResponse(data).error,
    });
  }

  const { email, password } = data.data;

  try {
    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    if (!user.isActive) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    if (!isEmailVerificationEnabled()) {
      await markUserVerifiedIfNeeded(user.id);
    } else if (!user.isVerified) {
      const { rawToken, emailSent, verificationLink } =
        await issueEmailVerification({
          req,
          user,
        });

      const message = getVerificationDeliveryMessage({
        emailSent,
        successMessage:
          "Verify your email before logging in. We sent you a new verification email.",
        developmentMessage:
          "Verify your email before logging in. Use the verification link below while testing locally.",
        productionFallbackMessage:
          "Verify your email before logging in. Verification email delivery is unavailable right now.",
      });

      return res.status(403).json(
        buildVerificationRequiredResponse({
          message,
          rawToken,
          verificationLink,
        }),
      );
    }

    const accessToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRATION },
    );
    const refreshTokenValue = jwt.sign(
      { userId: user.id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRATION },
    );

    await db.refreshToken.deleteMany({ where: { userId: user.id } });
    await db.refreshToken.create({
      data: {
        token: hashToken(refreshTokenValue),
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    res.cookie("refreshToken", refreshTokenValue, {
      ...getRefreshCookieOptions(),
      maxAge: REFRESH_TOKEN_TTL_MS,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      accessToken,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
}

async function refreshToken(req, res) {
  const token = req.cookies.refreshToken;
  if (!token) {
    return res
      .status(400)
      .json({ success: false, message: "Refresh token required" });
  }

  try {
    let checkToken;

    try {
      checkToken = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    } catch (error) {
      console.error(error);
      return res
        .status(401)
        .json({ success: false, message: "Invalid Refresh Token" });
    }

    const revokedToken = await db.refreshToken.findUnique({
      where: { token: hashToken(token) },
    });

    if (!revokedToken || revokedToken.isRevoked) {
      return res
        .status(401)
        .json({ success: false, message: "Refresh token revoked" });
    }

    const user = await db.user.findUnique({
      where: { id: checkToken.userId },
      select: { id: true, role: true, isActive: true, isVerified: true },
    });

    if (!user || !user.isActive) {
      return res
        .status(401)
        .json({ success: false, message: "User not found or inactive" });
    }

    if (!isEmailVerificationEnabled()) {
      await markUserVerifiedIfNeeded(user.id);
    } else if (!user.isVerified) {
      await db.refreshToken.updateMany({
        where: { userId: user.id },
        data: { isRevoked: true },
      });

      res.clearCookie("refreshToken", getRefreshCookieOptions());
      return res.status(403).json({
        success: false,
        code: EMAIL_NOT_VERIFIED_CODE,
        requiresEmailVerification: true,
        message: "Verify your email before continuing",
      });
    }

    const newAccessToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRATION },
    );

    return res.status(200).json({ success: true, accessToken: newAccessToken });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
}

async function logOut(req, res) {
  const token = req.cookies.refreshToken;
  if (!token) {
    return res
      .status(400)
      .json({ success: false, message: "Refresh token required" });
  }

  try {
    await db.refreshToken.updateMany({
      where: { token: hashToken(token) },
      data: { isRevoked: true },
    });

    res.clearCookie("refreshToken", getRefreshCookieOptions());
    return res
      .status(200)
      .json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
}

async function forgotPassword(req, res) {
  const data = z.forgotPasswordSchema.safeParse(req.body);
  if (!data.success) {
    return res.status(400).json({
      success: false,
      error: buildValidationErrorResponse(data).error,
    });
  }

  const { email } = data.data;
  const genericResponse = {
    success: true,
    message:
      "If this email is registered, you will receive password reset instructions shortly",
  };

  try {
    const user = await db.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return res.status(200).json(genericResponse);
    }

    const rawToken = crypto.randomBytes(32).toString("hex");

    await db.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await db.passwordResetToken.create({
      data: {
        token: hashToken(rawToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const { resetLink } = await sendPasswordResetEmail({
      req,
      user,
      rawToken,
    });

    return res.status(200).json(
      buildForgotPasswordResponse({
        message: genericResponse.message,
        rawToken,
        resetLink,
      }),
    );
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
}

async function resetPassword(req, res) {
  const data = z.resetPasswordSchema.safeParse(req.body);
  if (!data.success) {
    return res.status(400).json({
      success: false,
      error: buildValidationErrorResponse(data).error,
    });
  }

  const { token, password } = data.data;

  try {
    const resetToken = await db.passwordResetToken.findUnique({
      where: { token: hashToken(token) },
    });

    if (!resetToken || resetToken.isUsed || resetToken.expiresAt < new Date()) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired reset token" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.$transaction([
      db.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      db.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { isUsed: true, usedAt: new Date() },
      }),
      db.refreshToken.updateMany({
        where: { userId: resetToken.userId },
        data: { isRevoked: true },
      }),
      db.passwordResetToken.deleteMany({
        where: {
          userId: resetToken.userId,
          id: { not: resetToken.id },
        },
      }),
    ]);

    return res
      .status(200)
      .json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
}

export default {
  register,
  login,
  refreshToken,
  logOut,
  requestEmailVerification,
  verifyEmail,
  forgotPassword,
  resetPassword,
};
