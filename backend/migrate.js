const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hotel_db',
    multipleStatements: true
  });

  const sql = fs.readFileSync('inventory.sql', 'utf8');
  console.log('Running init.sql...');
  await connection.query(sql);
  console.log('Tables created and seeded!');
  await connection.end();
}

run().catch(console.error);
