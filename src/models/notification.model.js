import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: "Provider" },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking",
  },
  messageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
  type: {
    type: String,
    enum: [
      "new-request",
      "booking-created",
      "request-accepted",
      "request-cancelled",
      "booking-completed",
      "request-confirmed",
      "booking-live",
      "booking-cancelled",
      "booking-rescheduled",
      "review-submitted",
      "report-submitted",
      "status-update",
      "service-review-submitted",
      "awaiting-user-confirmation-for-acceptance",
      "awaiting-user-confirmation-for-completion",
      "user-completed-request",
      "new-message",
      "request-confirmation",
    ],
    required: true,
  },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export const Notification = mongoose.model("Notification", notificationSchema);
