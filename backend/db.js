// ── backend/db.js ─────────────────────────────────────────────────────────────
// Mongoose connection singleton.
// All models import this file to ensure connect() is called once.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI || MONGO_URI.includes('<USERNAME>')) {
  console.error('❌  MONGO_URI is not set in .env — please add your Atlas connection string.');
  process.exit(1);
}

mongoose.set('strictQuery', true);

const connect = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`✅  MongoDB connected → ${mongoose.connection.name}`);
  } catch (err) {
    console.error('❌  MongoDB connection failed:', err.message);
    process.exit(1);
  }
};

module.exports = { connect, mongoose };