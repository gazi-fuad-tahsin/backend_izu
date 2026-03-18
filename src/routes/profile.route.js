import express from "express";
import {
  getProfile,
  getProviderProfile,
  updateProfile,
  updateLanguage,
  getServiceHistory,
  changePassword,
} from "../controllers/profile.controller.js";

import { isAuthenticated } from "../middlewares/auth.middlewares.js";
import upload from "../middlewares/multer.middlewares.js";

const router = express.Router();
router.use(isAuthenticated);

router.get("/", getProfile);
router.get("/provider", getProviderProfile);
router.patch("/", upload.single("profileImage"), updateProfile);
router.patch("/language", updateLanguage);
router.get("/service-history", getServiceHistory);
router.patch("/change-password", changePassword);

export default router;
