# Storage Bucket RLS Policy Fix

## Problem
We've identified an issue with payment proof uploads failing with the error: `Upload failed: new row violates row-level security policy`.

This error occurs because the `payment_proofs` storage bucket lacks Row Level Security (RLS) policies that would allow authenticated users to upload files.

## Solution

### 1. Run the SQL script in Supabase SQL Editor

1. Open your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `fix_storage_policies.sql` into the editor
4. Run the script to apply the necessary policies

### 2. Verify the policies were applied

After running the script, you can verify the policies were applied by checking:

1. Go to Storage → Policies in your Supabase dashboard
2. Look for policies related to the `payment_proofs` bucket
3. You should see policies allowing authenticated users to upload, read, update, and delete files

### 3. Test the upload functionality

After applying these policies, test the payment proof upload functionality again. The error should be resolved.

## Potential Alternative Solutions

If the SQL script doesn't resolve the issue:

1. **Make sure users are authenticated:** This error can occur if attempting to upload without an authenticated session.

2. **Check if the bucket exists:** Ensure the `payment_proofs` bucket exists in your Supabase project.

3. **Temporary development solution:** If needed for development purposes only, uncomment and run the more permissive policy at the bottom of the SQL script.

4. **Check for bucket name mismatches:** Ensure the bucket name used in the code (`payment_proofs`) matches exactly with the bucket name in Supabase.

# Payment Records Update Policy Fix

## Problem
We've encountered a second issue with the error: `Failed to update payment record: No record was updated`.

This error occurs because there are no Row Level Security (RLS) policies that would allow authenticated users to update payment records in the database.

## Solution

### 1. Run the SQL script in Supabase SQL Editor

1. Open your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `fix_payment_update_policy.sql` into the editor
4. Run the script to apply the necessary policies

### 2. Verify the policies were applied

After running the script, you can verify the policies were applied by checking:

1. Run the following SQL query: `SELECT * FROM pg_policies WHERE tablename = 'payments' AND cmd = 'UPDATE';`
2. You should see policies allowing authenticated users to update their own payment records

### 3. Test the payment proof upload functionality

After applying these policies, test the payment proof upload functionality again. You should now be able to:
1. Upload a file to the storage bucket
2. Update the payment record with the proof URL

## Additional Troubleshooting

If you're still encountering issues:

1. **Check user authentication:** Ensure users are properly authenticated when uploading payment proofs.

2. **Verify payment record ownership:** Make sure the user trying to update a payment record is the owner of that record.

3. **Check payment record existence:** Verify that the payment ID being updated exists in the database.

4. **Inspect database logs:** Look for more specific error messages in the Supabase database logs. 