require('dotenv').config();
const mysql = require('mysql2/promise');

// ── Connection pool ─────────────────────────────────────────────────────────
// Using a pool (not a single connection) so concurrent API requests
// each get their own connection without queuing.
const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'hotel_db',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
});

// ── Startup connectivity check ──────────────────────────────────────────────
// Fire-and-forget ping so we know the pool can actually reach MySQL.
(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('✅  MySQL pool connected to', process.env.DB_NAME || 'hotel_db');
  } catch (err) {
    console.error('❌  MySQL connection failed:', err.message);
    process.exit(1);
  }
})();

module.exports = pool;