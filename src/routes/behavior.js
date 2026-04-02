import express from "express";
import authMiddleWare from "../middlewares/auth.js";
import behavior from "../controllers/behavior.js";

const router = express.Router();

router.post("/track", authMiddleWare.auth, behavior.trackBehavior);

export default router;
