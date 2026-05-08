-- DEVELOPMENT USE ONLY
-- This script disables Row Level Security (RLS) completely for the payments table
-- WARNING: Only use in development, NEVER in production!

-- Disable RLS for the payments table
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;

-- Confirm that RLS is disabled
SELECT 
  relname, 
  relrowsecurity 
FROM pg_class 
WHERE relname = 'payments' 
AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Add a comment as a reminder
COMMENT ON TABLE public.payments IS 'Stores payment information for quotations. WARNING: RLS is currently DISABLED. Re-enable before deploying to production!'; 