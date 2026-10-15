// ── backend/routes/inventory.js ──────────────────────────────────────────────
// Centralized real-time room availability calculation and inventory metrics.
// Supports date forecasting query: ?date=YYYY-MM-DD
// Unified PMS Formula:
// True Available Rooms = Total Rooms - (Occupied Rooms + Dirty/Uncleaned Rooms + Out of Order/Service Rooms)
// ─────────────────────────────────────────────────────────────────────────────
const express     = require('express');
const RoomType    = require('../models/RoomType');
const Room        = require('../models/Room');
const Reservation = require('../models/Reservation');

const router = express.Router();

/**
 * calculateInventoryAvailability(targetDateStr)
 * Single, centralized source of truth for property-wide and per-category
 * room counts and true availability, supporting real-time and date forecasting.
 */
async function calculateInventoryAvailability(targetDateStr) {
  let targetDate = new Date();
  if (targetDateStr) {
    const parsed = new Date(targetDateStr);
    if (!isNaN(parsed.getTime())) {
      targetDate = parsed;
    }
  }

  const targetYear  = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth();
  const targetDay   = targetDate.getDate();

  const targetStart = new Date(targetYear, targetMonth, targetDay, 0, 0, 0, 0);
  const targetEnd   = new Date(targetYear, targetMonth, targetDay, 23, 59, 59, 999);
  const asOf        = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;

  const now = new Date();
  const isToday = targetStart.toDateString() === now.toDateString();

  // 1. Fetch room types and physical rooms in parallel
  const [roomTypes, rooms] = await Promise.all([
    RoomType.find().sort({ _id: 1 }).lean(),
    Room.find().sort({ room_number: 1 }).lean(),
  ]);

  // 2. Fetch reservations active on the target forecast date
  // Active stay covering target date: arrival <= targetEnd && departure > targetStart
  const activeReservations = await Reservation.find({
    status: { $in: ['Checked In', 'Confirmed'] },
    arrival_date:   { $lte: targetEnd },
    departure_date: { $gt: targetStart },
  }).lean();

  // Track occupied / booked physical room IDs and room numbers
  const occupiedRoomIdSet = new Set(
    activeReservations.map(r => r.room_id?.toString()).filter(Boolean)
  );
  const occupiedRoomNumberSet = new Set(
    activeReservations.map(r => r.room_number ? String(r.room_number).trim() : null).filter(Boolean)
  );

  // Track unassigned reservations per room type (reserved without a specific physical room number assigned yet)
  const unassignedByType = {};
  for (const r of activeReservations) {
    if (!r.room_id && !r.room_number && r.room_type) {
      const typeKey = r.room_type.toLowerCase().trim();
      unassignedByType[typeKey] = (unassignedByType[typeKey] || 0) + 1;
    }
  }

  // Helper: Is room occupied/assigned on target date
  const isRoomOccupied = (room) => {
    if (room._id && occupiedRoomIdSet.has(room._id.toString())) return true;
    if (room.room_number && occupiedRoomNumberSet.has(String(room.room_number).trim())) return true;
    return false;
  };

  // Helper: Is room Out of Order (OOO) or Out of Service (OOS)
  const isRoomOOO = (room) => {
    return room.maintenance_status === 'OOO' || room.maintenance_status === 'OOS';
  };

  // Helper: Is room dirty / uncleaned
  const isRoomDirty = (room) => {
    return room.housekeeping_status === 'Dirty';
  };

  // Group physical rooms by category
  const typeMap = new Map();
  for (const rt of roomTypes) {
    typeMap.set(rt._id.toString(), {
      type: rt,
      rooms: [],
    });
  }

  for (const room of rooms) {
    const tid = room.room_type_id?.toString();
    if (tid && typeMap.has(tid)) {
      typeMap.get(tid).rooms.push(room);
    } else {
      const matched = roomTypes.find(rt => rt.name.toLowerCase() === (room.room_type || '').toLowerCase());
      if (matched && typeMap.has(matched._id.toString())) {
        typeMap.get(matched._id.toString()).rooms.push(room);
      }
    }
  }

  // Calculate stats per room type
  const breakdown = roomTypes.map((rt) => {
    const entry = typeMap.get(rt._id.toString()) || { rooms: [] };
    const typeRooms = entry.rooms;
    const total = typeRooms.length;

    let assignedOccupied = 0;
    let ooo = 0;
    let dirty = 0;
    let inspected = 0;
    let clean = 0;

    for (const r of typeRooms) {
      if (r.housekeeping_status === 'Inspected') inspected++;
      if (r.housekeeping_status === 'Clean') clean++;

      const occupiedFlag = isRoomOccupied(r);
      const oooFlag      = isRoomOOO(r);
      const dirtyFlag    = isRoomDirty(r);

      if (occupiedFlag) {
        assignedOccupied++;
      } else if (oooFlag) {
        // Out of order / Out of service
        ooo++;
      } else if (dirtyFlag) {
        // Vacant but dirty/uncleaned (not ready for check-in)
        dirty++;
      }
    }

    // Include unassigned reservations for this category
    const unassignedCount = unassignedByType[rt.name.toLowerCase().trim()] || 0;
    const occupied = assignedOccupied + unassignedCount;

    // Sellable rooms = total minus OOO/OOS
    const sellable = Math.max(0, total - ooo);

    // Exact Formula:
    // True Available Rooms = Total Rooms - (Occupied Rooms + Dirty/Uncleaned Rooms + Out of Order/Service Rooms)
    const unavailable = occupied + dirty + ooo;
    const trueAvailable = Math.max(0, total - unavailable);
    const pct = sellable > 0 ? Math.round((occupied / sellable) * 100) : 0;

    return {
      type_id:              rt._id,
      type_code:            rt.type_code,
      name:                 rt.name,
      base_price:           rt.base_price,
      total_rooms:          total,
      ooo_rooms:            ooo,
      dirty_rooms:          dirty,
      inspected_rooms:      inspected,
      clean_rooms:          clean,
      occupied_rooms:       occupied,
      sellable_rooms:       sellable,
      available_rooms:      trueAvailable,
      true_available_rooms: trueAvailable,
      occupancy_pct:        pct,
    };
  });

  // Calculate property-wide summary
  const summary = breakdown.reduce(
    (acc, r) => {
      acc.total += r.total_rooms;
      acc.total_rooms += r.total_rooms;
      acc.ooo += r.ooo_rooms;
      acc.ooo_rooms += r.ooo_rooms;
      acc.dirty += r.dirty_rooms;
      acc.dirty_rooms += r.dirty_rooms;
      acc.inspected += r.inspected_rooms;
      acc.inspected_rooms += r.inspected_rooms;
      acc.clean += r.clean_rooms;
      acc.clean_rooms += r.clean_rooms;
      acc.occupied += r.occupied_rooms;
      acc.occupied_rooms += r.occupied_rooms;
      acc.sellable += r.sellable_rooms;
      acc.sellable_rooms += r.sellable_rooms;
      acc.available += r.available_rooms;
      acc.available_rooms += r.available_rooms;
      acc.true_available += r.true_available_rooms;
      acc.true_available_rooms += r.true_available_rooms;
      return acc;
    },
    {
      total: 0, total_rooms: 0, ooo: 0, ooo_rooms: 0, dirty: 0, dirty_rooms: 0,
      inspected: 0, inspected_rooms: 0, clean: 0, clean_rooms: 0,
      occupied: 0, occupied_rooms: 0, sellable: 0, sellable_rooms: 0,
      available: 0, available_rooms: 0, true_available: 0, true_available_rooms: 0,
      occupancy_pct: 0,
    }
  );

  summary.occupancy_pct = summary.sellable > 0
    ? Math.round((summary.occupied / summary.sellable) * 100)
    : 0;

  return {
    summary,
    breakdown,
    as_of:       asOf,
    target_date: asOf,
    is_today:    isToday,
  };
}

// ── GET /api/inventory/breakdown?date=YYYY-MM-DD ─────────────────────────────
// Full breakdown and summary for the Room Inventory Breakdown page & forecasting
router.get('/breakdown', async (req, res) => {
  try {
    const data = await calculateInventoryAvailability(req.query.date);
    return res.json(data);
  } catch (err) {
    console.error('Error fetching inventory breakdown:', err.message);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── GET /api/inventory/summary?date=YYYY-MM-DD ───────────────────────────────
// Summary and room-type category breakdown for the Dashboard "Rooms Available" widget
router.get('/summary', async (req, res) => {
  try {
    const data = await calculateInventoryAvailability(req.query.date);
    return res.json({
      summary:     data.summary,
      breakdown:   data.breakdown,
      as_of:       data.as_of,
      target_date: data.target_date,
      is_today:    data.is_today,
    });
  } catch (err) {
    console.error('Error fetching inventory summary:', err.message);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── GET /api/inventory/availability?date=YYYY-MM-DD ──────────────────────────
// Direct alias for forecasting endpoint
router.get('/availability', async (req, res) => {
  try {
    const data = await calculateInventoryAvailability(req.query.date);
    return res.json(data);
  } catch (err) {
    console.error('Error fetching inventory availability:', err.message);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── GET /api/inventory ───────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const data = await calculateInventoryAvailability(req.query.date);
    return res.json(data);
  } catch (err) {
    console.error('Error fetching inventory:', err.message);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
