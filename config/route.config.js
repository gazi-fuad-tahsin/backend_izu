import express from "express";

import authRoutes from "../src/routes/auth.route.js";
import messageRoutes from "../src/routes/message.route.js";
import notificationRoutes from "../src/routes/notification.route.js";
import serviceRoutes from "../src/routes/service.route.js";
import profileRoutes from "../src/routes/profile.route.js";
import bookingRoutes from "../src/routes/booking.route.js";
import adminRoutes from "../src/routes/admin.route.js";
import providerRoutes from "../src/routes/provider.route.js";
import paymentRoutes from "../src/routes/payment.route.js";
import categoryRoutes from "../src/routes/category.route.js";

const router = express.Router();

// Authentication routes
router.use("/auth", authRoutes);

// Message routes
router.use("/messages", messageRoutes);

// Notification routes
router.use("/notifications", notificationRoutes);

// Service routes
router.use("/services", serviceRoutes);

// Profile routes
router.use("/profile", profileRoutes);

// Booking routes
router.use("/bookings", bookingRoutes);

// Admin routes
router.use("/admin", adminRoutes);

// Provider routes
router.use("/providers", providerRoutes);

// payment routes
router.use("/payments", paymentRoutes);

// category routes
router.use("/categories", categoryRoutes);

export default router;
