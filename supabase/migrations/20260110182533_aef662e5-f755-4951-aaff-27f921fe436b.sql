-- Add 'anyone_who' as a valid target_type for incentives
-- This type allows multiple participants to qualify by reaching the target

-- First, let's check the current constraint and update it if needed
-- Since target_type is stored as TEXT, we just need to support the new value in the application

-- No schema changes needed since target_type is already TEXT and can store any value