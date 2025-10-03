"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import Badge from "../ui/badge/Badge";

export interface ShippingTrackingItem {
  id: string;
  trackingNumber: string;
  orderNumber: string;
  origin: {
    country: string;
    name: string;
  };
  current: {
    country: string;
    name: string;
  };
  destination: {
    country: string;
    name: string;
  };
  status: 'In Transit' | 'Delivered' | 'Processing' | 'Delayed';
}

interface ShippingTrackingTableProps {
  trackingData: ShippingTrackingItem[];
}

const ShippingTrackingTable: React.FC<ShippingTrackingTableProps> = ({ 
  trackingData 
}) => {
  return (
    <div className="max-w-full overflow-x-auto">
      <div className="min-w-full">
        <Table>
          {/* Table Header */}
          <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
            <TableRow>
              <TableCell
                isHeader
                className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Tracking #
              </TableCell>
              <TableCell
                isHeader
                className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Order #
              </TableCell>
              <TableCell
                isHeader
                className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Origin
              </TableCell>
              <TableCell
                isHeader
                className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Current
              </TableCell>
              <TableCell
                isHeader
                className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Destination
              </TableCell>
              <TableCell
                isHeader
                className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Status
              </TableCell>
            </TableRow>
          </TableHeader>

          {/* Table Body */}
          <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
            {trackingData.map((item) => (
              <TableRow 
                key={item.id}
                className="transition-all duration-300 hover:bg-[#E3F2FD] hover:shadow-md cursor-pointer transform hover:translate-x-1 hover:scale-[1.01]"
              >
                <TableCell className="px-5 py-4 text-gray-700 text-start text-theme-sm dark:text-white/90">
                  {item.trackingNumber}
                </TableCell>
                <TableCell className="px-5 py-4 text-gray-700 text-start text-theme-sm dark:text-white/90">
                  {item.orderNumber}
                </TableCell>
                <TableCell className="px-5 py-4 text-gray-700 text-start text-theme-sm dark:text-white/90">
                  <div className="flex flex-col">
                    <span className="font-medium text-[#0D47A1]">{item.origin.country}</span>
                    <span className="text-xs text-gray-500">{item.origin.name}</span>
                  </div>
                </TableCell>
                <TableCell className="px-5 py-4 text-gray-700 text-start text-theme-sm dark:text-white/90">
                  <div className="flex flex-col">
                    <span className="font-medium text-[#ffb300]">{item.current.country}</span>
                    <span className="text-xs text-gray-500">{item.current.name}</span>
                  </div>
                </TableCell>
                <TableCell className="px-5 py-4 text-gray-700 text-start text-theme-sm dark:text-white/90">
                  <div className="flex flex-col">
                    <span className="font-medium text-[#43a047]">{item.destination.country}</span>
                    <span className="text-xs text-gray-500">{item.destination.name}</span>
                  </div>
                </TableCell>
                <TableCell className="px-5 py-4 text-start">
                  <Badge
                    size="sm"
                    color={
                      item.status === "Delivered"
                        ? "success"
                        : item.status === "In Transit"
                        ? "primary"
                        : item.status === "Processing"
                        ? "warning"
                        : "error"
                    }
                  >
                    {item.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ShippingTrackingTable; 