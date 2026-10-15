const { mongoose } = require('../db');

const reservationSchema = new mongoose.Schema(
  {
    // Physical room assignment (nullable until check-in)
    room_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: null },
    room_number: { type: String, default: null, trim: true },

    // Core guest info
    guest_name:          { type: String, required: true, trim: true },
    confirmation_number: { type: String, required: true, unique: true, uppercase: true, trim: true },
    phone_number:        { type: String, default: null, trim: true },
    membership_tier: {
      type: String,
      enum: ['None', 'Silver', 'Gold', 'Platinum', 'Diamond'],
      default: 'None',
    },

    // Room / stay details
    room_type:     { type: String, required: true, trim: true },
    arrival_date:  { type: Date, required: true },
    departure_date:{ type: Date, required: true },
    adults:        { type: Number, default: 1, min: 1 },
    children:      { type: Number, default: 0, min: 0 },

    // Status
    status: {
      type: String,
      enum: ['Confirmed', 'Checked In', 'Checked Out', 'Pending'],
      default: 'Confirmed',
    },
    // Exact check-in and check-out timestamps
    checkInTime:    { type: Date, default: null },
    checkOutTime:   { type: Date, default: null },
    check_in_time:  { type: Date, default: null },
    check_out_time: { type: Date, default: null },

    // Financial / booking
    room_rate: { type: Number, default: 0, min: 0 },
    payment_mode: {
      type: String,
      enum: ['Cash', 'Credit Card', 'Debit Card', 'UPI', 'Bank Transfer', 'Bill to Room', 'Complimentary'],
      default: 'Credit Card',
    },
    reservation_source: {
      type: String,
      enum: ['Direct', 'OTA', 'Corporate', 'Walk-in', 'Travel Agent', 'Phone'],
      default: 'Direct',
    },
    billing_option: {
      type: String,
      enum: ['Guest Account', 'Company/Corporate', 'Pre-paid', 'Split Billing'],
      default: 'Guest Account',
    },
  },
  { timestamps: true }
);

// Validation: departure must be after arrival
reservationSchema.pre('save', function () {
  if (this.departure_date <= this.arrival_date) {
    throw new Error('departure_date must be after arrival_date.');
  }
  // Auto-timestamps on status change
  if (this.status === 'Checked In') {
    const ts = this.checkInTime || this.check_in_time || new Date();
    this.checkInTime = ts;
    this.check_in_time = ts;
  }
  if (this.status === 'Checked Out') {
    const ts = this.checkOutTime || this.check_out_time || new Date();
    this.checkOutTime = ts;
    this.check_out_time = ts;
  }
});

module.exports = mongoose.model('Reservation', reservationSchema);
