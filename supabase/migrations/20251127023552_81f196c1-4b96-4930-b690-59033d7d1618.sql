-- Add blitz trip tracking columns to reps table
ALTER TABLE reps ADD COLUMN blitz_trip_name TEXT;
ALTER TABLE reps ADD COLUMN blitz_trip_date DATE;
ALTER TABLE reps ADD COLUMN blitz_trip_end_date DATE;
ALTER TABLE reps ADD COLUMN blitz_trip_location TEXT;