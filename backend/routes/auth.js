// ── backend/routes/auth.js ────────────────────────────────────────────────────
// POST /api/auth/login  – verify credentials, return signed JWT
const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');

const router = express.Router();

const JWT_SECRET     = process.env.JWT_SECRET || 'oracle_hotel_secret_change_in_prod';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';   // typical hotel shift

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Basic input validation
    if (!username || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'username and password are required.',
      });
    }

    // Look up the user
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE username = ? LIMIT 1',
      [username.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      // Return a generic message to prevent username enumeration
      return res.status(401).json({ status: 'error', message: 'Invalid credentials.' });
    }

    const user = rows[0];

    // Compare the provided password against the stored hash
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ status: 'error', message: 'Invalid credentials.' });
    }

    // Build JWT payload (never include the hash)
    const payload = {
      id:       user.id,
      username: user.username,
      role:     user.role,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    console.log(`🔑  User "${user.username}" (${user.role}) logged in.`);

    return res.json({
      status: 'ok',
      token,
      user: payload,
    });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
// Validate a token and return the current user's info.
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.json({ status: 'ok', user: { id: decoded.id, username: decoded.username, role: decoded.role } });
  } catch {
    return res.status(401).json({ status: 'error', message: 'Invalid or expired token.' });
  }
});

module.exports = router;
