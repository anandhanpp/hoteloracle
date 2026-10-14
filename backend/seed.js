require('dotenv').config();
const pool = require('./db');

const seedData = [
  {
    guest_name: 'John Doe',
    confirmation_number: 'CONF12345',
    phone_number: '555-0101',
    membership_tier: 'Gold',
    room_type: 'Deluxe King',
    arrival_date: '2023-10-01',
    departure_date: '2023-10-05',
    adults: 2,
    children: 0,
    status: 'Checked Out',
    room_rate: 150.00,
    payment_mode: 'Credit Card',
    reservation_source: 'Direct',
    billing_option: 'Guest Account'
  }
];

async function runSeed() {
  try {
    for (const res of seedData) {
      await pool.query(`
        INSERT INTO reservations (guest_name, confirmation_number, phone_number, membership_tier, room_type, arrival_date, departure_date, adults, children, status, room_rate, payment_mode, reservation_source, billing_option)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [res.guest_name, res.confirmation_number, res.phone_number, res.membership_tier, res.room_type, res.arrival_date, res.departure_date, res.adults, res.children, res.status, res.room_rate, res.payment_mode, res.reservation_source, res.billing_option]);
    }
    console.log('Database seeded successfully.');
  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    process.exit();
  }
}

runSeed();
