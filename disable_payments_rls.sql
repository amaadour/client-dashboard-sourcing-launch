-- DEVELOPMENT USE ONLY
-- This script temporarily disables Row Level Security (RLS) on the payments table
-- WARNING: Do NOT use this in production!

-- Temporarily disable RLS for development testing
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;

-- Add a comment to remind us to re-enable this later
COMMENT ON TABLE public.payments IS 'Stores payment information for quotations. WARNING: RLS is currently DISABLED for development. Re-enable before production!';

-- To re-enable RLS before going to production, run:
-- ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY; 