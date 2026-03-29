import express from "express";
import user from "../controllers/authenticated.user.js";
import upload from "../middlewares/upload.middleware.js";
const router = express.Router();

router.get("/me", user.getProfile);
router.put("/me", user.updateProfile);
router.put("/change-password", user.changePassword);
router.post("/upload-avatar", upload, user.uploadAvatar);

export default router;
