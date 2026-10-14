// ── backend/routes/inventory.js ──────────────────────────────────────────────
// GET /api/inventory/breakdown  – real-time room availability per category
// Uses MongoDB $aggregate to replicate the SQL GROUP BY + LEFT JOIN logic.
const express  = require('express');
const RoomType = require('../models/RoomType');
const Room     = require('../models/Room');
const Reservation = require('../models/Reservation');

const router = express.Router();

// ── GET /api/inventory/breakdown ─────────────────────────────────────────────
router.get('/breakdown', async (_req, res) => {
  try {
    const today     = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd   = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const asOf       = today.toISOString().slice(0, 10);

    // ── Step 1: Get all room types ──────────────────────────────────────────
    const roomTypes = await RoomType.find().sort({ _id: 1 }).lean();

    // ── Step 2: Aggregate room counts + OOO per room type ──────────────────
    const roomAgg = await Room.aggregate([
      {
        $group: {
          _id:       '$room_type_id',
          total:     { $sum: 1 },
          ooo:       { $sum: { $cond: [{ $eq: ['$maintenance_status', 'OOO'] }, 1, 0] } },
          room_ids:  { $push: '$_id' },
        },
      },
    ]);
    // Map: roomTypeId -> { total, ooo, room_ids }
    const roomStatMap = Object.fromEntries(
      roomAgg.map(r => [r._id?.toString(), r])
    );

    // ── Step 3: Find all checked-in reservations covering today ────────────
    // "Checked In" + arrival <= today < departure
    const checkedIn = await Reservation.find({
      status:        'Checked In',
      arrival_date:  { $lt: todayEnd   },
      departure_date:{ $gte: todayStart },
    }).select('room_id').lean();

    // Set of occupied room_ids (as strings)
    const occupiedRoomIds = new Set(
      checkedIn.map(r => r.room_id?.toString()).filter(Boolean)
    );

    // ── Step 4: Count occupied rooms per room type ──────────────────────────
    // Map roomType ObjectId -> occupied count
    const allRooms = await Room.find({
      _id: { $in: [...occupiedRoomIds].map(id => id) },
    }).select('_id room_type_id').lean();

    const occupiedByType = {};
    allRooms.forEach(r => {
      const tid = r.room_type_id?.toString();
      if (tid) occupiedByType[tid] = (occupiedByType[tid] ?? 0) + 1;
    });

    // ── Step 5: Build response ──────────────────────────────────────────────
    const breakdown = roomTypes.map(rt => {
      const tid      = rt._id.toString();
      const stats    = roomStatMap[tid] ?? { total: 0, ooo: 0 };
      const total    = stats.total;
      const ooo      = stats.ooo;
      const occupied = occupiedByType[tid] ?? 0;
      const sellable = total - ooo;
      const available = Math.max(0, sellable - occupied);
      const pct      = sellable > 0 ? Math.round((occupied / sellable) * 100) : 0;

      return {
        type_id:         rt._id,
        type_code:       rt.type_code,
        name:            rt.name,
        base_price:      rt.base_price,
        total_rooms:     total,
        ooo_rooms:       ooo,
        sellable_rooms:  sellable,
        occupied_rooms:  occupied,
        available_rooms: available,
        occupancy_pct:   pct,
      };
    });

    // ── Step 6: Property-wide summary ───────────────────────────────────────
    const summary = breakdown.reduce(
      (acc, r) => {
        acc.total    += r.total_rooms;
        acc.ooo      += r.ooo_rooms;
        acc.sellable += r.sellable_rooms;
        acc.occupied += r.occupied_rooms;
        acc.available += r.available_rooms;
        return acc;
      },
      { total: 0, ooo: 0, sellable: 0, occupied: 0, available: 0 }
    );
    summary.occupancy_pct = summary.sellable > 0
      ? Math.round((summary.occupied / summary.sellable) * 100)
      : 0;

    return res.json({ summary, breakdown, as_of: asOf });
  } catch (err) {
    console.error('Error fetching inventory breakdown:', err.message);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
