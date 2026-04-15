import express from "express";
import user from "../controllers/public.user.js";
const router = express.Router();

router.get("/:id", user.getPublicUserProfile);
router.get("/:id/products", user.getPublicUserProducts);
router.get("/:id/reviews", user.getUserProductReviews);
export default router;
