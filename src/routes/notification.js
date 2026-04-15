import express from "express";
import authMiddleWare from "../middlewares/auth.js";
import notification from "../controllers/notification.js";

const router = express.Router();

router.get("/", authMiddleWare.auth, notification.getNotifications);
router.put(
  "/read-all",
  authMiddleWare.auth,
  notification.markAllNotificationsAsRead,
);
router.put(
  "/scope/:scope/read",
  authMiddleWare.auth,
  notification.markNotificationScopeAsRead,
);
router.put(
  "/rental/:id/read",
  authMiddleWare.auth,
  notification.markRentalNotificationsAsRead,
);
router.get(
  "/unread-count",
  authMiddleWare.auth,
  notification.getUnreadNotificationsCount,
);
router.put(
  "/:id/read",
  authMiddleWare.auth,
  notification.markNotificationAsRead,
);
router.delete("/:id", authMiddleWare.auth, notification.deleteNotification);

export default router;
