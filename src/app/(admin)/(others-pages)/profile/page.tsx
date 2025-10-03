"use client";

import React, { Suspense, useEffect } from "react";
import dynamic from 'next/dynamic';
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

// Import components dynamically with SSR disabled
const UserInfoCard = dynamic(() => import("@/components/user-profile/UserInfoCard"), {
  ssr: false,
});



// Loading fallback component
const LoadingCard = () => (
  <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
    <div className="h-20 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg"></div>
  </div>
);

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/signin");
    }
  }, [user, loading, router]);
  // Render profile content or loading indicator
  if (loading || !user) return null;
  return (
    <div>
      <div className="rounded-2xl bg-white dark:bg-gray-900">
        <h3 className="mb-3 text-xl font-semibold text-gray-900 dark:text-white md:text-2xl">
          My Profile
        </h3>
      </div>

      <div className="space-y-6">

    
        <Suspense fallback={<LoadingCard />}>
          <UserInfoCard />
        </Suspense>
      </div>
    </div>
  );
}
