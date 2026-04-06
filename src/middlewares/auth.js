import jwt from "jsonwebtoken";
import db from "../database/db.js";

async function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ success: false, message: "Access token required" });
  }
  const token = authHeader.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Access token required" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        isVerified: true,
      },
    });
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (!user.isActive) {
      return res
        .status(403)
        .json({ success: false, message: "Account is disabled" });
    }
    req.user = user;
    return next();
  } catch (error) {
    console.error(error);
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
}

async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return next();
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        isVerified: true,
      },
    });

    if (user?.isActive) {
      req.user = user;
    }
  } catch (error) {
    console.error(error);
  }

  return next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource",
      });
    }

    return next();
  };
}

const adminOnly = requireRole("admin");

export default {
  adminOnly,
  auth,
  optionalAuth,
  requireRole,
};
