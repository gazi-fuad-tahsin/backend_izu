import express from "express";
import {
  signup,
  login,
  forgotPassword,
  verifyOTP,
  resetPassword,
  refreshAccessToken,
  logout,
  changePassword,
} from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOTP);
router.post("/reset-password", resetPassword);
router.post("/change-password", changePassword);
router.post("/refresh-token", refreshAccessToken);
router.post("/logout", logout);

export default router;
