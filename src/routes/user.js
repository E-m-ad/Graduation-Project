import express from "express";
import user from "../controllers/user.js";
const router = express.Router();

router.get("/me", user.getProfile);
router.put("/me", user.updateProfile);
router.put("/change-password", user.changePassword);

export default router;
