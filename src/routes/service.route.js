import express from "express";
import {
  createService,
  updateService,
  // getAllServices,
  getServiceDetails,
  // getPopularServices,
  getAllAndPopularServices,
  getOwnServices,
  getCategoryWiseServices,
  deleteService,
} from "../controllers/service.controller.js";
import { isAuthenticated } from "../middlewares/auth.middlewares.js";
import upload from "../middlewares/multer.middlewares.js";

const router = express.Router();
router.use(isAuthenticated);

// Service Routes
router.post(
  "/",
  upload.fields([{ name: "serviceThumbnails", maxCount: 3 }]),
  createService
);
router.get("/", getAllAndPopularServices);
router.patch(
  "/:serviceId",
  upload.fields([{ name: "serviceThumbnails", maxCount: 3 }]),
  updateService
);
// router.get("/popular", getPopularServices);
router.get("/own-services", getOwnServices);
// router.get("/", getAllServices);
router.get("/:serviceId", getServiceDetails);
router.get("/categoryWise/:categoryId", getCategoryWiseServices);
router.delete("/delete/:serviceId", deleteService);

export default router;
