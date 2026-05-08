"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    
    // If authenticated, go to dashboard, otherwise to signin
    if (user) {
      console.log("User detected, redirecting to dashboard");
      router.push("/dashboard-home");
    } else {
      console.log("No user detected, redirecting to signin");
      router.push("/signin");
    }
  }, [user, loading, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 relative overflow-hidden">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 grid grid-cols-12 gap-2 p-2">
          {Array.from({ length: 12 * 12 }).map((_, i) => (
            <div 
              key={i} 
              className="border-[0.5px] border-blue-500/20 rounded-sm"
            ></div>
          ))}
        </div>
      </div>
      
      {/* Centered Card */}
      <div className="z-10 w-full max-w-md mx-auto">
        <div className="bg-white rounded-xl shadow-xl overflow-hidden p-8 text-center flex flex-col items-center">
          <div className="mb-6 h-32 w-32 relative">
            <div className="absolute inset-0 bg-white dark:bg-white rounded-full shadow-md flex items-center justify-center p-4">
              <Image 
                src="/images/logo/logo-icon.svg" 
                alt="Logo" 
                width={96}
                height={96}
                className="object-contain"
              />
            </div>
          </div>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">
            Admin Dashboard for Managing Client Orders Efficiently
          </h1>
          <p className="text-gray-600 mb-8">
            Please wait while we load your dashboard...
          </p>
          <Link href="/signin">
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors">
              {loading ? "Loading..." : "Continue to Dashboard"}
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
} 