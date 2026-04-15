import express from "express";
import authMiddleWare from "../middlewares/auth.js";
import review from "../controllers/review.js";

const router = express.Router();

router.post("/", authMiddleWare.auth, review.createReview);
router.get("/product/:id", review.getProductReviews);
router.put("/:id", authMiddleWare.auth, review.updateOwnReview);
router.put("/:id/reply", authMiddleWare.auth, review.replyToReview);
router.delete("/:id", authMiddleWare.auth, review.deleteOwnReview);

export default router;
