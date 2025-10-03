"use client";

import Image from "next/image";

export default function PendingApproval() {
  return (
    <div className="min-h-screen grid place-items-center p-10 bg-gray-50 dark:bg-gray-950">
      <div className="max-w-md text-center flex flex-col items-center gap-2">
        <div className="bg-white dark:bg-white p-[15px] rounded-xl shadow-lg transition-all duration-300">
          <Image
            src="/images/logo/logo.png"
            alt="Logo"
            width={231}
            height={48}
            className="mx-auto h-auto w-auto"
            priority
          />
        </div>
        <h1 className="text-2xl font-semibold text-[#094eed]">Account pending approval</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Your account is awaiting admin approval. You’ll get access once approved.
        </p>
      </div>
    </div>
  );
}


