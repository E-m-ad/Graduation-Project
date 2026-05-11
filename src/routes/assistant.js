import express from "express";
import authMiddleWare from "../middlewares/auth.js";
import assistant from "../controllers/assistant.js";

const router = express.Router();

router.post("/chat", authMiddleWare.optionalAuth, assistant.chat);

export default router;
