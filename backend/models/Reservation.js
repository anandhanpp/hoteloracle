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

/**
 * Combines a calendar date and an optional time/datetime into a unified Date object.
 * Extracts date (YYYY-MM-DD) from dateVal and time (HH:mm:ss) from timeVal or embedded date time.
 */
function combineDateAndTime(dateVal, timeVal, defaultTime = '00:00:00') {
  if (!dateVal) return null;

  // Extract YYYY-MM-DD and any embedded time from dateVal
  let dateStr = '';
  let embeddedTime = null;

  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    dateStr = dateVal.toISOString().slice(0, 10);
    const t = dateVal.toISOString().slice(11, 19);
    if (t !== '00:00:00') embeddedTime = t;
  } else if (typeof dateVal === 'string') {
    dateStr = dateVal.slice(0, 10);
    if (dateVal.includes('T')) {
      const match = dateVal.match(/T(\d{2}:\d{2}(?::\d{2})?)/);
      if (match) {
        embeddedTime = match[1].length === 5 ? `${match[1]}:00` : match[1];
      }
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;

  // Extract HH:mm:ss from timeVal if available
  let timeStr = defaultTime;
  if (timeVal instanceof Date && !isNaN(timeVal.getTime())) {
    timeStr = timeVal.toISOString().slice(11, 19);
  } else if (typeof timeVal === 'string' && timeVal.trim() !== '') {
    const trimmed = timeVal.trim();
    if (trimmed.includes('T')) {
      const match = trimmed.match(/T(\d{2}):(\d{2})(?::(\d{2}))?/);
      if (match) {
        timeStr = `${match[1]}:${match[2]}:${match[3] || '00'}`;
      }
    } else if (/^\d{1,2}:\d{2}/.test(trimmed)) {
      const parts = trimmed.split(':');
      const hh = parts[0].padStart(2, '0');
      const mm = (parts[1] || '00').padStart(2, '0');
      const ss = (parts[2] || '00').slice(0, 2).padStart(2, '0');
      timeStr = `${hh}:${mm}:${ss}`;
    }
  } else if (embeddedTime) {
    timeStr = embeddedTime;
  }

  const dt = new Date(`${dateStr}T${timeStr}.000Z`);
  return isNaN(dt.getTime()) ? null : dt;
}

// Validation & Auto-timestamps on save
reservationSchema.pre('save', function () {
  const now = new Date();

  // Auto-timestamps on status change
  if (this.status === 'Checked In') {
    const ts = this.checkInTime || this.check_in_time || this.arrival_date || now;
    this.checkInTime = ts;
    this.check_in_time = ts;
  }
  if (this.status === 'Checked Out') {
    const ts = this.checkOutTime || this.check_out_time || now;
    this.checkOutTime = ts;
    this.check_out_time = ts;
    if (!this.departure_date) {
      this.departure_date = ts;
    }
  }

  const checkIn = this.check_in_time || this.checkInTime || this.arrival_date;
  const checkOut = this.check_out_time || this.checkOutTime || this.departure_date;

  let arrivalDateTime = combineDateAndTime(this.arrival_date, checkIn, '00:00:00');
  let departureDateTime = combineDateAndTime(this.departure_date, checkOut, '00:00:00');

  // Handle same-day stays during check-in: if checkOut was after checkIn, ensure full DateTime holds
  if (this.status === 'Checked In' && arrivalDateTime && departureDateTime && departureDateTime <= arrivalDateTime) {
    const originalDep = combineDateAndTime(this.departure_date, this.departure_date, '00:00:00');
    if (originalDep && originalDep > arrivalDateTime) {
      departureDateTime = originalDep;
      this.departure_date = originalDep;
    }
  }

  // If checking out and departureDateTime <= arrivalDateTime, adjust arrival to 1 minute before checkout
  if (this.status === 'Checked Out' && arrivalDateTime && departureDateTime && departureDateTime <= arrivalDateTime) {
    arrivalDateTime = new Date(departureDateTime.getTime() - 60 * 1000);
    this.arrival_date = arrivalDateTime;
    this.checkInTime = arrivalDateTime;
    this.check_in_time = arrivalDateTime;
  }

  if (!arrivalDateTime || !departureDateTime || departureDateTime <= arrivalDateTime) {
    throw new Error('departure_date must be after arrival_date. For same-day stays, check_out_time must be chronologically after check_in_time.');
  }

  // Sync arrival_date and departure_date so full Date/Time comparison holds in MongoDB
  this.arrival_date = arrivalDateTime;
  this.departure_date = departureDateTime;
});

const Reservation = mongoose.model('Reservation', reservationSchema);
Reservation.combineDateAndTime = combineDateAndTime;

module.exports = Reservation;

