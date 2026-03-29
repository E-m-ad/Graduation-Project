import "dotenv/config";
import express from "express";
import { fileURLToPath } from "node:url";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import authMiddleWare from "./middlewares/auth.js";
import auth from "./routes/auth.js";
import user from "./routes/authenticated.user.js";
import publicUser from "./routes/public.user.js";

const app = express();
const uploadsDir = fileURLToPath(new URL("../uploads", import.meta.url));

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));
app.use(express.static("public"));
app.use(
  "/uploads",
  express.static(uploadsDir, {
    setHeaders: (res) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  }),
);

app.use("/api/v1/auth", auth);
app.use("/api/v1/users", authMiddleWare.auth, user);
app.use("/api/v1/public/users", publicUser);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
