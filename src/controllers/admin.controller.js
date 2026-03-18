import { Provider } from "../models/provider.model.js";
import { Booking } from "../models/booking.model.js";
import { sendResponse } from "../utility/helper.js";
import AppError from "../errors/appError.js";
import catchAsync from "../utility/catchAsync.js";
import { User } from "../models/user.model.js";
import { paymentInfo } from "../models/payment.model.js";
import { Service } from "../models/service.model.js";

const sendPaginatedResponse = (
  res,
  { statusCode = 200, success = true, message = "", data = [], pagination = {} }
) => {
  res.status(statusCode).json({
    success,
    message,
    data,
    pagination: {
      page: Number(pagination.page) || 1,
      limit: Number(pagination.limit) || 10,
      totalPages: Number(pagination.totalPages) || 1,
      totalItems: Number(pagination.totalItems) || 0,
    },
  });
};

export const getAdminStatistics = catchAsync(async (req, res, next) => {
  const totalUser = await User.countDocuments({
    accountType: { $ne: "admin" },
  });
  const totalProvider = await Provider.countDocuments();
  const totalOrder = await Booking.countDocuments({ status: "completed" });

  const completedBookings = await Booking.find({ status: "completed" }).select(
    "totalPrice"
  );
  const totalAdminEarning = completedBookings.reduce(
    (sum, booking) => sum + booking.totalPrice * 0.1,
    0
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Admin statistics",
    data: {
      totalUser,
      totalProvider,
      totalOrder,
      totalAdminEarning,
    },
  });
});

export const getRevenueByMonth = catchAsync(async (req, res, next) => {
  const { year } = req.query;
  const currentYear = year ? parseInt(year) : new Date().getFullYear();

  const data = await Booking.aggregate([
    {
      $match: {
        status: "completed",
        bookingTime: {
          $gte: new Date(currentYear, 0, 1),
          $lt: new Date(currentYear + 1, 0, 1),
        },
      },
    },
    {
      $lookup: {
        from: "paymentinfos",
        localField: "_id",
        foreignField: "bookingId",
        as: "payment",
      },
    },
    {
      $unwind: {
        path: "$payment",
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $match: {
        "payment.paymentStatus": "complete",
      },
    },
    {
      $group: {
        _id: {
          month: { $month: "$bookingTime" },
        },
        revenue: { $sum: "$payment.price" },
      },
    },
    {
      $project: {
        _id: 0,
        month: {
          $arrayElemAt: [
            [
              "JAN",
              "FEB",
              "MAR",
              "APR",
              "MAY",
              "JUN",
              "JUL",
              "AUG",
              "SEP",
              "OCT",
              "NOV",
              "DEC",
            ],
            { $subtract: ["$_id.month", 1] },
          ],
        },
        revenue: 1,
      },
    },
    {
      $sort: { month: 1 },
    },
  ]);

  // Create all months with zero revenue
  const allMonths = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];

  const result = allMonths.map((month) => {
    const existingMonth = data.find((item) => item.month === month);
    return {
      month: month,
      revenue: existingMonth ? existingMonth.revenue : 0,
    };
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: `Monthly revenue for ${currentYear}`,
    data: result,
  });
});

export const getRecentActivity = catchAsync(async (req, res, next) => {
  const { days } = req.query;
  if (!["1", "7"].includes(days)) {
    return next(new AppError(400, "days must be 1 or 7"));
  }

  const now = new Date();
  const past = new Date();
  past.setDate(now.getDate() - parseInt(days));

  const recentActivity = await Booking.find({
    createdAt: { $gte: past, $lte: now },
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate("userId", "name")
    .populate("serviceId", "serviceDetails.title")
    .populate("providerId", "name")
    .select("userId serviceId providerId status totalPrice createdAt");

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: `Recent activity in last ${days} day(s)`,
    data: recentActivity,
  });
});

export const getTopServices = catchAsync(async (req, res, next) => {
  const { timeFilter } = req.query;

  const match = { status: "completed" };
  if (timeFilter === "7days") {
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    match.bookingTime = { $gte: sevenDaysAgo };
  }

  const totalBookings = await Booking.countDocuments(match);

  const topServices = await Service.aggregate([
    {
      $lookup: {
        from: "bookings",
        localField: "_id",
        foreignField: "serviceId",
        as: "bookings",
        pipeline: [{ $match: match }],
      },
    },
    {
      $addFields: {
        totalBookings: { $size: "$bookings" },
        percentage: {
          $cond: {
            if: { $eq: [totalBookings, 0] },
            then: 0,
            else: {
              $multiply: [
                { $divide: [{ $size: "$bookings" }, totalBookings] },
                100,
              ],
            },
          },
        },
      },
    },
    { $sort: { percentage: -1 } },
    { $limit: 5 },
    {
      $project: {
        title: "$serviceDetails.title",
        totalBookings: 1,
        percentage: { $round: ["$percentage", 2] },
      },
    },
  ]);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: `Top performing services (${timeFilter || "allTime"})`,
    data: topServices,
  });
});

export const getUserList = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const aggregationPipeline = [
    { $match: { accountType: { $ne: "admin" } } },
    {
      $facet: {
        metadata: [{ $count: "total" }],
        data: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              name: 1,
              email: 1,
              phone: 1,
              _id: 1,
            },
          },
          {
            $lookup: {
              from: "bookings",
              let: { userId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$userId", "$$userId"] },
                        { $eq: ["$status", "completed"] },
                      ],
                    },
                  },
                },
              ],
              as: "completedBookings",
            },
          },
          {
            $addFields: {
              totalCompletedOrder: { $size: "$completedBookings" },
            },
          },
        ],
      },
    },
    {
      $project: {
        data: 1,
        total: { $arrayElemAt: ["$metadata.total", 0] },
      },
    },
  ];

  const [result] = await User.aggregate(aggregationPipeline);
  const users = result?.data || [];
  const totalUsers = result?.total || 0;

  sendPaginatedResponse(res, {
    message: "User list retrieved successfully",
    data: users,
    pagination: {
      page,
      limit,
      totalPages: Math.ceil(totalUsers / limit),
      totalItems: totalUsers,
    },
  });
});

export const getProviderList = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const aggregationPipeline = [
    {
      $facet: {
        metadata: [{ $count: "total" }],
        data: [
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: "services",
              localField: "providerId",
              foreignField: "providerId",
              as: "servicesOffered",
            },
          },
          {
            $project: {
              name: 1,
              email: 1,
              phone: 1,
              serviceCount: { $size: "$servicesOffered" },
            },
          },
        ],
      },
    },
    {
      $project: {
        data: 1,
        total: { $arrayElemAt: ["$metadata.total", 0] },
      },
    },
  ];

  const [result] = await Provider.aggregate(aggregationPipeline);
  const providers = result?.data || [];
  const totalProviders = result?.total || 0;

  sendPaginatedResponse(res, {
    message: "Provider list retrieved successfully",
    data: providers,
    pagination: {
      page,
      limit,
      totalPages: Math.ceil(totalProviders / limit),
      totalItems: totalProviders,
    },
  });
});

export const getCommissionReports = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const aggregationPipeline = [
    { $match: { accountType: { $ne: "admin" } } },
    {
      $facet: {
        metadata: [{ $count: "total" }],
        data: [
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: "bookings",
              let: { userId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$userId", "$$userId"] },
                        { $eq: ["$status", "completed"] },
                      ],
                    },
                  },
                },
                {
                  $lookup: {
                    from: "paymentinfos",
                    localField: "_id",
                    foreignField: "bookingId",
                    as: "payment",
                    pipeline: [{ $match: { paymentStatus: "complete" } }],
                  },
                },
                { $unwind: "$payment" },
              ],
              as: "completedBookings",
            },
          },
          {
            $unwind: {
              path: "$completedBookings",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $group: {
              _id: "$_id",
              name: { $first: "$name" },
              email: { $first: "$email" },
              phone: { $first: "$phone" },
              completedOrder: { $sum: 1 },
              totalPayment: { $sum: "$completedBookings.payment.price" },
            },
          },
          {
            $addFields: {
              adminProfit: { $multiply: ["$totalPayment", 0.1] },
            },
          },
        ],
      },
    },
    {
      $project: {
        data: 1,
        total: { $arrayElemAt: ["$metadata.total", 0] },
      },
    },
  ];

  const [result] = await User.aggregate(aggregationPipeline);
  const reports = result?.data || [];
  const totalReports = result?.total || 0;

  sendPaginatedResponse(res, {
    message: "Commission reports retrieved successfully",
    data: reports,
    pagination: {
      page,
      limit,
      totalPages: Math.ceil(totalReports / limit),
      totalItems: totalReports,
    },
  });
});
