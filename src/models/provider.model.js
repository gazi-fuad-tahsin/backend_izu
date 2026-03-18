import mongoose from "mongoose";

const providerSchema = new mongoose.Schema({
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  name: { type: String },
  email: { type: String },
  availability: [{ type: Date }],
  isActive: { type: Boolean, default: true },
  location: {
    type: { type: String, enum: ["Point"], required: true, default: "Point" },
    coordinates: [Number],
  },
});

providerSchema.index({ location: "2dsphere" });
export const Provider = mongoose.model("Provider", providerSchema);
