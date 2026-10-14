// ── backend/server.js ─────────────────────────────────────────────────────────
// Oracle Hospitality PMS — Express + MongoDB Atlas (Mongoose)
// ─────────────────────────────────────────────────────────────────────────────
const path = require('path');
const fs   = require('fs');

// Attempt to load .env in development if present
const backendEnvPath = path.join(__dirname, '.env');
const rootEnvPath    = path.join(__dirname, '..', '.env');
if (fs.existsSync(backendEnvPath)) {
  require('dotenv').config({ path: backendEnvPath });
} else if (fs.existsSync(rootEnvPath)) {
  require('dotenv').config({ path: rootEnvPath });
} else {
  require('dotenv').config();
}

const express     = require('express');
const cors        = require('cors');
const { connect } = require('./db');

// ── Routers ───────────────────────────────────────────────────────────────────
const authRouter         = require('./routes/auth');
const reservationsRouter = require('./routes/reservations');
const roomsRouter        = require('./routes/rooms');
const billingRouter      = require('./routes/billing');
const inventoryRouter    = require('./routes/inventory');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── CORS Configuration ────────────────────────────────────────────────────────
const corsOriginEnv = process.env.CORS_ORIGIN;
const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
];

const allowedOrigins = corsOriginEnv
  ? corsOriginEnv.split(',').map((s) => s.trim())
  : defaultAllowedOrigins;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. server-side, curl, same-domain requests)
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // Automatically allow Vercel preview / production deployment URLs
      if (origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());

// ── Database Connection Middleware ────────────────────────────────────────────
// Ensures that every incoming request has an active, cached MongoDB Atlas connection.
app.use(async (req, res, next) => {
  try {
    await connect();
    next();
  } catch (err) {
    console.error('❌ Database connection error on request:', err.message);
    res.status(503).json({
      status: 'error',
      message: 'Database connection failed. Please verify MongoDB Atlas configuration.',
    });
  }
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use(['/api/auth', '/auth'],                 authRouter);
app.use(['/api/reservations', '/reservations'], reservationsRouter);
app.use(['/api/rooms', '/rooms'],               roomsRouter);
app.use(['/api/billing', '/billing'],           billingRouter);
app.use(['/api/inventory', '/inventory'],       inventoryRouter);

// ── Health / DB check ─────────────────────────────────────────────────────────
app.get(['/api', '/'], (_req, res) => {
  res.json({
    status: 'ok',
    name: 'Oracle Hospitality PMS API',
    endpoints: [
      '/api/auth',
      '/api/reservations',
      '/api/rooms',
      '/api/billing',
      '/api/inventory/breakdown',
      '/api/status',
      '/api/db-test',
    ],
  });
});

app.get(['/api/status', '/status'], (_req, res) => {
  res.json({ status: 'ok', message: 'Backend is running', db: 'MongoDB Atlas' });
});

app.get(['/api/db-test', '/db-test'], (_req, res) => {
  const { mongoose } = require('./db');
  const state = mongoose.connection.readyState;
  // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  if (state === 1) return res.json({ status: 'ok', message: 'MongoDB is connected' });
  return res.status(500).json({ status: 'error', message: `MongoDB connection state: ${state}` });
});

// ── Error Handling Middleware ─────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    status: 'error',
    message: err.message || 'Internal server error',
  });
});

// ── Bootstrap & Serverless Export ──────────────────────────────────────────────
// Run HTTP listener only when started directly via CLI (not when imported by Vercel serverless)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅  Server listening on http://localhost:${PORT}`);
  });
}

// Export Express app for Vercel Serverless Function entrypoint
module.exports = app;
