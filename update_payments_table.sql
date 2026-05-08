-- First, drop the existing table and dependencies
DROP TABLE IF EXISTS public.payments CASCADE;

-- Now recreate the payments table with the correct structure
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  -- User who made the payment
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Payment details
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'USD' NOT NULL,
  payment_method TEXT DEFAULT 'Bank Transfer' NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  transaction_id TEXT,
  reference_number TEXT,
  payment_proof_url TEXT,
  
  -- Additional payment info
  payer_name TEXT,
  payer_email TEXT,
  billing_address TEXT,
  payment_date TIMESTAMP WITH TIME ZONE,
  
  -- Metadata and notes
  payment_notes TEXT,
  metadata JSONB
);

-- Create index on user_id for faster lookups
CREATE INDEX idx_payments_user_id ON public.payments(user_id);

-- Create index on status for filtering
CREATE INDEX idx_payments_status ON public.payments(status);

-- Add constraint to ensure status is one of the allowed values
ALTER TABLE public.payments ADD CONSTRAINT payments_status_check 
  CHECK (status IN ('Pending', 'Accepted', 'Rejected', 'pending', 'processing', 'completed', 'failed'));

-- Add RLS policies for security
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own payments
CREATE POLICY "Users can view their own payments" 
  ON public.payments 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own payments
CREATE POLICY "Users can insert their own payments" 
  ON public.payments 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Policy: Admin role can view all payments
CREATE POLICY "Admin can view all payments" 
  ON public.payments 
  FOR SELECT 
  USING (auth.uid() IN (
    SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'
  ));

-- Policy: Admin role can modify all payments
CREATE POLICY "Admin can modify all payments" 
  ON public.payments 
  FOR ALL 
  USING (auth.uid() IN (
    SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'
  ));

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update the updated_at column
CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Comment on table and columns for documentation
COMMENT ON TABLE public.payments IS 'Stores payment information for quotations';
COMMENT ON COLUMN public.payments.id IS 'Unique identifier for the payment';
COMMENT ON COLUMN public.payments.user_id IS 'Reference to the user who made the payment';
COMMENT ON COLUMN public.payments.amount IS 'Amount of the payment';
COMMENT ON COLUMN public.payments.payment_method IS 'Method used for payment (e.g., WISE BANK, CIH BANK)';
COMMENT ON COLUMN public.payments.status IS 'Status of the payment (Pending, Accepted, Rejected, pending, processing, completed, failed)';
COMMENT ON COLUMN public.payments.reference_number IS 'Reference number for the payment transaction';
COMMENT ON COLUMN public.payments.payment_proof_url IS 'URL to the payment proof document or image';

-- Create indices for faster lookups
CREATE INDEX IF NOT EXISTS payments_user_id_idx ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON public.payments(status);
CREATE INDEX IF NOT EXISTS payments_created_at_idx ON public.payments(created_at);

-- Enable RLS on payments table
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

-- Make sure admins can bypass RLS
-- Note: You need to define who is an admin, this is just an example
-- CREATE POLICY admin_all_payments ON payments
--  USING (auth.uid() IN (SELECT id FROM admin_users)); 