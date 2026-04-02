import express from "express";
import authMiddleWare from "../middlewares/auth.js";
import category from "../controllers/category.js";

const router = express.Router();

router.get("/", category.getCategories);
router.get("/:id", category.getCategoryDetails);
router.post("/", authMiddleWare.auth, category.createCategory);
router.put("/:id", authMiddleWare.auth, category.updateCategory);
router.delete("/:id", authMiddleWare.auth, category.deleteCategory);

export default router;
