import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  lastName: { type: String },
  bio: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  profileImage: { type: String, default: "" },
  accountType: {
    type: String,
    enum: ["user", "provider", "admin"],
    required: true,
  },
  refreshToken: { type: String, select: false },
  otp: { type: String, select: false },
  location: {
    type: { type: String, enum: ["Point"], required: true, default: "Point" },
    coordinates: [Number],
  },
  stripeAccountId: { type: String },
  phone: { type: String },
  language: {
    type: String,
    enum: ["English", "Deutsch", "عربي"],
    default: "English",
  },
  createdAt: { type: Date, default: Date.now },
});

// compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model("User", userSchema);
