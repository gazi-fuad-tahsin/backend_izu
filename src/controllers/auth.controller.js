import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import AppError from "../errors/appError.js";
import { Provider } from "../models/provider.model.js";
import { User } from "../models/user.model.js";
import catchAsync from "../utility/catchAsync.js";
import {
  generateVerificationCode,
  sendPasswordResetCode,
  sendResponse,
} from "../utility/helper.js";

const generateToken = (userId, secret, expiry) => {
  return jwt.sign({ id: userId }, secret, { expiresIn: expiry });
};

export const signup = catchAsync(async (req, res, next) => {
  const { name, email, password, accountType, phone } = req.body;

  if (!name || !email || !password || !accountType || !phone) {
    return next(new AppError(400, "All fields are required"));
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new AppError(400, "Email already registered"));
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    accountType,
    phone,
  });

  if (accountType === "provider") {
    await Provider.create({
      providerId: user._id,
      name: user.name,
      email: user.email,
      phone,
      location: {
        type: "Point",
        coordinates: [0, 0],
      },
    });
  }

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "User registered successfully",
    data: { userId: user._id, email: user.email, phone },
  });
});

export const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError(400, "Email and password are required"));
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    return next(new AppError(404, "User not found"));
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return next(new AppError(401, "Invalid credentials"));
  }

  const refreshToken = generateToken(
    user._id,
    process.env.JWT_REFRESH_SECRET,
    process.env.REFRESH_TOKEN_EXPIRY
  );
  await User.findByIdAndUpdate(user._id, { refreshToken });

  const accessToken = generateToken(
    user._id,
    process.env.JWT_ACCESS_SECRET,
    process.env.ACCESS_TOKEN_EXPIRY
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Login successful",
    data: {
      accessToken,
      refreshToken,
      userId: user._id,
      email: user.email,
      role: user.accountType,
    },
  });
});

export const forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new AppError(400, "Email is required"));
  }

  const user = await User.findOne({ email });
  if (!user) {
    return next(new AppError(404, "User not found"));
  }

  const otp = generateVerificationCode();
  await sendPasswordResetCode(email, otp);

  user.otp = otp;
  await user.save();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "OTP sent to your email",
    data: { email, otpExpiry: Date.now() + 10 * 60 * 1000 },
  });
});

export const verifyOTP = catchAsync(async (req, res, next) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return next(new AppError(400, "Email and OTP are required"));
  }

  const user = await User.findOne({ email, otp });
  if (!user) {
    return next(new AppError(404, "User not found"));
  }

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "OTP verified successfully",
    data: { email },
  });
});

export const resetPassword = catchAsync(async (req, res, next) => {
  const { email, otp, newPassword, confirmPassword } = req.body;

  if (!email || !otp || !newPassword || !confirmPassword) {
    return next(
      new AppError(400, "OTP, new password, and confirm password are required")
    );
  }

  if (newPassword !== confirmPassword) {
    return next(
      new AppError(400, "New password and confirm password do not match")
    );
  }

  const user = await User.findOne({ email }).select("+otp");
  if (!user) {
    return next(new AppError(404, "User not found"));
  }

  if (user.otp !== otp) {
    return next(new AppError(404, "Otp did not match!"));
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  user.otp = null;
  await user.save();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Password reset successfully",
    data: { email: user.email },
  });
});

export const refreshAccessToken = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return next(new AppError(400, "Refresh token is required"));
  }

  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  const user = await User.findById(decoded.id);
  if (!user) {
    return next(new AppError(401, "User not found"));
  }

  const accessToken = generateToken(
    user._id,
    process.env.JWT_ACCESS_SECRET,
    process.env.ACCESS_TOKEN_EXPIRY
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Access token refreshed successfully",
    data: { accessToken, role: user.accountType },
  });
});


export const changePassword = catchAsync(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Old password and new password are required"
    );
  }
  if (oldPassword === newPassword) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Old password and new password cannot be same"
    );
  }
  const user = await User.findById({ _id: req.user?._id });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if(!user.comparePassword(oldPassword)){
    throw new AppError(httpStatus.NOT_FOUND, "Old Password Not Matched")
  }
  user.password = newPassword;
  await user.save();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password changed",
    data: "",
  });
});

export const logout = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  if (!userId) {
    return next(new AppError(400, "User not authenticated"));
  }

  await User.findByIdAndUpdate(userId, { refreshToken: null });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Logout successful",
  });
});
