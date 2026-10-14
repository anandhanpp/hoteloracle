const { mongoose } = require('../db');

// ── Charge ─────────────────────────────────────────────────────────────────────
const chargeSchema = new mongoose.Schema(
  {
    reservation_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation', required: true },
    window_number:   { type: Number, min: 1, max: 8, default: 1 },
    transaction_code:{ type: String, required: true, trim: true },
    description:     { type: String, default: '', trim: true },
    price:           { type: Number, required: true },
    quantity:        { type: Number, default: 1, min: 1 },
    total:           { type: Number }, // computed in pre-save
    supplement:      { type: String, default: null },
    reference:       { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

chargeSchema.pre('save', function () {
  this.total = parseFloat((this.price * this.quantity).toFixed(2));
});

// ── Payment ────────────────────────────────────────────────────────────────────
const paymentSchema = new mongoose.Schema(
  {
    reservation_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation', required: true },
    window_number:  { type: Number, min: 1, max: 8, default: 1 },
    payment_method: { type: String, default: 'Cash', trim: true },
    amount:         { type: Number, required: true },
    reference:      { type: String, default: null },
    supplement:     { type: String, default: null },
    card_holder:    { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

// ── User ───────────────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    username:      { type: String, required: true, unique: true, lowercase: true, trim: true },
    password_hash: { type: String, required: true },
    role: {
      type: String,
      enum: ['Front Desk', 'Manager', 'Housekeeping', 'Billing', 'Admin'],
      default: 'Front Desk',
    },
  },
  { timestamps: true }
);

const Charge  = mongoose.model('Charge',  chargeSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const User    = mongoose.model('User',    userSchema);

module.exports = { Charge, Payment, User };
