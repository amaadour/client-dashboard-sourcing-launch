"use client";

import React from "react";
import ShippingTrackingTable, { ShippingTrackingItem } from "./ShippingTrackingTable";

// Sample tracking data
const sampleTrackingData: ShippingTrackingItem[] = [
  {
    id: "ship-1",
    trackingNumber: "MES-00001",
    orderNumber: "MES-00001",
    origin: {
      country: "China",
      name: "Shenzhen"
    },
    current: {
      country: "Singapore",
      name: "Singapore Port"
    },
    destination: {
      country: "Morocco",
      name: "Casablanca"
    },
    status: "In Transit"
  },
  {
    id: "ship-2",
    trackingNumber: "MES-00002",
    orderNumber: "MES-00002",
    origin: {
      country: "China",
      name: "Shanghai"
    },
    current: {
      country: "Egypt",
      name: "Port Said"
    },
    destination: {
      country: "Morocco",
      name: "Casablanca"
    },
    status: "In Transit"
  },
  {
    id: "ship-3",
    trackingNumber: "MES-00003",
    orderNumber: "MES-00003",
    origin: {
      country: "China",
      name: "Guangzhou"
    },
    current: {
      country: "Morocco",
      name: "Casablanca"
    },
    destination: {
      country: "Morocco",
      name: "Casablanca"
    },
    status: "Delivered"
  }
];

const ShippingTracking: React.FC = () => {
  return (
    <ShippingTrackingTable trackingData={sampleTrackingData} />
  );
};

export default ShippingTracking; 