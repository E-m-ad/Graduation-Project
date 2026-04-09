import "dotenv/config";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import db from "./database/db.js";
import authMiddleWare from "./middlewares/auth.js";
import auth from "./routes/auth.js";
import user from "./routes/authenticated.user.js";
import publicUser from "./routes/public.user.js";
import category from "./routes/category.js";
import product from "./routes/product.js";
import rental from "./routes/rental.js";
import review from "./routes/review.js";
import wishlist from "./routes/wishlist.js";
import recommendation from "./routes/recommendation.js";
import behavior from "./routes/behavior.js";
import notification from "./routes/notification.js";
import admin from "./routes/admin.js";
import docs from "./routes/docs.js";
import { hasEmailTransportConfig, verifyEmailTransport } from "./utils/email.js";
import {
  getUploadsRootDir,
  isEmailVerificationEnabled,
  isOriginAllowed,
} from "./utils/runtime-config.js";
import { getSchemaHealth } from "./utils/schema-health.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistDir = path.resolve(__dirname, "../frontend/dist");
const publicDir = path.resolve(__dirname, "../public");
const staticDir = fs.existsSync(frontendDistDir) ? frontendDistDir : publicDir;
const uploadsDir = getUploadsRootDir();

function buildCorsOptions() {
  if (process.env.NODE_ENV !== "production") {
    return {
      origin: true,
      credentials: true,
    };
  }

  return {
    origin(origin, callback) {
      callback(null, isOriginAllowed(origin));
    },
    credentials: true,
    optionsSuccessStatus: 204,
  };
}

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(morgan("dev"));
  app.use(helmet());
  app.use(cors(buildCorsOptions()));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get("/healthz", async (req, res) => {
    try {
      await db.$queryRaw`SELECT 1`;
      const schema = await getSchemaHealth(db);
      const emailVerificationEnabled = isEmailVerificationEnabled();
      const emailConfigPresent =
        emailVerificationEnabled && hasEmailTransportConfig();
      let emailStatus = emailVerificationEnabled ? "not_configured" : "disabled";

      if (emailConfigPresent) {
        try {
          await verifyEmailTransport();
          emailStatus = "up";
        } catch (error) {
          console.error("healthz email verify error:", error);
          emailStatus = "down";
        }
      }

      if (!schema.ok) {
        return res.status(503).json({
          status: "degraded",
          database: "up",
          schema: "mismatch",
          email: emailStatus,
          missingColumns: schema.missing,
          timestamp: new Date().toISOString(),
        });
      }

      if (
        process.env.NODE_ENV === "production" &&
        emailVerificationEnabled &&
        emailStatus !== "up"
      ) {
        return res.status(200).json({
          status: "degraded",
          database: "up",
          schema: "up",
          email: emailStatus,
          timestamp: new Date().toISOString(),
        });
      }

      res.status(200).json({
        status: "ok",
        database: "up",
        schema: "up",
        email: emailStatus,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("healthz error:", error);
      res.status(503).json({
        status: "degraded",
        database: "down",
        email: "unknown",
      });
    }
  });

  app.use(express.static(staticDir));
  app.use(
    "/uploads",
    express.static(uploadsDir, {
      setHeaders: (res) => {
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      },
    }),
  );

  app.use("/api/v1/docs", docs);
  app.use("/api/v1/auth", auth);
  app.use("/api/v1/users", authMiddleWare.auth, user);
  app.use("/api/v1/public/users", publicUser);
  app.use("/api/v1/categories", category);
  app.use("/api/v1/products", product);
  app.use("/api/v1/rentals", rental);
  app.use("/api/v1/reviews", review);
  app.use("/api/v1/wishlists", wishlist);
  app.use("/api/v1/recommendations", recommendation);
  app.use("/api/v1/behavior", behavior);
  app.use("/api/v1/notifications", notification);
  app.use("/api/v1/admin", admin);

  return app;
}

export function startServer(port = Number(process.env.PORT || 8080)) {
  const app = createApp();

  const server = app.listen(port, "0.0.0.0", async () => {
    console.log(`Server is running on port ${port}`);

    if (
      process.env.NODE_ENV === "production" &&
      isEmailVerificationEnabled() &&
      hasEmailTransportConfig()
    ) {
      try {
        await verifyEmailTransport();
        console.log("SMTP transport verified");
      } catch (error) {
        console.error(
          "SMTP transport verification failed. Continuing startup with email marked as degraded:",
          error,
        );
      }
    }
  });

  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startServer();
}

export default createApp;
