const pool = require('./db');
const fs = require('fs');

async function migrate() {
  try {
    console.log('Running rooms migration...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT,
        room_number         VARCHAR(20)     NOT NULL,
        room_type           VARCHAR(100)    NOT NULL,
        housekeeping_status ENUM('Clean', 'Dirty', 'Inspected') NOT NULL DEFAULT 'Clean',
        maintenance_status  ENUM('Active', 'OOO', 'OOS')        NOT NULL DEFAULT 'Active',
        created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                            ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_room_number (room_number),
        INDEX idx_rooms_status (housekeeping_status, maintenance_status),
        INDEX idx_rooms_type   (room_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Rooms table created / verified.');

    const [cols] = await pool.query("SHOW COLUMNS FROM reservations LIKE 'room_id'");
    if (cols.length === 0) {
      await pool.query(`
        ALTER TABLE reservations
        ADD COLUMN room_id INT UNSIGNED NULL,
        ADD CONSTRAINT fk_reservations_room
          FOREIGN KEY (room_id) REFERENCES rooms (id)
          ON DELETE SET NULL ON UPDATE CASCADE
      `);
      console.log('✅ Added room_id foreign key column to reservations.');
    } else {
      console.log('ℹ️  room_id already exists in reservations.');
    }

    const sql = fs.readFileSync(__dirname + '/init.sql', 'utf8');
    const seedIndex = sql.indexOf('INSERT IGNORE INTO rooms');
    if (seedIndex !== -1) {
      const seedPart = sql.substring(seedIndex).trim();
      await pool.query(seedPart);
      console.log('✅ Seeded physical rooms.');
    }

    // Link checked-in reservation to room 201
    const [resInHouse] = await pool.query("SELECT id, room_id FROM reservations WHERE status = 'Checked In' LIMIT 1");
    if (resInHouse.length > 0 && !resInHouse[0].room_id) {
      const [r201] = await pool.query("SELECT id FROM rooms WHERE room_number = '201'");
      if (r201.length > 0) {
        await pool.query("UPDATE reservations SET room_id = ? WHERE id = ?", [r201[0].id, resInHouse[0].id]);
        console.log(`✅ Assigned Room 201 to checked-in reservation ID ${resInHouse[0].id}.`);
      }
    }

    const [roomCount] = await pool.query("SELECT COUNT(*) AS c FROM rooms");
    console.log(`✅ Total rooms in database: ${roomCount[0].c}`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
