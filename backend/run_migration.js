require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function runMigration() {
  try {
    console.log('Running migration...');
    const sql = fs.readFileSync(path.join(__dirname, 'migrations', '001_add_timing_fields.sql'), 'utf-8');
    
    // We cannot execute multiple statements in one go unless multipleStatements is true in the connection pool.
    // However, our script only has one ALTER TABLE statement.
    await pool.query(sql);
    console.log('Migration applied successfully!');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Migration already applied (fields exist).');
    } else {
      console.error('Migration failed:', err.message);
    }
  } finally {
    process.exit();
  }
}

runMigration();
