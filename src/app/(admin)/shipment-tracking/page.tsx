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
  const viewShipmentDetails = (shipment: ShipmentTrackingData) => {
    setSelectedShipment(shipment);
    setShowDetailsModal(true);
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
        className="max-w-3xl mx-4 md:mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-xl relative overflow-hidden custom-scrollbar"
      >
        {selectedShipment && selectedShipment.quotation && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Shipment Details</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Tracking Number: {selectedShipment.quotation.quotation_id || "N/A"}
                </p>
              </div>
            </div>
            
            <div className="p-5 md:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <div className="relative h-48 w-full overflow-hidden rounded-lg mb-4 border border-gray-200 dark:border-gray-700">
                    <Image
                      src={selectedShipment.quotation.image_url || defaultProductImage}
                      alt={selectedShipment.quotation.product_name || "Product"}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{selectedShipment.quotation.product_name || "Product"}</h3>
                  <p className="text-gray-500 dark:text-gray-400">Order ID: {selectedShipment.quotation.quotation_id || "N/A"}</p>
                </div>
                
                <div className="space-y-4">
                  <div className="border-b border-gray-200 dark:border-gray-700 pb-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                    <div className="mt-1">
                      <Badge color={getStatusBadgeColor(selectedShipment.status)} size="sm">
                        {selectedShipment.status || "Not Available"}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="border-b border-gray-200 dark:border-gray-700 pb-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Dates</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">Created:</span> {formatDate(selectedShipment.created_at)}
                    </p>
                    {selectedShipment.status?.toLowerCase() === "delivered" ? (
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <span className="font-medium">Delivered:</span> {formatDate(selectedShipment.delivered_at)}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <span className="font-medium">Estimated Delivery:</span> {formatDate(selectedShipment.estimated_delivery)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 shadow-sm">
                  <div className="text-gray-500 dark:text-gray-400 text-sm mb-1">Origin</div>
                  <div className="font-medium text-blue-600 dark:text-blue-400">China</div>
                  
                </div>
                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 shadow-sm">
                  <div className="text-gray-500 dark:text-gray-400 text-sm mb-1">Current Location</div>
                  <div className="font-medium text-amber-600 dark:text-amber-400">{selectedShipment.location || "Not updated"}</div>
                  <div className="text-gray-700 dark:text-gray-300">{selectedShipment.location ? "In Transit" : "Waiting for update"}</div>
                </div>
                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 shadow-sm">
                  <div className="text-gray-500 dark:text-gray-400 text-sm mb-1">Destination</div>
                  <div className="font-medium text-green-600 dark:text-green-400">{selectedShipment.quotation.shipping_country || "Not specified"}</div>
                  <div className="text-gray-700 dark:text-gray-300">{selectedShipment.quotation.shipping_city || "Not specified"}</div>
                </div>
              </div>

              {/* Receiver Information Section */}
              {selectedShipment.receiver_name && (
                <div className="mt-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/60">
                  <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-4">Receiver Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
                      <p className="font-medium text-gray-900 dark:text-white">{selectedShipment.receiver_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Phone Number</p>
                      <p className="font-medium text-gray-900 dark:text-white">{selectedShipment.receiver_phone}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Address</p>
                      <p className="font-medium text-gray-900 dark:text-white whitespace-pre-line">{selectedShipment.receiver_address}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Image Gallery Section - Show if images are available */}
              {selectedShipment.images_urls && selectedShipment.images_urls.length > 0 ? (
                <div className="mt-6">
                  <h3 className="mb-3 text-lg font-medium text-gray-800 dark:text-white">Shipment Images</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {selectedShipment.images_urls.map((url, idx) => {
                      // Ensure URL is valid before rendering Image component
                      const isValid = isValidUrl(url);
                      const imageUrl = isValid ? validateImageUrl(url) : imagePlaceholder;
                      
                      return (
                        <div 
                          key={idx} 
                          className="relative h-32 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => {
                            setSelectedImage(imageUrl);
                            setImageModalOpen(true);
                          }}
                        >
                          <Image
                            src={imageUrl}
                            alt={`Shipment image ${idx + 1}`}
                            fill
                            className="object-cover"
                          />
                          <div className="absolute inset-0 bg-black opacity-0 hover:opacity-10 transition-opacity flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                            </svg>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="mt-6">
                  <h3 className="mb-3 text-lg font-medium text-gray-800 dark:text-white">Shipment Images</h3>
                  <div className="text-center text-gray-500 dark:text-gray-400 py-6 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                    No images available
                  </div>
                </div>
              )}

              {/* Image Modal for Zooming */}
              {imageModalOpen && (
                <div className="fixed inset-0 z-[9999] bg-white flex items-center justify-center" onClick={() => setImageModalOpen(false)}>
                  <button className="absolute right-3 top-3 z-[10000] flex h-9.5 w-9.5 items-center justify-center rounded-full bg-gray-100 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white sm:right-6 sm:top-6 sm:h-11 sm:w-11" onClick={(e) => {
                    e.stopPropagation();
                    setImageModalOpen(false);
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path fill-rule="evenodd" clip-rule="evenodd" d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L6.04289 16.5413Z" fill="currentColor"></path>
                    </svg>
                  </button>
                  
                  <div className="w-full h-full flex items-center justify-center p-4">
                    <Image
                      src={selectedImage}
                      alt="Shipment image"
                      className="max-w-full max-h-full object-contain"
                      onClick={(e) => e.stopPropagation()}
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
              {selectedShipment.videos_urls && selectedShipment.videos_urls.length > 0 ? (
                <div className="mt-6">
                  <h3 className="mb-3 text-lg font-medium text-gray-800 dark:text-white">Shipment Videos</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedShipment.videos_urls.map((url, idx) => {
                      // Ensure URL is valid before rendering video component
                      const isValid = isValidUrl(url);
                      const videoUrl = isValid ? validateImageUrl(url) : "";
                      
                      if (!isValid) return null;
                      
                      return (
                        <div key={idx} className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
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
                </div>
              ) : (
                <div className="mt-6">
                  <h3 className="mb-3 text-lg font-medium text-gray-800 dark:text-white">Shipment Videos</h3>
                  <div className="text-center text-gray-500 dark:text-gray-400 py-6 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                    No videos available
                  </div>
                </div>
              )}
              
              <div className="mt-6 flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowDetailsModal(false)}
                  className="border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
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
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
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