// ── backend/routes/auth.js ────────────────────────────────────────────────────
const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const { User } = require('../models/index');

const router = express.Router();

const JWT_SECRET     = process.env.JWT_SECRET || 'oracle_hotel_secret_change_in_prod';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ status: 'error', message: 'username and password are required.' });
    }

    const user = await User.findOne({ username: username.trim().toLowerCase() });
    if (!user) return res.status(401).json({ status: 'error', message: 'Invalid credentials.' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ status: 'error', message: 'Invalid credentials.' });

    const payload = { id: user._id, username: user.username, role: user.role };
    const token   = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    console.log(`🔑  User "${user.username}" (${user.role}) logged in.`);
    return res.json({ status: 'ok', token, user: payload });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'No token provided.' });
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    return res.json({ status: 'ok', user: { id: decoded.id, username: decoded.username, role: decoded.role } });
  } catch {
    return res.status(401).json({ status: 'error', message: 'Invalid or expired token.' });
  }
});

module.exports = router;
