import mongoose from 'mongoose'

const paymentInfoSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Types.ObjectId,
      ref: 'User',
    },
    bookingId: {
      type: mongoose.Types.ObjectId,
      ref: 'Booking',
    },
    price: { type: Number, required: true },
    providerId: {
      type: mongoose.Types.ObjectId,
      ref: 'Provider',
    },
    paymentType: {
      type: String,
      enum: ['booking', 'tip'],
      default: 'booking',
    },
    paymentStatus: {
      type: String,
      enum: ['complete', 'pending', 'failed'],
      default: 'pending',
    },
    seasonId: { type: String },
    transactionId: { type: String },
    paymentMethod: { type: String },
    type: { type: String, enum: ['donation', 'order'] },
    providerTransfer: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
)

export const paymentInfo = mongoose.model('paymentInfo', paymentInfoSchema)
