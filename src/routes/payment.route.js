import express from "express";
import {
  createPayment,
  confirmPayment,
  createStripeConnectAccount,
} from "../controllers/payment.controller.js";
import { isAuthenticated } from "../middlewares/auth.middlewares.js";

const router = express.Router();

// Create Payment
router.post("/create-payment", isAuthenticated, createPayment);

// Capture Payment
router.post("/confirm-payment", isAuthenticated, confirmPayment);

router.post("/connect", isAuthenticated, createStripeConnectAccount);

export default router;
