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
          .select('id, quotation_id, product_name, image_url, shipping_country, shipping_city, shipping_method')
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
    setLabelText(shipment.label || "");
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

  // Open label modal
  const openLabelModal = (shipment?: ShipmentTrackingData) => {
    const targetShipment = shipment || selectedShipment;
    if (targetShipment) {
      setSelectedShipment(targetShipment);
      setLabelText(targetShipment.label || "");
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
      const { error } = await supabase
        .from('shipping')
        .update({ label: labelText.trim() || null })
        .eq('id', selectedShipment.id);

      if (error) {
        throw error;
      }

      // Update local state
      setShipmentData(prevData =>
        prevData.map(shipment =>
          shipment.id === selectedShipment.id
            ? { ...shipment, label: labelText.trim() || null }
            : shipment
        )
      );

      setFilteredShipmentData(prevData =>
        prevData.map(shipment =>
          shipment.id === selectedShipment.id
            ? { ...shipment, label: labelText.trim() || null }
            : shipment
        )
      );

      if (selectedShipment) {
        setSelectedShipment({
          ...selectedShipment,
          label: labelText.trim() || null
        });
      }

      setShowLabelModal(false);
    } catch (err) {
      console.error("Error saving label:", err);
      alert("Failed to save label. Please try again.");
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
            {/* Fixed Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Shipment Details</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Tracking Number: <span className="font-medium text-gray-900 dark:text-white">{selectedShipment.quotation.quotation_id || "N/A"}</span>
                </p>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="ml-4 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition-all duration-200 hover:bg-gray-200 hover:text-gray-700 active:scale-95 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-white"
                aria-label="Close modal"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="stroke-current"
                >
                  <path
                    d="M18 6L6 18M6 6L18 18"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-6 min-h-0">
              {/* Product Information Card */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-xl p-5 mb-6 border border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="relative h-56 w-full overflow-hidden rounded-xl mb-4 border-2 border-gray-200 dark:border-gray-700 shadow-md">
                      <Image
                        src={selectedShipment.quotation.image_url || defaultProductImage}
                        alt={selectedShipment.quotation.product_name || "Product"}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{selectedShipment.quotation.product_name || "Product"}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Order ID: <span className="font-medium text-gray-900 dark:text-white">{selectedShipment.quotation.quotation_id || "N/A"}</span>
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Status</p>
                      <div>
                        <Badge color={getStatusBadgeColor(selectedShipment.status)} size="sm">
                          {selectedShipment.status || "Not Available"}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Timeline</p>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(selectedShipment.created_at)}</p>
                        </div>
                        {selectedShipment.status?.toLowerCase() === "delivered" ? (
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Delivered</p>
                            <p className="text-sm font-medium text-green-600 dark:text-green-400">{formatDate(selectedShipment.delivered_at)}</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Estimated Delivery</p>
                            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">{formatDate(selectedShipment.estimated_delivery)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Location Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {/* Origin Card */}
                <div className="group relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-all duration-200">
                  <div className="absolute top-0 left-0 w-1 h-full bg-[#1E88E5]"></div>
                  <div className="relative p-5 pl-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <svg className="w-5 h-5 text-[#1E88E5] dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Origin</div>
                    </div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white">China</div>
                  </div>
                </div>

                {/* Current Location Card */}
                <div className="group relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-all duration-200">
                  <div className={`absolute top-0 left-0 w-1 h-full ${
                    selectedShipment.location 
                      ? 'bg-[#1E88E5]'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}></div>
                  <div className="relative p-5 pl-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 rounded-lg ${
                        selectedShipment.location 
                          ? 'bg-gray-100 dark:bg-gray-700'
                          : 'bg-gray-50 dark:bg-gray-700/50'
                      }`}>
                        <svg className={`w-5 h-5 ${
                          selectedShipment.location 
                            ? 'text-[#1E88E5] dark:text-blue-400'
                            : 'text-gray-400 dark:text-gray-500'
                        }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <div className={`text-xs font-semibold uppercase tracking-wider ${
                        selectedShipment.location 
                          ? 'text-gray-500 dark:text-gray-400'
                          : 'text-gray-400 dark:text-gray-500'
                      }`}>Current Location</div>
                    </div>
                    <div className={`text-lg font-bold mb-1 ${
                      selectedShipment.location
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}>{selectedShipment.location || "Not updated"}</div>
                    <div className={`text-xs font-medium ${
                      selectedShipment.location 
                        ? 'text-[#1E88E5] dark:text-blue-400'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {selectedShipment.location ? "In Transit" : "Waiting for update"}
                    </div>
                  </div>
                </div>

                {/* Destination Card */}
                <div className="group relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-all duration-200">
                  <div className="absolute top-0 left-0 w-1 h-full bg-[#1E88E5]"></div>
                  <div className="relative p-5 pl-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <svg className="w-5 h-5 text-[#1E88E5] dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Destination</div>
                    </div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                      {selectedShipment.quotation.shipping_country || "Not specified"}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedShipment.quotation.shipping_city || "Not specified"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Receiver Information Section */}
              {selectedShipment.receiver_name && (
                <div className="mb-6 bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Receiver Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Name</p>
                      <p className="text-base font-semibold text-gray-900 dark:text-white">{selectedShipment.receiver_name}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Phone Number</p>
                      <p className="text-base font-semibold text-gray-900 dark:text-white">{selectedShipment.receiver_phone}</p>
                    </div>
                    <div className="md:col-span-2 bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Delivery Address</p>
                      <p className="text-base font-medium text-gray-900 dark:text-white whitespace-pre-line">{selectedShipment.receiver_address}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Carton Section */}
              <div className="mb-6 bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    Carton
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gray-300 text-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                    onClick={openLabelModal}
                  >
                    Label
                  </Button>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  {selectedShipment.label ? (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Label</p>
                      <p className="text-base font-medium text-gray-900 dark:text-white">{selectedShipment.label}</p>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400">No label added yet</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Click the Label button to add one</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Image Gallery Section - Show if images are available */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Shipment Images
                </h3>
                {selectedShipment.images_urls && selectedShipment.images_urls.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {selectedShipment.images_urls.map((url, idx) => {
                      const isValid = isValidUrl(url);
                      const imageUrl = isValid ? validateImageUrl(url) : imagePlaceholder;
                      
                      return (
                        <div 
                          key={idx} 
                          className="relative h-40 rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer group"
                          onClick={() => {
                            setSelectedImage(imageUrl);
                            setImageModalOpen(true);
                          }}
                        >
                          <Image
                            src={imageUrl}
                            alt={`Shipment image ${idx + 1}`}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                          <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-20 transition-opacity flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                            </svg>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm font-medium">No images available</p>
                  </div>
                )}
              </div>

              {/* Image Modal for Zooming */}
              {imageModalOpen && (
                <div className="fixed inset-0 z-[9999] bg-black/90 dark:bg-black/95 flex items-center justify-center" onClick={() => setImageModalOpen(false)}>
                  <button className="absolute right-3 top-3 z-[10000] flex h-9.5 w-9.5 items-center justify-center rounded-full bg-gray-100 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white sm:right-6 sm:top-6 sm:h-11 sm:w-11" onClick={(e) => {
                    e.stopPropagation();
                    setImageModalOpen(false);
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" clipRule="evenodd" d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L6.04289 16.5413Z" fill="currentColor"></path>
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

              {/* Video Gallery Section - Show if videos are available */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Shipment Videos
                </h3>
                {selectedShipment.videos_urls && selectedShipment.videos_urls.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedShipment.videos_urls.map((url, idx) => {
                      const isValid = isValidUrl(url);
                      const videoUrl = isValid ? validateImageUrl(url) : "";
                      
                      if (!isValid) return null;
                      
                      return (
                        <div key={idx} className="rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 shadow-md hover:shadow-lg transition-shadow">
                          <video 
                            controls
                            className="w-full h-auto"
                            preload="metadata"
                          >
                            <source src={videoUrl} type="video/mp4" />
                            Your browser does not support the video tag.
                          </video>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm font-medium">No videos available</p>
                  </div>
                )}
              </div>

              {/* Full Quotation Details Section */}
              {loadingQuotationDetails ? (
                <div className="mb-6 bg-gray-50 dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700 text-center">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">Loading quotation details...</p>
                </div>
              ) : fullQuotationDetails ? (
                <div className="mb-6 space-y-6">
                  {/* Complete Quotation Information */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-xl p-6 border border-blue-200 dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                      <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Complete Quotation Details
                    </h3>

                    {/* Product Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Product Name</p>
                        <p className="text-base font-semibold text-gray-900 dark:text-white">{fullQuotationDetails.product_name || "N/A"}</p>
                      </div>
                      <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Quantity</p>
                        <p className="text-base font-semibold text-gray-900 dark:text-white">{fullQuotationDetails.quantity || "N/A"}</p>
                      </div>
                      {fullQuotationDetails.product_url && (
                        <div className="md:col-span-2 bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Product URL</p>
                          <a href={fullQuotationDetails.product_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline break-all">
                            {fullQuotationDetails.product_url}
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Shipping Information */}
                    <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mb-6">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        Shipping Information
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Country</p>
                          <p className="text-base font-semibold text-gray-900 dark:text-white">{fullQuotationDetails.shipping_country || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">City</p>
                          <p className="text-base font-semibold text-gray-900 dark:text-white">{fullQuotationDetails.shipping_city || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Method</p>
                          <p className="text-base font-semibold text-gray-900 dark:text-white">{fullQuotationDetails.shipping_method || "N/A"}</p>
                        </div>
                        {fullQuotationDetails.service_type && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Service Type</p>
                            <p className="text-base font-semibold text-gray-900 dark:text-white">{fullQuotationDetails.service_type}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Receiver Address from Quotation */}
                    {(fullQuotationDetails.receiver_name || fullQuotationDetails.receiver_phone || fullQuotationDetails.receiver_address) && (
                      <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mb-6">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          Receiver Address (from Quotation)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {fullQuotationDetails.receiver_name && (
                            <div>
                              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Name</p>
                              <p className="text-base font-semibold text-gray-900 dark:text-white">{fullQuotationDetails.receiver_name}</p>
                            </div>
                          )}
                          {fullQuotationDetails.receiver_phone && (
                            <div>
                              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Phone</p>
                              <p className="text-base font-semibold text-gray-900 dark:text-white">{fullQuotationDetails.receiver_phone}</p>
                            </div>
                          )}
                          {fullQuotationDetails.receiver_address && (
                            <div className="md:col-span-2">
                              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Address</p>
                              <p className="text-base font-medium text-gray-900 dark:text-white whitespace-pre-line">{fullQuotationDetails.receiver_address}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Pricing Options */}
                    <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Pricing Options
                      </h4>
                      <div className="space-y-4">
                        {[1, 2, 3].map((optionNum) => {
                          const title = fullQuotationDetails[`title_option${optionNum}`] as string | undefined;
                          const totalPrice = fullQuotationDetails[`total_price_option${optionNum}`] as number | undefined;
                          const unitPrice = fullQuotationDetails[`unit_price_option${optionNum}`] as number | undefined;
                          const deliveryTime = fullQuotationDetails[`delivery_time_option${optionNum}`] as string | undefined;
                          const description = fullQuotationDetails[`description_option${optionNum}`] as string | undefined;
                          const priceDescription = fullQuotationDetails[`price_description_option${optionNum}`] as string | undefined;
                          const unitWeight = fullQuotationDetails[`unit_weight_option${optionNum}`] as number | undefined;
                          const isSelected = fullQuotationDetails.selected_option === optionNum;

                          if (!title && !totalPrice) return null;

                          return (
                            <div
                              key={optionNum}
                              className={`rounded-lg p-4 border-2 ${
                                isSelected
                                  ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-400"
                                  : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <h5 className="text-base font-bold text-gray-900 dark:text-white">
                                  Option {optionNum}: {title || "N/A"}
                                </h5>
                                {isSelected && (
                                  <Badge color="primary" size="sm">Selected</Badge>
                                )}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {totalPrice && (
                                  <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Total Price</p>
                                    <p className="text-lg font-bold text-gray-900 dark:text-white">${Number(totalPrice).toFixed(2)}</p>
                                  </div>
                                )}
                                {unitPrice && (
                                  <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Unit Price</p>
                                    <p className="text-base font-semibold text-gray-900 dark:text-white">${Number(unitPrice).toFixed(2)}</p>
                                  </div>
                                )}
                                {deliveryTime && (
                                  <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Delivery Time</p>
                                    <p className="text-base font-medium text-gray-900 dark:text-white">{deliveryTime}</p>
                                  </div>
                                )}
                                {unitWeight && (
                                  <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Unit Weight</p>
                                    <p className="text-base font-medium text-gray-900 dark:text-white">{unitWeight}g</p>
                                  </div>
                                )}
                              </div>
                              {description && (
                                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Description</p>
                                  <p className="text-sm text-gray-700 dark:text-gray-300">{description}</p>
                                </div>
                              )}
                              {priceDescription && (
                                <div className="mt-2">
                                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Price Description</p>
                                  <p className="text-sm text-gray-700 dark:text-gray-300">{priceDescription}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {fullQuotationDetails.Quotation_fees && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex justify-between items-center">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Quotation Fees</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">${Number(fullQuotationDetails.Quotation_fees).toFixed(2)}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Additional Information */}
                    <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Additional Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500 dark:text-gray-400 mb-1">Quotation ID</p>
                          <p className="font-medium text-gray-900 dark:text-white">{fullQuotationDetails.quotation_id || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400 mb-1">Status</p>
                          <Badge color={getStatusBadgeColor(fullQuotationDetails.status)} size="sm">
                            {fullQuotationDetails.status || "N/A"}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400 mb-1">Created At</p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {fullQuotationDetails.created_at ? new Date(fullQuotationDetails.created_at).toLocaleString() : "N/A"}
                          </p>
                        </div>
                        {fullQuotationDetails.updated_at && (
                          <div>
                            <p className="text-gray-500 dark:text-gray-400 mb-1">Updated At</p>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {new Date(fullQuotationDetails.updated_at).toLocaleString()}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
              
            </div>
            
            {/* Fixed Footer */}
            <div className="flex justify-end p-5 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 font-medium shadow-sm hover:shadow-md"
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
                          
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-gray-300 text-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                            onClick={() => openLabelModal(shipment)}
                          >
                            Label
                          </Button>
                          
                          {/* Add "Provide Shipping Info" button for shipments with "Waiting" status */}
                          {shipment.status?.toLowerCase() === "waiting" && (
                            <Button
                              size="sm"
                              variant="primary"
                              className="bg-[#1E88E5] hover:bg-[#0D47A1]"
                              onClick={() => openReceiverModal(shipment)}
                            >
                              Provide Info
                            </Button>
                          )}
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