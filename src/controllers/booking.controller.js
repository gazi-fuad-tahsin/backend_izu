import { getIO } from "../app.js";
import AppError from "../errors/appError.js";
import { Booking } from "../models/booking.model.js";
import { Notification } from "../models/notification.model.js";
import { Provider } from "../models/provider.model.js";
import { Service } from "../models/service.model.js";
import {
  populateBooking,
  populateBookings,
} from "../utility/booking_population.js";
import catchAsync from "../utility/catchAsync.js";
import { sendResponse } from "../utility/helper.js";

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

export const createBooking = catchAsync(async (req, res, next) => {
  const io = getIO();
  const {
    serviceId,
    title,
    bookingTime,
    location,
    estimatedHours,
    bookingType,
    extraNote,
  } = req.body;
  const userId = req.user._id;

  // Check for duplicate booking
  const existingBooking = await Booking.findOne({
    userId,
    serviceId,
    status: { $in: ["pending", "ongoing", "upcoming", "accepted"] },
  }).populate("userId", "name email profileImage");
  if (existingBooking) {
    return next(
      new AppError(400, "A booking for this service and time already exists")
    );
  }

  const service = await Service.findById(serviceId);
  if (!service) return next(new AppError(404, "Service not found"));

  if (bookingType !== "hourly" && bookingType !== "per session") {
    return next(new AppError(400, "Invalid booking type"));
  }

  let basePrice =
    bookingType === "hourly"
      ? service.serviceDetails[0]?.hourlyPrice
      : service.serviceDetails[0]?.perSessionPrice;
  if (!basePrice)
    return next(new AppError(400, "Price not defined for this service"));

  let totalAmount = basePrice;
  if (bookingType === "hourly") {
    totalAmount *= estimatedHours;
  }

  const providerAmount = totalAmount * 0.9;

  let booking = await Booking.create({
    userId,
    serviceId,
    title,
    bookingTime,
    location: location,
    totalPrice: totalAmount,
    providerAmount,
    bookingType,
    estimatedHours,
    extraNote,
    status: "pending",
    providerId: service.providerId,
    requestSent : true
  });

  if (!booking) return next(new AppError(500, "Failed to create booking"));

  // if (service.providerId) {
  //   booking.providerId = new mongoose.Types.ObjectId(service.providerId);
  //   booking.requestSent = false;
  //   await booking.save();
  // }

  let booking1 = await populateBooking(Booking.findById(booking._id));

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Booking created",
    data: booking1,
  });
});

export const cancelBooking = catchAsync(async (req, res, next) => {
  const { bookingId } = req.params;
  const userId = req.user._id;

  const booking = await populateBooking(
    Booking.findOne({
      _id: bookingId,
      status: { $in: ["pending", "upcoming", "accepted", "awaiting-user-confirmation-for-acceptance", "waiting-for-start"] },
      userId,
    })
  );

  if (!booking) {
    return next(new AppError(404, "Booking not found or unauthorized"));
  }

  booking.status = "cancelled";
  await booking.save();

  const io = getIO();
  io.to(userId.toString()).emit("booking-cancelled-user", { bookingId });

  if (booking.providerId) {
    // extract provider's userId properly
    const providerUserId =
      booking.providerId.providerId?._id || booking.providerId._id;

    io.to(providerUserId.toString()).emit("booking-cancelled-provider", {
      bookingId,
    });

    const notification = await Notification.create({
      userId: providerUserId,
      bookingId,
      type: "booking-cancelled",
      message: `The booking has been cancelled by the ${req.user.name}.`,
    });

    io.to(providerUserId.toString()).emit("notification", notification);
  }

  if (booking.serviceId && Array.isArray(booking.serviceId.serviceDetails)) {
    booking.serviceId.serviceDetails =
      booking.serviceId.serviceDetails[0] || null;
  }

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Booking cancelled",
    data: { _id: booking._id, status: booking.status },
  });
});

export const confirmRequest = catchAsync(async (req, res, next) => {
  const { bookingId } = req.params;
  const userId = req.user._id;

  let booking = await Booking.findById(bookingId);

  if (
    !booking ||
    booking.userId.toString() !== userId.toString() ||
    booking.status !== "awaiting-user-confirmation-for-acceptance"
  ) {
    return next(
      new AppError(404, "Request not found or not awaiting confirmation")
    );
  }

  booking.status = "ongoing";
  booking.requestAccepted = true;
  booking.acceptStartServiceTime = Date.now();
  await booking.save();
  booking = await populateBooking(Booking.findById(bookingId));
  const io = getIO();
  const providerUserId =
    booking.providerId.providerId?._id || booking.providerId._id;

  io.to(providerUserId.toString()).emit("request-confirmed", {
    bookingId,
    userId,
    message: `${req.user.name} has confirmed the request and started the service.`,
  });

  const notification = await Notification.create({
    userId: providerUserId,
    bookingId,
    type: "request-confirmed",
    message: `Your request has been confirmed by user ${userId}.`,
  });

  io.to(providerUserId.toString()).emit("notification", notification);

  if (booking.serviceId && Array.isArray(booking.serviceId.serviceDetails)) {
    booking.serviceId.serviceDetails =
      booking.serviceId.serviceDetails[0] || null;
  }

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Booking request confirmed and started",
    data: booking,
  });
});

export const confirmCompletionRequest = catchAsync(async (req, res, next) => {
  const { bookingId } = req.params;
  const userId = req.user._id;

  const booking = await (Booking.findById(bookingId));

  if (
    !booking ||
    booking.userId._id.toString() !== userId.toString() ||
    booking.status !== "awaiting-user-confirmation-for-completion"
  ) {
    return next(
      new AppError(404, "Request not found or not awaiting confirmation")
    );
  }

  booking.status = "completed";
  await booking.save();

  const savedBooking = await populateBooking(Booking.findById(bookingId));

  const io = getIO();
  const providerUserId =
    booking.providerId.providerId?._id || booking.providerId._id;

  io.to(providerUserId.toString()).emit("booking-completed", {
    bookingId,
    userId,
  });

  const notification = await Notification.create({
    userId: providerUserId,
    bookingId,
    type: "booking-completed",
    message: `User ${req.user.name} has confirmed the completion of your booking.`,
  });

  io.to(providerUserId.toString()).emit("notification", notification);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Booking confirmed as completed",
    data: savedBooking
  });
});

export const submitServiceReview = catchAsync(async (req, res, next) => {
  const { bookingId } = req.params;
  const userId = req.user._id;
  const { rating, message, serviceId } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return next(new AppError(400, "Rating must be between 1 and 5"));
  }

  const booking = await Booking.findById(bookingId).populate(
    "userId",
    "name email profileImage"
  );

  if (
    !booking ||
    booking.status !== "completed" ||
    booking.userId._id.toString() !== userId.toString()
  ) {
    return next(
      new AppError(404, "Booking not found, not completed, or unauthorized")
    );
  }

  const service = await Service.findById(serviceId).populate({
    path: "providerId",
    populate: {
      path: "providerId",
      model: "User",
      select: "name email profileImage",
    },
  });
  if (!service) return next(new AppError(404, "Service not found"));

  const provider = await Provider.findById(booking.providerId).populate(
    "providerId",
    "name email profileImage"
  );
  if (!provider) return next(new AppError(404, "Provider document not found"));

  // Ensure the service provider matches the booking provider
  if (
    provider.providerId._id.toString() !==
    service.providerId.providerId._id.toString()
  ) {
    return next(
      new AppError(
        403,
        "Service not associated with the provider in this booking"
      )
    );
  }

  const newReview = {
    rating: parseInt(rating),
    message: message?.trim() || "",
    submittedBy: userId,
  };

  service.reviews.push(newReview);
  await service.save();

  const io = getIO();
  io.to(provider.providerId._id.toString()).emit("service-review-submitted", {
    serviceId,
    review: newReview,
  });

  const notification = await Notification.create({
    userId: provider.providerId._id,
    bookingId,
    type: "service-review-submitted",
    message: `User ${req.user.name} submitted a review for service ${
      service.serviceDetails.title
    }: ${rating}★${message ? ` - ${message}` : ""}`,
  });

  io.to(provider.providerId._id.toString()).emit("notification", notification);

  if (serviceId && Array.isArray(serviceId.serviceDetails)) {
    serviceId.serviceDetails = serviceId.serviceDetails[0] || null;
  }

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Service review submitted successfully",
    data: { serviceId, review: newReview },
  });
});

export const getLiveBookings = catchAsync(async (req, res, next) => {
  const role = req.user.accountType;
  const userId = req.user._id;
  let filter = {};
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  if (role === "provider") {
    const provider = await Provider.findOne({ providerId: userId });
    if (!provider) return next(new AppError(404, "Provider not found"));
    filter.providerId = req.user._id;
  } else {
    filter.userId = userId;
  }

  filter.status = { $in: ["ongoing", "awaiting-user-confirmation-for-acceptance", "awaiting-user-confirmation-for-completion", "waiting-for-start"] };
  console.log(filter);
  const liveBookings = await populateBookings(
    Booking.find(filter).skip(skip).limit(limit).sort({ bookingTime: 1 })
  );
  console.log(liveBookings);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Live bookings retrieved",
    data: liveBookings,
    pagination: { page, limit },
  });
});

// export const getUpcomingBookings = catchAsync(async (req, res, next) => {
//   const userId = req.user._id;
//   const currentDate = new Date();
//   const upcomingBookings = await Booking.find({
//     userId,
//     status: "upcoming",
//     bookingTime: { $gt: currentDate },
//   })
//     .populate("serviceId", "title serviceDetails")
//     .populate("userId", "name email profileImage")
//     .populate({
//       path: "serviceId",
//       populate: {
//         path: "providerId",
//         model: "User",
//         select: "name email profileImage",
//       },
//       populate: {
//         path: "category",
//         model: "Category",
//         select: "name",
//       },
//     })
//     .populate({
//       path: "providerId",
//       populate: {
//         path: "providerId",
//         model: "User",
//         select: "name email profileImage",
//       },
//     });

//   if (
//     upcomingBookings.serviceId &&
//     Array.isArray(upcomingBookings.serviceId.serviceDetails)
//   ) {
//     upcomingBookings.serviceId.serviceDetails =
//       upcomingBookings.serviceId.serviceDetails[0] || null;
//   }

//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "Upcoming bookings retrieved",
//     data: upcomingBookings,
//   });
// });

// export const getCompletedAndCancelledBookings = catchAsync(
//   async (req, res, next) => {
//     const userId = req.user._id;

//     const completedAndCancelledBookings = await Booking.find({
//       userId,
//       status: { $in: ["completed", "cancelled"] },
//     })
//       .populate("serviceId", "title serviceDetails")
//       .populate("userId", "name email profileImage")
//       .populate({
//         path: "serviceId",
//         populate: {
//           path: "providerId",
//           model: "User",
//           select: "name email profileImage",
//         },
//         populate: {
//           path: "category",
//           model: "Category",
//           select: "name",
//         },
//       })
//       .populate({
//         path: "providerId",
//         populate: {
//           path: "providerId",
//           model: "User",
//           select: "name email profileImage",
//         },
//       });

//     let completed = completedAndCancelledBookings.filter(
//       (booking) => booking.status === "completed"
//     );
//     let cancelled = completedAndCancelledBookings.filter(
//       (booking) => booking.status === "cancelled"
//     );

//     if (
//       completed.serviceId &&
//       Array.isArray(completed.serviceId.serviceDetails)
//     ) {
//       completed.serviceId.serviceDetails =
//         completed.serviceId.serviceDetails[0] || null;
//     }

//     if (
//       cancelled.serviceId &&
//       Array.isArray(cancelled.serviceId.serviceDetails)
//     ) {
//       cancelled.serviceId.serviceDetails =
//         cancelled.serviceId.serviceDetails[0] || null;
//     }

//     sendResponse(res, {
//       statusCode: 200,
//       success: true,
//       message: "Completed and cancelled bookings retrieved",
//       data: { completed, cancelled },
//     });
//   }
// );

// Upcoming Bookings (keep as is, but added pagination)
export const getUpcomingBookings = catchAsync(async (req, res, next) => {
  const role = req.user.accountType;
  let filter = {};

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  if (role === "provider") {
    const provider = await Provider.findOne({ providerId: req.user._id });
    if (!provider) return next(new AppError(404, "Provider not found"));
    filter.providerId = req.user._id;
  } else {
    filter.userId = req.user._id;
  }

  filter.status = "upcoming";

  const bookings = await populateBookings(Booking.find(filter)
    .skip(skip)
    .limit(limit)
    .sort({ bookingTime: 1 })
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Upcoming bookings retrieved",
    data: bookings,
    pagination: { page, limit },
  });
});

// Completed Bookings
export const getCompletedBookings = catchAsync(async (req, res, next) => {
  const role = req.user.accountType;
  let filter = {};

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  if (role === "provider") {
    const provider = await Provider.findOne({ providerId: req.user._id });
    if (!provider) return next(new AppError(404, "Provider not found"));
    filter.providerId = provider.providerId;
  } else {
    filter.userId = req.user._id;
  }

  filter.status = "completed";
  console.log(filter);
  const bookings = await populateBookings(
    Booking.find(filter).skip(skip).limit(limit).sort({ bookingTime: -1 })
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Completed bookings retrieved",
    data: bookings,
    pagination: { page, limit },
  });
});

// Cancelled Bookings
export const getCancelledBookings = catchAsync(async (req, res, next) => {
  const role = req.user.accountType;
  let filter = {};

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  if (role === "provider") {
    const provider = await Provider.findOne({ providerId: req.user._id });
    if (!provider) return next(new AppError(404, "Provider not found"));
    filter.providerId = provider._id;
  } else {
    filter.userId = req.user._id;
  }

  filter.status = "cancelled";

  const bookings = await populateBookings(
    Booking.find(filter).skip(skip).limit(limit).sort({ bookingTime: -1 })
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Cancelled bookings retrieved",
    data: bookings,
    pagination: { page, limit },
  });
});
