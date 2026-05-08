import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json();
    
    if (!token || !password) {
      return NextResponse.json(
        { error: 'Missing token or password' },
        { status: 400 }
      );
    }
    
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }
    
    try {
      // Using direct fetch to Supabase Admin API
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        return NextResponse.json(
          { error: 'Server configuration issue' },
          { status: 500 }
        );
      }
      
      // First verify the token directly
      const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey
        },
        body: JSON.stringify({ type: 'recovery', token, email: null })
      });
      
      if (!verifyResponse.ok) {
        const error = await verifyResponse.json();
        console.error('Token verification failed:', error);
        return NextResponse.json(
          { error: 'Token verification failed. Please request a new password reset link.' },
          { status: 401 }
        );
      }
      
      const verifyData = await verifyResponse.json();
      
      if (!verifyData || !verifyData.user || !verifyData.user.id) {
        console.error('No user found in verification response:', verifyData);
        return NextResponse.json(
          { error: 'Unable to identify user. Please request a new password reset link.' },
          { status: 400 }
        );
      }
      
      const userId = verifyData.user.id;
      
      // Now update the password
      const updateResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey
        },
        body: JSON.stringify({ password })
      });
      
      if (!updateResponse.ok) {
        const error = await updateResponse.json();
        console.error('Password update failed:', error);
        return NextResponse.json(
          { error: 'Failed to update password. Please try again.' },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { success: true, message: 'Password has been reset successfully!' },
        { status: 200 }
      );
    } catch (error) {
      console.error('Direct API operation error:', error);
      return NextResponse.json(
        { error: 'An error occurred while resetting your password. Please try again.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 