import express from "express";
import {
  createBooking,
  cancelBooking,
  confirmRequest,
  confirmCompletionRequest,
  submitServiceReview,
  getLiveBookings as getUserLiveBookings,
  getUpcomingBookings as getUserUpcomingBookings,
  getCancelledBookings,
  getCompletedBookings,
} from "../controllers/booking.controller.js";
import { isAuthenticated } from "../middlewares/auth.middlewares.js";

const router = express.Router();
router.use(isAuthenticated);

// Booking Routes
router.post("/", createBooking);
router.patch("/cancel/:bookingId", cancelBooking);
router.patch("/confirm/:bookingId", confirmRequest);
router.patch("/confirm-completion/:bookingId", confirmCompletionRequest);
router.post("/review/:bookingId", submitServiceReview);
router.get("/live", isAuthenticated, getUserLiveBookings);
router.get("/upcoming", isAuthenticated, getUserUpcomingBookings);
router.get("/cancelled", isAuthenticated, getCancelledBookings);
router.get("/completed", isAuthenticated, getCompletedBookings);

export default router;
