'use client';

import { User, AuthError } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError } | undefined>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: AuthError } | undefined>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const getSession = async () => {
      try {
        setLoading(true);
        const { data: sessionData } = await supabase.auth.getSession();
        
        if (sessionData?.session?.user) {
          console.log("User session found:", sessionData.session.user.id);
          setUser(sessionData.session.user);
          
          // Save user profile data to localStorage for faster profile page loading
          const profileData = {
            first_name: sessionData.session.user.user_metadata?.first_name || "",
            last_name: sessionData.session.user.user_metadata?.last_name || "",
            email: sessionData.session.user.email || "",
            phone: sessionData.session.user.user_metadata?.phone || "",
            country: sessionData.session.user.user_metadata?.country || "",
            avatar_url: sessionData.session.user.user_metadata?.avatar_url || "",
            updated_at: new Date().toISOString()
          };
          
          if (typeof window !== 'undefined') {
            localStorage.setItem('profileData', JSON.stringify(profileData));
            console.log("User profile data saved to localStorage during session check");
          }
        } else {
          console.log("No active session found");
          setUser(null);
        }
      } catch (error) {
        console.error("Error getting session:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    // Initial session check
    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("Auth state changed:", event);
        if (event === 'SIGNED_IN' && session?.user) {
          console.log("User signed in:", session.user.id);
          setUser(session.user);
          
          // Save user profile data to localStorage when signed in
          const profileData = {
            first_name: session.user.user_metadata?.first_name || "",
            last_name: session.user.user_metadata?.last_name || "",
            email: session.user.email || "",
            phone: session.user.user_metadata?.phone || "",
            country: session.user.user_metadata?.country || "",
            avatar_url: session.user.user_metadata?.avatar_url || "",
            updated_at: new Date().toISOString()
          };
          
          if (typeof window !== 'undefined') {
            localStorage.setItem('profileData', JSON.stringify(profileData));
            console.log("User profile data saved to localStorage on auth state change");
          }
          
        } else if (event === 'SIGNED_OUT') {
          console.log("User signed out");
          setUser(null);
          
          // Clear profile data from localStorage on sign out
          if (typeof window !== 'undefined') {
            localStorage.removeItem('profileData');
            console.log("Profile data removed from localStorage on sign out");
          }
        } else if (event === 'PASSWORD_RECOVERY') {
          console.log("Password recovery event received");
          
          // Check if we have hash params in the URL for the OTP verification
          const hash = window.location.hash;
          if (hash) {
            const params = new URLSearchParams(hash.substring(1));
            const token = params.get("access_token");
            const email = session?.user?.email;
            
            if (token && email) {
              // Redirect to the verify-code page with token and email
              const verifyUrl = `/verify-code?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
              console.log("Redirecting to:", verifyUrl);
              window.location.href = verifyUrl;
            }
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const signIn = async (email: string, password: string) => {
    try {
      console.log("Signing in with email:", email);

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          console.error("Sign in error:", error.message, error);
          return { error };
        }

        // User successfully signed in
        console.log("User successfully signed in:", data);

        // Check if profile exists for this user
        if (data.user) {
          const { data: existingProfile, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', data.user.id)
            .single();
            
          if (profileError && profileError.code !== 'PGRST116') {
            console.error("Error checking existing profile:", profileError);
          }

          // If no profile exists, create one based on auth user data
          if (!existingProfile) {
            console.log("Creating profile for user:", data.user.id);
            const userData = data.user.user_metadata || {};
            
            // Also check if profile with this email already exists
            const { data: emailProfile, error: emailProfileError } = await supabase
              .from('profiles')
              .select('id')
              .eq('email', email)
              .single();
              
            if (emailProfileError && emailProfileError.code !== 'PGRST116') {
              console.error("Error checking email profile:", emailProfileError);
            }
              
            if (emailProfile) {
              console.log('Profile with this email already exists, updating user ID reference');
              // Update the existing profile with the correct user ID
              const { error: updateError } = await supabase
                .from('profiles')
                .update({ id: data.user.id })
                .eq('id', emailProfile.id);
                
              if (updateError) {
                console.error('Error updating profile ID reference:', updateError);
              } else {
                console.log('Successfully updated profile ID reference');
              }
            } else {
              // Create new profile
              const profileData = {
                id: data.user.id,
                first_name: userData.first_name || '',
                last_name: userData.last_name || '',
                full_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
                email: email,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              
              console.log('Creating new profile with data:', profileData);
              
              const { error: profileError, data: newProfileData } = await supabase
                .from('profiles')
                .insert([profileData])
                .select();
                
              if (profileError) {
                console.error('Error creating profile during sign in:', profileError);
              } else {
                console.log('Profile created during sign in for user:', data.user.id, newProfileData);
              }
            }
          } else {
            console.log('Profile already exists for user:', data.user.id);
          }
        }

        return undefined;
      } catch (innerError) {
        console.error("Exception during supabase.auth.signInWithPassword:", innerError);
        return { 
          error: { 
            message: `Authentication service error: ${innerError instanceof Error ? innerError.message : 'Unknown error'}`,
            name: "AuthServiceError" 
          } as AuthError 
        };
      }
    } catch (error) {
      console.error("Sign in exception:", error);
      return { error: error as AuthError };
    }
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      console.log("Starting signup process for:", email);
      
      // First, check if a profile with this email already exists
      const { data: existingProfile, error: profileCheckError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();
        
      if (profileCheckError && profileCheckError.code !== 'PGRST116') {
        // Real error (not "no rows returned" error)
        console.error("Error checking for existing profile:", profileCheckError);
      }
      
      if (existingProfile) {
        console.log("Profile already exists with this email. Cannot create duplicate account.");
        return { 
          error: { 
            message: "An account with this email already exists. Please sign in instead.",
            name: "EmailExistsError" 
          } as AuthError 
        };
      }
      
      // Proceed with auth user creation
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      });
      
      if (error) {
        console.error("Auth signup error:", error);
        return { error: error as AuthError };
      }
      
      // If user creation is successful and we have a user ID, create a profile record
      if (data?.user?.id) {
        const userId = data.user.id;
        console.log("Auth user created successfully, ID:", userId);
        console.log("Creating profile record in profiles table");
        
        try {
          // Insert into profiles table
          const profileData = { 
            id: userId,
            first_name: firstName,
            last_name: lastName,
            full_name: `${firstName} ${lastName}`.trim(),
            email: email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          console.log("Profile data to insert:", profileData);
          
          const { error: profileError, data: profileResult } = await supabase
            .from('profiles')
            .insert([profileData])
            .select();
          
          if (profileError) {
            console.error('Error creating profile:', profileError);
            // Don't attempt to recover from this error - we already checked for existing profile
            console.error('Profile error details:', JSON.stringify(profileError));
          } else {
            console.log('Profile created successfully for user:', userId);
            console.log('Profile data:', profileResult);
          }
        } catch (profileException) {
          console.error('Exception during profile creation:', profileException);
        }
      } else {
        console.warn("User data not available after signup");
      }
      
      return undefined;
    } catch (error) {
      console.error('Sign up error:', error);
      return { error: error as AuthError };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/signin');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 