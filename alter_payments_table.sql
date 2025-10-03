-- This script alters the existing payments table without dropping it
-- It's safer to use if you already have data in the table you want to keep

-- Check if payments table exists
DO $$
BEGIN
  -- First check if payment_status column exists and needs to be renamed to status
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payments' 
    AND column_name = 'payment_status'
  ) THEN
    -- Rename payment_status to status
    ALTER TABLE public.payments RENAME COLUMN payment_status TO status;
    RAISE NOTICE 'Renamed payment_status column to status';
  END IF;

  -- Add status column if it doesn't exist
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payments' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN status TEXT DEFAULT 'Pending' NOT NULL;
    RAISE NOTICE 'Added status column';
  END IF;

  -- Add currency column if it doesn't exist
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payments' 
    AND column_name = 'currency'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN currency TEXT DEFAULT 'USD' NOT NULL;
    RAISE NOTICE 'Added currency column';
  END IF;

  -- Add payment_date column if it doesn't exist
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payments' 
    AND column_name = 'payment_date'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN payment_date TIMESTAMP WITH TIME ZONE;
    RAISE NOTICE 'Added payment_date column';
  END IF;

  -- Add quotation_ids column if it doesn't exist
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payments' 
    AND column_name = 'quotation_ids'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN quotation_ids TEXT[] NOT NULL DEFAULT '{}';
    RAISE NOTICE 'Added quotation_ids column';
  END IF;

  -- Add reference_number column if it doesn't exist
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payments' 
    AND column_name = 'reference_number'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN reference_number TEXT;
    RAISE NOTICE 'Added reference_number column';
  END IF;

  -- Add payment_proof_url column if it doesn't exist
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payments' 
    AND column_name = 'payment_proof_url'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN payment_proof_url TEXT;
    RAISE NOTICE 'Added payment_proof_url column';
  END IF;

  -- Add constraint to ensure status is one of the allowed values
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payments_status_check'
  ) THEN
    ALTER TABLE public.payments ADD CONSTRAINT payments_status_check 
      CHECK (status IN ('Pending', 'Accepted', 'Rejected', 'pending', 'processing', 'completed', 'failed'));
    RAISE NOTICE 'Added status check constraint';
  END IF;

  -- Create the status index if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_payments_status'
  ) THEN
    CREATE INDEX idx_payments_status ON public.payments(status);
    RAISE NOTICE 'Created status index';
  END IF;

  -- Create the user_id index if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_payments_user_id'
  ) THEN
    CREATE INDEX idx_payments_user_id ON public.payments(user_id);
    RAISE NOTICE 'Created user_id index';
  END IF;

  -- Enable RLS if not already enabled - fix the check to use pg_class
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'payments' 
    AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    AND relrowsecurity = true
  ) THEN
    ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Enabled row level security';
  END IF;

  -- Add other optional columns if they don't exist
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payments' 
    AND column_name = 'payer_name'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN payer_name TEXT;
    RAISE NOTICE 'Added payer_name column';
  END IF;

  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payments' 
    AND column_name = 'payer_email'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN payer_email TEXT;
    RAISE NOTICE 'Added payer_email column';
  END IF;

  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payments' 
    AND column_name = 'payment_notes'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN payment_notes TEXT;
    RAISE NOTICE 'Added payment_notes column';
  END IF;

  -- Create RLS policies if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'payments' AND policyname = 'Users can view their own payments'
  ) THEN
    CREATE POLICY "Users can view their own payments" 
      ON public.payments 
      FOR SELECT 
      USING (auth.uid() = user_id);
    RAISE NOTICE 'Created policy for users to view their own payments';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'payments' AND policyname = 'Users can insert their own payments'
  ) THEN
    CREATE POLICY "Users can insert their own payments" 
      ON public.payments 
      FOR INSERT 
      WITH CHECK (auth.uid() = user_id);
    RAISE NOTICE 'Created policy for users to insert their own payments';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'payments' AND policyname = 'Admin can view all payments'
  ) THEN
    CREATE POLICY "Admin can view all payments" 
      ON public.payments 
      FOR SELECT 
      USING (auth.uid() IN (
        SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'
      ));
    RAISE NOTICE 'Created policy for admins to view all payments';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'payments' AND policyname = 'Admin can modify all payments'
  ) THEN
    CREATE POLICY "Admin can modify all payments" 
      ON public.payments 
      FOR ALL 
      USING (auth.uid() IN (
        SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'
      ));
    RAISE NOTICE 'Created policy for admins to modify all payments';
  END IF;

  -- Create trigger function if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'handle_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION public.handle_updated_at()
    RETURNS TRIGGER AS $BODY$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $BODY$ LANGUAGE plpgsql;
    RAISE NOTICE 'Created handle_updated_at function';
  END IF;

  -- Create trigger if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_payments_updated_at'
  ) THEN
    CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
    RAISE NOTICE 'Created update_payments_updated_at trigger';
  END IF;

  RAISE NOTICE 'Payment table update complete';
END$$;

-- Add or update comments on table and columns
COMMENT ON TABLE public.payments IS 'Stores payment information for quotations';
COMMENT ON COLUMN public.payments.id IS 'Unique identifier for the payment';
COMMENT ON COLUMN public.payments.user_id IS 'Reference to the user who made the payment';
COMMENT ON COLUMN public.payments.amount IS 'Amount of the payment';
COMMENT ON COLUMN public.payments.currency IS 'Currency of the payment (default: USD)';
COMMENT ON COLUMN public.payments.payment_method IS 'Method used for payment (e.g., WISE BANK, CIH BANK)';
COMMENT ON COLUMN public.payments.status IS 'Status of the payment (Pending, Accepted, Rejected)';
COMMENT ON COLUMN public.payments.quotation_ids IS 'Array of quotation IDs related to this payment';
COMMENT ON COLUMN public.payments.reference_number IS 'Reference number for the payment transaction';
COMMENT ON COLUMN public.payments.payment_proof_url IS 'URL to the payment proof document or image';
COMMENT ON COLUMN public.payments.payment_date IS 'Date and time when payment was made'; 