// ── backend/seed_atlas.js ───────────────────────────────────────────────────
// Seed initial data (Users, RoomTypes, Rooms, Reservations, Charges, Payments)
// into MongoDB Atlas.
// ─────────────────────────────────────────────────────────────────────────────
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const bcrypt = require('bcrypt');
const { connect, mongoose } = require('./db');
const { User, Charge, Payment } = require('./models/index');
const RoomType = require('./models/RoomType');
const Room = require('./models/Room');
const Reservation = require('./models/Reservation');

async function seed() {
  await connect();
  console.log('Seeding database...');

  // 1. Users
  const userCount = await User.countDocuments();
  if (userCount === 0) {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash('password123', saltRounds);
    await User.insertMany([
      { username: 'admin',     password_hash: passwordHash, role: 'Admin' },
      { username: 'manager',   password_hash: passwordHash, role: 'Manager' },
      { username: 'frontdesk', password_hash: passwordHash, role: 'Front Desk' },
    ]);
    console.log('✅ Seeded users (admin, manager, frontdesk / password123)');
  }

  // 2. Room Types
  const roomTypesData = [
    { type_code: 'STD_S', name: 'Standard Single',   base_price: 2500.00 },
    { type_code: 'STD_D', name: 'Standard Double',   base_price: 3500.00 },
    { type_code: 'DLX_K', name: 'Deluxe King',       base_price: 5500.00 },
    { type_code: 'EXE_Q', name: 'Executive Queen',   base_price: 4500.00 },
    { type_code: 'JNR_S', name: 'Junior Suite',      base_price: 8000.00 },
    { type_code: 'OCN_S', name: 'Ocean Suite',      base_price: 12000.00 },
    { type_code: 'PNT_S', name: 'Penthouse Suite',  base_price: 20000.00 },
  ];

  const typeMap = {};
  for (const rt of roomTypesData) {
    const doc = await RoomType.findOneAndUpdate(
      { type_code: rt.type_code },
      rt,
      { upsert: true, new: true }
    );
    typeMap[rt.name] = doc._id;
  }
  console.log('✅ Seeded room types');

  // 3. Rooms
  const roomCount = await Room.countDocuments();
  if (roomCount === 0) {
    const rawRooms = [
      // Floor 1
      { room_number: '101', room_type: 'Standard Single', housekeeping_status: 'Inspected', maintenance_status: 'Active' },
      { room_number: '102', room_type: 'Standard Single', housekeeping_status: 'Clean',     maintenance_status: 'Active' },
      { room_number: '103', room_type: 'Standard Single', housekeeping_status: 'Dirty',     maintenance_status: 'Active' },
      { room_number: '104', room_type: 'Standard Single', housekeeping_status: 'Inspected', maintenance_status: 'Active' },
      { room_number: '105', room_type: 'Standard Single', housekeeping_status: 'Clean',     maintenance_status: 'Active' },
      { room_number: '106', room_type: 'Standard Double', housekeeping_status: 'Inspected', maintenance_status: 'Active' },
      { room_number: '107', room_type: 'Standard Double', housekeeping_status: 'Clean',     maintenance_status: 'Active' },
      { room_number: '108', room_type: 'Standard Double', housekeeping_status: 'Dirty',     maintenance_status: 'Active' },
      { room_number: '109', room_type: 'Standard Double', housekeeping_status: 'Inspected', maintenance_status: 'Active' },
      { room_number: '110', room_type: 'Standard Double', housekeeping_status: 'Clean',     maintenance_status: 'Active' },
      { room_number: '111', room_type: 'Standard Double', housekeeping_status: 'Inspected', maintenance_status: 'Active' },
      { room_number: '112', room_type: 'Standard Double', housekeeping_status: 'Dirty',     maintenance_status: 'OOO' },

      // Floor 2
      { room_number: '201', room_type: 'Deluxe King',     housekeeping_status: 'Clean',     maintenance_status: 'Active' },
      { room_number: '202', room_type: 'Deluxe King',     housekeeping_status: 'Inspected', maintenance_status: 'Active' },
      { room_number: '203', room_type: 'Deluxe King',     housekeeping_status: 'Inspected', maintenance_status: 'Active' },
      { room_number: '204', room_type: 'Deluxe King',     housekeeping_status: 'Dirty',     maintenance_status: 'OOO' },
      { room_number: '205', room_type: 'Deluxe King',     housekeeping_status: 'Inspected', maintenance_status: 'Active' },
      { room_number: '206', room_type: 'Deluxe King',     housekeeping_status: 'Clean',     maintenance_status: 'Active' },
      { room_number: '207', room_type: 'Deluxe King',     housekeeping_status: 'Dirty',     maintenance_status: 'Active' },
      { room_number: '208', room_type: 'Deluxe King',     housekeeping_status: 'Clean',     maintenance_status: 'OOS' },
      { room_number: '209', room_type: 'Deluxe King',     housekeeping_status: 'Inspected', maintenance_status: 'Active' },
      { room_number: '210', room_type: 'Deluxe King',     housekeeping_status: 'Clean',     maintenance_status: 'Active' },
      { room_number: '211', room_type: 'Executive Queen', housekeeping_status: 'Inspected', maintenance_status: 'Active' },
      { room_number: '212', room_type: 'Executive Queen', housekeeping_status: 'Clean',     maintenance_status: 'Active' },
      { room_number: '213', room_type: 'Executive Queen', housekeeping_status: 'Dirty',     maintenance_status: 'Active' },
      { room_number: '214', room_type: 'Executive Queen', housekeeping_status: 'Inspected', maintenance_status: 'Active' },
      { room_number: '215', room_type: 'Executive Queen', housekeeping_status: 'Clean',     maintenance_status: 'Active' },
      { room_number: '216', room_type: 'Executive Queen', housekeeping_status: 'Inspected', maintenance_status: 'Active' },
      { room_number: '217', room_type: 'Executive Queen', housekeeping_status: 'Clean',     maintenance_status: 'OOS' },
      { room_number: '218', room_type: 'Executive Queen', housekeeping_status: 'Dirty',     maintenance_status: 'Active' },
      { room_number: '219', room_type: 'Executive Queen', housekeeping_status: 'Inspected', maintenance_status: 'Active' },
      { room_number: '220', room_type: 'Executive Queen', housekeeping_status: 'Clean',     maintenance_status: 'Active' },

      // Floor 3
      { room_number: '301', room_type: 'Junior Suite',    housekeeping_status: 'Inspected', maintenance_status: 'Active' },
      { room_number: '302', room_type: 'Junior Suite',    housekeeping_status: 'Clean',     maintenance_status: 'Active' },
      { room_number: '303', room_type: 'Junior Suite',    housekeeping_status: 'Dirty',     maintenance_status: 'Active' },
      { room_number: '304', room_type: 'Junior Suite',    housekeeping_status: 'Inspected', maintenance_status: 'Active' },
      { room_number: '305', room_type: 'Junior Suite',    housekeeping_status: 'Clean',     maintenance_status: 'Active' },
      { room_number: '306', room_type: 'Junior Suite',    housekeeping_status: 'Dirty',     maintenance_status: 'OOO' },
      { room_number: '307', room_type: 'Standard Single', housekeeping_status: 'Clean',     maintenance_status: 'Active' },
      { room_number: '308', room_type: 'Standard Single', housekeeping_status: 'Clean',     maintenance_status: 'Active' },
      { room_number: '309', room_type: 'Standard Double', housekeeping_status: 'Inspected', maintenance_status: 'Active' },
      { room_number: '310', room_type: 'Standard Double', housekeeping_status: 'Clean',     maintenance_status: 'Active' },
      { room_number: '311', room_type: 'Standard Double', housekeeping_status: 'Clean',     maintenance_status: 'Active' },

      // Floor 4
      { room_number: '401', room_type: 'Ocean Suite',     housekeeping_status: 'Inspected', maintenance_status: 'Active' },
      { room_number: '402', room_type: 'Ocean Suite',     housekeeping_status: 'Clean',     maintenance_status: 'Active' },
      { room_number: '403', room_type: 'Ocean Suite',     housekeeping_status: 'Dirty',     maintenance_status: 'Active' },
      { room_number: '404', room_type: 'Ocean Suite',     housekeeping_status: 'Inspected', maintenance_status: 'Active' },
      { room_number: '405', room_type: 'Ocean Suite',     housekeeping_status: 'Inspected', maintenance_status: 'Active' },

      // Floor 5
      { room_number: '501', room_type: 'Penthouse Suite', housekeeping_status: 'Inspected', maintenance_status: 'Active' },
      { room_number: '502', room_type: 'Penthouse Suite', housekeeping_status: 'Clean',     maintenance_status: 'Active' },
    ];

    const roomDocs = rawRooms.map(r => ({
      ...r,
      room_type_id: typeMap[r.room_type] || null,
    }));
    await Room.insertMany(roomDocs);
    console.log(`✅ Seeded ${roomDocs.length} rooms`);
  }

  // 4. Sample Reservations
  const resCount = await Reservation.countDocuments();
  if (resCount === 0) {
    const room201 = await Room.findOne({ room_number: '201' });
    const room106 = await Room.findOne({ room_number: '106' });
    const room301 = await Room.findOne({ room_number: '301' });

    const today = new Date();
    const yest = new Date(today); yest.setDate(today.getDate() - 1);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const in3Days = new Date(today); in3Days.setDate(today.getDate() + 3);
    const in5Days = new Date(today); in5Days.setDate(today.getDate() + 5);

    const createdRes = await Reservation.insertMany([
      {
        guest_name: 'John Doe',
        confirmation_number: 'CONF10001',
        phone_number: '555-0101',
        membership_tier: 'Gold',
        room_type: 'Deluxe King',
        room_id: room201?._id || null,
        arrival_date: yest,
        departure_date: in3Days,
        adults: 2,
        children: 0,
        status: 'Checked In',
        check_in_time: yest,
        room_rate: 5500.00,
        payment_mode: 'Credit Card',
        reservation_source: 'Direct',
        billing_option: 'Guest Account',
      },
      {
        guest_name: 'Jane Smith',
        confirmation_number: 'CONF10002',
        phone_number: '555-0102',
        membership_tier: 'Platinum',
        room_type: 'Junior Suite',
        room_id: room301?._id || null,
        arrival_date: today,
        departure_date: in5Days,
        adults: 2,
        children: 1,
        status: 'Checked In',
        check_in_time: today,
        room_rate: 8000.00,
        payment_mode: 'Credit Card',
        reservation_source: 'OTA',
        billing_option: 'Guest Account',
      },
      {
        guest_name: 'Robert Davis',
        confirmation_number: 'CONF10003',
        phone_number: '555-0103',
        membership_tier: 'Silver',
        room_type: 'Standard Double',
        room_id: room106?._id || null,
        arrival_date: today,
        departure_date: tomorrow,
        adults: 1,
        children: 0,
        status: 'Confirmed',
        room_rate: 3500.00,
        payment_mode: 'Debit Card',
        reservation_source: 'Corporate',
        billing_option: 'Company/Corporate',
      },
      {
        guest_name: 'Alice Cooper',
        confirmation_number: 'CONF10004',
        phone_number: '555-0104',
        membership_tier: 'Diamond',
        room_type: 'Ocean Suite',
        room_id: null,
        arrival_date: tomorrow,
        departure_date: in5Days,
        adults: 2,
        children: 0,
        status: 'Confirmed',
        room_rate: 12000.00,
        payment_mode: 'Credit Card',
        reservation_source: 'Direct',
        billing_option: 'Pre-paid',
      },
      {
        guest_name: 'Michael Brown',
        confirmation_number: 'CONF10005',
        phone_number: '555-0105',
        membership_tier: 'None',
        room_type: 'Standard Single',
        room_id: null,
        arrival_date: tomorrow,
        departure_date: in3Days,
        adults: 1,
        children: 0,
        status: 'Pending',
        room_rate: 2500.00,
        payment_mode: 'Cash',
        reservation_source: 'Walk-in',
        billing_option: 'Guest Account',
      },
    ]);
    console.log(`✅ Seeded ${createdRes.length} sample reservations`);

    // 5. Charges & Payments for John Doe
    const john = createdRes[0];
    await Charge.create([
      {
        reservation_id: john._id,
        window_number: 1,
        transaction_code: 'RM100',
        description: 'Room Charge - Deluxe King (Night 1)',
        price: 5500.00,
        quantity: 1,
        total: 5500.00,
      },
      {
        reservation_id: john._id,
        window_number: 1,
        transaction_code: 'FB200',
        description: 'Room Service Dinner',
        price: 1250.00,
        quantity: 1,
        total: 1250.00,
      },
    ]);

    await Payment.create([
      {
        reservation_id: john._id,
        window_number: 1,
        payment_method: 'Credit Card',
        amount: 5500.00,
        reference: 'AUTH-987654',
      },
    ]);
    console.log('✅ Seeded charges & payments for John Doe');
  }

  console.log('🎉 Seeding completed successfully!');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
