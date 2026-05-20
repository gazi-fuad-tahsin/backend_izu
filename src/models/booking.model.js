import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    title: { type: String },
    bookingTime: { type: Date, required: true, index: true },
    location: {
      type: { type: String, default: "Point" },
      coordinates: [Number],
      address: { type: String },
    },
    totalPrice: { type: Number, required: true },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    extraNote: { type: String },
    providerAmount: { type: Number },
    status: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "ongoing",
        "completed",
        "cancelled",
        "upcoming",
        "awaiting-user-confirmation-for-completion",
        "awaiting-user-confirmation-for-acceptance",
        "request-confirmed",
        "waiting-for-start"
      ],
      default: "pending",
      index: true,
    },
    requestSent: { type: Boolean, default: false },
    requestAccepted: { type: Boolean, default: false },
    acceptStartServiceTime: { type: Date },
    bookingType: {
      type: String,
      enum: ["per session", "hourly"],
      required: true,
    },
    estimatedHours: { type: Number, default: 1 },
  },
  { timestamps: true }
);

bookingSchema.index({ location: "2dsphere" });
export const Booking = mongoose.model("Booking", bookingSchema);
