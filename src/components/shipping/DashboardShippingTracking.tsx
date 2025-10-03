"use client";

import React, { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import Badge from "../ui/badge/Badge";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

// Interface for quotation data
interface QuotationData {
  id: string;
  quotation_id: string;
  product_name: string;
  image_url: string;
  shipping_country: string;
  shipping_city: string;
  shipping_method: string;
}

// Interface for tracking data
interface ShipmentTrackingData {
  id: string;
  quotation_id: string;
  status: string;
  location: string | null;
  created_at: string;
  estimated_delivery: string | null;
  // Related quotation data
  quotation?: QuotationData | null;
}

const DashboardShippingTracking: React.FC = () => {
  const { user } = useAuth();
  const [shipmentData, setShipmentData] = useState<ShipmentTrackingData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchShipmentData = async () => {
      try {
        if (!user?.id) {
          setShipmentData([]);
          setIsLoading(false);
          return;
        }
        
        setIsLoading(true);
        setError(null);
        
        // Fetch only the current user's shipments, limited to 3
        const { data: userShipments, error: shippingError } = await supabase
          .from('shipping')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(3);
          
        if (shippingError) {
          console.error("Error accessing shipping table:", shippingError);
          setError("Failed to load shipping data");
          setIsLoading(false);
          return;
        }
        
        if (!userShipments || userShipments.length === 0) {
          setShipmentData([]);
          setIsLoading(false);
          return;
        }
        
        // Get all valid quotation IDs from the user's shipping records
        const quotationIds = userShipments
          .map(item => item.quotation_id)
          .filter(id => id != null); // Filter out null quotation_ids
        
        if (quotationIds.length === 0) {
          // If there are no valid quotation IDs, just return the shipping data without quotation details
          setShipmentData(userShipments.map(shipment => ({
            ...shipment,
            quotation: null
          })));
          setIsLoading(false);
          return;
        }
        
        // Fetch related quotation data
        const { data: quotationData, error: quotationError } = await supabase
          .from('quotations')
          .select('id, quotation_id, product_name, image_url, shipping_country, shipping_city, shipping_method')
          .in('id', quotationIds);
          
        if (quotationError) {
          console.error("Error fetching quotation data:", quotationError);
          // Don't fail completely, just continue without quotation data
          setShipmentData(userShipments.map(shipment => ({
            ...shipment,
            quotation: null
          })));
          setIsLoading(false);
          return;
        }
        
        // Create a map of quotations by ID for easier lookup
        const quotationsMap: Record<string, QuotationData> = {};
        if (quotationData) {
          quotationData.forEach(quotation => {
            quotationsMap[quotation.id] = quotation;
          });
        }
        
        // Join the shipping data with quotation data
        const combinedData = userShipments.map(shippingItem => ({
          ...shippingItem,
          quotation: shippingItem.quotation_id ? quotationsMap[shippingItem.quotation_id] || null : null
        }));
        
        setShipmentData(combinedData);
      } catch (err) {
        console.error("Exception in fetchShipmentData:", err);
        setError("An unexpected error occurred");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchShipmentData();
  }, [user?.id]);

  // Get status badge color
  const getStatusBadgeColor = (status: string): "primary" | "success" | "warning" | "info" | "error" => {
    switch (status?.toLowerCase() || '') {
      case "delivered":
        return "success";
      case "in transit":
        return "primary";
      case "processing":
      case "waiting":
        return "warning";
      case "delayed":
        return "error";
      default:
        return "info";
    }
  };

  // Format date string
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Render a message when there's no data, loading, or error
  const renderMessage = (message: string) => {
    return (
      <TableRow>
        <TableCell className="px-5 py-4 text-center text-gray-500 dark:text-gray-400">
          {message}
        </TableCell>
        <TableCell className="hidden">&nbsp;</TableCell>
        <TableCell className="hidden">&nbsp;</TableCell>
        <TableCell className="hidden">&nbsp;</TableCell>
        <TableCell className="hidden">&nbsp;</TableCell>
      </TableRow>
    );
  };

  return (
    <div className="max-w-full overflow-x-auto">
      <div className="min-w-full">
        <Table>
          {/* Table Header */}
          <TableHeader className="border-b border-gray-100 dark:border-gray-700">
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
                Product
              </TableCell>
              <TableCell
                isHeader
                className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Location
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
          <TableBody className="divide-y divide-gray-100 dark:divide-gray-700">
            {isLoading && renderMessage("Loading shipment tracking data...")}
            {!isLoading && error && renderMessage(error)}
            {!isLoading && !error && shipmentData.length === 0 && renderMessage("No shipment tracking data available")}

            {!isLoading && !error && shipmentData.map((item) => (
              <TableRow 
                key={item.id}
                className="transition-all duration-300 hover:bg-[#E3F2FD] dark:hover:bg-blue-900/20 hover:shadow-md cursor-pointer transform hover:translate-x-1 hover:scale-[1.01]"
              >
                <TableCell className="px-5 py-4 text-gray-700 text-start text-theme-sm dark:text-gray-300">
                  {item.quotation?.quotation_id || "N/A"}
                </TableCell>
                <TableCell className="px-5 py-4 text-gray-700 text-start text-theme-sm dark:text-gray-300">
                  {item.quotation?.product_name || "Unknown Product"}
                </TableCell>
                <TableCell className="px-5 py-4 text-gray-700 text-start text-theme-sm dark:text-gray-300">
                  <div className="flex flex-col">
                    <span className="font-medium text-[#ffb300] dark:text-amber-400">{item.location || "Unknown"}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Last updated: {formatDate(item.created_at)}</span>
                  </div>
                </TableCell>
                <TableCell className="px-5 py-4 text-gray-700 text-start text-theme-sm dark:text-gray-300">
                  <div className="flex flex-col">
                    <span className="font-medium text-[#43a047] dark:text-green-400">{item.quotation?.shipping_country || "Unknown"}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{item.quotation?.shipping_city || "Unknown"}</span>
                  </div>
                </TableCell>
                <TableCell className="px-5 py-4 text-start">
                  <Badge
                    size="sm"
                    color={getStatusBadgeColor(item.status)}
                  >
                    {item.status || "Unknown"}
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

export default DashboardShippingTracking; 