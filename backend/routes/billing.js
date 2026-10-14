// ── backend/routes/billing.js ─────────────────────────────────────────────────
const express     = require('express');
const Reservation = require('../models/Reservation');
const { Charge, Payment } = require('../models/index');

const router = express.Router();

// ── GET /api/billing/:reservation_id ─────────────────────────────────────────
// Returns: { reservation, windows: { 1: { charges, payments, balance }, … } }
router.get('/:reservation_id', async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.reservation_id).lean();
    if (!reservation) {
      return res.status(404).json({ status: 'error', message: `Reservation ${req.params.reservation_id} not found.` });
    }

    const [charges, payments] = await Promise.all([
      Charge.find({ reservation_id: reservation._id }).sort({ window_number: 1, created_at: 1 }).lean(),
      Payment.find({ reservation_id: reservation._id }).sort({ window_number: 1, created_at: 1 }).lean(),
    ]);

    // Group into windows 1–8
    const windows = {};
    for (let w = 1; w <= 8; w++) {
      const wCharges   = charges.filter(c => c.window_number === w);
      const wPayments  = payments.filter(p => p.window_number === w);
      const totalC     = wCharges.reduce((s, c)  => s + c.total,  0);
      const totalP     = wPayments.reduce((s, p) => s + p.amount, 0);
      windows[w] = {
        charges:        wCharges,
        payments:       wPayments,
        total_charges:  parseFloat(totalC.toFixed(2)),
        total_payments: parseFloat(totalP.toFixed(2)),
        balance:        parseFloat((totalC - totalP).toFixed(2)),
      };
    }

    res.json({ reservation: { ...reservation, id: reservation._id }, windows });
  } catch (err) {
    console.error('Error fetching billing:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── POST /api/billing/charge ──────────────────────────────────────────────────
router.post('/charge', async (req, res) => {
  try {
    const {
      reservation_id, window_number = 1, transaction_code,
      description = '', price, quantity = 1, supplement = null, reference = null,
    } = req.body;

    if (!reservation_id || !transaction_code || price === undefined) {
      return res.status(400).json({ status: 'error', message: 'reservation_id, transaction_code, and price are required.' });
    }

    const win = Number(window_number);
    if (win < 1 || win > 8) return res.status(400).json({ status: 'error', message: 'window_number must be 1–8.' });

    const exists = await Reservation.exists({ _id: reservation_id });
    if (!exists) return res.status(404).json({ status: 'error', message: `Reservation ${reservation_id} not found.` });

    const charge = await Charge.create({
      reservation_id, window_number: win, transaction_code,
      description, price: parseFloat(price), quantity: Number(quantity),
      supplement, reference,
    });

    res.status(201).json(charge);
  } catch (err) {
    console.error('Error posting charge:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── POST /api/billing/payment ─────────────────────────────────────────────────
router.post('/payment', async (req, res) => {
  try {
    const {
      reservation_id, window_number = 1, payment_method = 'Cash',
      amount, reference = null, supplement = null, card_holder = null,
    } = req.body;

    if (!reservation_id || amount === undefined) {
      return res.status(400).json({ status: 'error', message: 'reservation_id and amount are required.' });
    }

    const win = Number(window_number);
    if (win < 1 || win > 8) return res.status(400).json({ status: 'error', message: 'window_number must be 1–8.' });

    const exists = await Reservation.exists({ _id: reservation_id });
    if (!exists) return res.status(404).json({ status: 'error', message: `Reservation ${reservation_id} not found.` });

    const payment = await Payment.create({
      reservation_id, window_number: win, payment_method,
      amount: parseFloat(amount), reference, supplement, card_holder,
    });

    res.status(201).json(payment);
  } catch (err) {
    console.error('Error posting payment:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── PUT /api/billing/transfer ─────────────────────────────────────────────────
router.put('/transfer', async (req, res) => {
  try {
    const { charge_id, to_window } = req.body;
    if (!charge_id || to_window === undefined) {
      return res.status(400).json({ status: 'error', message: 'charge_id and to_window are required.' });
    }
    const win = Number(to_window);
    if (win < 1 || win > 8) return res.status(400).json({ status: 'error', message: 'to_window must be 1–8.' });

    const charge = await Charge.findByIdAndUpdate(charge_id, { window_number: win }, { new: true });
    if (!charge) return res.status(404).json({ status: 'error', message: `Charge ${charge_id} not found.` });

    res.json(charge);
  } catch (err) {
    console.error('Error transferring charge:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── DELETE /api/billing/charge/:id ───────────────────────────────────────────
router.delete('/charge/:id', async (req, res) => {
  try {
    const deleted = await Charge.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ status: 'error', message: `Charge ${req.params.id} not found.` });
    res.json({ status: 'ok', deleted });
  } catch (err) {
    console.error('Error deleting charge:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
