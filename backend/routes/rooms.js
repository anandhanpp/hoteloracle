// ── backend/routes/rooms.js ───────────────────────────────────────────────────
const express     = require('express');
const Room        = require('../models/Room');
const Reservation = require('../models/Reservation');

const router = express.Router();

const VALID_HK    = ['Clean', 'Dirty', 'Inspected'];
const VALID_MAINT = ['Active', 'OOO', 'OOS'];

// ── GET /api/rooms ────────────────────────────────────────────────────────────
// Returns all rooms with current occupant reservation info if checked in.
router.get('/', async (req, res) => {
  try {
    const { housekeeping_status, maintenance_status, room_type, floor } = req.query;

    const filter = {};
    if (housekeeping_status && VALID_HK.includes(housekeeping_status))     filter.housekeeping_status = housekeeping_status;
    if (maintenance_status  && VALID_MAINT.includes(maintenance_status))   filter.maintenance_status  = maintenance_status;
    if (room_type)  filter.room_type   = room_type;
    if (floor)      filter.room_number = new RegExp(`^${floor}`);

    const rooms = await Room.find(filter)
      .sort({ room_number: 1 })
      .lean();

    // Find all currently checked-in reservations for these rooms
    const roomIds = rooms.map(r => r._id);
    const activeRes = await Reservation.find({
      room_id: { $in: roomIds },
      status: 'Checked In',
    }).lean();

    const resMap = Object.fromEntries(activeRes.map(r => [r.room_id.toString(), r]));

    const enriched = rooms.map(room => {
      const activeReservation = resMap[room._id.toString()];
      return {
        ...room,
        id: room._id,
        reservation_id:     activeReservation?._id ?? null,
        guest_name:         activeReservation?.guest_name ?? null,
        confirmation_number:activeReservation?.confirmation_number ?? null,
        arrival_date:       activeReservation?.arrival_date ?? null,
        departure_date:     activeReservation?.departure_date ?? null,
        reservation_status: activeReservation?.status ?? null,
        is_occupied:        activeReservation ? 1 : 0,
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error('Error fetching rooms:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── GET /api/rooms/available ──────────────────────────────────────────────────
// Inspected / Clean + Active + not currently occupied, filtered strictly by room_type.
router.get('/available', async (req, res) => {
  try {
    const { room_type, housekeeping_status } = req.query;

    // Find occupied room IDs
    const occupied = await Reservation.find({ status: 'Checked In' }).select('room_id').lean();
    const occupiedIds = occupied.map(r => r.room_id).filter(Boolean);

    const filter = {
      maintenance_status: { $nin: ['OOO', 'OOS'] },
      _id: { $nin: occupiedIds },
    };

    if (housekeeping_status) {
      if (housekeeping_status !== 'all') {
        filter.housekeeping_status = housekeeping_status;
      }
    } else {
      // Return both Inspected and Clean rooms by default so staff have available choices
      filter.housekeeping_status = { $in: ['Inspected', 'Clean'] };
    }

    if (room_type) {
      filter.room_type = new RegExp(`^${room_type.trim()}$`, 'i');
    }

    const rooms = await Room.find(filter).sort({ room_number: 1 }).lean();
    res.json(rooms.map(r => ({ ...r, id: r._id })));
  } catch (err) {
    console.error('Error fetching available rooms:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── PUT /api/rooms/:id/status ─────────────────────────────────────────────────
router.put('/:id/status', async (req, res) => {
  try {
    const { housekeeping_status, maintenance_status } = req.body;

    if (!housekeeping_status && !maintenance_status) {
      return res.status(400).json({
        status: 'error',
        message: 'At least one of housekeeping_status or maintenance_status must be provided.',
      });
    }
    if (housekeeping_status && !VALID_HK.includes(housekeeping_status)) {
      return res.status(400).json({ status: 'error', message: `housekeeping_status must be one of: ${VALID_HK.join(', ')}` });
    }
    if (maintenance_status && !VALID_MAINT.includes(maintenance_status)) {
      return res.status(400).json({ status: 'error', message: `maintenance_status must be one of: ${VALID_MAINT.join(', ')}` });
    }

    const update = {};
    if (housekeeping_status) update.housekeeping_status = housekeeping_status;
    if (maintenance_status)  update.maintenance_status  = maintenance_status;

    const room = await Room.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).lean();
    if (!room) return res.status(404).json({ status: 'error', message: `Room ${req.params.id} not found.` });

    console.log(`🏨 Room ${room.room_number} updated:`, update);
    res.json({ ...room, id: room._id });
  } catch (err) {
    console.error('Error updating room status:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
