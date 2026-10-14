// ── backend/routes/inventory.js ──────────────────────────────────────────────
// GET /api/inventory/breakdown  – real-time room availability per category
const express = require('express');
const pool    = require('../db');

const router = express.Router();

// ── GET /api/inventory/breakdown ─────────────────────────────────────────────
// Returns per-room-type totals, occupied count (Checked In today), and
// available count, plus a property-wide summary row.
//
// Response shape:
// {
//   summary : { total, occupied, available, occupancy_pct },
//   breakdown: [
//     { type_code, name, base_price, total_rooms, occupied_rooms,
//       available_rooms, ooo_rooms, occupancy_pct },
//     ...
//   ]
// }
router.get('/breakdown', async (_req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const sql = `
      SELECT
        rt.id              AS type_id,
        rt.type_code,
        rt.name,
        rt.base_price,

        -- Total physical rooms of this type
        COUNT(r.id)        AS total_rooms,

        -- Out-of-order rooms (maintenance_status = 'OOO')
        SUM(CASE WHEN r.maintenance_status = 'OOO' THEN 1 ELSE 0 END) AS ooo_rooms,

        -- Rooms currently occupied: linked to a Checked-In reservation
        -- where today falls within the stay window
        SUM(
          CASE
            WHEN res.id IS NOT NULL
             AND res.status = 'Checked In'
             AND res.arrival_date   <= ?
             AND res.departure_date >= ?
            THEN 1
            ELSE 0
          END
        ) AS occupied_rooms

      FROM room_types rt
      LEFT JOIN rooms r
        ON r.room_type_id = rt.id
      LEFT JOIN reservations res
        ON res.room_id = r.id
       AND res.status = 'Checked In'
       AND res.arrival_date   <= ?
       AND res.departure_date >= ?

      GROUP BY rt.id, rt.type_code, rt.name, rt.base_price
      ORDER BY rt.id ASC
    `;

    const [rows] = await pool.execute(sql, [today, today, today, today]);

    // Compute derived fields
    const breakdown = rows.map(row => {
      const total     = Number(row.total_rooms);
      const ooo       = Number(row.ooo_rooms);
      const occupied  = Number(row.occupied_rooms);
      const sellable  = total - ooo;             // rooms that can be sold
      const available = Math.max(0, sellable - occupied);
      const pct       = sellable > 0
        ? Math.round((occupied / sellable) * 100)
        : 0;

      return {
        type_id:        row.type_id,
        type_code:      row.type_code,
        name:           row.name,
        base_price:     parseFloat(row.base_price),
        total_rooms:    total,
        ooo_rooms:      ooo,
        sellable_rooms: sellable,
        occupied_rooms: occupied,
        available_rooms: available,
        occupancy_pct:  pct,
      };
    });

    // Property-wide summary
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

    return res.json({ summary, breakdown, as_of: today });
  } catch (err) {
    console.error('Error fetching inventory breakdown:', err.message);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
