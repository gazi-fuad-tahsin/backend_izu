import { Service } from "../models/service.model.js";
import { Provider } from "../models/provider.model.js";
import { Booking } from "../models/booking.model.js";
import { sendResponse } from "../utility/helper.js";
import AppError from "../errors/appError.js";
import catchAsync from "../utility/catchAsync.js";
import { getIO } from "../app.js";
import { Notification } from "../models/notification.model.js";
import { User } from "../models/user.model.js";
import { paymentInfo } from "../models/payment.model.js";
import {
  populateBooking,
  populateBookings,
} from "../utility/booking_population.js";

const populateForProvider = [
  { path: "serviceId", select: "title serviceDetails" },
  { path: "userId", select: "name email profileImage" },
];

const populateForUser = [
  { path: "serviceId", select: "title serviceDetails" },
  { path: "userId", select: "name email profileImage" },
  {
    path: "serviceId",
    populate: [
      { path: "providerId", model: "User", select: "name email profileImage" },
      { path: "category", model: "Category", select: "name" },
    ],
  },
  {
    path: "providerId",
    populate: {
      path: "providerId",
      model: "User",
      select: "name email profileImage",
    },
  },
];

const getPopulateOptions = (role) => {
  return role === "provider" ? populateForProvider : populateForUser;
};

export const updateLocation = catchAsync(async (req, res, next) => {
  const providerId = req.user._id;
  const { latitude, longitude } = req.body;

  if (
    !latitude ||
    !longitude ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return next(new AppError(400, "Invalid latitude or longitude"));
  }

  const provider = await Provider.findOneAndUpdate(
    { providerId },
    {
      location: {
        type: "Point",
        coordinates: [longitude, latitude],
        updatedAt: new Date(),
      },
    },
    { new: true, runValidators: true, upsert: true }
  );

  if (!provider) return next(new AppError(404, "Provider not found"));

  const io = getIO();
  io.emit("provider-location-update", {
    providerId,
    location: provider.location,
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Location updated",
    data: provider.location,
  });
});

export const getPendingRequests = catchAsync(async (req, res, next) => {
  const providerId = req.user._id;
  const provider = await Provider.findOne({ providerId });
  if (!provider) return next(new AppError(404, "Provider not found"));

  const providerActualId = provider._id;
  const requests = await populateBookings(
    Booking.find({
      providerId: providerId,
      status: "pending",
      requestSent: true,
      requestAccepted: false,
    })
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Pending requests",
    data: requests,
  });
});

export const acceptRequest = catchAsync(async (req, res, next) => {
  const { bookingId } = req.params;
  const providerId = req.user._id;

  const provider = await Provider.findOne({ providerId });
  if (!provider) return next(new AppError(404, "Provider not found"));

  const providerActualId = provider._id;
  let booking = await Booking.findById(bookingId);

  if (
    !booking ||
    booking.providerId._id.toString() !== provider.providerId.toString() || // Use providerActualId
    booking.status !== "pending"
  ) {
    return next(new AppError(404, "Request not found or unauthorized"));
  }

  booking.status = "upcoming";
  booking.requestAccepted = true;
  booking = await booking.save();
  booking = await populateBooking(Booking.findById(bookingId));

  const io = getIO();

  io.to(booking.userId._id.toString()).emit("request-accepted", {
    booking,
    providerId: provider.providerId,
    message: `Provider has accepted your booking.`,
  });

  

  const notification = await Notification.create({
    userId: booking.userId._id,
    providerId: provider.providerId,
    bookingId,
    type: "request-accepted",
    message: `Provider ${booking.userId.name} has accepted your booking.`,
  });

  io.to(booking.userId._id.toString()).emit("notification", notification);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Booking accepted successfully",
    data: booking,
  });
});

export const startService = catchAsync(async (req, res, next) => {
  const { bookingId } = req.params;
  const providerId = req.user._id;

  const provider = await Provider.findOne({ providerId });
  if (!provider) return next(new AppError(404, "Provider not found"));

  const providerActualId = provider._id;
  let booking = await Booking.findById(bookingId);

  if (
    !booking ||
    booking.providerId.toString() !== provider.providerId.toString() ||
    !(booking.status !== "ongoing" || booking.status !== "awaiting-user-confirmation-for-acceptance")
  ) {
    return next(
      new AppError(404, "Booking not found or not eligible to start service")
    );
  }

  booking.status = "awaiting-user-confirmation-for-acceptance";
  await booking.save();
  console.log(booking);

  const populatedBooking = await populateBooking(Booking.findById(bookingId));
  const io = getIO();
  console.log("Sending start service request to user", booking.userId.toString());
  io.to(booking.userId.toString()).emit("request-confirmation", {
    booking: populatedBooking,
    providerId: provider.providerId,
    message: `Provider wants to start your service. Do you confirm?`,
  });

  const notification = await Notification.create({
    userId: booking.userId,
    providerId: provider.providerId,
    bookingId,
    type: "request-confirmation",
    message: `Provider ${req.user.name} wants to start your service(${booking.title}). Please confirm to proceed.`,
  });

  io.to(booking.userId.toString()).emit("notification", notification);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Start service request sent to user for confirmation",
    data: populatedBooking,
  });
});

export const cancelRequest = catchAsync(async (req, res, next) => {
  const { bookingId } = req.params;
  const providerId = req.user._id;

  const booking = await Booking.findById(bookingId);
  if (!booking || booking.providerId.toString() !== providerId.toString()) {
    return next(new AppError(404, "Request not found or unauthorized"));
  }

  booking.status = "cancelled";
  await booking.save();

  const io = getIO();
  io.to(booking.userId.toString()).emit("request-cancelled", { bookingId });

  const notification = await Notification.create({
    userId: booking.userId,
    providerId,
    bookingId,
    type: "request-cancelled",
    message: `Your request has been cancelled by provider ${req.user.name}.`,
  });
  io.to(booking.userId.toString()).emit("notification", notification);

  if (booking.serviceId && Array.isArray(booking.serviceId.serviceDetails)) {
    booking.serviceId.serviceDetails =
      booking.serviceId.serviceDetails[0] || null;
  }

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Request cancelled",
    data: booking,
  });
});

export const getLiveBookings = catchAsync(async (req, res, next) => {
  const providerId = req.user._id;
  const provider = await Provider.findOne({ providerId });
  if (!provider) return next(new AppError(404, "Provider not found"));

  const providerActualId = provider._id;

  const liveBookings = await populateBookings(
    Booking.find({
      providerId: provider.providerId,
      status: { $in: ["ongoing", "awaiting-user-confirmation-for-acceptance"] },
    })
  );

  console.log(liveBookings);
  // status:  { $in: ["ongoing", "awaiting-user-confirmation-for-acceptance"] },
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Live bookings",
    data: liveBookings,
  });
});

export const getUpcomingBookings = catchAsync(async (req, res, next) => {
  const providerId = req.user._id;
  const provider = await Provider.findOne({ providerId });
  if (!provider) return next(new AppError(404, "Provider not found"));

  const providerActualId = provider._id;

  const upcomingBookings = await populateBookings(
    Booking.find({
      providerId: providerActualId,
      status: "upcoming",
    })
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Upcoming bookings",
    data: upcomingBookings,
  });
});

export const getCompletedAndCancelledBookings = catchAsync(
  async (req, res, next) => {
    const providerId = req.user._id;
    const provider = await Provider.findOne({ providerId });
    if (!provider) return next(new AppError(404, "Provider not found"));

    const providerActualId = provider._id;

    const completedAndCancelledBookings = await populateBookings(
      Booking.find({
        providerId: providerActualId,
        status: { $in: ["completed", "cancelled"] },
      })
    );
    let completed = completedAndCancelledBookings.filter(
      (booking) => booking.status === "completed"
    );

    let cancelled = completedAndCancelledBookings.filter(
      (booking) => booking.status === "cancelled"
    );

    if (
      completedAndCancelledBookings[0].serviceId &&
      Array.isArray(completedAndCancelledBookings[0].serviceId.serviceDetails)
    ) {
      completedAndCancelledBookings[0].serviceId.serviceDetails =
        completedAndCancelledBookings[0].serviceId.serviceDetails[0] || null;
    }

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Completed and cancelled bookings retrieved",
      data: {
        completed,
        cancelled,
      },
    });
  }
);

export const completeBooking = catchAsync(async (req, res, next) => {
  const { bookingId } = req.params;
  const providerId = req.user._id; // Use userId instead of providerId

  // Find the provider associated with this user
  const provider = await Provider.findOne({ providerId }); // Assuming userId links User and Provider
  if (!provider) return next(new AppError(404, "Provider not found"));

  if (!providerId.toString()) {
    return next(new AppError(403, "Unauthorized"));
  }

  const booking = await Booking.findById({
    _id: bookingId,
    status: {
      in: ["accepted", "ongoing", "awaiting-user-confirmation-for-completion"],
    },
  });
  booking.status = "awaiting-user-confirmation-for-completion";
  await booking.save();
  const savedBooking = await populateBooking(Booking.findById({
      _id: bookingId,
    }));

  const io = getIO();
  io.to(booking.userId.toString()).emit("provider-completed-request", {
    bookingId,
    booking: savedBooking,
    providerId,
    message: `Provider ${req.user.name} wants to complete your service. Do you confirm?`,
  });

  const notification = await Notification.create({
    userId: booking.userId,
    providerId,
    bookingId,
    type: "awaiting-user-confirmation-for-completion",
    message: `Provider has marked your booking as completed. Please confirm.`,
  });
  io.to(booking.userId.toString()).emit("notification", notification);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Completion request sent to user for confirmation",
    data: savedBooking,
  });
});

export const checkUpcomingBookings = async () => {
  const currentDate = new Date();

  const upcomingBookings = await populateBookings(
    Booking.find({
      status: "upcoming",
    })
  );

  const io = getIO();

  await Promise.all(
    upcomingBookings.map(async (booking) => {
      if (booking.bookingTime <= currentDate) {
        booking.status = "ongoing";
        await booking.save();

        // --- notify provider
        if (booking.providerId) {
          const providerNotification = await Notification.create({
            userId: booking.providerId,
            bookingId: booking._id,
            type: "booking-ongoing",
            message: `Your booking with user ${booking.userId.name} for '${booking.title}' has started.`,
          });
          io.to(booking.providerId.toString()).emit(
            "notification",
            providerNotification
          );
        }

        // --- notify user
        const userNotification = await Notification.create({
          userId: booking.userId,
          bookingId: booking._id,
          type: "booking-ongoing",
          message: `Your booking '${booking.title}' is now ongoing.`,
        });
        io.to(booking.userId.toString()).emit("notification", userNotification);
      }
    })
  );
};

export const getProviderStats = catchAsync(async (req, res, next) => {
  const providerId = req.user._id;
  const provider = await Provider.findOne({ providerId });
  if (!provider) return next(new AppError(404, "Provider not found"));

  const providerActualId = provider._id;

  const completedBookings = await Booking.countDocuments({
    providerId: providerActualId,
    status: "completed",
  });
  const totalEarnings = await Booking.aggregate([
    { $match: { providerId: providerActualId, status: "completed" } },
    { $group: { _id: null, total: { $sum: "$providerAmount" } } },
  ]).then((result) => result[0]?.total || 0);

  let totalAmount = totalEarnings * 0.9;

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Provider statistics",
    data: {
      totalWorkCompletion: completedBookings,
      providerEarnings: totalAmount,
    },
  });
});

export const getBookingLocation = catchAsync(async (req, res, next) => {
  const { bookingId } = req.params;
  const providerId = req.user._id;

  const provider = await Provider.findOne({ providerId });
  if (!provider) return next(new AppError(404, "Provider not found"));

  const booking = await Booking.findById(bookingId);
  if (!booking.status === "accepted || ongoing")
    return next(new AppError(404, "Booking not found"));

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Booking location retrieved",
    data: {
      location: booking.location,
    },
  });
});
