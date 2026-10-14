-- backend/migrations/001_add_timing_fields.sql

ALTER TABLE reservations
ADD COLUMN phone_number VARCHAR(50) NULL AFTER confirmation_number,
ADD COLUMN membership_tier ENUM('None', 'Silver', 'Gold', 'Platinum', 'Diamond') NOT NULL DEFAULT 'None' AFTER phone_number,
ADD COLUMN check_in_time DATETIME NULL AFTER status,
ADD COLUMN check_out_time DATETIME NULL AFTER check_in_time;
