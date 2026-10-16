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
  obj.adults = obj.adults != null ? Number(obj.adults) : 1;
  obj.children = obj.children != null ? Number(obj.children) : 0;

  const checkIn = obj.checkInTime || obj.check_in_time || null;
  const checkOut = obj.checkOutTime || obj.check_out_time || null;
  obj.checkInTime = checkIn;
  obj.check_in_time = checkIn;
  obj.checkOutTime = checkOut;
  obj.check_out_time = checkOut;

  if (obj.room_id) {
    const room = await Room.findById(obj.room_id).lean();
    obj.room_number              = room?.room_number ?? obj.room_number ?? null;
    obj.room_housekeeping_status = room?.housekeeping_status ?? null;
    obj.room_maintenance_status  = room?.maintenance_status ?? null;
  } else {
    obj.room_number = obj.room_number ?? null;
    obj.room_housekeeping_status = null;
    obj.room_maintenance_status = null;
  }
  return obj;
}

// ── GET /api/reservations ─────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const filter = {};

    if (req.query.status) {
      if (req.query.status.toLowerCase() === 'inhouse' || req.query.status.toLowerCase() === 'in-house') {
        filter.status = 'Checked In';
      } else {
        filter.status = req.query.status;
      }
    }
    if (req.query.room_type) filter.room_type = req.query.room_type;

    if (req.query.search) {
      const re = new RegExp(req.query.search, 'i');
      filter.$or = [
        { guest_name: re },
        { confirmation_number: re },
        { phone_number: re },
      ];
    }

    if (req.query.date_type === 'inhouse' && !req.query.date) {
      filter.status = 'Checked In';
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
      const checkIn = r.checkInTime || r.check_in_time || null;
      const checkOut = r.checkOutTime || r.check_out_time || null;
      return {
        ...r,
        id: r._id,
        adults: r.adults != null ? Number(r.adults) : 1,
        children: r.children != null ? Number(r.children) : 0,
        checkInTime: checkIn,
        check_in_time: checkIn,
        checkOutTime: checkOut,
        check_out_time: checkOut,
        room_number:              room?.room_number ?? r.room_number ?? null,
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
      check_in_time = null, check_out_time = null,
      checkInTime = null, checkOutTime = null,
      room_rate = 0, payment_mode = 'Credit Card', reservation_source = 'Direct',
      billing_option = 'Guest Account', room_id = null, room_number = null,
    } = req.body;

    if (!guest_name || !confirmation_number || !room_type || !arrival_date || !departure_date) {
      return res.status(400).json({
        status: 'error',
        message: 'guest_name, confirmation_number, room_type, arrival_date, and departure_date are required.',
      });
    }

    const { mongoose } = require('../db');
    let resolvedRoomId = room_id || null;
    let resolvedRoomNumber = room_number || null;

    if (resolvedRoomId && mongoose.isValidObjectId(resolvedRoomId)) {
      const roomDoc = await Room.findById(resolvedRoomId);
      if (roomDoc) {
        resolvedRoomNumber = roomDoc.room_number;
      }
    } else if (resolvedRoomNumber) {
      const roomDoc = await Room.findOne({ room_number: String(resolvedRoomNumber).trim() });
      if (roomDoc) {
        resolvedRoomId = roomDoc._id;
        resolvedRoomNumber = roomDoc.room_number;
      }
    }

    const initialCheckIn = checkInTime || check_in_time || (status === 'Checked In' ? new Date() : null);
    const initialCheckOut = checkOutTime || check_out_time || (status === 'Checked Out' ? new Date() : null);

    // Validate full DateTime (date + check-in/out times)
    const arrivalDT = Reservation.combineDateAndTime(arrival_date, initialCheckIn, '00:00:00');
    const departureDT = Reservation.combineDateAndTime(departure_date, initialCheckOut, '00:00:00');

    if (!arrivalDT || !departureDT || departureDT <= arrivalDT) {
      return res.status(400).json({
        status: 'error',
        message: 'departure_date must be after arrival_date. For same-day stays, check_out_time must be chronologically after check_in_time.',
      });
    }

    const reservation = await Reservation.create({
      room_id: resolvedRoomId,
      room_number: resolvedRoomNumber,
      guest_name,
      confirmation_number: confirmation_number.toUpperCase(),
      phone_number, membership_tier, room_type,
      arrival_date: arrivalDT,
      departure_date: departureDT,
      adults: Number(adults), children: Number(children),
      status,
      checkInTime: initialCheckIn ? arrivalDT : null,
      check_in_time: initialCheckIn ? arrivalDT : null,
      checkOutTime: initialCheckOut ? departureDT : null,
      check_out_time: initialCheckOut ? departureDT : null,
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

    // Resolve room assignment (room_id or room_number)
    const { mongoose } = require('../db');
    if (req.body.room_id !== undefined || req.body.room_number !== undefined) {
      let roomDoc = null;
      if (req.body.room_id && mongoose.isValidObjectId(req.body.room_id)) {
        roomDoc = await Room.findById(req.body.room_id);
      }
      if (!roomDoc && req.body.room_number) {
        roomDoc = await Room.findOne({ room_number: String(req.body.room_number).trim() });
      }
      if (roomDoc) {
        req.body.room_id = roomDoc._id;
        req.body.room_number = roomDoc.room_number;
        current.room_id = roomDoc._id;
        current.room_number = roomDoc.room_number;
      }
    }

    // Auto-timestamps on status transition
    const newStatus = req.body.status ?? current.status;
    const now = new Date();

    if (newStatus === 'Checked In') {
      const ts = req.body.checkInTime || req.body.check_in_time || (current.status !== 'Checked In' ? now : current.checkInTime || now);
      req.body.checkInTime = ts;
      req.body.check_in_time = ts;
    }
    if (newStatus === 'Checked Out') {
      const ts = req.body.checkOutTime || req.body.check_out_time || (current.status !== 'Checked Out' ? now : current.checkOutTime || now);
      req.body.checkOutTime = ts;
      req.body.check_out_time = ts;
    }

    // Route-level DateTime validation
    const nextArrDate = req.body.arrival_date !== undefined ? req.body.arrival_date : current.arrival_date;
    const nextDepDate = req.body.departure_date !== undefined ? req.body.departure_date : current.departure_date;
    const nextInTime = req.body.check_in_time !== undefined ? req.body.check_in_time : (req.body.checkInTime !== undefined ? req.body.checkInTime : (current.check_in_time || current.checkInTime));
    const nextOutTime = req.body.check_out_time !== undefined ? req.body.check_out_time : (req.body.checkOutTime !== undefined ? req.body.checkOutTime : (current.check_out_time || current.checkOutTime));

    const arrivalDT = Reservation.combineDateAndTime(nextArrDate, nextInTime, '00:00:00');
    const departureDT = Reservation.combineDateAndTime(nextDepDate, nextOutTime, '00:00:00');

    if (!arrivalDT || !departureDT || departureDT <= arrivalDT) {
      return res.status(400).json({
        status: 'error',
        message: 'departure_date must be after arrival_date. For same-day stays, check_out_time must be chronologically after check_in_time.',
      });
    }

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

    console.log(`✏️  Reservation ${current._id} updated → room: "${current.room_number}", status: "${current.status}", in: ${current.checkInTime}, out: ${current.checkOutTime}`);
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
