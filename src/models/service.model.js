import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
  rating: { type: Number, required: true, min: 1, max: 5 },
  message: { type: String, trim: true },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
});

const serviceDetailSchema = new mongoose.Schema({
  title: { type: String, required: true },
  perSessionPrice: { type: Number },
  hourlyPrice: { type: Number },
  details: { type: String },
  isActive: { type: Boolean },
  address: { type: String },
  serviceThumbnails: [{ type: String }],
  serviceType: {
    type: String,
    enum: ["per session", "hourly"],
    required: true,
  },
});

const serviceSchema = new mongoose.Schema({
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  },
  notes: { type: String },
  serviceDetails: [serviceDetailSchema],
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  reviews: [reviewSchema],
  averageRating: { type: Number, default: 0 },
});

serviceSchema.pre("save", function (next) {
  if (this.reviews.length > 0) {
    const totalRating = this.reviews.reduce(
      (sum, review) => sum + review.rating,
      0
    );
    this.averageRating = totalRating / this.reviews.length;
  }
  next();
});

export const Service = mongoose.model("Service", serviceSchema);
