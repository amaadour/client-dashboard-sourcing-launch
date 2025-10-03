import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard Home",
  description: "Dashboard home page with metrics and quotation requests",
};

export default function DashboardHomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 