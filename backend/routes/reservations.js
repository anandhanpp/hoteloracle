// ── backend/routes/reservations.js ───────────────────────────────────────────
const express     = require('express');
const Reservation = require('../models/Reservation');
const Room        = require('../models/Room');

const router = express.Router();

// Helper: enrich a reservation document with room info, matching the original
// MySQL JOIN shape so the frontend stays unchanged.
async function enrich(res) {
  const obj = res.toObject ? res.toObject() : { ...res };
  obj.id = obj._id;          // keep numeric-style id field the frontend expects

  if (obj.room_id) {
    const room = await Room.findById(obj.room_id).lean();
    obj.room_number              = room?.room_number ?? null;
    obj.room_housekeeping_status = room?.housekeeping_status ?? null;
    obj.room_maintenance_status  = room?.maintenance_status ?? null;
  } else {
    obj.room_number = obj.room_housekeeping_status = obj.room_maintenance_status = null;
  }
  return obj;
}

// ── GET /api/reservations ─────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const filter = {};

    if (req.query.status)    filter.status    = req.query.status;
    if (req.query.room_type) filter.room_type = req.query.room_type;

    if (req.query.search) {
      const re = new RegExp(req.query.search, 'i');
      filter.$or = [
        { guest_name: re },
        { confirmation_number: re },
        { phone_number: re },
      ];
    }

    if (req.query.date && req.query.date_type) {
      const d = new Date(req.query.date);
      const next = new Date(d); next.setDate(next.getDate() + 1);

      if (req.query.date_type === 'arrival') {
        filter.arrival_date = { $gte: d, $lt: next };
      } else if (req.query.date_type === 'departure') {
        filter.departure_date = { $gte: d, $lt: next };
      } else if (req.query.date_type === 'inhouse') {
        filter.status = 'Checked In';
        filter.arrival_date   = { $lte: d };
        filter.departure_date = { $gte: d };
      }
    }

    const reservations = await Reservation.find(filter)
      .sort({ arrival_date: 1, _id: 1 })
      .lean();

    // Enrich with room info (batch: collect room_ids then query once)
    const roomIds = [...new Set(reservations.map(r => r.room_id).filter(Boolean))];
    const rooms   = await Room.find({ _id: { $in: roomIds } }).lean();
    const roomMap = Object.fromEntries(rooms.map(r => [r._id.toString(), r]));

    const enriched = reservations.map(r => {
      const room = r.room_id ? roomMap[r.room_id.toString()] : null;
      return {
        ...r,
        id: r._id,
        room_number:              room?.room_number ?? null,
        room_housekeeping_status: room?.housekeeping_status ?? null,
        room_maintenance_status:  room?.maintenance_status ?? null,
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error('Error fetching reservations:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── POST /api/reservations ────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      guest_name, confirmation_number, phone_number = null,
      membership_tier = 'None', room_type, arrival_date, departure_date,
      adults = 1, children = 0, status = 'Confirmed',
      check_in_time = null, check_out_time = null, room_rate = 0,
      payment_mode = 'Credit Card', reservation_source = 'Direct',
      billing_option = 'Guest Account', room_id = null,
    } = req.body;

    if (!guest_name || !confirmation_number || !room_type || !arrival_date || !departure_date) {
      return res.status(400).json({
        status: 'error',
        message: 'guest_name, confirmation_number, room_type, arrival_date, and departure_date are required.',
      });
    }

    const reservation = await Reservation.create({
      room_id: room_id || null,
      guest_name,
      confirmation_number: confirmation_number.toUpperCase(),
      phone_number, membership_tier, room_type,
      arrival_date: new Date(arrival_date),
      departure_date: new Date(departure_date),
      adults: Number(adults), children: Number(children),
      status, check_in_time, check_out_time,
      room_rate: Number(room_rate),
      payment_mode, reservation_source, billing_option,
    });

    res.status(201).json(await enrich(reservation));
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ status: 'error', message: 'confirmation_number already exists.' });
    }
    console.error('Error creating reservation:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── PUT /api/reservations/:id ─────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const current = await Reservation.findById(req.params.id);
    if (!current) {
      return res.status(404).json({ status: 'error', message: `Reservation ${req.params.id} not found.` });
    }

    // Auto-timestamps on status transition
    const newStatus = req.body.status ?? current.status;
    if (newStatus === 'Checked In'  && current.status !== 'Checked In'  && !req.body.check_in_time)  req.body.check_in_time  = new Date();
    if (newStatus === 'Checked Out' && current.status !== 'Checked Out' && !req.body.check_out_time) req.body.check_out_time = new Date();

    // If checking out, mark the room dirty
    if (newStatus === 'Checked Out' && current.room_id) {
      await Room.findByIdAndUpdate(current.room_id, { housekeeping_status: 'Dirty' });
    }

    // Confirmation numbers are upper-cased
    if (req.body.confirmation_number) {
      req.body.confirmation_number = req.body.confirmation_number.toUpperCase();
    }

    // Apply partial update
    Object.assign(current, req.body);
    await current.save();

    console.log(`✏️  Reservation ${current._id} updated → status: "${current.status}"`);
    res.json(await enrich(current));
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ status: 'error', message: 'confirmation_number already exists.' });
    }
    console.error('Error updating reservation:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── DELETE /api/reservations/:id ──────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Reservation.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ status: 'error', message: `Reservation ${req.params.id} not found.` });
    }
    res.json({ status: 'ok', deleted });
  } catch (err) {
    console.error('Error deleting reservation:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
