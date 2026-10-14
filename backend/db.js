// ── backend/db.js ─────────────────────────────────────────────────────────────
// Mongoose connection singleton with serverless connection caching (Vercel / AWS Lambda friendly)
// ─────────────────────────────────────────────────────────────────────────────
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// Attempt to load .env in development if present
const backendEnvPath = path.join(__dirname, '.env');
const rootEnvPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(backendEnvPath)) {
  require('dotenv').config({ path: backendEnvPath });
} else if (fs.existsSync(rootEnvPath)) {
  require('dotenv').config({ path: rootEnvPath });
} else {
  require('dotenv').config();
}

mongoose.set('strictQuery', true);

// Maintain a cached connection across serverless function invocations
let cached = global._mongoose;
if (!cached) {
  cached = global._mongoose = { conn: null, promise: null };
}

/**
 * Connects to MongoDB Atlas using connection pooling and caching.
 * Safe for both traditional long-running Node.js servers and Vercel serverless functions.
 */
const connect = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri || uri.includes('<USERNAME>') || uri.includes('<username>')) {
    const errorMsg = '❌ MONGO_URI is not properly set in environment variables.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // If already connected and connection is alive, return existing connection
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  // If a connection attempt is in progress, wait for it
  if (!cached.promise) {
    const options = {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
      dbName: 'hotel_db',
    };

    cached.promise = mongoose.connect(uri, options).then((mongooseInstance) => {
      console.log(`✅ MongoDB connected → ${mongooseInstance.connection.name}`);
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    console.error('❌ MongoDB connection failed:', err.message);
    throw err;
  }

  return cached.conn;
};

module.exports = { connect, mongoose };