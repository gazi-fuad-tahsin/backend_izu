import express from "express";
import {
  getAdminStatistics,
  getRevenueByMonth,
  getUserList,
  getProviderList,
  getCommissionReports,
  getRecentActivity,
  getTopServices,
} from "../controllers/admin.controller.js";
import { isAuthenticated } from "../middlewares/auth.middlewares.js";


const router = express.Router();
router.use(isAuthenticated);

// Admin Routes
router.get("/statistics", getAdminStatistics);
router.get("/revenue-by-month", getRevenueByMonth);
router.get("/recent-activity", getRecentActivity);
router.get("/top-services", getTopServices);
router.get("/users", getUserList);
router.get("/providers", getProviderList);
router.get("/commission-reports", getCommissionReports);

export default router;
