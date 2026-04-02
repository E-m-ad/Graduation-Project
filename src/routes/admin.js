import express from "express";
import authMiddleWare from "../middlewares/auth.js";
import admin from "../controllers/admin.js";

const router = express.Router();

router.use(authMiddleWare.auth);
router.use(authMiddleWare.adminOnly);

router.get("/dashboard", admin.getDashboard);
router.get("/users", admin.getUsers);
router.put("/users/:id/status", admin.updateUserStatus);
router.get("/products", admin.getProducts);
router.put("/products/:id/approve", admin.approveProduct);
router.put("/products/:id/reject", admin.rejectProduct);
router.get("/rentals", admin.getRentals);
router.get("/reports", admin.getReports);

export default router;
