-- inventory.sql - Schema for Room Availability & Occupancy

CREATE TABLE IF NOT EXISTS room_categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  total_rooms INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS room_inventory (
  date DATE NOT NULL,
  category_id INT UNSIGNED NOT NULL,
  booked_count INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (date, category_id),
  FOREIGN KEY (category_id) REFERENCES room_categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed categories
INSERT IGNORE INTO room_categories (name, total_rooms) VALUES 
('Standard', 50),
('Deluxe', 30),
('Penthouse', 5);
