import { User } from "../models/user.model.js";
import { Booking } from "../models/booking.model.js";
import { sendResponse, uploadOnCloudinary } from "../utility/helper.js";
import AppError from "../errors/appError.js";
import catchAsync from "../utility/catchAsync.js";
import { paymentInfo } from "../models/payment.model.js";
import { Provider } from "../models/provider.model.js";
import { Service } from "../models/service.model.js";
import bcrypt from "bcryptjs";

// For user and admin
export const getProfile = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const user = await User.findById(userId).select("-password -refreshToken");
  // if provider then don't show profile info
  if (user.accountType === "provider") {
    return next(new AppError(403, "Access denied"));
  }

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Profile retrieved",
    data: user,
  });
});

// For provider
export const getProviderProfile = catchAsync(async (req, res, next) => {
  const providerId = req.user._id;
  const provider = await Provider.findOne({ providerId }).populate({
    path: "providerId",
    select: "name profileImage language",
  });

  if (!provider) return next(new AppError(404, "Provider not found"));

  const services = await Service.find({ providerId }).select(
    "title averageRating reviews"
  );
  const totalRating = services.reduce(
    (sum, service) => sum + service.averageRating,
    0
  );
  const overallAverageRating =
    services.length > 0 ? totalRating / services.length : 0;

  // Flatten providerId fields into main object
  const providerObj = provider.toObject();
  let mergedProvider = { ...providerObj };
  if (providerObj.providerId && typeof providerObj.providerId === "object") {
    mergedProvider = {
      ...providerObj,
      ...providerObj.providerId,
    };
    delete mergedProvider.providerId;
  }

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Provider profile retrieved",
    data: {
      ...mergedProvider,
      overallAverageRating: overallAverageRating.toFixed(1),
      services,
    },
  });
});

export const updateProfile = catchAsync(async (req, res, next) => {
  const userOrProviderOrAdminId = req.user._id;
  const { name, phone, bio, lastName, email } = req.body;

  let profileImageUrl = req.user.profileImage;
  if (req.file) {
    const uploadResult = await uploadOnCloudinary(req.file.buffer, "profile");
    profileImageUrl = uploadResult.secure_url;
  }

  // Update User document
  const updatedUser = await User.findByIdAndUpdate(
    userOrProviderOrAdminId,
    { name, phone, bio, lastName, email, profileImage: profileImageUrl },
    { new: true, runValidators: true }
  ).select("-password -refreshToken");

  // If provider, also update Provider document
  if (req.user.accountType === "provider") {
    await Provider.findOneAndUpdate(
      { providerId: userOrProviderOrAdminId },
      { name, phone, bio, lastName, email, profileImage: profileImageUrl },
      { new: true, runValidators: true }
    );
  }

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Profile updated successfully",
    data: updatedUser,
  });
});

export const updateLanguage = catchAsync(async (req, res, next) => {
  const userOrProviderOrAdminId = req.user._id;
  const { language } = req.body;

  if (!["English", "Deutsch", "عربي"].includes(language)) {
    return next(new AppError(400, "Invalid language code"));
  }

  const user = await User.findByIdAndUpdate(
    userOrProviderOrAdminId,
    { language },
    { new: true, runValidators: true }
  );

  if (!user) return next(new AppError(404, "User not found"));

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Language updated",
    data: { language: user.language },
  });
});

export const getServiceHistory = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { search } = req.query;

  let allHistory = await Booking.find({ userId })
    .populate("serviceId providerId", "name")
    .sort({ bookingTime: -1 });

  if (search) {
    const searchRegex = new RegExp(search, "i");
    allHistory = allHistory.filter((booking) =>
      searchRegex.test(booking?.serviceId?.name || "")
    );
  }

  const liveHistory = allHistory.filter(
    (booking) => booking.status === "accepted" || booking.status === "ongoing"
  );
  const upcomingHistory = allHistory.filter(
    (booking) => booking.status === "upcoming"
  );
  const completedHistory = allHistory.filter(
    (booking) => booking.status === "completed"
  );
  const cancelledHistory = allHistory.filter(
    (booking) => booking.status === "cancelled"
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Service history",
    data: {
      live: liveHistory,
      upcoming: upcomingHistory,
      completed: completedHistory,
      cancelled: cancelledHistory,
    },
  });
});

export const changePassword = catchAsync(async (req, res, next) => {
  const userOrProviderOrAdminId = req.user._id;
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return next(
      new AppError(400, "Current, new, and confirm passwords are required")
    );
  }

  if (newPassword !== confirmPassword) {
    return next(
      new AppError(400, "New password and confirm password do not match")
    );
  }

  const user = await User.findById(userOrProviderOrAdminId).select("+password");
  if (!user) {
    return next(new AppError(404, "User not found"));
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    return next(new AppError(401, "Current password is incorrect"));
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  await user.save();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Password changed successfully",
  });
});
