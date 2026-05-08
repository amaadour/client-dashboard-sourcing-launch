"use client";

import React, { useState, useEffect } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import Image from "next/image";
import { Modal } from "@/components/ui/modal";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

// Product fallback image
const defaultProductImage = "/images/product/product-01.jpg";
const imagePlaceholder = "/images/placeholder.jpg";

// Define the shipment tracking data type
interface ShipmentTrackingData {
  id: string;
  quotation_id: string;
  status: string;
  location: string | null;
  videos_urls: string[] | null;
  images_urls: string[] | null;
  delivered_at: string | null;
  estimated_delivery: string | null;
  created_at: string;
  user_id: string | null;
  label?: string | null;
  // Related quotation data
  quotation?: QuotationData | null;
  receiver_name?: string;
  receiver_phone?: string;
  receiver_address?: string;
}

// Define quotation data interface
interface QuotationData {
  id: string;
  quotation_id: string;
  product_name: string;
  image_url: string;
  shipping_country: string;
  shipping_city: string;
  shipping_method: string;
  client_label?: string | null;
}

// Full quotation details interface
interface FullQuotationDetails {
  id: string;
  quotation_id: string;
  product_name: string;
  quantity: number;
  status: string;
  created_at: string;
  updated_at?: string;
  image_url?: string;
  shipping_country: string;
  shipping_city: string;
  shipping_method: string;
  service_type?: string;
  product_url?: string;
  selected_option?: number;
  receiver_name?: string;
  receiver_phone?: string;
  receiver_address?: string;
  Quotation_fees?: number;
  title_option1?: string;
  total_price_option1?: number;
  unit_price_option1?: number;
  delivery_time_option1?: string;
  description_option1?: string;
  price_description_option1?: string;
  unit_weight_option1?: number;
  title_option2?: string;
  total_price_option2?: number;
  unit_price_option2?: number;
  delivery_time_option2?: string;
  description_option2?: string;
  price_description_option2?: string;
  unit_weight_option2?: number;
  title_option3?: string;
  total_price_option3?: number;
  unit_price_option3?: number;
  delivery_time_option3?: string;
  description_option3?: string;
  price_description_option3?: string;
  unit_weight_option3?: number;
  [key: string]: unknown; // For dynamic fields like image_option1, etc.
}

// Receiver information interface
interface ReceiverInfo {
  receiver_name: string;
  receiver_phone: string;
  receiver_address: string;
}

export default function ShipmentTrackingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/signup");
    }
  }, [user, loading, router]);
  const [shipmentData, setShipmentData] = useState<ShipmentTrackingData[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<ShipmentTrackingData | null>(null);
  const [filteredShipmentData, setFilteredShipmentData] = useState<ShipmentTrackingData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Add this loading state for the page
  const [isLoading, setIsLoading] = useState(true);
  
  // Receiver info modal states
  const [showReceiverModal, setShowReceiverModal] = useState(false);
  const [receiverInfo, setReceiverInfo] = useState<ReceiverInfo>({
    receiver_name: '',
    receiver_phone: '',
    receiver_address: ''
  });
  const [savedReceivers, setSavedReceivers] = useState<(ReceiverInfo & { id: string })[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [useExistingReceiver, setUseExistingReceiver] = useState(false);
  const [selectedReceiverId, setSelectedReceiverId] = useState<string | null>(null);
  const [saveForLater, setSaveForLater] = useState(false);

  // Image modal states
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState("");

  // Label modal states
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [labelText, setLabelText] = useState("");
  const [isSavingLabel, setIsSavingLabel] = useState(false);

  // Full quotation details state
  const [fullQuotationDetails, setFullQuotationDetails] = useState<FullQuotationDetails | null>(null);
  const [loadingQuotationDetails, setLoadingQuotationDetails] = useState(false);

  // Fetch shipment data from Supabase - get user's shipments
  useEffect(() => {
    const fetchShipmentData = async () => {
      try {
        if (!user?.id) {
          // If no user is logged in, return empty data
          setShipmentData([]);
          setFilteredShipmentData([]);
          return;
        }
        
        setIsLoading(true);
        setError(null);
        
        // Fetch only the current user's shipments, newest first
        const { data: userShipments, error: shippingError } = await supabase
          .from('shipping')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
          
        if (shippingError) {
          console.error("Error accessing shipping table:", shippingError);
          setError("Failed to load shipping data: " + shippingError.message);
          setIsLoading(false);
          return;
        }
        
        if (!userShipments || userShipments.length === 0) {
          // No shipments found for this user
          setShipmentData([]);
          setFilteredShipmentData([]);
          setIsLoading(false);
          return;
        }
        
        // Get all quotation IDs from the user's shipping records, filtering out null/undefined values
        const quotationIds = userShipments
          .map(item => item.quotation_id)
          .filter((id): id is string => id !== null && id !== undefined);
        
        // If there are no valid quotation IDs, we can skip fetching quotations
        if (quotationIds.length === 0) {
          // Map shipping items without quotation data
          const combinedData = userShipments.map(shippingItem => ({
            ...shippingItem,
            quotation: null
          }));
          setShipmentData(combinedData);
          setFilteredShipmentData(combinedData);
          setIsLoading(false);
          return;
        }
        
        // Fetch related quotation data using only valid IDs
        const { data: quotationData, error: quotationError } = await supabase
          .from('quotations')
          .select('id, quotation_id, product_name, image_url, shipping_country, shipping_city, shipping_method, client_label')
          .in('id', quotationIds);
          
        if (quotationError) {
          console.error("Error fetching quotation data:", quotationError);
          setError("Failed to load quotation details");
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
          quotation: quotationsMap[shippingItem.quotation_id] || null
        }));
        
        setShipmentData(combinedData);
        setFilteredShipmentData(combinedData);
      } catch (err) {
        console.error("Exception in fetchShipmentData:", err);
        setError("An unexpected error occurred");
      } finally {
        setIsLoading(false);
      }
    };
    
    const fetchSavedReceivers = async () => {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('shipping_receivers')
          .select('*')
          .eq('user_id', user.id);
          
        if (error) {
          console.error("Error fetching saved receivers:", error);
          return;
        }
        
        if (data && data.length > 0) {
          setSavedReceivers(data);
        }
      } catch (err) {
        console.error("Exception fetching saved receivers:", err);
      }
    };
    
    fetchShipmentData();
    fetchSavedReceivers();
  }, [user?.id]);

  // Effect to check URL parameters for quotation ID
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const quotationId = params.get('quotationId');
      
      if (quotationId && shipmentData.length > 0) {
        const shipment = shipmentData.find(s => s.quotation?.id === quotationId);
        if (shipment) {
          setSelectedShipment(shipment);
          setShowDetailsModal(true);
        }
      }
    }
  }, [shipmentData]);

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

  // Handle search
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);
    
    if (query.trim() === "") {
      setFilteredShipmentData(shipmentData);
    } else {
      const filtered = shipmentData.filter(
        shipment => 
          shipment.quotation?.quotation_id?.toLowerCase().includes(query) ||
          shipment.quotation?.product_name?.toLowerCase().includes(query)
      );
      setFilteredShipmentData(filtered);
    }
  };

  // View shipment details
  const viewShipmentDetails = async (shipment: ShipmentTrackingData) => {
    setSelectedShipment(shipment);
    setLabelText(shipment.quotation?.client_label || shipment.label || "");
    setShowDetailsModal(true);
    setFullQuotationDetails(null);
    
    // Fetch full quotation details from Supabase
    if (shipment.quotation_id) {
      setLoadingQuotationDetails(true);
      try {
        const { data: quotationData, error } = await supabase
          .from('quotations')
          .select('*')
          .eq('id', shipment.quotation_id)
          .single();
        
        if (error) {
          console.error("Error fetching quotation details:", error);
        } else if (quotationData) {
          setFullQuotationDetails(quotationData);
        }
      } catch (error) {
        console.error("Error fetching quotation details:", error);
      } finally {
        setLoadingQuotationDetails(false);
      }
    }
  };

  // Open label modal — prefer quotation.client_label as source of truth
  const openLabelModal = (shipment?: ShipmentTrackingData) => {
    const targetShipment = shipment || selectedShipment;
    if (targetShipment) {
      setSelectedShipment(targetShipment);
      setLabelText(targetShipment.quotation?.client_label || targetShipment.label || "");
      setShowLabelModal(true);
    }
  };

  // Save label
  const handleSaveLabel = async () => {
    if (!selectedShipment || !user?.id) {
      return;
    }

    setIsSavingLabel(true);
    try {
      const newLabel = labelText.trim() || null;

      // Update shipping.label
      const { error: shippingError } = await supabase
        .from('shipping')
        .update({ label: newLabel })
        .eq('id', selectedShipment.id);

      if (shippingError) {
        console.error("Shipping update error:", shippingError.message, shippingError.code, shippingError.details, shippingError.hint);
        throw new Error(shippingError.message || "Failed to update shipping label");
      }

      // Also sync quotations.client_label so both stay in sync
      if (selectedShipment.quotation_id) {
        const { error: quotationError } = await supabase
          .from('quotations')
          .update({ client_label: newLabel } as never)
          .eq('id', selectedShipment.quotation_id);

        if (quotationError) {
          console.error("Quotation update error:", quotationError.message, quotationError.code, quotationError.details);
          // Non-blocking — label is saved in shipping, just log the sync failure
        }
      }

      // Update local state
      const updatedShipment = { ...selectedShipment, label: newLabel };
      setShipmentData(prevData =>
        prevData.map(s => s.id === selectedShipment.id ? updatedShipment : s)
      );
      setFilteredShipmentData(prevData =>
        prevData.map(s => s.id === selectedShipment.id ? updatedShipment : s)
      );
      setSelectedShipment(updatedShipment);
      setShowLabelModal(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Error saving label:", message);
      alert(`Failed to save label: ${message}`);
    } finally {
      setIsSavingLabel(false);
    }
  };

  // Open receiver information modal
  const openReceiverModal = (shipment: ShipmentTrackingData) => {
    setSelectedShipment(shipment);
    setReceiverInfo({
      receiver_name: '',
      receiver_phone: '',
      receiver_address: ''
    });
    setSubmissionSuccess(false);
    setSubmissionError(null);
    setShowReceiverModal(true);
  };

  // Handle receiver input change
  const handleReceiverInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setReceiverInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Select an existing receiver
  const handleSelectExistingReceiver = (receiverId: string) => {
    const receiver = savedReceivers.find(r => r.id === receiverId);
    if (receiver) {
      setReceiverInfo({
        receiver_name: receiver.receiver_name,
        receiver_phone: receiver.receiver_phone,
        receiver_address: receiver.receiver_address
      });
      setSelectedReceiverId(receiverId);
    }
  };

  // Submit receiver information
  const handleReceiverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedShipment || !user?.id) {
      setSubmissionError("Session information missing. Please refresh the page.");
      return;
    }
    
    // Validate inputs
    if (!receiverInfo.receiver_name.trim()) {
      setSubmissionError("Receiver name is required");
      return;
    }
    
    if (!receiverInfo.receiver_phone.trim()) {
      setSubmissionError("Receiver phone number is required");
      return;
    }
    
    if (!receiverInfo.receiver_address.trim()) {
      setSubmissionError("Receiver address is required");
      return;
    }
    
    setIsSubmitting(true);
    setSubmissionError(null);
    
    try {
      // Save the receiver information to the shipping_receivers table
      const { error: receiverError } = await supabase
        .from('shipping_receivers')
        .insert({
          user_id: user.id,
          shipping_id: selectedShipment.id,
          receiver_name: receiverInfo.receiver_name,
          receiver_phone: receiverInfo.receiver_phone,
          receiver_address: receiverInfo.receiver_address,
          is_default: saveForLater, // Set is_default based on the checkbox
        });
        
      if (receiverError) {
        throw receiverError;
      }
      
      // If saveForLater is true but an existing receiver is being used, update it to be default
      if (saveForLater && useExistingReceiver && selectedReceiverId) {
        const { error: updateError } = await supabase
          .from('shipping_receivers')
          .update({ is_default: true })
          .eq('id', selectedReceiverId);
          
        if (updateError) {
          console.error("Error setting receiver as default:", updateError);
        }
      }
      
      // Update the shipping table with receiver information and status
      const { error: updateError } = await supabase
        .from('shipping')
        .update({ 
          status: 'processing',
          receiver_name: receiverInfo.receiver_name,
          receiver_phone: receiverInfo.receiver_phone,
          receiver_address: receiverInfo.receiver_address
        })
        .eq('id', selectedShipment.id);
        
      if (updateError) {
        throw updateError;
      }
      
      // Update the local state to reflect the change
      setShipmentData(prevData => 
        prevData.map(shipment => 
          shipment.id === selectedShipment.id 
            ? { 
                ...shipment, 
                status: 'processing',
                receiver_name: receiverInfo.receiver_name,
                receiver_phone: receiverInfo.receiver_phone,
                receiver_address: receiverInfo.receiver_address
              } 
            : shipment
        )
      );
      
      setFilteredShipmentData(prevData => 
        prevData.map(shipment => 
          shipment.id === selectedShipment.id 
            ? { 
                ...shipment, 
                status: 'processing',
                receiver_name: receiverInfo.receiver_name,
                receiver_phone: receiverInfo.receiver_phone,
                receiver_address: receiverInfo.receiver_address
              } 
            : shipment
        )
      );
      
      // If we're saving for later, update the local state
      if (saveForLater && !useExistingReceiver) {
        setSavedReceivers(prev => [
          ...prev,
          { 
            id: crypto.randomUUID(), // Temporary ID until we fetch from DB again
            receiver_name: receiverInfo.receiver_name,
            receiver_phone: receiverInfo.receiver_phone,
            receiver_address: receiverInfo.receiver_address
          }
        ]);
      }
      
      setSubmissionSuccess(true);
      
      // Close the modal after a brief delay
      setTimeout(() => {
        setShowReceiverModal(false);
      }, 2000);
      
    } catch (err) {
      console.error("Error submitting receiver information:", err);
      setSubmissionError(err instanceof Error ? err.message : "Failed to save receiver information");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format date string
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not available";
    return new Date(dateString).toLocaleDateString();
  };

  // Validate and format URL
  const validateImageUrl = (url: string): string => {
    // If URL is already absolute, return it
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // If it's a relative path without leading slash, add it
    if (!url.startsWith('/')) {
      return `/${url}`;
    }
    
    // Otherwise, it's already a valid relative URL
    return url;
  };
  
  // Check if URL is valid for display
  const isValidUrl = (url: string): boolean => {
    try {
      // Test if URL is constructable (for absolute URLs)
      if (url.startsWith('http://') || url.startsWith('https://')) {
        new URL(url);
        return true;
      }
      // For relative URLs, just check if it has content
      return !!url.trim();
    } catch {
      return false;
    }
  };

  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      {/* Page Header Section */}
      <div className="col-span-12">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-[#0D47A1] dark:text-white/90">
            Your Shipment Tracking
          </h1>
        </div>
      </div>

      {/* Shipment Details Modal */}
      <Modal 
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        showCloseButton={false}
        className="max-w-3xl mx-4 md:mx-auto"
      >
        {selectedShipment && selectedShipment.quotation && (
          <div className="flex flex-col h-full max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#BBDEFB] flex-shrink-0 bg-[#E3F2FD]">
              <div>
                <h2 className="text-lg font-bold text-[#0D47A1]">Shipment Details</h2>
                <p className="text-xs text-[#0D47A1]/60 mt-0.5">{selectedShipment.quotation.quotation_id || "N/A"}</p>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-[#BBDEFB] text-[#0D47A1] hover:bg-[#BBDEFB] transition-all active:scale-95"
                aria-label="Close modal"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6L18 18" />
                </svg>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 min-h-0 space-y-4 bg-white">

              {/* Product + Status */}
              <div className="rounded-xl border border-[#BBDEFB] overflow-hidden">
                <div className="px-4 py-3 bg-[#E3F2FD] border-b border-[#BBDEFB]">
                  <h3 className="text-xs font-semibold text-[#0D47A1] uppercase tracking-wide">Product</h3>
                </div>
                <div className="p-4 flex gap-4 items-start bg-white">
                  <div
                    className="relative w-20 h-20 rounded-lg overflow-hidden border border-[#BBDEFB] flex-shrink-0 cursor-zoom-in group"
                    onClick={() => {
                      const img = selectedShipment.quotation?.image_url || defaultProductImage;
                      setSelectedImage(img);
                      setImageModalOpen(true);
                    }}
                  >
                    <Image src={selectedShipment.quotation.image_url || defaultProductImage} alt={selectedShipment.quotation.product_name || "Product"} fill className="object-cover group-hover:scale-105 transition-transform duration-200" />
                    <div className="absolute inset-0 bg-[#0D47A1]/0 group-hover:bg-[#0D47A1]/15 transition-colors flex items-center justify-center">
                      <svg className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-[#0D47A1]">{selectedShipment.quotation.product_name || "Product"}</h4>
                    <p className="text-xs text-[#0D47A1]/60 mt-0.5 mb-2">{selectedShipment.quotation.quotation_id}</p>
                    <Badge color={getStatusBadgeColor(selectedShipment.status)} size="sm">
                      {selectedShipment.status || "Not Available"}
                    </Badge>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-[#0D47A1]/60 uppercase tracking-wide">Created</p>
                    <p className="text-xs font-semibold text-gray-700 mt-0.5">{formatDate(selectedShipment.created_at)}</p>
                    <p className="text-xs text-[#0D47A1]/60 uppercase tracking-wide mt-2">
                      {selectedShipment.status?.toLowerCase() === "delivered" ? "Delivered" : "Est. Delivery"}
                    </p>
                    <p className="text-xs font-semibold text-gray-700 mt-0.5">
                      {selectedShipment.status?.toLowerCase() === "delivered"
                        ? formatDate(selectedShipment.delivered_at)
                        : formatDate(selectedShipment.estimated_delivery)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Route */}
              <div className="rounded-xl border border-[#BBDEFB] overflow-hidden">
                <div className="px-4 py-3 bg-[#E3F2FD] border-b border-[#BBDEFB]">
                  <h3 className="text-xs font-semibold text-[#0D47A1] uppercase tracking-wide">Route</h3>
                </div>
                <div className="grid grid-cols-3 divide-x divide-[#BBDEFB] bg-white">
                  <div className="px-4 py-3">
                    <p className="text-xs text-[#0D47A1]/60 uppercase tracking-wide mb-1">Origin</p>
                    <p className="text-sm font-bold text-[#0D47A1]">China</p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-xs text-[#0D47A1]/60 uppercase tracking-wide mb-1">Current</p>
                    <p className={`text-sm font-bold ${selectedShipment.location ? 'text-[#0D47A1]' : 'text-gray-400'}`}>
                      {selectedShipment.location || "—"}
                    </p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-xs text-[#0D47A1]/60 uppercase tracking-wide mb-1">Destination</p>
                    <p className="text-sm font-bold text-[#0D47A1]">{selectedShipment.quotation.shipping_country || "—"}</p>
                    <p className="text-xs text-[#0D47A1]/60">{selectedShipment.quotation.shipping_city}</p>
                  </div>
                </div>
              </div>

              {/* Receiver */}
              {selectedShipment.receiver_name && (
                <div className="rounded-xl border border-[#BBDEFB] overflow-hidden">
                  <div className="px-4 py-3 bg-[#E3F2FD] border-b border-[#BBDEFB]">
                    <h3 className="text-xs font-semibold text-[#0D47A1] uppercase tracking-wide">Receiver</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#E3F2FD] bg-white">
                    <div className="px-4 py-3">
                      <p className="text-xs text-[#0D47A1]/60 uppercase tracking-wide mb-0.5">Name</p>
                      <p className="text-sm font-semibold text-gray-800">{selectedShipment.receiver_name}</p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-xs text-[#0D47A1]/60 uppercase tracking-wide mb-0.5">Phone</p>
                      <p className="text-sm font-semibold text-gray-800">{selectedShipment.receiver_phone || "—"}</p>
                    </div>
                    {selectedShipment.receiver_address && (
                      <div className="md:col-span-2 px-4 py-3 border-t border-[#E3F2FD]">
                        <p className="text-xs text-[#0D47A1]/60 uppercase tracking-wide mb-0.5">Address</p>
                        <p className="text-sm text-gray-800 whitespace-pre-line">{selectedShipment.receiver_address}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Carton / Label */}
              <div className="rounded-xl border border-[#0D47A1] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-[#E3F2FD] border-b border-[#BBDEFB]">
                  <h3 className="text-xs font-semibold text-[#0D47A1] uppercase tracking-wide">Carton Label</h3>
                  <button
                    onClick={() => openLabelModal()}
                    className={`inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      (selectedShipment.quotation?.client_label || selectedShipment.label)
                        ? "bg-[#0D47A1] text-white hover:bg-[#1565C0] shadow-sm"
                        : "bg-white border border-[#0D47A1] text-[#0D47A1] hover:bg-[#E3F2FD]"
                    }`}
                  >
                    {(selectedShipment.quotation?.client_label || selectedShipment.label) ? (
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l3 3 5-5" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z" />
                      </svg>
                    )}
                    {(selectedShipment.quotation?.client_label || selectedShipment.label) ? 'Labeled' : 'Label'}
                  </button>
                </div>
                <div className="px-4 py-3 bg-white">
                  {(selectedShipment.quotation?.client_label || selectedShipment.label) ? (
                    <p className="text-sm font-mono font-semibold text-[#0D47A1]">
                      {selectedShipment.quotation?.client_label || selectedShipment.label}
                    </p>
                  ) : (
                    <p className="text-sm text-[#0D47A1]/40 italic">No label added yet — click the button to add one</p>
                  )}
                </div>
              </div>

              {/* Quotation Details */}
              {loadingQuotationDetails ? (
                <div className="rounded-xl border border-[#BBDEFB] p-8 text-center bg-white">
                  <div className="w-7 h-7 border-4 border-[#0D47A1] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-sm text-[#0D47A1]/60">Loading quotation details…</p>
                </div>
              ) : fullQuotationDetails ? (
                <div className="rounded-xl border border-[#BBDEFB] overflow-hidden">
                  <div className="px-4 py-3 bg-[#0D47A1]">
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wide">Quotation Details</h3>
                  </div>
                  <div className="bg-white divide-y divide-[#E3F2FD]">
                    <div className="grid grid-cols-2 divide-x divide-[#E3F2FD]">
                      <div className="px-4 py-3">
                        <p className="text-xs text-[#0D47A1]/60 uppercase tracking-wide mb-0.5">Product</p>
                        <p className="text-sm font-semibold text-gray-800">{fullQuotationDetails.product_name || "—"}</p>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-xs text-[#0D47A1]/60 uppercase tracking-wide mb-0.5">Quantity</p>
                        <p className="text-sm font-semibold text-gray-800">{fullQuotationDetails.quantity || "—"}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-[#E3F2FD]">
                      <div className="px-4 py-3">
                        <p className="text-xs text-[#0D47A1]/60 uppercase tracking-wide mb-0.5">Country</p>
                        <p className="text-sm font-semibold text-gray-800">{fullQuotationDetails.shipping_country || "—"}</p>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-xs text-[#0D47A1]/60 uppercase tracking-wide mb-0.5">City</p>
                        <p className="text-sm font-semibold text-gray-800">{fullQuotationDetails.shipping_city || "—"}</p>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-xs text-[#0D47A1]/60 uppercase tracking-wide mb-0.5">Method</p>
                        <p className="text-sm font-semibold text-gray-800">{fullQuotationDetails.shipping_method || "—"}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-[#E3F2FD]">
                      <div className="px-4 py-3">
                        <p className="text-xs text-[#0D47A1]/60 uppercase tracking-wide mb-0.5">Status</p>
                        <Badge color={getStatusBadgeColor(fullQuotationDetails.status)} size="sm">{fullQuotationDetails.status || "—"}</Badge>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-xs text-[#0D47A1]/60 uppercase tracking-wide mb-0.5">Created</p>
                        <p className="text-xs font-semibold text-gray-800">{fullQuotationDetails.created_at ? new Date(fullQuotationDetails.created_at).toLocaleDateString() : "—"}</p>
                      </div>
                    </div>
                    {fullQuotationDetails.product_url && (
                      <div className="px-4 py-3">
                        <p className="text-xs text-[#0D47A1]/60 uppercase tracking-wide mb-0.5">Product URL</p>
                        <a href={fullQuotationDetails.product_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#0D47A1] hover:underline break-all">{fullQuotationDetails.product_url}</a>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Images */}
              <div className="rounded-xl border border-[#BBDEFB] overflow-hidden">
                <div className="px-4 py-3 bg-[#E3F2FD] border-b border-[#BBDEFB]">
                  <h3 className="text-xs font-semibold text-[#0D47A1] uppercase tracking-wide">Shipment Images</h3>
                </div>
                <div className="p-4 bg-white">
                {selectedShipment.images_urls && selectedShipment.images_urls.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {selectedShipment.images_urls.map((url, idx) => {
                      const isValid = isValidUrl(url);
                      const imageUrl = isValid ? validateImageUrl(url) : imagePlaceholder;
                      return (
                        <div
                          key={idx}
                          className="relative h-32 rounded-lg overflow-hidden border border-[#BBDEFB] cursor-pointer group"
                          onClick={() => { setSelectedImage(imageUrl); setImageModalOpen(true); }}
                        >
                          <Image src={imageUrl} alt={`Shipment image ${idx + 1}`} fill className="object-cover group-hover:scale-105 transition-transform duration-200" />
                          <div className="absolute inset-0 bg-[#0D47A1]/0 group-hover:bg-[#0D47A1]/10 transition-colors" />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 border border-dashed border-[#BBDEFB] rounded-lg bg-[#E3F2FD]/30">
                    <p className="text-sm text-[#0D47A1]/40">No images available</p>
                  </div>
                )}
                </div>
              </div>

              {/* Image Modal for Zooming */}
              {imageModalOpen && (
                <div className="fixed inset-0 z-[9999] bg-black/90 dark:bg-black/95 flex items-center justify-center" onClick={() => setImageModalOpen(false)}>
                  <button
                    className="absolute right-5 top-5 z-[10000] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white hover:text-gray-900 transition-all duration-200 active:scale-95"
                    onClick={(e) => { e.stopPropagation(); setImageModalOpen(false); }}
                    aria-label="Close"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                  
                  <div className="relative w-[90vw] h-[90vh] max-w-7xl max-h-[90vh] p-4" onClick={(e) => e.stopPropagation()}>
                    <Image
                      src={selectedImage}
                      alt="Shipment image"
                      fill
                      className="object-contain"
                      sizes="90vw"
                    />
                  </div>
                  
                  <div className="absolute bottom-4 right-4 flex space-x-3">
                    <button 
                      className="bg-blue-500 text-white rounded-full p-3 shadow-lg hover:bg-blue-600 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(selectedImage, '_blank');
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                    <button 
                      className="bg-blue-500 text-white rounded-full p-3 shadow-lg hover:bg-blue-600 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        const link = document.createElement('a');
                        link.href = selectedImage;
                        link.download = 'shipment-image.jpg';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Videos */}
              <div className="rounded-xl border border-[#BBDEFB] overflow-hidden">
                <div className="px-4 py-3 bg-[#E3F2FD] border-b border-[#BBDEFB]">
                  <h3 className="text-xs font-semibold text-[#0D47A1] uppercase tracking-wide">Shipment Videos</h3>
                </div>
                <div className="p-4 bg-white">
                {selectedShipment.videos_urls && selectedShipment.videos_urls.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedShipment.videos_urls.map((url, idx) => {
                      const isValid = isValidUrl(url);
                      const videoUrl = isValid ? validateImageUrl(url) : "";
                      if (!isValid) return null;
                      return (
                        <div key={idx} className="rounded-lg overflow-hidden border border-[#BBDEFB]">
                          <video controls className="w-full h-auto" preload="metadata">
                            <source src={videoUrl} type="video/mp4" />
                          </video>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 border border-dashed border-[#BBDEFB] rounded-lg bg-[#E3F2FD]/30">
                    <p className="text-sm text-[#0D47A1]/40">No videos available</p>
                  </div>
                )}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="flex justify-end px-5 py-4 border-t border-[#BBDEFB] flex-shrink-0 bg-white">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-5 py-2.5 rounded-lg border border-[#BBDEFB] text-[#0D47A1] text-sm font-medium hover:bg-[#E3F2FD] transition-all"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Label Modal */}
      <Modal 
        isOpen={showLabelModal}
        onClose={() => !isSavingLabel && setShowLabelModal(false)}
        className="max-w-md p-6 mx-4 md:mx-auto custom-scrollbar"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Add Label</h3>
          <button 
            onClick={() => !isSavingLabel && setShowLabelModal(false)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            disabled={isSavingLabel}
          >
          </button>
        </div>
        
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Add a label for this carton to help identify it.
        </p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Label Text
            </label>
            <input
              type="text"
              value={labelText}
              onChange={(e) => setLabelText(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Enter label text"
              disabled={isSavingLabel}
            />
          </div>
          
          <div className="flex justify-end gap-3">
            <Button
              onClick={() => !isSavingLabel && setShowLabelModal(false)}
              variant="outline"
              type="button"
              disabled={isSavingLabel}
              className="border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="button"
              onClick={handleSaveLabel}
              disabled={isSavingLabel}
              className={isSavingLabel ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}
            >
              {isSavingLabel ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Saving...
                </>
              ) : (
                "Save Label"
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Receiver Information Modal */}
      <Modal 
        isOpen={showReceiverModal}
        onClose={() => !isSubmitting && setShowReceiverModal(false)}
        className="max-w-md p-6 mx-4 md:mx-auto custom-scrollbar"
      >
        {submissionSuccess ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Information Saved!</h4>
            <p className="text-gray-600 dark:text-gray-400">
              Your shipping information has been successfully submitted and your shipment is now being processed.
            </p>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Provide Shipping Information</h3>
              <button 
                onClick={() => !isSubmitting && setShowReceiverModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                disabled={isSubmitting}
              >
              </button>
            </div>
            
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Please provide the receiver information for your shipment.
            </p>
            
            {savedReceivers.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center mb-3">
                  <input
                    type="checkbox"
                    id="useExistingReceiver"
                    checked={useExistingReceiver}
                    onChange={() => setUseExistingReceiver(!useExistingReceiver)}
                    className="mr-2 h-4 w-4 text-blue-600"
                  />
                  <label htmlFor="useExistingReceiver" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Use saved shipping information
                  </label>
                </div>
                
                {useExistingReceiver && (
                  <div className="mb-4">
                    <select
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      value={selectedReceiverId || ''}
                      onChange={(e) => handleSelectExistingReceiver(e.target.value)}
                    >
                      <option value="">Select saved shipping information</option>
                      {savedReceivers.map(receiver => (
                        <option key={receiver.id} value={receiver.id}>
                          {receiver.receiver_name} - {receiver.receiver_phone}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
            
            <form onSubmit={handleReceiverSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Receiver Name*
                  </label>
                  <input
                    type="text"
                    name="receiver_name"
                    value={receiverInfo.receiver_name}
                    onChange={handleReceiverInputChange}
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Full Name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Receiver Phone Number*
                  </label>
                  <input
                    type="text"
                    name="receiver_phone"
                    value={receiverInfo.receiver_phone}
                    onChange={handleReceiverInputChange}
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Phone Number"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Exact Address*
                  </label>
                  <textarea
                    name="receiver_address"
                    value={receiverInfo.receiver_address}
                    onChange={handleReceiverInputChange}
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Street, City, State, Country, ZIP Code"
                    rows={3}
                    required
                  ></textarea>
                </div>
                
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    id="saveForLater"
                    checked={saveForLater}
                    onChange={() => setSaveForLater(!saveForLater)}
                    className="mr-2 h-4 w-4 text-blue-600"
                  />
                  <label htmlFor="saveForLater" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Save this information for future shipments
                  </label>
                </div>
                
                {submissionError && (
                  <div className="text-sm text-red-600 dark:text-red-400">
                    {submissionError}
                  </div>
                )}
                
                <div className="flex justify-end gap-3">
                  <Button
                    onClick={() => !isSubmitting && setShowReceiverModal(false)}
                    variant="outline"
                    type="button"
                    disabled={isSubmitting}
                    className="border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={isSubmitting}
                    className={isSubmitting ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      "Submit Information"
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </>
        )}
      </Modal>

      {/* Main Table Section */}
      <div className="col-span-12">
        <div className="rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="flex flex-wrap items-center justify-between gap-4 p-5 md:p-6">
            <h3 className="font-semibold text-[#0D47A1] text-base dark:text-white/90">
              Your Shipment Status
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearch}
                  placeholder="Search by tracking #, order #, or product..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E88E5] focus:border-[#1E88E5] w-64 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                />
                <svg
                  className="absolute left-3 top-2.5 text-gray-400"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M21 21L16.65 16.65"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="p-6 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#1E88E5] border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Loading your shipment data...</p>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-red-500 dark:text-red-400">
              <p>{error}</p>
            </div>
          ) : !user ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              <p>Please sign in to view your shipments</p>
            </div>
          ) : filteredShipmentData.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              <p>You don&apos;t have any active shipments</p>
              <p className="mt-2 text-sm">Check back later or contact customer support for assistance</p>
            </div>
          ) : (
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
                      Tracking Number
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
                      Destination
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                    >
                      Current Location
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                    >
                      Status
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                    >
                      Dates
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                    >
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHeader>

                {/* Table Body */}
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                    {filteredShipmentData.map((shipment) => (
                    <TableRow
                        key={shipment.id}
                      className="transition-all duration-300 hover:bg-[#E3F2FD] dark:hover:bg-gray-700/50 hover:shadow-md cursor-pointer"
                    >
                      <TableCell className="px-5 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {shipment.quotation?.quotation_id || "N/A"}
                      </TableCell>
                      <TableCell className="px-5 py-3 text-sm">
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 overflow-hidden rounded-lg flex-shrink-0">
                            <Image
                                src={shipment.quotation?.image_url || defaultProductImage}
                                alt={shipment.quotation?.product_name || "Product"}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div>
                              <div className="font-medium text-gray-800 dark:text-white/90">{shipment.quotation?.product_name || "Product"}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-3 text-sm">
                        <div className="flex flex-col">
                            <span className="font-medium text-green-600 dark:text-green-400">{shipment.quotation?.shipping_country || "Not specified"}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{shipment.quotation?.shipping_city || "Not specified"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-3 text-sm">
                        <div className="flex flex-col">
                            <span className="font-medium text-yellow-600 dark:text-yellow-400">{shipment.location || "Not updated"}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{shipment.location ? "In Transit" : "Waiting for update"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-3 text-sm">
                        <Badge color={getStatusBadgeColor(shipment.status)} size="sm">
                            {shipment.status || "Not Available"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-5 py-3 text-sm">
                        <div className="flex flex-col">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Created: {formatDate(shipment.created_at)}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                              {shipment.status?.toLowerCase() === "delivered" 
                                ? `Delivered: ${formatDate(shipment.delivered_at)}` 
                                : `Est. Delivery: ${formatDate(shipment.estimated_delivery)}`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-3 text-sm">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-gray-300 text-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                            onClick={() => viewShipmentDetails(shipment)}
                          >
                            View Details
                          </Button>
                          
                          <button
                            onClick={() => openLabelModal(shipment)}
                            className={`inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                              (shipment.quotation?.client_label || shipment.label)
                                ? "bg-[#0D47A1] text-white hover:bg-[#1565C0] shadow-sm"
                                : "bg-white border border-[#0D47A1] text-[#0D47A1] hover:bg-[#E3F2FD]"
                            }`}
                          >
                            {(shipment.quotation?.client_label || shipment.label) ? (
                              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l3 3 5-5" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z" />
                              </svg>
                            )}
                            {(shipment.quotation?.client_label || shipment.label) ? 'Labeled' : 'Label'}
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
} 