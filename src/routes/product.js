import express from "express";
import authMiddleWare from "../middlewares/auth.js";
import product from "../controllers/product.js";
import uploadProductImages from "../middlewares/product.upload.js";
const router = express.Router();

router.get("/", product.getProducts);
router.get("/my-listings", authMiddleWare.auth, product.getMyListings);
router.post("/", authMiddleWare.auth, product.createProduct);
router.put("/:id", authMiddleWare.auth, product.updateProduct);
router.put("/:id/status", authMiddleWare.auth, product.updateProductStatus);
router.post(
  "/:id/images",
  authMiddleWare.auth,
  uploadProductImages,
  product.uploadProductImages,
);
router.delete(
  "/:id/images/:imgId",
  authMiddleWare.auth,
  product.deleteProductImage,
);
router.delete("/:id", authMiddleWare.auth, product.deleteProduct);
router.get("/:id", product.getProductDetails);
export default router;
