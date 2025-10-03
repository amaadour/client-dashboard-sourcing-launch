"use client";

// Metadata is exported from a separate file since we can't use it with 'use client'
// The parent layout will handle metadata

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Return children directly without any header component
  return <div className="min-h-screen bg-gray-50 dark:bg-gray-900">{children}</div>;
} 