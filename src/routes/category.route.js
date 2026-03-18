import express from "express";
import {
  createCategory,
  getAllCategories,
} from "../controllers/category.controller.js";
import { isAuthenticated } from "../middlewares/auth.middlewares.js";
import upload from "../middlewares/multer.middlewares.js";

const router = express.Router();
router.use(isAuthenticated);

router.post("/", upload.single("catImage"), createCategory);
router.get("/", getAllCategories);

export default router;
