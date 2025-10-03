-- Create the payment_quotations table if it doesn't exist
CREATE TABLE IF NOT EXISTS payment_quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(payment_id, quotation_id)
);

-- Add comment to the table
COMMENT ON TABLE payment_quotations IS 'Junction table to link payments with quotations';

-- Create indices for faster lookups
CREATE INDEX IF NOT EXISTS payment_quotations_payment_id_idx ON payment_quotations(payment_id);
CREATE INDEX IF NOT EXISTS payment_quotations_quotation_id_idx ON payment_quotations(quotation_id);
CREATE INDEX IF NOT EXISTS payment_quotations_user_id_idx ON payment_quotations(user_id);

-- Create RLS policies for payment_quotations
ALTER TABLE payment_quotations ENABLE ROW LEVEL SECURITY;

-- Policy for selecting - users can only see their own records
CREATE POLICY select_own_payment_quotations ON payment_quotations
  FOR SELECT USING (auth.uid() = user_id);

-- Policy for inserting - users can only insert records where they are the owner
CREATE POLICY insert_own_payment_quotations ON payment_quotations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy for updating - users can only update their own records
CREATE POLICY update_own_payment_quotations ON payment_quotations
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy for deleting - users can only delete their own records
CREATE POLICY delete_own_payment_quotations ON payment_quotations
  FOR DELETE USING (auth.uid() = user_id);

-- Optional trigger for auto-creating shipping records when payment is approved
-- Uncomment and modify as needed for your schema

/*
CREATE OR REPLACE FUNCTION create_shipping_on_payment_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- If payment status was changed to 'Approved'
  IF NEW.status = 'Approved' AND (OLD.status IS NULL OR OLD.status != 'Approved') THEN
    -- For each related quotation, create a shipping record
    INSERT INTO shippings (
      user_id,
      quotation_id,
      payment_id,
      status,
      tracking_number,
      shipping_date
    )
    SELECT 
      pq.user_id,
      pq.quotation_id,
      pq.payment_id,
      'processing',
      'TRK-' || LEFT(md5(random()::text), 8),
      now()
    FROM 
      payment_quotations pq
    WHERE 
      pq.payment_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create or replace the trigger
DROP TRIGGER IF EXISTS payment_approval_trigger ON payments;
CREATE TRIGGER payment_approval_trigger
  AFTER UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION create_shipping_on_payment_approval();
*/ 