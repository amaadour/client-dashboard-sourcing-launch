"use client";

import React, { useState, useEffect, Suspense } from "react";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import EyeIcon from "@/icons/EyeIcon";
import EyeCloseIcon from "@/icons/EyeCloseIcon";

function VerifyCodeContent() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get email from URL query or localStorage
  useEffect(() => {
    const emailFromUrl = searchParams?.get("email");
    const storedEmail = typeof window !== 'undefined' ? localStorage.getItem('resetPasswordEmail') : null;
    
    if (emailFromUrl) {
      setEmail(emailFromUrl);
      if (typeof window !== 'undefined') {
        localStorage.setItem('resetPasswordEmail', emailFromUrl);
      }
    } else if (storedEmail) {
      setEmail(storedEmail);
    }
  }, [searchParams]);

  // Handle countdown for resend code
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    
    if (!email) {
      setError("Email is required");
      return;
    }
    
    if (!token) {
      setError("Verification code is required");
      return;
    }
    
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Verify the OTP token first
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'recovery'
      });
      
      if (verifyError) {
        setError(verifyError.message || "Invalid or expired code. Please try again.");
        return;
      }
      
      // If verification successful, update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password
      });
      
      if (updateError) {
        setError(updateError.message || "Failed to update password. Please try again.");
        return;
      }
      
      // Success path
      setSuccess(true);
      setToken("");
      setPassword("");
      setConfirmPassword("");
      
      // Clear stored email
      if (typeof window !== 'undefined') {
        localStorage.removeItem('resetPasswordEmail');
      }
      
      // Redirect to sign in page after 3 seconds
      setTimeout(() => {
        router.push("/signin");
      }, 3000);
      
    } catch (err) {
      console.error("Error during verification or password reset:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResendError("");
    setResendSuccess(false);
    
    if (!email) {
      setResendError("Email is required to resend code");
      return;
    }
    
    setResendLoading(true);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/verify-code',
      });
      
      if (error) {
        setResendError(error.message || "Failed to resend code. Please try again.");
        return;
      }
      
      setResendSuccess(true);
      setCountdown(60); // Start countdown for 60 seconds
      
    } catch (err) {
      console.error("Error resending code:", err);
      setResendError("An unexpected error occurred. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full">
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Reset Password
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter the verification code sent to your email and create a new password
            </p>
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-400">
              {error}
            </div>
          )}
          
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg dark:bg-green-900/20 dark:border-green-900/30 dark:text-green-400">
              Password has been reset successfully! Redirecting to sign in page...
            </div>
          )}
          
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg dark:bg-blue-900/20 dark:border-blue-900/30 dark:text-blue-400">
            <p>Please check your email for a <strong>6-digit verification code</strong> that was sent to you. You&apos;ll need this code to reset your password.</p>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              <div>
                <Label>
                  Email Address <span className="text-error-500">*</span>{" "}
                </Label>
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div>
                <Label>
                  Verification Code <span className="text-error-500">*</span>{" "}
                </Label>
                <Input
                  type="text"
                  placeholder="Enter 6-digit verification code"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                />
              </div>
              
              <div>
                <Label>
                  New Password <span className="text-error-500">*</span>{" "}
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
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
              
              <div>
                <Label>
                  Confirm Password <span className="text-error-500">*</span>{" "}
                </Label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <span
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                  >
                    {showConfirmPassword ? (
                      <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
                    ) : (
                      <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
                    )}
                  </span>
                </div>
              </div>
              
              <div>
                <Button 
                  className="w-full" 
                  size="sm"
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading ? "Processing..." : "Reset Password"}
                </Button>
              </div>
              
              <div className="text-center">
                {resendError && (
                  <p className="text-xs text-error-600 mb-2 dark:text-error-400">{resendError}</p>
                )}
                
                {resendSuccess && (
                  <p className="text-xs text-success-600 mb-2 dark:text-success-400">
                    Verification code sent successfully!
                  </p>
                )}
                
                {countdown > 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Resend code in {countdown}s
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resendLoading}
                    className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
                  >
                    {resendLoading ? "Sending..." : "Didn&apos;t receive a code? Send code"}
                  </button>
                )}
                
                <div className="mt-2">
                  <Link
                    href="/signin"
                    className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
                  >
                    Back to Sign In
                  </Link>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function LoadingVerifyCode() {
  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full">
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="space-y-6">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyCode() {
  return (
    <Suspense fallback={<LoadingVerifyCode />}>
      <VerifyCodeContent />
    </Suspense>
  );
} 