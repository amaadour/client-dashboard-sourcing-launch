import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shipment Tracking | MES Dashboard",
  description: "Track your shipments in real-time with detailed information",
};

export default function ShipmentTrackingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 