const pool = require('./db');

/**
 * Ensures that inventory records exist for a given date range.
 * If a record doesn't exist, it defaults to 0 booked.
 */
async function initializeInventory(connection, startDate, endDate, categoryId) {
  // A robust approach would be to loop through dates and insert ignore
  const dates = [];
  let current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current < end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  for (const date of dates) {
    await connection.execute(
      `INSERT IGNORE INTO room_inventory (date, category_id, booked_count) VALUES (?, ?, 0)`,
      [date, categoryId]
    );
  }
  return dates;
}

/**
 * Checks if a specific room category has availability for all dates in the range.
 */
async function checkAvailability(categoryId, startDate, endDate, requiredRooms = 1) {
  const [category] = await pool.execute('SELECT total_rooms FROM room_categories WHERE id = ?', [categoryId]);
  if (!category.length) throw new Error('Invalid category ID');
  const totalRooms = category[0].total_rooms;

  const [inventory] = await pool.execute(
    `SELECT date, booked_count FROM room_inventory 
     WHERE category_id = ? AND date >= ? AND date < ?`,
    [categoryId, startDate, endDate]
  );

  for (const record of inventory) {
    if (totalRooms - record.booked_count < requiredRooms) {
      return false; // Not enough availability on this date
    }
  }
  return true;
}

/**
 * Books a room, reducing availability for the specific category on selected dates.
 */
async function bookRoom(categoryId, startDate, endDate, requiredRooms = 1) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Initialize missing inventory dates
    const dates = await initializeInventory(connection, startDate, endDate, categoryId);

    // 2. Lock inventory rows for update to prevent race conditions
    const [inventory] = await connection.execute(
      `SELECT date, booked_count FROM room_inventory 
       WHERE category_id = ? AND date >= ? AND date < ? FOR UPDATE`,
      [categoryId, startDate, endDate]
    );

    // 3. Verify category total
    const [category] = await connection.execute('SELECT total_rooms FROM room_categories WHERE id = ?', [categoryId]);
    const totalRooms = category[0].total_rooms;

    for (const record of inventory) {
      if (totalRooms - record.booked_count < requiredRooms) {
        throw new Error(`Not enough rooms available on ${record.date}`);
      }
    }

    // 4. Update the booked count
    await connection.execute(
      `UPDATE room_inventory SET booked_count = booked_count + ? 
       WHERE category_id = ? AND date >= ? AND date < ?`,
      [requiredRooms, categoryId, startDate, endDate]
    );

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Calculates overall hotel occupancy for a specific date.
 */
async function getOverallOccupancy(date) {
  const [totalResult] = await pool.execute('SELECT SUM(total_rooms) as hotel_total FROM room_categories');
  const hotelTotal = parseInt(totalResult[0].hotel_total) || 0;

  if (hotelTotal === 0) return 0;

  const [bookedResult] = await pool.execute(
    'SELECT SUM(booked_count) as total_booked FROM room_inventory WHERE date = ?',
    [date]
  );
  
  const totalBooked = parseInt(bookedResult[0].total_booked) || 0;
  return {
    date,
    totalBooked,
    hotelTotal,
    occupancyPercentage: ((totalBooked / hotelTotal) * 100).toFixed(2) + '%'
  };
}

module.exports = {
  checkAvailability,
  bookRoom,
  getOverallOccupancy
};
