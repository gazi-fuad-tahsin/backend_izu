import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  catImage: { type: String, required: true },
  isActive: { type: Boolean, default: true },
});

export const Category = mongoose.model("Category", categorySchema);
