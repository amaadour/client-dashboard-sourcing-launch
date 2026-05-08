"use client";
import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import EyeIcon from "@/icons/EyeIcon";
import EyeCloseIcon from "@/icons/EyeCloseIcon";
import Link from "next/link";
import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { createClient } from '@supabase/supabase-js';

export default function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  
  const { signIn } = useAuth();

  const handleGoogleSignIn = async (e: React.MouseEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard-home`
        }
      });
      
      if (error) {
        console.error("Google sign-in error:", error);
        setError(error.message || "Failed to sign in with Google");
      }
    } catch (err) {
      console.error("Google sign-in exception:", err);
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    console.log("Sign-in attempt with email:", email);

    if (!email || !password) {
      setError("Please fill in all fields");
      setIsLoading(false);
      return;
    }

    try {
      console.log("Calling signIn function");
      // Log if we have Supabase configured properly
      console.log("Supabase environment check:", {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL ? "Set" : "Not set",
        key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "Set" : "Not set",
      });
      
      const result = await signIn(email, password);
      console.log("Sign-in result:", result);
      
      if (result?.error) {
        console.error("Sign-in error details:", result.error);
        let errorMessage = "Invalid email or password";
        
        // Provide more specific error messages when possible
        if (result.error.message) {
          if (result.error.message.includes("Invalid login")) {
            errorMessage = "The email or password you entered is incorrect";
          } else {
            errorMessage = result.error.message;
          }
        }
        
        setError(errorMessage);
      } else {
        console.log("Sign-in successful, redirecting");
        
        // Force a hard redirect directly to the dashboard
        window.location.href = "/dashboard-home";
      }
    } catch (err: unknown) {
      console.error("Sign-in exception:", err);
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred during sign in";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Attempt to create a direct client as a fallback
  const createDirectClient = () => {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (supabaseUrl && supabaseAnonKey) {
        console.log("Creating direct Supabase client");
        return createClient(supabaseUrl, supabaseAnonKey);
      }
    } catch (err) {
      console.error("Error creating direct Supabase client:", err);
    }
    return null;
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResetSuccess(false);
    setIsLoading(true);

    if (!resetEmail) {
      setError("Please enter your email address");
      setIsLoading(false);
      return;
    }

    try {
      // Check if we've recently sent an email to this address (throttling)
      const lastResetTime = localStorage.getItem(`pwreset_${resetEmail}`);
      const cooldownPeriod = 2 * 60 * 1000; // 2 minutes in milliseconds
      
      if (lastResetTime) {
        const timeElapsed = Date.now() - parseInt(lastResetTime);
        // If less than cooldown period has passed, don't allow another request
        if (timeElapsed < cooldownPeriod) {
          const waitTime = Math.ceil((cooldownPeriod - timeElapsed)/1000);
          setError(`Please wait ${waitTime} seconds before requesting another reset email.`);
          setIsLoading(false);
          return;
        }
      }

      // Start with an assumption of no error
      let resetError = null;
      
      try {
        // First try with the default Supabase client
        console.log("Attempting password reset with default client");
        const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
          redirectTo: `${window.location.origin}/verify-code`,
        });
        resetError = error;
      } catch (err) {
        console.error("Error with primary Supabase client:", err);
        resetError = err instanceof Error ? err : new Error("Unknown error");
      }
      
      // If we got a rate limit error, try with a direct client
      if (resetError && resetError.message && resetError.message.includes("rate limit")) {
        console.log("Rate limit hit, attempting with direct client");
        const directClient = createDirectClient();
        
        if (directClient) {
          try {
            const { error } = await directClient.auth.resetPasswordForEmail(resetEmail, {
              redirectTo: `${window.location.origin}/verify-code`,
            });
            
            // Update the error status based on the second attempt
            resetError = error;
          } catch (err) {
            console.error("Error with direct Supabase client:", err);
            // Keep original error if the fallback also fails
          }
        }
      }
      
      if (resetError) {
        console.error("Password reset error:", resetError);
        
        // Specific handling for rate limit errors
        if (resetError.message && resetError.message.includes("rate limit")) {
          setError("You've requested too many password resets. Please try again in a few minutes or contact support if you need immediate assistance.");
        } else {
          setError(resetError.message || "Failed to send reset instructions");
        }
      } else {
        // Store the timestamp of this successful reset request
        localStorage.setItem(`pwreset_${resetEmail}`, Date.now().toString());
        
        setResetSuccess(true);
        setError("");

        // Wait 2 seconds and then redirect to verify-code page
        setTimeout(() => {
          window.location.href = `/verify-code?email=${encodeURIComponent(resetEmail)}`;
        }, 2000);
      }
    } catch (err) {
      console.error("Password reset exception:", err);
      setError("An unexpected error occurred. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsForgotPassword(!isForgotPassword);
    setError("");
    setResetSuccess(false);
    // Pre-fill the reset email if user already typed in login email
    if (!isForgotPassword && email) {
      setResetEmail(email);
    }
  };

  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full pt-6 pb-6 sm:pt-8 sm:pb-8">
      <div className="w-full max-w-md sm:pt-10 mx-auto mb-5">

      </div>
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              {isForgotPassword ? "Reset Password" : "Sign In"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isForgotPassword 
                ? "Enter your email to receive password reset instructions" 
                : "Enter your email and password to sign in!"}
            </p>
          </div>
          <div>
            {!isForgotPassword && (
              <div className="mb-3">
                <button 
                  onClick={handleGoogleSignIn}
                  className="w-full flex items-center justify-center gap-3 py-3 text-sm font-medium text-gray-700 transition-colors bg-white border border-gray-300 rounded-lg px-4 hover:bg-gray-50 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10 dark:border-gray-700 shadow-sm">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M18.7511 10.1944C18.7511 9.47495 18.6915 8.94995 18.5626 8.40552H10.1797V11.6527H15.1003C15.0011 12.4597 14.4654 13.675 13.2749 14.4916L13.2582 14.6003L15.9087 16.6126L16.0924 16.6305C17.7788 15.1041 18.7511 12.8583 18.7511 10.1944Z"
                      fill="#4285F4"
                    />
                    <path
                      d="M10.1788 18.75C12.5895 18.75 14.6133 17.9722 16.0915 16.6305L13.274 14.4916C12.5201 15.0068 11.5081 15.3666 10.1788 15.3666C7.81773 15.3666 5.81379 13.8402 5.09944 11.7305L4.99473 11.7392L2.23868 13.8295L2.20264 13.9277C3.67087 16.786 6.68674 18.75 10.1788 18.75Z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.10014 11.7305C4.91165 11.186 4.80257 10.6027 4.80257 9.99992C4.80257 9.3971 4.91165 8.81379 5.09022 8.26935L5.08523 8.1534L2.29464 6.02954L2.20333 6.0721C1.5982 7.25823 1.25098 8.5902 1.25098 9.99992C1.25098 11.4096 1.5982 12.7415 2.20333 13.9277L5.10014 11.7305Z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M10.1789 4.63331C11.8554 4.63331 12.9864 5.34303 13.6312 5.93612L16.1511 3.525C14.6035 2.11528 12.5895 1.25 10.1789 1.25C6.68676 1.25 3.67088 3.21387 2.20264 6.07218L5.08953 8.26943C5.81381 6.15972 7.81776 4.63331 10.1789 4.63331Z"
                      fill="#EB4335"
                    />
                  </svg>
                  Sign in with Google
                </button>
              </div>
            )}
            
            {!isForgotPassword && (
              <div className="mt-6 mb-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 py-2 text-gray-400 bg-white dark:bg-gray-900">
                      Or
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-400">
                {error}
              </div>
            )}
            
            {resetSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg dark:bg-green-900/20 dark:border-green-900/30 dark:text-green-400">
                Password reset instructions have been sent to your email.
              </div>
            )}
            
            {isForgotPassword ? (
              <form onSubmit={handlePasswordReset}>
                <div className="space-y-6">
                  <div>
                    <Label>
                      Email <span className="text-error-500">*</span>{" "}
                    </Label>
                    <Input 
                      placeholder="Enter your email address" 
                      type="email" 
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Button 
                      className="w-full" 
                      size="sm"
                      type="submit"
                      disabled={isLoading}
                    >
                      {isLoading ? "Sending..." : "Send Reset Instructions"}
                    </Button>
                  </div>
                  <div className="text-center">
                    <button
                      onClick={toggleForgotPassword}
                      className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
                    >
                      Back to Sign In
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="space-y-6">
                  <div>
                    <Label>
                      Email <span className="text-error-500">*</span>{" "}
                    </Label>
                    <Input 
                      placeholder="info@gmail.com" 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label>
                      Password <span className="text-error-500">*</span>{" "}
                    </Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <span
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                      >
                        {showPassword ? (
                          <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
                        ) : (
                          <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox checked={isChecked} onChange={setIsChecked} />
                      <span className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400">
                        Keep me logged in
                      </span>
                    </div>
                    <button
                      onClick={toggleForgotPassword}
                      className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="mt-6">
                    <Button 
                      className="w-full" 
                      size="sm"
                      type="submit"
                      disabled={isLoading}
                    >
                      {isLoading ? "Signing in..." : "Sign in"}
                    </Button>
                  </div>
                </div>
              </form>
            )}

            <div className="mt-8 mb-4">
              <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-start">
                Don&apos;t have an account? {" "}
                <Link
                  href="/signup"
                  className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
                >
                  Sign Up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
