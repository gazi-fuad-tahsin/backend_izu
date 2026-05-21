import AppError from "../errors/appError.js";
import { Service } from "../models/service.model.js";
import catchAsync from "../utility/catchAsync.js";
import { sendResponse, uploadOnCloudinary } from "../utility/helper.js";

// CREATE SERVICE
export const createService = catchAsync(async (req, res, next) => {
  const { category, serviceDetails } = req.body;
  const providerId = req.user._id;

  // Validate provider account type
  if (req.user.accountType !== "provider") {
    return next(new AppError(403, "Only providers can create services"));
  }

  // Validate required fields
  if (!category) {
    return next(new AppError(400, "Category is required"));
  }

  // Handle serviceDetails
  let details;
  if (typeof serviceDetails === "string") {
    try {
      details = JSON.parse(serviceDetails);
    } catch (err) {
      return next(new AppError(400, "Invalid serviceDetails format"));
    }
  } else {
    details = serviceDetails;
  }

  if (typeof details !== "object" || details === null) {
    return next(new AppError(400, "serviceDetails must be an object"));
  }

  // Validate required serviceDetails fields
  if (!details.title || !details.serviceType) {
    return next(
      new AppError(400, "title and serviceType are required in serviceDetails")
    );
  }
  if (!["per session", "hourly"].includes(details.serviceType)) {
    return next(
      new AppError(400, "serviceType must be 'per session' or 'hourly'")
    );
  }

  // Handle file uploads
  let thumbnails = [];
  if (req.files?.serviceThumbnails?.length > 0) {
    if (req.files.serviceThumbnails.length > 3) {
      return next(
        new AppError(400, "You can upload a maximum of 3 thumbnails")
      );
    }
    for (const file of req.files.serviceThumbnails) {
      if (!file?.buffer) {
        return next(new AppError(400, "Empty file detected"));
      }
      const uploaded = await uploadOnCloudinary(file.buffer);
      if (!uploaded?.url) {
        return next(new AppError(500, "Failed to upload thumbnail"));
      }
      thumbnails.push(uploaded.url);
    }
  }

  // Add thumbnails to serviceDetails
  details.serviceThumbnails = thumbnails;

  // Create service
  const service = await Service.create({
    category,
    serviceDetails: [details], // Store as array per schema
    providerId,
  });

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Service created successfully",
    data: service,
  });
});

// UPDATE SERVICE
export const updateService = catchAsync(async (req, res, next) => {
  const { serviceId } = req.params;
  const providerId = req.user._id;
  const { category, serviceDetails } = req.body;

  // Find existing service
  const existingService = await Service.findById(serviceId);
  if (!existingService) {
    return next(new AppError(404, "Service not found"));
  }

  // Validate provider ownership
  if (!existingService.providerId.equals(providerId)) {
    return next(
      new AppError(403, "You are not allowed to update this service")
    );
  }

  // Prepare update data
  let updateData = {};
  let detailsUpdated = false;

  // Handle category update
  if (category) {
    updateData.category = category;
  }

  // Get existing serviceDetails (assume single entry for simplicity)
  let existingDetails = existingService.serviceDetails[0]
    ? existingService.serviceDetails[0].toObject()
    : {};

  let newDetails = { ...existingDetails };

  // Handle serviceDetails update
  if (serviceDetails) {
    let detailsInput;
    if (typeof serviceDetails === "string") {
      try {
        detailsInput = JSON.parse(serviceDetails);
      } catch (err) {
        return next(new AppError(400, "Invalid serviceDetails format"));
      }
    } else {
      detailsInput = serviceDetails;
    }

    if (typeof detailsInput !== "object" || detailsInput === null) {
      return next(new AppError(400, "serviceDetails must be an object"));
    }

    // Validate serviceType if provided
    if (
      detailsInput.serviceType &&
      !["per session", "hourly"].includes(detailsInput.serviceType)
    ) {
      return next(
        new AppError(400, "serviceType must be 'per session' or 'hourly'")
      );
    }

    // Merge provided serviceDetails fields with existing ones
    newDetails = { ...newDetails, ...detailsInput };
    detailsUpdated = true;
  }

  // Handle file uploads
  if (req.files?.serviceThumbnails?.length > 0) {
    if (req.files.serviceThumbnails.length > 3) {
      return next(
        new AppError(400, "You can upload a maximum of 3 thumbnails")
      );
    }

    let thumbnails = [];
    for (const file of req.files.serviceThumbnails) {
      if (!file?.buffer) {
        return next(new AppError(400, "Empty file detected"));
      }
      const uploaded = await uploadOnCloudinary(file.buffer);
      if (!uploaded?.url) {
        return next(new AppError(500, "Failed to upload thumbnail"));
      }
      thumbnails.push(uploaded.url);
    }

    // Replace or merge thumbnails (replace in this case, can modify to merge if needed)
    newDetails.serviceThumbnails = thumbnails;
    detailsUpdated = true;
  }

  // Update serviceDetails only if modified
  if (detailsUpdated) {
    updateData.serviceDetails = [newDetails];
  }

  // Check if there's anything to update
  if (Object.keys(updateData).length === 0) {
    return next(new AppError(400, "No valid fields provided for update"));
  }

  // Perform update
  const updatedService = await Service.findByIdAndUpdate(
    serviceId,
    { $set: updateData },
    { new: true, runValidators: true }
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Service updated successfully",
    data: updatedService,
  });
});

// Get service details by ID
export const getServiceDetails = catchAsync(async (req, res, next) => {
  const { serviceId } = req.params;
  const service = await Service.findById(serviceId)
    .populate("category", "name catImage")
    .populate("providerId", "name profileImage email");
  if (!service) return next(new AppError(404, "Service not found"));

  // Ensure serviceDetails is not an array in response
  const responseService = service.toObject();
  if (Array.isArray(responseService.serviceDetails)) {
    responseService.serviceDetails = responseService.serviceDetails[0] || {};
  }

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Service details",
    data: responseService,
  });
});

// Delete service
export const deleteService = catchAsync(async (req, res, next) => {
  const { serviceId } = req.params;
  const service = await Service.findByIdAndDelete(serviceId);
  if (!service) return next(new AppError(404, "Service not found"));

  sendResponse(res, {
    statusCode: 200,
    success: true,
    data: {
        message: "Service deleted successfully",
    }
  });
});

// Get all and popular services
export const getAllAndPopularServices = catchAsync(async (req, res, next) => {
  // Fetch popular services based on bookings
  const popularServices = await Service.aggregate([
    {
      $lookup: {
        from: "bookings",
        localField: "_id",
        foreignField: "serviceId",
        as: "bookings",
      },
    },
    {
      $addFields: {
        totalBookings: { $size: "$bookings" },
      },
    },
    {
      $match: {
        totalBookings: { $gt: 0 },
      },
    },
    // Add category lookup inside aggregation
    {
      $lookup: {
        from: "categories",
        localField: "category",
        foreignField: "_id",
        as: "category",
      },
    },
    {
      $addFields: {
        category: { $arrayElemAt: ["$category", 0] },
      },
    },
    { $sort: { totalBookings: -1 } },
    { $limit: 5 },
  ]);

  // Populate provider for popular services only (category is already populated)
  const populatedPopularServices = await Service.populate(popularServices, {
    path: "providerId",
    select: "name profileImage email",
    model: "User",
  });

  // Format popular services and ensure serviceDetails is not an array
  const formattedPopularServices = populatedPopularServices.map((service) => {
    const { providerId, bookings, serviceDetails, ...rest } = service;
    return {
      ...rest,
      provider: providerId,
      serviceDetails: Array.isArray(serviceDetails)
        ? serviceDetails[0] || {}
        : serviceDetails,
    };
  });

  // Fetch all services with category and provider populated
  const allServices = await Service.find()
    .populate("category", "name catImage")
    .populate("providerId", "name profileImage language email");

  // Group services by category name
  const servicesByCategory = allServices.reduce((acc, service) => {
    const serviceObj = service.toObject();
    const categoryName = serviceObj.category?.name || "Uncategorized";

    // Rename providerId to provider and ensure serviceDetails is not an array
    const formattedService = {
      ...serviceObj,
      provider: serviceObj.providerId,
      serviceDetails: Array.isArray(serviceObj.serviceDetails)
        ? serviceObj.serviceDetails[0] || {}
        : serviceObj.serviceDetails,
    };
    delete formattedService.providerId;

    // Initialize category array if it doesn't exist
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }

    // Add service to category
    acc[categoryName].push(formattedService);

    return acc;
  }, {});

  // Combine popular and categorized services
  const responseData = {
    "Most Popular": formattedPopularServices,
    ...servicesByCategory,
  };

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "All and popular services retrieved successfully",
    data: responseData,
  });
});

// Get own services for providers
export const getOwnServices = catchAsync(async (req, res, next) => {
  const providerId = req.user._id;
  const services = await Service.find({ providerId })
    .populate("category", "name catImage")
    .populate("providerId", "name email profileImage");

  // Ensure serviceDetails is not an array in response
  const formattedServices = services.map((service) => {
    const serviceObj = service.toObject();
    return {
      ...serviceObj,
      serviceDetails: Array.isArray(serviceObj.serviceDetails)
        ? serviceObj.serviceDetails[0] || {}
        : serviceObj.serviceDetails,
    };
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Own Services",
    data: formattedServices,
  });
});

// Get category-wise services
export const getCategoryWiseServices = catchAsync(async (req, res, next) => {
  const { categoryId } = req.params;
  const services = await Service.find({ category: categoryId })
    .populate("category", "name catImage")
    .populate("providerId", "name email profileImage");

  // Ensure serviceDetails is not an array in response
  const formattedServices = services.map((service) => {
    const serviceObj = service.toObject();
    return {
      ...serviceObj,
      serviceDetails: Array.isArray(serviceObj.serviceDetails)
        ? serviceObj.serviceDetails[0] || {}
        : serviceObj.serviceDetails,
      provider: serviceObj.providerId,
    };
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Services retrieved",
    data: formattedServices,
  });
});
