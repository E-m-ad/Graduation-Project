import express from "express";
import authMiddleWare from "../middlewares/auth.js";
import recommendation from "../controllers/recommendation.js";

const router = express.Router();

router.get("/", authMiddleWare.auth, recommendation.getRecommendations);
router.get("/similar/:productId", recommendation.getSimilarProducts);

export default router;
