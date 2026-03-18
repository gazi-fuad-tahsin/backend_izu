import AppError from "../errors/appError.js";
import { Notification } from "../models/notification.model.js";
import catchAsync from "../utility/catchAsync.js";
import { sendResponse } from "../utility/helper.js";

export const getNotifications = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { limit = 30, page = 1 } = req.query;
  const skip = (page - 1) * limit;
  console.log(req.params)
  const notifications = await Notification.find({ userId })
    .skip(skip)
    .limit(limit)
    .populate("bookingId", "bookingTime status")
    .sort({ createdAt: -1 });

  if (!notifications) return next(new AppError(404, "No notifications found"));

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User notifications",
    data: notifications,
  });
});

export const getAdminNotifications = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  const notifications = await Notification.find({ userId })
    .populate("messageId", "message from to createdAt")
    .sort({ createdAt: -1 });

  if (!notifications) return next(new AppError(404, "No notifications found"));

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User notifications",
    data: notifications,
  });
});

export const markNotificationAsRead = catchAsync(async (req, res, next) => {
  const { notificationId } = req.params;
  const userId = req.user._id;

  const notification = await Notification.findById(notificationId);
  if (!notification || notification.userId.toString() !== userId.toString()) {
    return next(new AppError(404, "Notification not found or unauthorized"));
  }

  notification.read = true;
  await notification.save();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Notification marked as read",
    data: notification,
  });
});

export const markAllNotificationsAsRead = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  const notifications = await Notification.updateMany(
    { userId },
    { read: true }
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "All notifications marked as read",
    data: notifications,
  });
});
