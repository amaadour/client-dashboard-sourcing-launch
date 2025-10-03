-- Script to fix storage RLS policies for payment_proofs bucket
-- This needs to be run in the Supabase SQL Editor

-- First, update the bucket to be public (optional, but helps with URL access)
UPDATE storage.buckets SET public = TRUE WHERE id = 'payment_proofs';

-- Create policy to allow all authenticated users to upload to the bucket
CREATE POLICY "Allow authenticated uploads to payment_proofs" 
ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'payment_proofs');

-- Create policy to allow users to read their own objects
CREATE POLICY "Allow users to read their own payment proofs" 
ON storage.objects
FOR SELECT 
TO authenticated
USING (bucket_id = 'payment_proofs' AND auth.uid() = owner);

-- Create policy to allow users to update their own objects
CREATE POLICY "Allow users to update their own payment proofs" 
ON storage.objects
FOR UPDATE 
TO authenticated
USING (bucket_id = 'payment_proofs' AND auth.uid() = owner)
WITH CHECK (bucket_id = 'payment_proofs');

-- Create policy to allow users to delete their own objects
CREATE POLICY "Allow users to delete their own payment proofs" 
ON storage.objects
FOR DELETE 
TO authenticated
USING (bucket_id = 'payment_proofs' AND auth.uid() = owner);

-- If needed, you can also add a policy to allow public read access
-- This is useful if you need the payment proofs to be viewable by anyone with the URL
CREATE POLICY "Allow public read access to payment_proofs" 
ON storage.objects
FOR SELECT 
TO public
USING (bucket_id = 'payment_proofs');

-- If the above policies don't resolve the issue, you might need a more permissive policy for testing purposes only:
-- WARNING: Only use this in development, not in production!
-- CREATE POLICY "Development - Allow all operations on payment_proofs" 
-- ON storage.objects
-- FOR ALL
-- TO authenticated
-- USING (bucket_id = 'payment_proofs')
-- WITH CHECK (bucket_id = 'payment_proofs'); 