import express from "express";
import authMiddleWare from "../middlewares/auth.js";
import notification from "../controllers/notification.js";

const router = express.Router();

router.get("/", authMiddleWare.auth, notification.getNotifications);
router.put("/read-all", authMiddleWare.auth, notification.markAllNotificationsAsRead);
router.get(
  "/unread-count",
  authMiddleWare.auth,
  notification.getUnreadNotificationsCount,
);
router.put("/:id/read", authMiddleWare.auth, notification.markNotificationAsRead);

export default router;
