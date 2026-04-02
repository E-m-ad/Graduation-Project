import express from "express";
import authMiddleWare from "../middlewares/auth.js";
import wishlist from "../controllers/wishlist.js";

const router = express.Router();

router.get("/", authMiddleWare.auth, wishlist.getMyWishlist);
router.post("/:productId", authMiddleWare.auth, wishlist.addToWishlist);
router.delete("/:productId", authMiddleWare.auth, wishlist.removeFromWishlist);

export default router;
