import { paymentInfo } from "../models/payment.model.js";
import { User } from "../models/user.model.js";
import Stripe from "stripe";
import { Booking } from "../models/booking.model.js";
import { Notification } from "../models/notification.model.js";
import { getIO } from "../app.js";
import { populateBooking } from "../utility/booking_population.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-11-15",
});

export const createPayment = async (req, res) => {
  const { price, bookingId, providerId, paymentType } = req.body;
  const userId = req.user._id;

  if (!userId || !price || !bookingId) {
    return res.status(400).json({
      error: "userId, price, bookingId, type, and providerId are required.",
    });
  }

  try {
    // Create a PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(price * 100), // Stripe expects the amount in cents
      currency: "usd",
      metadata: {
        userId: userId.toString(),
        bookingId: bookingId.toString(),
      },
    });

    // Save payment record with status 'pending'
    const newPaymentInfo = new paymentInfo({
      userId,
      bookingId,
      price,
      providerId,
      paymentType,
      transactionId: paymentIntent.id,
      paymentStatus: "pending",
    });
    await newPaymentInfo.save();

    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      message: "PaymentIntent created.",
    });
  } catch (error) {
    console.error("Error creating PaymentIntent:", error);
    res.status(500).json({
      error: "Internal server error.",
    });
  }
};

export const confirmPayment = async (req, res) => {
  const { paymentIntentId } = req.body;

  if (!paymentIntentId) {
    return res.status(400).json({ error: "paymentIntentId is required." });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({
        error: `Payment not completed. Status: ${paymentIntent.status}`,
      });
    }

    const paymentRecord = await paymentInfo.findOneAndUpdate(
      { transactionId: paymentIntentId },
      { paymentStatus: "complete" },
      { new: true }
    );

    const booking1 = await populateBooking(Booking.findById(
      paymentIntent.metadata.bookingId
    ))

    const notification = await Notification.create({
      userId: booking1.serviceId.providerId,
      bookingId: paymentIntent.metadata.bookingId,
      type: "new-request",
      message: `New request from ${req.user.name} for ${booking1.title} at ${booking1.bookingTime}.`,
    });
    const io = getIO();
    io.to(booking1.serviceId.providerId.toString()).emit(
      "notification",
      notification
    );

    booking1.requestSent = true;
    await Booking.findByIdAndUpdate(
      booking1._id,
      { requestSent: true },
    )
    io.to(booking1.serviceId.providerId.toString()).emit(
      "new-request",
      booking1
    );
    if (!paymentRecord) {
      return res.status(404).json({ error: "Payment record not found." });
    }

    // // Get provider (not customer)
    // const provider = await User.findById(paymentRecord.providerId);
    // if (!provider || !provider.stripeAccountId) {
    //   return res
    //     .status(400)
    //     .json({ error: "Provider Stripe account not connected." });
    // }

    // const amountToTransfer = Math.round(paymentRecord.price * 0.9 * 100); // 90% in cents

    // const transfer = await stripe.transfers.create({
    //   amount: amountToTransfer,
    //   currency: "usd",
    //   destination: provider.stripeAccountId,
    //   transfer_group: `ORDER_${paymentIntent.id}`,
    // });

    // paymentRecord.providerTransfer = true;
    // await paymentRecord.save();

    return res.status(200).json({
      success: true,
      message: "Payment processed and transferred.",
      paymentIntent,
    });
  } catch (error) {
    console.error("Error confirming or transferring payment:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

export const createStripeConnectAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    let accountId = user.stripeAccountId;

    // Create account if not exists
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      user.stripeAccountId = account.id;
      await user.save();
      accountId = account.id;
    }

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.CLIENT_URL}/connect/refresh`,
      return_url: `${process.env.CLIENT_URL}/stripe-account-success`,
      type: "account_onboarding",
    });

    res.status(200).json({ url: accountLink.url });
  } catch (error) {
    console.error("Stripe onboarding error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
