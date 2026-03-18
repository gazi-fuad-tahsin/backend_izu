import express from "express";
import {
  getNotifications,
  getAdminNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../controllers/notification.controller.js";
import { isAuthenticated } from "../middlewares/auth.middlewares.js";
const router = express.Router();

router.use(isAuthenticated);

router.get("/", getNotifications);
router.get("/admin", getAdminNotifications);
router.put("/:notificationId/read", markNotificationAsRead);
router.put("/read-all", markAllNotificationsAsRead);

export default router;
