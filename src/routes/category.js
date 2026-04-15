import express from "express";
import authMiddleWare from "../middlewares/auth.js";
import category from "../controllers/category.js";

const router = express.Router();

router.get("/", category.getCategories);
router.get("/:id", category.getCategoryDetails);
router.post(
  "/",
  authMiddleWare.auth,
  authMiddleWare.adminOnly,
  category.createCategory,
);
router.put(
  "/:id",
  authMiddleWare.auth,
  authMiddleWare.adminOnly,
  category.updateCategory,
);
router.delete(
  "/:id",
  authMiddleWare.auth,
  authMiddleWare.adminOnly,
  category.deleteCategory,
);

export default router;
