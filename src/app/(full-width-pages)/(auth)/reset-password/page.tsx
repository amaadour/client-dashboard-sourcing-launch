"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ResetPassword() {
  const router = useRouter();

  useEffect(() => {
    // Store the token in localStorage if it exists in URL
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    
    if (hash) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const accessToken = hashParams.get("access_token");
      
      if (accessToken) {
        localStorage.setItem('passwordResetToken', accessToken);
      }
    } else if (token) {
      localStorage.setItem('passwordResetToken', token);
    }
    
    // Get the email from localStorage if available
    const email = localStorage.getItem('resetPasswordEmail');
    
    // Redirect to the verify-code page with email parameter if available
    const redirectUrl = email 
      ? `/verify-code?email=${encodeURIComponent(email)}`
      : "/verify-code";
    
    // Redirect after a short delay
    const timer = setTimeout(() => {
      router.push(redirectUrl);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [router]);
  
  // Just a loading indicator while redirecting
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
          </div>
        </div>
      </div>
    </div>
  );
} 