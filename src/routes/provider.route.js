import express from "express";
import {
  updateLocation,
  getPendingRequests,
  acceptRequest,
  startService,
  cancelRequest,
  getLiveBookings,
  getUpcomingBookings,
  getCompletedAndCancelledBookings,
  completeBooking,
  getProviderStats,
  getBookingLocation,
} from "../controllers/provider.controller.js";
import { isAuthenticated } from "../middlewares/auth.middlewares.js";
import upload from "../middlewares/multer.middlewares.js";

const router = express.Router();
router.use(isAuthenticated);

router.patch("/location", updateLocation);
router.get("/pending-requests", getPendingRequests);
router.patch("/accept-request/:bookingId", acceptRequest);
router.patch("/start-service/:bookingId", startService);
router.patch("/cancel-request/:bookingId", cancelRequest);
router.get("/live-bookings", getLiveBookings);
router.get("/upcoming-bookings", getUpcomingBookings);
router.get("/completed-cancelled-bookings", getCompletedAndCancelledBookings);
router.patch("/complete-booking/:bookingId", completeBooking);
router.get("/stats", getProviderStats);
router.get("/:bookingId/location", getBookingLocation);

export default router;
