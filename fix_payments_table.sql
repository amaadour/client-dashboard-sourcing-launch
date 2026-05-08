-- Fix payments table script
-- This script modifies the payment table to support development mode testing

-- First, get table definition information
DO $$
DECLARE
  constraint_exists BOOLEAN;
BEGIN
  -- Check if the foreign key constraint exists
  SELECT EXISTS(
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'payments_user_id_fkey'
  ) INTO constraint_exists;

  -- Drop the foreign key constraint if it exists
  IF constraint_exists THEN
    RAISE NOTICE 'Dropping constraint payments_user_id_fkey';
    ALTER TABLE public.payments DROP CONSTRAINT payments_user_id_fkey;
  END IF;

  -- Make user_id nullable for development testing
  ALTER TABLE public.payments ALTER COLUMN user_id DROP NOT NULL;
  
  -- Re-create the foreign key constraint with ON NULL SET NULL
  ALTER TABLE public.payments
    ADD CONSTRAINT payments_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;
  
  -- Make sure we have all needed columns
  -- Check if method column exists
  IF NOT EXISTS(
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'method'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN method TEXT;
  END IF;

  -- Check if total_amount column exists
  IF NOT EXISTS(
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'total_amount'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN total_amount DECIMAL(12,2) DEFAULT 0 NOT NULL;
  END IF;

  -- Check if status column exists
  IF NOT EXISTS(
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN status TEXT DEFAULT 'pending';
  END IF;

  -- Check if proof_url column exists
  IF NOT EXISTS(
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'proof_url'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN proof_url TEXT;
  END IF;
END $$;

-- Fix RLS policies to allow inserts without a user_id in development
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;

-- Make sure policies don't conflict
DROP POLICY IF EXISTS "allow_all_inserts" ON public.payments;
DROP POLICY IF EXISTS "select_own_payments" ON public.payments;
DROP POLICY IF EXISTS "insert_own_payments" ON public.payments;

-- Re-enable RLS with simpler policies
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Policy for selecting - users can only see their own payments
CREATE POLICY select_own_payments ON public.payments
  FOR SELECT USING (
    auth.uid() = user_id OR user_id IS NULL
  );

-- More permissive insert policy for development
CREATE POLICY allow_all_inserts ON public.payments
  FOR INSERT WITH CHECK (true);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'Payments table fixed for development use.' as result; 