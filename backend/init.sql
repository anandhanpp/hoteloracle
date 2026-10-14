-- ════════════════════════════════════════════════════════════════════════════
-- init.sql  –  Oracle Project · Hotel DB schema
-- Run this once in phpMyAdmin or via:
--   mysql -u root hotel_db < backend/init.sql
-- ════════════════════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS hotel_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE hotel_db;

-- ── rooms ─────────────────────────────────────────────────────────────────────
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
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- ── reservations ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reservations (
  id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  room_id             INT UNSIGNED    NULL,

  -- Core guest / room fields
  guest_name          VARCHAR(255)    NOT NULL,
  confirmation_number VARCHAR(100)    NOT NULL,
  phone_number        VARCHAR(50)     NULL,
  membership_tier     ENUM(
                        'None', 'Silver', 'Gold', 'Platinum', 'Diamond'
                      )               NOT NULL DEFAULT 'None',
  room_type           VARCHAR(100)    NOT NULL,
  arrival_date        DATE            NOT NULL,
  departure_date      DATE            NOT NULL,
  adults              TINYINT UNSIGNED NOT NULL DEFAULT 1,
  children            TINYINT UNSIGNED NOT NULL DEFAULT 0,
  status              ENUM(
                        'Confirmed',
                        'Checked In',
                        'Checked Out',
                        'Pending'
                      )               NOT NULL DEFAULT 'Confirmed',
  check_in_time       DATETIME        NULL,
  check_out_time      DATETIME        NULL,

  -- Financial / booking fields
  room_rate           DECIMAL(10, 2)  NOT NULL DEFAULT 0.00,
  payment_mode        ENUM(
                        'Cash',
                        'Credit Card',
                        'Debit Card',
                        'UPI',
                        'Bank Transfer',
                        'Bill to Room',
                        'Complimentary'
                      )               NOT NULL DEFAULT 'Credit Card',
  reservation_source  ENUM(
                        'Direct',
                        'OTA',
                        'Corporate',
                        'Walk-in',
                        'Travel Agent',
                        'Phone'
                      )               NOT NULL DEFAULT 'Direct',
  billing_option      ENUM(
                        'Guest Account',
                        'Company/Corporate',
                        'Pre-paid',
                        'Split Billing'
                      )               NOT NULL DEFAULT 'Guest Account',

  -- Timestamps
  created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                      ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_confirmation_number (confirmation_number),
  INDEX idx_arrival_date     (arrival_date),
  INDEX idx_status           (status),
  INDEX idx_reservations_room (room_id),
  CONSTRAINT fk_reservations_room
    FOREIGN KEY (room_id) REFERENCES rooms (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- ── charges ───────────────────────────────────────────────────────────────────
-- Represents individual posted charges on a guest folio, grouped into one of
-- up to 8 billing windows (folios). window_number defaults to 1 (Window 1).
CREATE TABLE IF NOT EXISTS charges (
  id               INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  reservation_id   INT UNSIGNED    NOT NULL,
  window_number    TINYINT UNSIGNED NOT NULL DEFAULT 1
                     COMMENT 'Folio window 1–8',
  transaction_code VARCHAR(50)     NOT NULL,
  description      VARCHAR(255)    NOT NULL DEFAULT '',
  price            DECIMAL(10, 2)  NOT NULL DEFAULT 0.00,
  quantity         INT UNSIGNED    NOT NULL DEFAULT 1,
  total            DECIMAL(10, 2)  NOT NULL DEFAULT 0.00
                     COMMENT 'Computed as price * quantity; stored for fast queries',
  supplement       VARCHAR(255)    NULL,
  reference        VARCHAR(255)    NULL,
  created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_charges_reservation (reservation_id),
  INDEX idx_charges_window      (reservation_id, window_number),
  CONSTRAINT fk_charges_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- ── payments ──────────────────────────────────────────────────────────────────
-- Represents payments applied against a guest folio window.
CREATE TABLE IF NOT EXISTS payments (
  id               INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  reservation_id   INT UNSIGNED    NOT NULL,
  window_number    TINYINT UNSIGNED NOT NULL DEFAULT 1
                     COMMENT 'Folio window 1–8',
  payment_method   VARCHAR(100)    NOT NULL DEFAULT 'Cash',
  amount           DECIMAL(10, 2)  NOT NULL DEFAULT 0.00,
  reference        VARCHAR(255)    NULL,
  supplement       VARCHAR(255)    NULL,
  card_holder      VARCHAR(255)    NULL,
  created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_payments_reservation (reservation_id),
  INDEX idx_payments_window      (reservation_id, window_number),
  CONSTRAINT fk_payments_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- ── seed rooms ────────────────────────────────────────────────────────────────
INSERT IGNORE INTO rooms (room_number, room_type, housekeeping_status, maintenance_status) VALUES
  -- Floor 1: Standard Single & Double
  ('101', 'Standard Single', 'Inspected', 'Active'),
  ('102', 'Standard Single', 'Clean',     'Active'),
  ('103', 'Standard Single', 'Dirty',     'Active'),
  ('104', 'Standard Single', 'Inspected', 'Active'),
  ('105', 'Standard Single', 'Clean',     'Active'),
  ('106', 'Standard Double', 'Inspected', 'Active'),
  ('107', 'Standard Double', 'Clean',     'Active'),
  ('108', 'Standard Double', 'Dirty',     'Active'),
  ('109', 'Standard Double', 'Inspected', 'Active'),
  ('110', 'Standard Double', 'Clean',     'Active'),
  ('111', 'Standard Double', 'Inspected', 'Active'),
  ('112', 'Standard Double', 'Dirty',     'OOO'),

  -- Floor 2: Deluxe King & Executive Queen
  ('201', 'Deluxe King',     'Clean',     'Active'),
  ('202', 'Deluxe King',     'Inspected', 'Active'),
  ('203', 'Deluxe King',     'Inspected', 'Active'),
  ('204', 'Deluxe King',     'Dirty',     'OOO'),
  ('205', 'Deluxe King',     'Inspected', 'Active'),
  ('206', 'Deluxe King',     'Clean',     'Active'),
  ('207', 'Deluxe King',     'Dirty',     'Active'),
  ('208', 'Deluxe King',     'Clean',     'OOS'),
  ('209', 'Deluxe King',     'Inspected', 'Active'),
  ('210', 'Deluxe King',     'Clean',     'Active'),
  ('211', 'Executive Queen', 'Inspected', 'Active'),
  ('212', 'Executive Queen', 'Clean',     'Active'),
  ('213', 'Executive Queen', 'Dirty',     'Active'),
  ('214', 'Executive Queen', 'Inspected', 'Active'),
  ('215', 'Executive Queen', 'Clean',     'Active'),
  ('216', 'Executive Queen', 'Inspected', 'Active'),
  ('217', 'Executive Queen', 'Clean',     'OOS'),
  ('218', 'Executive Queen', 'Dirty',     'Active'),

  -- Floor 3: Junior Suite
  ('301', 'Junior Suite',    'Inspected', 'Active'),
  ('302', 'Junior Suite',    'Clean',     'Active'),
  ('303', 'Junior Suite',    'Dirty',     'Active'),
  ('304', 'Junior Suite',    'Inspected', 'Active'),
  ('305', 'Junior Suite',    'Clean',     'Active'),
  ('306', 'Junior Suite',    'Dirty',     'OOO'),

  -- Floor 4: Ocean Suite
  ('401', 'Ocean Suite',     'Inspected', 'Active'),
  ('402', 'Ocean Suite',     'Clean',     'Active'),
  ('403', 'Ocean Suite',     'Dirty',     'Active'),
  ('404', 'Ocean Suite',     'Inspected', 'Active'),

  -- Floor 5: Penthouse Suite
  ('501', 'Penthouse Suite', 'Inspected', 'Active'),
  ('502', 'Penthouse Suite', 'Clean',     'Active');

-- ── room_types ────────────────────────────────────────────────────────────────
-- Lookup table for room categories with base pricing.
CREATE TABLE IF NOT EXISTS room_types (
  id         INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  type_code  VARCHAR(10)    NOT NULL COMMENT 'Short code e.g. STD_S, DLX_K',
  name       VARCHAR(100)   NOT NULL COMMENT 'Must match rooms.room_type exactly',
  base_price DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  PRIMARY KEY (id),
  UNIQUE KEY uq_type_code (type_code),
  UNIQUE KEY uq_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO room_types (type_code, name, base_price) VALUES
  ('STD_S', 'Standard Single',   2500.00),
  ('STD_D', 'Standard Double',   3500.00),
  ('DLX_K', 'Deluxe King',       5500.00),
  ('EXE_Q', 'Executive Queen',   4500.00),
  ('JNR_S', 'Junior Suite',      8000.00),
  ('OCN_S', 'Ocean Suite',      12000.00),
  ('PNT_S', 'Penthouse Suite',  20000.00);

-- ── Add room_type_id FK to rooms ──────────────────────────────────────────────
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS room_type_id INT UNSIGNED NULL AFTER room_number;
ALTER TABLE rooms ADD INDEX IF NOT EXISTS idx_rooms_type_id (room_type_id);
ALTER TABLE rooms ADD CONSTRAINT IF NOT EXISTS fk_rooms_room_type
  FOREIGN KEY (room_type_id) REFERENCES room_types(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- Populate room_type_id from the existing room_type varchar column
UPDATE rooms r JOIN room_types rt ON r.room_type = rt.name SET r.room_type_id = rt.id WHERE r.room_type_id IS NULL;

-- ── Additional rooms to reach exactly 50 total ────────────────────────────────
INSERT IGNORE INTO rooms (room_number, room_type, room_type_id, housekeeping_status, maintenance_status) VALUES
  ('306', 'Standard Single',  1, 'Inspected', 'Active'),
  ('307', 'Standard Single',  1, 'Clean',     'Active'),
  ('308', 'Standard Single',  1, 'Clean',     'Active'),
  ('309', 'Standard Double',  2, 'Inspected', 'Active'),
  ('310', 'Standard Double',  2, 'Clean',     'Active'),
  ('311', 'Standard Double',  2, 'Clean',     'Active'),
  ('219', 'Executive Queen',  4, 'Inspected', 'Active'),
  ('220', 'Executive Queen',  4, 'Clean',     'Active'),
  ('405', 'Ocean Suite',      6, 'Inspected', 'Active');


-- ── users ────────────────────────────────────────────────────────────────────
-- Stores hotel staff login credentials. Passwords are bcrypt-hashed.
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  username      VARCHAR(100)  NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  role          ENUM(
                  'Front Desk',
                  'Manager',
                  'Housekeeping',
                  'Billing',
                  'Admin'
                )             NOT NULL DEFAULT 'Front Desk',
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_username (username)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- ── seed default users ────────────────────────────────────────────────────────
-- password for all seed users: password123
-- Hash generated with: bcrypt.hash('password123', 10)
INSERT IGNORE INTO users (username, password_hash, role) VALUES
  ('admin',      '$2b$10$B/bTLBm9ICyGOs64a.JtJOfcmuA.lyd5Ba4I.pmZVe3MgTTey2CBi', 'Admin'),
  ('manager',    '$2b$10$B/bTLBm9ICyGOs64a.JtJOfcmuA.lyd5Ba4I.pmZVe3MgTTey2CBi', 'Manager'),
  ('frontdesk',  '$2b$10$B/bTLBm9ICyGOs64a.JtJOfcmuA.lyd5Ba4I.pmZVe3MgTTey2CBi', 'Front Desk');
