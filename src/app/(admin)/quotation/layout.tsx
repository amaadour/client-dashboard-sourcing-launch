import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quotation Management | MES Dashboard",
  description: "Manage and track quotations",
};

export default function QuotationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 