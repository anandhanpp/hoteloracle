require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const pool    = require('./db');          // promise-based mysql2 pool
const authRouter      = require('./routes/auth');
const inventoryRouter = require('./routes/inventory');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Allowed enum values ──────────────────────────────────────────────────────
const VALID_STATUSES        = ['Confirmed', 'Checked In', 'Checked Out', 'Pending'];
const VALID_PAYMENT_MODES   = ['Cash', 'Credit Card', 'Debit Card', 'UPI', 'Bank Transfer', 'Bill to Room', 'Complimentary'];
const VALID_SOURCES         = ['Direct', 'OTA', 'Corporate', 'Walk-in', 'Travel Agent', 'Phone'];
const VALID_BILLING_OPTIONS = ['Guest Account', 'Company/Corporate', 'Pre-paid', 'Split Billing'];
const VALID_MEMBERSHIP_TIERS= ['None', 'Silver', 'Gold', 'Platinum', 'Diamond'];
const VALID_HOUSEKEEPING_STATUSES = ['Clean', 'Dirty', 'Inspected'];
const VALID_MAINTENANCE_STATUSES  = ['Active', 'OOO', 'OOS'];

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Auth routes ──────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);

// ── Inventory routes ─────────────────────────────────────────────────────────
app.use('/api/inventory', inventoryRouter);

// ── Start server (pool verifies DB in db.js on import) ───────────────────────
app.listen(PORT, () => {
  console.log(`✅  Server listening on http://localhost:${PORT}`);
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/status', (_req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// ── DB connectivity check ─────────────────────────────────────────────────────
app.get('/api/db-test', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', message: 'MySQL is connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── GET /api/reservations ─────────────────────────────────────────────────────
// Fetch all reservations, ordered by arrival_date ascending.
// Optional query params: ?status=Confirmed  ?room_type=Deluxe%20King
app.get('/api/reservations', async (req, res) => {
  try {
    let sql = `
      SELECT 
        reservations.*,
        rooms.room_number,
        rooms.housekeeping_status AS room_housekeeping_status,
        rooms.maintenance_status AS room_maintenance_status
      FROM reservations
      LEFT JOIN rooms ON reservations.room_id = rooms.id
    `;
    const params = [];
    const filters = [];

    if (req.query.status) {
      filters.push('reservations.status = ?');
      params.push(req.query.status);
    }
    if (req.query.room_type) {
      filters.push('reservations.room_type = ?');
      params.push(req.query.room_type);
    }
    if (req.query.search) {
      const searchStr = `%${req.query.search}%`;
      filters.push('(reservations.guest_name LIKE ? OR reservations.confirmation_number LIKE ? OR reservations.phone_number LIKE ? OR rooms.room_number LIKE ?)');
      params.push(searchStr, searchStr, searchStr, searchStr);
    }
    if (req.query.date && req.query.date_type) {
      if (req.query.date_type === 'arrival') {
        filters.push('reservations.arrival_date = ?');
        params.push(req.query.date);
      } else if (req.query.date_type === 'departure') {
        filters.push('reservations.departure_date = ?');
        params.push(req.query.date);
      } else if (req.query.date_type === 'inhouse') {
        filters.push('reservations.arrival_date <= ? AND reservations.departure_date >= ? AND reservations.status = "Checked In"');
        params.push(req.query.date, req.query.date);
      }
    }

    if (filters.length > 0) sql += ' WHERE ' + filters.join(' AND ');
    sql += ' ORDER BY reservations.arrival_date ASC, reservations.id ASC';

    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching reservations:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── POST /api/reservations ────────────────────────────────────────────────────
// Create a new reservation.
// Body: { guest_name, confirmation_number, room_type, arrival_date,
//         departure_date, adults, children, status,
//         room_rate, payment_mode, reservation_source, billing_option }
app.post('/api/reservations', async (req, res) => {
  try {
    const {
      guest_name,
      confirmation_number,
      phone_number       = null,
      membership_tier    = 'None',
      room_type,
      arrival_date,
      departure_date,
      adults             = 1,
      children           = 0,
      status             = 'Confirmed',
      check_in_time      = null,
      check_out_time     = null,
      room_rate          = 0,
      payment_mode       = 'Credit Card',
      reservation_source = 'Direct',
      billing_option     = 'Guest Account',
    } = req.body;

    // ── Validation ────────────────────────────────────────────────────────────
    if (!guest_name || !confirmation_number || !room_type || !arrival_date || !departure_date) {
      return res.status(400).json({
        status: 'error',
        message: 'guest_name, confirmation_number, room_type, arrival_date, and departure_date are required.',
      });
    }
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }
    if (payment_mode && !VALID_PAYMENT_MODES.includes(payment_mode)) {
      return res.status(400).json({
        status: 'error',
        message: `payment_mode must be one of: ${VALID_PAYMENT_MODES.join(', ')}`,
      });
    }
    if (reservation_source && !VALID_SOURCES.includes(reservation_source)) {
      return res.status(400).json({
        status: 'error',
        message: `reservation_source must be one of: ${VALID_SOURCES.join(', ')}`,
      });
    }
    if (billing_option && !VALID_BILLING_OPTIONS.includes(billing_option)) {
      return res.status(400).json({
        status: 'error',
        message: `billing_option must be one of: ${VALID_BILLING_OPTIONS.join(', ')}`,
      });
    }
    if (membership_tier && !VALID_MEMBERSHIP_TIERS.includes(membership_tier)) {
      return res.status(400).json({
        status: 'error',
        message: `membership_tier must be one of: ${VALID_MEMBERSHIP_TIERS.join(', ')}`,
      });
    }
    if (new Date(departure_date) <= new Date(arrival_date)) {
      return res.status(400).json({
        status: 'error',
        message: 'departure_date must be after arrival_date.',
      });
    }

    // Auto-assign timestamps if needed
    let finalCheckIn = check_in_time;
    let finalCheckOut = check_out_time;
    if (status === 'Checked In' && !finalCheckIn) finalCheckIn = new Date();
    if (status === 'Checked Out' && !finalCheckOut) finalCheckOut = new Date();

    const room_id = req.body.room_id ? Number(req.body.room_id) : null;

    // ── Insert ────────────────────────────────────────────────────────────────
    const sql = `
      INSERT INTO reservations
        (room_id, guest_name, confirmation_number, phone_number, membership_tier, room_type, arrival_date, departure_date,
         adults, children, status, check_in_time, check_out_time, room_rate, payment_mode, reservation_source, billing_option)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await pool.execute(sql, [
      room_id,
      guest_name,
      confirmation_number.toUpperCase(),
      phone_number,
      membership_tier,
      room_type,
      arrival_date,
      departure_date,
      Number(adults),
      Number(children),
      status,
      finalCheckIn,
      finalCheckOut,
      Number(room_rate),
      payment_mode,
      reservation_source,
      billing_option,
    ]);

    // Return the newly created row with room_number
    const [rows] = await pool.execute(`
      SELECT reservations.*, rooms.room_number 
      FROM reservations 
      LEFT JOIN rooms ON reservations.room_id = rooms.id 
      WHERE reservations.id = ?
    `, [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    // MySQL duplicate-key error code
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ status: 'error', message: 'confirmation_number already exists.' });
    }
    console.error('Error creating reservation:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── PUT /api/reservations/:id ─────────────────────────────────────────────────
// Update any combination of fields on an existing reservation.
// Sending only { status: 'Checked In' } is fully supported.
// Body: { guest_name?, confirmation_number?, room_type?, arrival_date?,
//         departure_date?, adults?, children?, status?,
//         room_rate?, payment_mode?, reservation_source?, billing_option? }
app.put('/api/reservations/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(404).json({ status: 'error', message: `Reservation ${req.params.id} not found.` });
    }

    // Fetch current row so we can merge partial updates
    const [existing] = await pool.execute('SELECT * FROM reservations WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ status: 'error', message: `Reservation ${id} not found.` });
    }
    const current = existing[0];

    // Merge: body fields override current DB values
    const room_id             = req.body.room_id !== undefined ? (req.body.room_id ? Number(req.body.room_id) : null) : current.room_id;
    const guest_name          = req.body.guest_name          ?? current.guest_name;
    const confirmation_number = req.body.confirmation_number ?? current.confirmation_number;
    const phone_number        = req.body.phone_number        ?? current.phone_number;
    const membership_tier     = req.body.membership_tier     ?? current.membership_tier;
    const room_type           = req.body.room_type           ?? current.room_type;
    const arrival_date        = req.body.arrival_date        ?? current.arrival_date;
    const departure_date      = req.body.departure_date      ?? current.departure_date;
    const adults              = req.body.adults              ?? current.adults;
    const children            = req.body.children            ?? current.children;
    const status              = req.body.status              ?? current.status;
    let   check_in_time       = req.body.check_in_time       !== undefined ? req.body.check_in_time : current.check_in_time;
    let   check_out_time      = req.body.check_out_time      !== undefined ? req.body.check_out_time : current.check_out_time;
    const room_rate           = req.body.room_rate           ?? current.room_rate;
    const payment_mode        = req.body.payment_mode        ?? current.payment_mode;
    const reservation_source  = req.body.reservation_source  ?? current.reservation_source;
    const billing_option      = req.body.billing_option      ?? current.billing_option;

    // ── Validation ────────────────────────────────────────────────────────────
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }
    if (payment_mode && !VALID_PAYMENT_MODES.includes(payment_mode)) {
      return res.status(400).json({
        status: 'error',
        message: `payment_mode must be one of: ${VALID_PAYMENT_MODES.join(', ')}`,
      });
    }
    if (reservation_source && !VALID_SOURCES.includes(reservation_source)) {
      return res.status(400).json({
        status: 'error',
        message: `reservation_source must be one of: ${VALID_SOURCES.join(', ')}`,
      });
    }
    if (billing_option && !VALID_BILLING_OPTIONS.includes(billing_option)) {
      return res.status(400).json({
        status: 'error',
        message: `billing_option must be one of: ${VALID_BILLING_OPTIONS.join(', ')}`,
      });
    }
    if (membership_tier && !VALID_MEMBERSHIP_TIERS.includes(membership_tier)) {
      return res.status(400).json({
        status: 'error',
        message: `membership_tier must be one of: ${VALID_MEMBERSHIP_TIERS.join(', ')}`,
      });
    }

    // Auto-assign timestamps if status changes
    if (status === 'Checked In' && current.status !== 'Checked In' && !req.body.check_in_time) {
      check_in_time = new Date();
    }
    if (status === 'Checked Out' && current.status !== 'Checked Out' && !req.body.check_out_time) {
      check_out_time = new Date();
    }

    // If checked out, mark assigned room as Dirty
    if (status === 'Checked Out' && current.room_id) {
      await pool.execute('UPDATE rooms SET housekeeping_status = "Dirty" WHERE id = ?', [current.room_id]);
    }

    // Only validate date ordering when at least one date field was touched
    const dateChanged = req.body.arrival_date !== undefined || req.body.departure_date !== undefined;
    if (dateChanged && new Date(departure_date) <= new Date(arrival_date)) {
      return res.status(400).json({
        status: 'error',
        message: 'departure_date must be after arrival_date.',
      });
    }

    // ── Update ────────────────────────────────────────────────────────────────
    const sql = `
      UPDATE reservations SET
        room_id             = ?,
        guest_name          = ?,
        confirmation_number = ?,
        phone_number        = ?,
        membership_tier     = ?,
        room_type           = ?,
        arrival_date        = ?,
        departure_date      = ?,
        adults              = ?,
        children            = ?,
        status              = ?,
        check_in_time       = ?,
        check_out_time      = ?,
        room_rate           = ?,
        payment_mode        = ?,
        reservation_source  = ?,
        billing_option      = ?
      WHERE id = ?
    `;
    await pool.execute(sql, [
      room_id,
      guest_name,
      confirmation_number.toString().toUpperCase(),
      phone_number,
      membership_tier,
      room_type,
      arrival_date,
      departure_date,
      Number(adults),
      Number(children),
      status,
      check_in_time,
      check_out_time,
      Number(room_rate),
      payment_mode,
      reservation_source,
      billing_option,
      id,
    ]);

    // Return the full updated row with room_number
    const [rows] = await pool.execute(`
      SELECT reservations.*, rooms.room_number 
      FROM reservations 
      LEFT JOIN rooms ON reservations.room_id = rooms.id 
      WHERE reservations.id = ?
    `, [id]);
    console.log(`✏️  Reservation ${id} updated → status: "${rows[0].status}", room_id: ${rows[0].room_id}`);
    res.json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ status: 'error', message: 'confirmation_number already exists.' });
    }
    console.error('Error updating reservation:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── DELETE /api/reservations/:id ──────────────────────────────────────────────
// Permanently delete a reservation by numeric id.
app.delete('/api/reservations/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(404).json({ status: 'error', message: `Reservation ${req.params.id} not found.` });
    }

    // Fetch before deleting so we can return it in the response
    const [existing] = await pool.execute('SELECT * FROM reservations WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ status: 'error', message: `Reservation ${id} not found.` });
    }

    await pool.execute('DELETE FROM reservations WHERE id = ?', [id]);
    res.json({ status: 'ok', deleted: existing[0] });
  } catch (err) {
    console.error('Error deleting reservation:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// ROOMS & HOUSEKEEPING MODULE  –  /api/rooms
// ════════════════════════════════════════════════════════════════════════════

// ── GET /api/rooms ────────────────────────────────────────────────────────────
// Fetch all rooms with their current housekeeping and maintenance statuses,
// including current occupant reservation info if checked in.
app.get('/api/rooms', async (req, res) => {
  try {
    const { housekeeping_status, maintenance_status, room_type, floor } = req.query;
    let sql = `
      SELECT 
        r.id,
        r.room_number,
        r.room_type,
        r.housekeeping_status,
        r.maintenance_status,
        r.created_at,
        r.updated_at,
        res.id AS reservation_id,
        res.guest_name,
        res.confirmation_number,
        res.arrival_date,
        res.departure_date,
        res.status AS reservation_status,
        CASE WHEN res.id IS NOT NULL THEN 1 ELSE 0 END AS is_occupied
      FROM rooms r
      LEFT JOIN reservations res 
        ON res.room_id = r.id AND res.status = 'Checked In'
    `;
    const conditions = [];
    const params = [];

    if (housekeeping_status && VALID_HOUSEKEEPING_STATUSES.includes(housekeeping_status)) {
      conditions.push('r.housekeeping_status = ?');
      params.push(housekeeping_status);
    }
    if (maintenance_status && VALID_MAINTENANCE_STATUSES.includes(maintenance_status)) {
      conditions.push('r.maintenance_status = ?');
      params.push(maintenance_status);
    }
    if (room_type) {
      conditions.push('r.room_type = ?');
      params.push(room_type);
    }
    if (floor) {
      conditions.push('r.room_number LIKE ?');
      params.push(`${floor}%`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY CAST(r.room_number AS UNSIGNED) ASC, r.room_number ASC';

    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching rooms:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── GET /api/rooms/available ──────────────────────────────────────────────────
// Fetch only rooms where housekeeping_status = 'Inspected' AND maintenance_status != 'OOO',
// not occupied, filtered optionally by room_type.
app.get('/api/rooms/available', async (req, res) => {
  try {
    const { room_type } = req.query;
    let sql = `
      SELECT r.*
      FROM rooms r
      WHERE r.housekeeping_status = 'Inspected'
        AND r.maintenance_status != 'OOO'
        AND r.maintenance_status != 'OOS'
        AND NOT EXISTS (
          SELECT 1 FROM reservations res 
          WHERE res.room_id = r.id AND res.status = 'Checked In'
        )
    `;
    const params = [];

    if (room_type) {
      sql += ' AND r.room_type = ?';
      params.push(room_type);
    }

    sql += ' ORDER BY CAST(r.room_number AS UNSIGNED) ASC, r.room_number ASC';

    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching available rooms:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── PUT /api/rooms/:id/status ─────────────────────────────────────────────────
// Update a specific room's housekeeping_status or maintenance_status.
// Body: { housekeeping_status?, maintenance_status? }
app.put('/api/rooms/:id/status', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(404).json({ status: 'error', message: `Room ${req.params.id} not found.` });
    }

    const { housekeeping_status, maintenance_status } = req.body;

    if (!housekeeping_status && !maintenance_status) {
      return res.status(400).json({
        status: 'error',
        message: 'At least one of housekeeping_status or maintenance_status must be provided.',
      });
    }

    if (housekeeping_status && !VALID_HOUSEKEEPING_STATUSES.includes(housekeeping_status)) {
      return res.status(400).json({
        status: 'error',
        message: `housekeeping_status must be one of: ${VALID_HOUSEKEEPING_STATUSES.join(', ')}`,
      });
    }

    if (maintenance_status && !VALID_MAINTENANCE_STATUSES.includes(maintenance_status)) {
      return res.status(400).json({
        status: 'error',
        message: `maintenance_status must be one of: ${VALID_MAINTENANCE_STATUSES.join(', ')}`,
      });
    }

    const [existing] = await pool.execute('SELECT * FROM rooms WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ status: 'error', message: `Room ${id} not found.` });
    }

    const current = existing[0];
    const newHK    = housekeeping_status ?? current.housekeeping_status;
    const newMaint = maintenance_status ?? current.maintenance_status;

    await pool.execute(
      'UPDATE rooms SET housekeeping_status = ?, maintenance_status = ? WHERE id = ?',
      [newHK, newMaint, id]
    );

    const [updated] = await pool.execute('SELECT * FROM rooms WHERE id = ?', [id]);
    console.log(`🏨 Room ${current.room_number} updated: HK="${newHK}", Maint="${newMaint}"`);
    res.json(updated[0]);
  } catch (err) {
    console.error('Error updating room status:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// BILLING MODULE  –  /api/billing
// ════════════════════════════════════════════════════════════════════════════

// ── GET /api/billing/:reservation_id ─────────────────────────────────────────
// Returns the reservation header + charges and payments grouped by window (1-8).
// Shape: { reservation, windows: { 1: { charges, payments, balance }, … } }
app.get('/api/billing/:reservation_id', async (req, res) => {
  try {
    const rid = Number(req.params.reservation_id);
    if (!Number.isInteger(rid) || rid < 1) {
      return res.status(400).json({ status: 'error', message: 'Invalid reservation_id.' });
    }

    // Fetch reservation header
    const [reservations] = await pool.execute(
      'SELECT * FROM reservations WHERE id = ?', [rid]
    );
    if (reservations.length === 0) {
      return res.status(404).json({ status: 'error', message: `Reservation ${rid} not found.` });
    }

    // Fetch all charges for this reservation
    const [charges] = await pool.execute(
      'SELECT * FROM charges WHERE reservation_id = ? ORDER BY window_number ASC, created_at ASC',
      [rid]
    );

    // Fetch all payments for this reservation
    const [payments] = await pool.execute(
      'SELECT * FROM payments WHERE reservation_id = ? ORDER BY window_number ASC, created_at ASC',
      [rid]
    );

    // Group into windows 1-8
    const windows = {};
    for (let w = 1; w <= 8; w++) {
      const wCharges  = charges.filter(c => c.window_number === w);
      const wPayments = payments.filter(p => p.window_number === w);
      const totalCharges  = wCharges.reduce((s, c) => s + parseFloat(c.total),  0);
      const totalPayments = wPayments.reduce((s, p) => s + parseFloat(p.amount), 0);
      windows[w] = {
        charges:  wCharges,
        payments: wPayments,
        total_charges:  parseFloat(totalCharges.toFixed(2)),
        total_payments: parseFloat(totalPayments.toFixed(2)),
        balance: parseFloat((totalCharges - totalPayments).toFixed(2)),
      };
    }

    res.json({ reservation: reservations[0], windows });
  } catch (err) {
    console.error('Error fetching billing:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── POST /api/billing/charge ──────────────────────────────────────────────────
// Body: { reservation_id, window_number?, transaction_code, description?,
//         price, quantity?, supplement?, reference? }
app.post('/api/billing/charge', async (req, res) => {
  try {
    const {
      reservation_id,
      window_number    = 1,
      transaction_code,
      description      = '',
      price,
      quantity         = 1,
      supplement       = null,
      reference        = null,
    } = req.body;

    if (!reservation_id || !transaction_code || price === undefined) {
      return res.status(400).json({
        status: 'error',
        message: 'reservation_id, transaction_code, and price are required.',
      });
    }

    const win = Number(window_number);
    if (win < 1 || win > 8) {
      return res.status(400).json({ status: 'error', message: 'window_number must be 1–8.' });
    }

    // Verify reservation exists
    const [existing] = await pool.execute(
      'SELECT id FROM reservations WHERE id = ?', [Number(reservation_id)]
    );
    if (existing.length === 0) {
      return res.status(404).json({ status: 'error', message: `Reservation ${reservation_id} not found.` });
    }

    const qty   = Number(quantity);
    const prc   = parseFloat(price);
    const total = parseFloat((prc * qty).toFixed(2));

    const [result] = await pool.execute(
      `INSERT INTO charges
         (reservation_id, window_number, transaction_code, description, price, quantity, total, supplement, reference)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [Number(reservation_id), win, transaction_code, description, prc, qty, total, supplement, reference]
    );

    const [rows] = await pool.execute('SELECT * FROM charges WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error posting charge:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── POST /api/billing/payment ─────────────────────────────────────────────────
// Body: { reservation_id, window_number?, payment_method?, amount,
//         reference?, supplement?, card_holder? }
app.post('/api/billing/payment', async (req, res) => {
  try {
    const {
      reservation_id,
      window_number  = 1,
      payment_method = 'Cash',
      amount,
      reference      = null,
      supplement     = null,
      card_holder    = null,
    } = req.body;

    if (!reservation_id || amount === undefined) {
      return res.status(400).json({
        status: 'error',
        message: 'reservation_id and amount are required.',
      });
    }

    const win = Number(window_number);
    if (win < 1 || win > 8) {
      return res.status(400).json({ status: 'error', message: 'window_number must be 1–8.' });
    }

    // Verify reservation exists
    const [existing] = await pool.execute(
      'SELECT id FROM reservations WHERE id = ?', [Number(reservation_id)]
    );
    if (existing.length === 0) {
      return res.status(404).json({ status: 'error', message: `Reservation ${reservation_id} not found.` });
    }

    const [result] = await pool.execute(
      `INSERT INTO payments
         (reservation_id, window_number, payment_method, amount, reference, supplement, card_holder)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [Number(reservation_id), win, payment_method, parseFloat(amount), reference, supplement, card_holder]
    );

    const [rows] = await pool.execute('SELECT * FROM payments WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error posting payment:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── PUT /api/billing/transfer ─────────────────────────────────────────────────
// Move a charge from one window to another.
// Body: { charge_id, to_window }
app.put('/api/billing/transfer', async (req, res) => {
  try {
    const { charge_id, to_window } = req.body;

    if (!charge_id || to_window === undefined) {
      return res.status(400).json({
        status: 'error',
        message: 'charge_id and to_window are required.',
      });
    }

    const win = Number(to_window);
    if (win < 1 || win > 8) {
      return res.status(400).json({ status: 'error', message: 'to_window must be 1–8.' });
    }

    // Verify charge exists
    const [existing] = await pool.execute('SELECT * FROM charges WHERE id = ?', [Number(charge_id)]);
    if (existing.length === 0) {
      return res.status(404).json({ status: 'error', message: `Charge ${charge_id} not found.` });
    }

    await pool.execute(
      'UPDATE charges SET window_number = ? WHERE id = ?',
      [win, Number(charge_id)]
    );

    const [rows] = await pool.execute('SELECT * FROM charges WHERE id = ?', [Number(charge_id)]);
    res.json(rows[0]);
  } catch (err) {
    console.error('Error transferring charge:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── DELETE /api/billing/charge/:id ───────────────────────────────────────────
// Remove a single charge.
app.delete('/api/billing/charge/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(404).json({ status: 'error', message: `Charge ${req.params.id} not found.` });
    }

    const [existing] = await pool.execute('SELECT * FROM charges WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ status: 'error', message: `Charge ${id} not found.` });
    }

    await pool.execute('DELETE FROM charges WHERE id = ?', [id]);
    res.json({ status: 'ok', deleted: existing[0] });
  } catch (err) {
    console.error('Error deleting charge:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});
