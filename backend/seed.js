// ── backend/seed.js ──────────────────────────────────────────────────────────
// Standalone database seeder for MongoDB Atlas
// ─────────────────────────────────────────────────────────────────────────────
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Require User model (supports both ./models/User and ./models/index)
let User;
try {
  User = require('./models/User');
} catch {
  User = require('./models/index').User;
}

const MONGO_URI = process.env.MONGO_URI;

async function seedDatabase() {
  if (!MONGO_URI) {
    console.error('❌ Error: MONGO_URI is missing in your .env file.');
    process.exit(1);
  }

  try {
    console.log('🔄 Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGO_URI);
    console.log(`✅ Connected successfully to: ${mongoose.connection.name}`);

    // 1. Clear existing users
    console.log('🧹 Clearing existing users...');
    const deleteResult = await User.deleteMany({});
    console.log(`🗑️  Removed ${deleteResult.deletedCount} existing user(s).`);

    // 2. Hash the admin password using bcrypt
    const plainPassword = 'password123';
    const saltRounds = 10;
    console.log('🔐 Hashing default admin password...');
    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

    // 3. Create default admin user
    // Note: Schema uses password_hash for authentication verification
    const adminUser = new User({
      username: 'admin',
      password_hash: hashedPassword,
      role: 'Admin'
    });

    await adminUser.save();
    console.log('✨ Default admin user created successfully:');
    console.log(`   - Username: admin`);
    console.log(`   - Password: password123`);
    console.log(`   - Role:     Admin`);
    console.log(`   - ID:       ${adminUser._id}`);

  } catch (error) {
    console.error('❌ An error occurred during database seeding:', error.message || error);
    process.exitCode = 1;
  } finally {
    // 4. Properly disconnect from MongoDB
    try {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from MongoDB Atlas.');
    } catch (disconnectError) {
      console.error('⚠️  Failed to disconnect cleanly:', disconnectError.message);
    }
  }
}

// Run the seed function
seedDatabase();
