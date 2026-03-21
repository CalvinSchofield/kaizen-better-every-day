-- Add 'manager' and 'senior_manager' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager' AFTER 'assistant_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'senior_manager' AFTER 'manager';