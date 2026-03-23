import db from "../database/db.js";
import z from "../utils/zod.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";

const RESET_TOKEN_TTL_MS = 2 * 60 * 1000;
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

async function register(req, res) {
  console.log(req.body);
  const data = z.registerSchema.safeParse(req.body);
  if (!data.success) {
    return res.status(400).json({
      success: false,
      error: {
        path: data.error.issues[0].path.join("."),
        message: data.error.issues[0].message,
      },
    });
  }
  const { name, email, password } = data.data;
  try {
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(201).json({
        success: true,
        message:
          "If this email is not registered, you will receive a confirmation email shortly",
      });
    }
    await db.user.create({
      data: {
        name,
        email,
        password: await bcrypt.hash(password, 10),
      },
    });
    res
      .status(201)
      .json({ success: true, message: "User registered successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function login(req, res) {
  const data = z.loginSchema.safeParse(req.body);
  if (!data.success) {
    return res.status(400).json({
      success: false,
      error: {
        path: data.error.issues[0].path.join("."),
        message: data.error.issues[0].message,
      },
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
    if (!user.isActive)
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword)
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
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
    const refreshTokenHash = crypto
      .createHash("sha256")
      .update(refreshTokenValue)
      .digest("hex");
    await db.refreshToken.create({
      data: {
        token: refreshTokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });
    res.cookie("refreshToken", refreshTokenValue, {
      ...getRefreshCookieOptions(),
      maxAge: REFRESH_TOKEN_TTL_MS,
    });
    res.status(200).json({
      success: true,
      message: "Login successful",
      accessToken,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}
async function refreshToken(req, res) {
  const token = req.cookies.refreshToken;
  if (!token)
    return res
      .status(400)
      .json({ success: false, message: "Refresh token required" });
  let checkToken;
  try {
    try {
      checkToken = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    } catch (error) {
      console.error(error);
      return res
        .status(401)
        .json({ success: false, message: "Invalid Refresh Token" });
    }
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const revokedToken = await db.refreshToken.findUnique({
      where: { token: hashedToken },
    });
    if (!revokedToken || revokedToken.isRevoked) {
      return res
        .status(401)
        .json({ success: false, message: "Refresh token revoked" });
    }
    const user = await db.user.findUnique({
      where: { id: checkToken.userId },
      select: { id: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) {
      return res
        .status(401)
        .json({ success: false, message: "User not found or inactive" });
    }
    const newAccessToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRATION },
    );
    res.status(200).json({ success: true, accessToken: newAccessToken });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

async function logOut(req, res) {
  const token = req.cookies.refreshToken;
  if (!token)
    return res
      .status(400)
      .json({ success: false, message: "Refresh token required" });
  try {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    await db.refreshToken.updateMany({
      where: { token: hashedToken },
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
      error: {
        path: data.error.issues[0].path.join("."),
        message: data.error.issues[0].message,
      },
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
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    await db.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await db.passwordResetToken.create({
      data: {
        token: hashedToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    if (process.env.NODE_ENV === "development") {
      return res.status(200).json({
        ...genericResponse,
        resetToken: rawToken,
      });
    }

    return res.status(200).json(genericResponse);
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
      error: {
        path: data.error.issues[0].path.join("."),
        message: data.error.issues[0].message,
      },
    });
  }

  const { token, password } = data.data;

  try {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const resetToken = await db.passwordResetToken.findUnique({
      where: { token: hashedToken },
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
  forgotPassword,
  resetPassword,
};
