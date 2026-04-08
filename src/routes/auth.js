import express from "express";
import auth from "../controllers/auth.js";

const router = express.Router();

router.post("/register", auth.register);
router.post("/login", auth.login);
router.post("/refresh-token", auth.refreshToken);
router.post("/logout", auth.logOut);
router.post("/forgot-password", auth.forgotPassword);
router.post("/reset-password", auth.resetPassword);
export default router;
