-- Script to fix payments table and RLS policies
-- Run this script in Supabase SQL Editor when encountering schema cache or RLS issues

-- First, refresh the schema cache by forcing a schema reload
NOTIFY pgrst, 'reload schema';

-- Make sure the payments table exists with the correct structure
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  -- User who made the payment
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Payment details
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'USD' NOT NULL,
  payment_method TEXT DEFAULT 'Bank Transfer' NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL,
  reference_number TEXT,
  payment_proof_url TEXT,
  
  -- Additional payment info
  payer_name TEXT,
  payer_email TEXT,
  payment_notes TEXT,
  payment_date TIMESTAMP WITH TIME ZONE
);

-- If the amount column doesn't exist, add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payments' 
    AND column_name = 'amount'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN amount DECIMAL(12,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Fix the RLS policies
-- First, disable RLS to start fresh
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "select_own_payments" ON public.payments;
DROP POLICY IF EXISTS "insert_own_payments" ON public.payments;
DROP POLICY IF EXISTS "update_own_payments" ON public.payments;
DROP POLICY IF EXISTS "delete_own_payments" ON public.payments;
DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can insert their own payments" ON public.payments;
DROP POLICY IF EXISTS "Admin can view all payments" ON public.payments;
DROP POLICY IF EXISTS "Admin can modify all payments" ON public.payments;

-- Create indices for faster lookups (if they don't exist)
CREATE INDEX IF NOT EXISTS payments_user_id_idx ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON public.payments(status);
CREATE INDEX IF NOT EXISTS payments_created_at_idx ON public.payments(created_at);

-- Re-enable RLS and create policies
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Policy for selecting - users can only see their own payments
CREATE POLICY select_own_payments ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

-- Policy for inserting - users can only insert their own payments
CREATE POLICY insert_own_payments ON public.payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy for updating - users can only update their own payments
CREATE POLICY update_own_payments ON public.payments
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy for deleting - users can only delete their own payments
CREATE POLICY delete_own_payments ON public.payments
  FOR DELETE USING (auth.uid() = user_id);

-- Admin policies
CREATE POLICY admin_all_payments ON public.payments
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Create or fix the junction table if needed
CREATE TABLE IF NOT EXISTS public.payment_quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(payment_id, quotation_id)
);

-- Fix RLS for the junction table
ALTER TABLE public.payment_quotations DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_payment_quotations" ON public.payment_quotations;
DROP POLICY IF EXISTS "insert_own_payment_quotations" ON public.payment_quotations;
DROP POLICY IF EXISTS "update_own_payment_quotations" ON public.payment_quotations;
DROP POLICY IF EXISTS "delete_own_payment_quotations" ON public.payment_quotations;

-- Re-enable RLS and create policies for junction table
ALTER TABLE public.payment_quotations ENABLE ROW LEVEL SECURITY;

-- Policy for selecting - users can only see their own records
CREATE POLICY select_own_payment_quotations ON public.payment_quotations
  FOR SELECT USING (auth.uid() = user_id);

-- Policy for inserting - users can only insert records where they are the owner
CREATE POLICY insert_own_payment_quotations ON public.payment_quotations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy for updating - users can only update their own records
CREATE POLICY update_own_payment_quotations ON public.payment_quotations
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy for deleting - users can only delete their own records
CREATE POLICY delete_own_payment_quotations ON public.payment_quotations
  FOR DELETE USING (auth.uid() = user_id);

-- Admin policy for junction table
CREATE POLICY admin_all_payment_quotations ON public.payment_quotations
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Reload the schema cache again to make sure changes are picked up
NOTIFY pgrst, 'reload schema';

SELECT 'Fix applied successfully. Schema and RLS policies have been updated.' as result; 