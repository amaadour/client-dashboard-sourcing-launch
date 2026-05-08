import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

// List of public routes that don't require authentication
const publicRoutes = ['/signin', '/signup', '/reset-password', '/verify-code', '/terms-of-use', '/privacy-policy'];

// Client accessible dashboard routes
const clientRoutes = [
  '/dashboard-home', 
  '/profile',
  '/quotation',
  '/order',
  '/payment',
  '/shipment-tracking',
  '/payment-example',
  '/checkoutpage',
  '/verify-code',
  '/pending-approval',
];

// Admin-only routes (redirect clients away from these)
const adminOnlyRoutes = [
  '/admin-dashboard',
  '/admin-users',
  '/admin-analytics',
  '/admin-settings'
];

// Routes that should be accessible without authentication (static assets, etc.)
const alwaysPublicPatterns = [
  /^\/api\//,
  /^\/_next\//,
  /^\/images\//,
  /^\/favicon\.ico$/,
];

export async function middleware(req: NextRequest) {
  console.log('Middleware executing for path:', req.nextUrl.pathname);
  
  // Check if the path should always be public
  const isAlwaysPublic = alwaysPublicPatterns.some(pattern => pattern.test(req.nextUrl.pathname));
  if (isAlwaysPublic) {
    console.log('Path is always public, allowing access:', req.nextUrl.pathname);
    return NextResponse.next();
  }
  
  // Initialize response
  const res = NextResponse.next();
  
  try {
    // Create Supabase client with the request
    const supabase = createMiddlewareClient({ req, res });
    
    // Get session data
    const {
      data: { session },
    } = await supabase.auth.getSession();

    console.log('Middleware session check:', session ? 'Session exists' : 'No session');
    
    // Get current path
    const path = req.nextUrl.pathname;
    
    // TEMPORARY: Allow direct access to client routes for development/testing
    if (clientRoutes.includes(path)) {
      console.log('Allowing direct access to client route:', path);
      return NextResponse.next();
    }
    
    // If the user is not logged in and trying to access a client dashboard route
    if (!session && clientRoutes.includes(path)) {
      console.log('Redirecting to /signup from:', path);
      const redirectUrl = new URL('/signup', req.url);
      return NextResponse.redirect(redirectUrl);
    }
    
    // If the user is not logged in and trying to access a protected route
    if (!session && !publicRoutes.includes(path)) {
      console.log('Redirecting to /signin from:', path);
      const redirectUrl = new URL('/signin', req.url);
      return NextResponse.redirect(redirectUrl);
    }
    
    // If user is logged in and trying to access auth pages
    if (session && publicRoutes.includes(path)) {
      // On /signin, if not approved, send to pending-approval instead
      if (path === '/signin') {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('approve')
          .eq('id', session.user.id)
          .single();

        if (!profileError && profile && profile.approve === false) {
          const redirectUrl = new URL('/pending-approval', req.url);
          return NextResponse.redirect(redirectUrl);
        }
      }

      console.log('Redirecting to /dashboard-home from:', path);
      const redirectUrl = new URL('/dashboard-home', req.url);
      return NextResponse.redirect(redirectUrl);
    }
    
    // If user is logged in, check roles for admin-only routes
    if (session && adminOnlyRoutes.some(route => path.startsWith(route))) {
      // Get user role
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
        
      if (userError) {
        console.error('Error fetching user role:', userError);
        // If there's an error, redirect to client dashboard for safety
        const redirectUrl = new URL('/dashboard-home', req.url);
        return NextResponse.redirect(redirectUrl);
      }
      
      if (userData && userData.role !== 'admin') {
        console.log('Non-admin user attempting to access admin route, redirecting to dashboard');
        const redirectUrl = new URL('/dashboard-home', req.url);
        return NextResponse.redirect(redirectUrl);
      }
    }
    
    console.log('Continuing to:', path);
    return res;
  } catch (error) {
    console.error('Middleware error:', error);
    
    // In case of error, allow access to public routes
    const path = req.nextUrl.pathname;
    if (publicRoutes.includes(path) || clientRoutes.includes(path)) {
      console.log('Error occurred, but path is public or client route, allowing access:', path);
      return NextResponse.next();
    }
    
    // For other routes, redirect to signin for safety
    console.log('Error occurred, redirecting to /signin from:', path);
    const redirectUrl = new URL('/signin', req.url);
    return NextResponse.redirect(redirectUrl);
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}; 