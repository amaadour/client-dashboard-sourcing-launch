-- PRODUCTION USE
-- This script re-enables Row Level Security (RLS) for the payments table
-- and creates appropriate policies for secure access

-- Re-enable RLS for the payments table
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can insert their own payments" ON public.payments;
DROP POLICY IF EXISTS "Admin can view all payments" ON public.payments;
DROP POLICY IF EXISTS "Admin can modify all payments" ON public.payments;
DROP POLICY IF EXISTS "Enable insert for development" ON public.payments;
DROP POLICY IF EXISTS "Service role can manage all payments" ON public.payments;

-- Create appropriate policies

-- 1. Allow users to view their own payments
CREATE POLICY "Users can view their own payments" 
  ON public.payments 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- 2. Allow users to insert their own payments
CREATE POLICY "Users can insert their own payments" 
  ON public.payments 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- 3. Allow admin role to view all payments
CREATE POLICY "Admin can view all payments" 
  ON public.payments 
  FOR SELECT 
  USING (auth.uid() IN (
    SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'
  ));

-- 4. Allow admin role to modify all payments
CREATE POLICY "Admin can modify all payments" 
  ON public.payments 
  FOR ALL 
  USING (auth.uid() IN (
    SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'
  ));

-- 5. Allow service role to manage all payments (for backend operations)
CREATE POLICY "Service role can manage all payments" 
  ON public.payments 
  FOR ALL 
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Restore the regular table comment
COMMENT ON TABLE public.payments IS 'Stores payment information for quotations.';

-- Confirm that RLS is enabled
SELECT 
  relname, 
  relrowsecurity 
FROM pg_class 
WHERE relname = 'payments' 
AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'); 