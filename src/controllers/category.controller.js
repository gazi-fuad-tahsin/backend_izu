import { Category } from "../models/category.model.js";
import { sendResponse, uploadOnCloudinary } from "../utility/helper.js";
import AppError from "../errors/appError.js";
import catchAsync from "../utility/catchAsync.js";
import { Service } from "../models/service.model.js";

export const createCategory = catchAsync(async (req, res) => {
  const { name } = req.body;

  let catImageUrl = req.file;
  if (req.file) {
    const uploadResult = await uploadOnCloudinary(req.file.buffer);
    catImageUrl = uploadResult.secure_url;
  }

  if (!name || !catImageUrl) {
    return next(new AppError(400, "Category name and image are required"));
  }

  const category = await Category.create({ name, catImage: catImageUrl });
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Category created",
    data: category,
  });
});

export const getAllCategories = catchAsync(async (req, res, next) => {
  const categories = await Category.find();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Categories retrieved",
    data: categories,
  });
});

export const getCategoryWiseServices = catchAsync(async (req, res, next) => {
  const { categoryId } = req.params;
  const services = await Service.find({ category: categoryId })
    .populate("category", "name catImage")
    .populate("providerId", "name");

  // Convert each service document to a plain object and fix serviceDetails
  const responseServices = services.map((service) => {
    const obj = service.toObject();
    if (Array.isArray(obj.serviceDetails)) {
      obj.serviceDetails = obj.serviceDetails[0] || {};
    }
    return obj;
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Services retrieved",
    data: responseServices,
  });
});
