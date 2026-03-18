
// helpers/populates.js
export const bookingPopulate = () => [
    {
      path: "userId",
      select: "name email profileImage",
    },
    {
      path: "serviceId",
      populate: [
        {
          path: "providerId",
          model: "User",
          select: "name email profileImage",
        },
        {
          path: "category",
          model: "Category",
          select: "name",
        },
      ],
    },
    {
      path: "providerId",
      model: "User",
      select: "name email profileImage",
    },
  ];

// Normalize serviceDetails safely
const normalizeBooking = (booking) => {
    if (booking?.serviceId && Array.isArray(booking.serviceId.serviceDetails)) {
      booking.serviceId.serviceDetails =
        booking.serviceId.serviceDetails[0] || null;
    }
    return booking;
  };
  
  // For single booking
  export const populateBooking = async (query) => {
    const booking = await query.populate(bookingPopulate()).lean();
    return normalizeBooking(booking);
  };
  
  // For multiple bookings
  export const populateBookings = async (query) => {
    const bookings = await query.populate(bookingPopulate()).lean();
    return bookings.map(normalizeBooking);
  };
  
  /* ------------------------------------------------------------------
   📌 Example usage:

   // Example 1: find by id
   let booking1 = await populateBooking(Booking.findById(booking._id));

   // Example 2: find one
   let booking2 = await populateBooking(Booking.findOne({ title: "Lawn cutter" }));

   // Example 3: find many
   let bookings = await populateBookings(Booking.find({ userId: someUserId }));
------------------------------------------------------------------ */

  