-- Script to fix payment update permissions
-- Run this script in the Supabase SQL Editor

-- First, refresh the schema cache
NOTIFY pgrst, 'reload schema';

-- Create policy to allow users to update their own payments
CREATE POLICY "update_own_payments" 
ON public.payments
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create a policy to allow users to update payments where user_id is null
-- This is helpful for development and testing purposes
CREATE POLICY "update_payments_with_null_user" 
ON public.payments
FOR UPDATE 
TO authenticated
USING (user_id IS NULL)
WITH CHECK (user_id IS NULL);

-- For development environments, you might want an even more permissive policy
-- WARNING: Only use this in development, not in production!
CREATE POLICY "dev_allow_all_payment_updates" 
ON public.payments
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);

-- List the policies to verify
SELECT * FROM pg_policies WHERE tablename = 'payments' AND cmd = 'UPDATE';

-- Show a confirmation message
DO $$
BEGIN
  RAISE NOTICE 'Payment update policies have been created successfully.';
END $$; 