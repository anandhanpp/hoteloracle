// ── backend/server.js ─────────────────────────────────────────────────────────
// Oracle Hospitality PMS — Express + MongoDB Atlas (Mongoose)
// ─────────────────────────────────────────────────────────────────────────────
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express      = require('express');
const cors         = require('cors');
const { connect }  = require('./db');

// ── Routers ───────────────────────────────────────────────────────────────────
const authRouter         = require('./routes/auth');
const reservationsRouter = require('./routes/reservations');
const roomsRouter        = require('./routes/rooms');
const billingRouter      = require('./routes/billing');
const inventoryRouter    = require('./routes/inventory');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',         authRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/rooms',        roomsRouter);
app.use('/api/billing',      billingRouter);
app.use('/api/inventory',    inventoryRouter);

// ── Health / DB check ─────────────────────────────────────────────────────────
app.get('/api/status', (_req, res) => {
  res.json({ status: 'ok', message: 'Backend is running', db: 'MongoDB Atlas' });
});

app.get('/api/db-test', (_req, res) => {
  const { mongoose } = require('./db');
  const state = mongoose.connection.readyState;
  // 0=disconnected 1=connected 2=connecting 3=disconnecting
  if (state === 1) return res.json({ status: 'ok', message: 'MongoDB is connected' });
  return res.status(500).json({ status: 'error', message: `MongoDB state: ${state}` });
});

// ── Bootstrap & Export ────────────────────────────────────────────────────────
// Initialize MongoDB Atlas connection
connect();

// Run standard listener for local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`✅  Server listening on http://localhost:${PORT}`);
  });
}

// Strictly required by Vercel to run Express as a serverless function
module.exports = app;
