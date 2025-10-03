"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Modal } from "@/components/ui/modal";
import { CloseIcon } from "@/icons";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { supabase } from "@/lib/supabase";
import { QuotationData } from '@/types/quotation';

interface QuotationDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: QuotationData;
  openCheckoutModal: (quotation: QuotationData) => void;
}

// Define a type for quotation with Quotation_fees
interface QuotationWithFees extends QuotationData {
  Quotation_fees?: string | number;
}

const QuotationDetailsModal: React.FC<QuotationDetailsProps> = ({ isOpen, onClose, quotation, openCheckoutModal }) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(
    quotation.selected_option ? String(quotation.selected_option) : null
  );
  const [savedOption, setSavedOption] = useState<string | null>(
    quotation.selected_option ? String(quotation.selected_option) : null
  );
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const actionButtonsRef = React.useRef<HTMLDivElement>(null);
  const [fee, setFee] = useState<number | null>(null);
  const [isLoadingFee, setIsLoadingFee] = useState(false);

  // Helper function to validate and format image URLs
  const validateImageUrl = (url: string): string => {
    if (!url) return '/images/placeholder.jpg';
    
    // Check if the URL is valid
    try {
      // If it's an absolute URL (starts with http:// or https://)
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      
      // If it's "product original" or contains invalid characters
      if (url === "product original" || !url.trim()) {
        return '/images/placeholder.jpg';
      }
      
      // If it's a relative path, make sure it starts with '/'
      if (!url.startsWith('/')) {
        return `/${url}`;
      }
      
      // If all checks pass, return the url
      return url;
    } catch (error) {
      console.error("Error validating image URL:", error);
      return '/images/placeholder.jpg';
    }
  };

  // Check if an image is a placeholder or invalid
  const isPlaceholderImage = (url: string): boolean => {
    if (!url) return true;
    if (url === '/images/placeholder.jpg') return true;
    if (url === 'product original') return true;
    if (!url.trim()) return true;
    if (url.includes('/images/product/product-01.jpg')) return true;
    return false;
  };

  // Simple refresh function to update the component
  const refreshComponent = () => {
    // Show brief refresh indicator
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
    
    // Increment refresh key to trigger re-render
    setRefreshKey(prevKey => prevKey + 1);
  };

  // Use provided price options or empty array if none
  const displayPriceOptions = quotation.priceOptions && quotation.priceOptions.length > 0 
    ? quotation.priceOptions 
    : [];

  // Handle option selection with visual feedback
  const handleOptionSelect = (optionId: string) => {
    // Only trigger effects if actually changing the selection
    if (optionId !== selectedOption) {
      setSelectedOption(optionId);
      
      // If changing from the saved option, scroll to action buttons to encourage saving
      if (optionId !== savedOption) {
        setTimeout(() => {
          actionButtonsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }
  };

  // Update the function to save directly to quotations table
  const saveOptionToDatabase = async (optionId: string) => {
    try {
      setIsSaving(true);
      
      // First we need to find the actual UUID of the quotation in the database
      // since the ID we have might be formatted differently (like QT-2024-001)
      let quotationUuid;
      
      if (quotation.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        // If the ID is already a valid UUID, use it directly
        quotationUuid = quotation.id;
      } else {
        // Try to find the actual UUID by quotation_id if it's a formatted ID
        const { data: quotationData, error: quotationError } = await supabase
          .from('quotations')
          .select('id')
          .eq('quotation_id', quotation.id)
          .maybeSingle();
          
        if (quotationError) {
          console.error("Error finding quotation UUID:", quotationError);
          alert("There was a problem accessing the quotation information. Please try again later.");
          return false;
        }
        
        if (!quotationData) {
          console.error("No matching quotation found for ID:", quotation.id);
          alert("This quotation could not be found in the database. Please refresh the page and try again.");
          return false;
        }
        
        quotationUuid = quotationData.id;
      }
      
      console.log("Debug - Attempting to save selection:", {
        quotationId: quotation.id,
        quotationUuid: quotationUuid,
        optionId: optionId,
      });
      
      // Save directly to quotations table
      const optionNumber = parseInt(optionId, 10);
      
      if (isNaN(optionNumber) || optionNumber < 1 || optionNumber > 3) {
        console.error("Invalid option number:", optionId);
        alert("Invalid option selection. Please choose option 1, 2, or 3.");
        return false;
      }
      
      // Update the quotation with the selected option
      const { error: updateError } = await supabase
        .from('quotations')
        .update({
          selected_option: optionNumber,
          updated_at: new Date().toISOString()
        })
        .eq('id', quotationUuid);
      
      if (updateError) {
        console.error("Error saving selection to quotations:", updateError);
        console.error("Error details:", JSON.stringify(updateError, null, 2));
        alert(`Error saving your selection: ${updateError.message || 'Unknown error'}`);
        return false;
      }
      
      console.log("Selection saved successfully to quotations table");
      return true;
      
    } catch (error) {
      console.error("Exception saving selection:", error);
      alert("An unexpected error occurred. Please try again or contact support if the problem persists.");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleAcceptQuote = async () => {
    if (!selectedOption) return;
    
    // Save the selected option to database
    const saved = await saveOptionToDatabase(selectedOption);
    
    if (saved) {
      // Save the selected option in local state
      setSavedOption(selectedOption);
      
      // Update the quotation object to reflect the change immediately
      quotation.selected_option = parseInt(selectedOption, 10);
      
      // Refresh the component to show updated selection
      refreshComponent();
      
      // Here you would handle accepting the quote with the selected price option
      console.log(`Accepting quote ${quotation.id} with price option ${selectedOption}`);
      
      // For now we'll just simulate acceptance
      alert(`Quotation ${quotation.id} has been accepted with the selected price option.`);
    } else {
      alert("Failed to save your selection. Please try again.");
    }
  };

  const handleSaveSelection = async () => {
    if (!selectedOption) return;
    
    // Track if this is a change of existing selection
    const isChangingSelection = quotation.selected_option && 
                               selectedOption !== String(quotation.selected_option);
    
    // Store the original option value for the message
    const originalOption = quotation.selected_option;
    
    // Save the selected option to database
    const saved = await saveOptionToDatabase(selectedOption);
    
    if (saved) {
      // Save the selected option in local state
      setSavedOption(selectedOption);
      
      // Update the quotation object to reflect the change immediately
      quotation.selected_option = parseInt(selectedOption, 10);
      
      // Refresh the component to show updated selection
      refreshComponent();
      
      // Different confirmation message based on whether changing or initial selection
      if (isChangingSelection) {
        alert(`Your selection has been changed from Option ${originalOption} to Option ${selectedOption}. You can now proceed to payment.`);
      } else {
        alert(`Your price option selection has been saved. You can now proceed to payment.`);
      }
    } else {
      alert("Failed to save your selection. Please try again.");
    }
  };

  // Force re-render when refresh key changes
  useEffect(() => {
    // This effect will run whenever the refresh key changes
    console.log("Component refreshed after option selection change");
  }, [refreshKey]);

  const handlePayNow = () => {
    const optionToUse = savedOption || selectedOption;
    if (!optionToUse) return;
    
    // Open the checkout modal
    onClose(); // Close the details modal first
    openCheckoutModal(quotation); // Open the checkout modal
  };



  const handleImageClick = (imageSrc: string) => {
    setZoomImage(imageSrc);
    setZoomLevel(1);
  };

  // Format fee with currency symbol
  const formatFee = (amount: number): string => {
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Fetch fee from database
  useEffect(() => {
    const fetchFee = async () => {
      if (!quotation || !quotation.id) return;
      
      setIsLoadingFee(true);
      try {
        let quotationId = quotation.id;
        
        // If the ID doesn't look like a UUID, it might be a display ID
        if (!quotationId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          console.log("ID is not a UUID, trying to find by quotation_id:", quotationId);
          // Try to find the actual UUID by quotation_id field
          const { data: quotationData, error: quotationError } = await supabase
            .from('quotations')
            .select('id')
            .eq('quotation_id', quotationId)
            .maybeSingle();
            
          if (quotationError) {
            console.error("Error finding quotation:", quotationError.message);
            setFee(null);
            setIsLoadingFee(false);
            return;
          }
          
          if (quotationData) {
            quotationId = quotationData.id;
            console.log("Found UUID:", quotationId);
          }
        }
        
        console.log("Fetching fee for quotation ID:", quotationId);
        
        // Query the quotations table for all fields
        const { data, error } = await supabase
          .from('quotations')
          .select('Quotation_fees')  // Use correct column name with capitalization
          .eq('id', quotationId)
          .maybeSingle();
        
        if (error) {
          // Log the error message without trying to stringify the whole error object
          console.error("Supabase error fetching fee:", error.message || "Unknown error");
          setFee(null);
        } else if (!data) {
          console.log("No data returned for quotation");
          setFee(null);
        } else {
          console.log("Data retrieved:", JSON.stringify(data, null, 2));
          // Check if the Quotation_fees field exists in the response
          if (data.Quotation_fees !== undefined && data.Quotation_fees !== null) {
            const feeValue = parseFloat(data.Quotation_fees);
            if (!isNaN(feeValue)) {
              console.log("Fee value:", feeValue);
              setFee(feeValue);
            } else {
              console.log("Fee is not a valid number:", data.Quotation_fees);
              setFee(null);
            }
          } else {
            console.log("Quotation_fees field not found in response");
            setFee(null);
          }
        }
      } catch {
        // Generic catch-all for any unexpected errors
        console.error("Exception in fee fetching process");
        setFee(null);
      } finally {
        setIsLoadingFee(false);
      }
    };
    
    if (isOpen && quotation) {
      fetchFee();
    } else {
      // Reset fee when modal closes
      setFee(null);
    }
  }, [isOpen, quotation]);
  
  // Price options section
  const renderPriceOptionsSection = () => {
    // If there are actual price options, display them
    if (displayPriceOptions.length > 0) {
      return (
        <div className={`relative ${isRefreshing ? 'opacity-70 pointer-events-none' : ''}`}>
          {isRefreshing && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-gray-800/50 z-10 rounded-lg">
              <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-md text-sm">
                Updating...
              </div>
            </div>
          )}
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
            Price Options
          </h3>
          {quotation.selected_option && (
            <div className={`mb-4 p-3 rounded-lg ${
              selectedOption && selectedOption !== String(quotation.selected_option)
                ? 'bg-yellow-50 border border-yellow-200 text-yellow-800 dark:bg-yellow-900/10 dark:border-yellow-800 dark:text-yellow-400'
                : 'bg-green-50 border border-green-200 text-green-800 dark:bg-green-900/10 dark:border-green-800 dark:text-green-400'
            }`}>
              <p className="font-medium">
                {selectedOption && selectedOption !== String(quotation.selected_option)
                  ? `Option ${quotation.selected_option} is currently selected. You've chosen Option ${selectedOption} instead.`
                  : `Option ${quotation.selected_option} is currently selected`
                }
              </p>
              {selectedOption && selectedOption !== String(quotation.selected_option) && (
                <div className="mt-2 flex items-center">
                  <p className="text-sm">Click &quot;Change Selection&quot; below to confirm this change.</p>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={handleSaveSelection}
                    disabled={isSaving}
                    className="ml-3 bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-300 text-xs py-1"
                  >
                    {isSaving ? 'Saving...' : 'Change Now'}
                  </Button>
                </div>
              )}
            </div>
          )}
          <div className="space-y-6">
            {displayPriceOptions.map((option) => {
              const isSelectedInDatabase = quotation.selected_option === parseInt(option.id, 10);
              const optionNum = option.id;
              // Dynamic keys for unit price and unit weight
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const rawUnitPrice = (option as any)[`unit_price_option${optionNum}`] as unknown as string | number | undefined;
              const unitPrice = (typeof rawUnitPrice === 'string' || typeof rawUnitPrice === 'number') ? rawUnitPrice : (option.price ?? 'N/A');
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const rawUnitWeight = (option as any)[`unit_weight_option${optionNum}`] as unknown as string | number | undefined;
              const unitWeight = (typeof rawUnitWeight === 'string' || typeof rawUnitWeight === 'number') ? rawUnitWeight : (option.unitWeightGrams ?? '-');
              // Gather all image fields for this option
              const imageFields = [
                option.modelImage,
                ...Object.keys(option)
                  .filter((key) => key.startsWith(`image_option${optionNum}_`) && option[key])
                  .map((key) => option[key])
              ].filter(Boolean);

              return (
                <div 
                  key={option.id}
                  className={`p-4 border rounded-lg transition-all ${
                    selectedOption === option.id || isSelectedInDatabase
                      ? 'border-[#1E88E5] bg-blue-50 dark:bg-blue-900/10'
                      : 'border-gray-200 hover:border-[#1E88E5] dark:border-gray-700'
                  }`}
                >
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="w-full">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 mb-3">
                        <thead>
                          <tr>
                            <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider text-center bg-gray-50 dark:bg-gray-800">Unit Price</th>
                            <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider text-center bg-gray-50 dark:bg-gray-800">Unit Weight (grams)</th>
                            <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider text-center bg-gray-50 dark:bg-gray-800">Images</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="px-4 py-2 text-sm text-center border font-bold text-gray-900 dark:text-white">${unitPrice}</td>
                            <td className="px-4 py-2 text-sm text-center border text-gray-900 dark:text-white">{unitWeight}</td>
                            <td className="px-4 py-2 text-sm text-center border">
                              <div className="flex flex-wrap gap-2 justify-center">
                                {imageFields.length > 0 ? (
                                  imageFields.map((img, idx) => (
                                    <div key={idx} className="relative w-16 h-16 rounded overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer" onClick={() => handleImageClick(validateImageUrl(img as string))}>
                                      <Image
                                        src={validateImageUrl(img as string)}
                                        alt={`Option Image ${idx+1}`}
                                        fill
                                        className="object-cover"
                                      />
                                      {isPlaceholderImage(img as string) && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700 bg-opacity-90 dark:bg-opacity-90">
                                          <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">No image</p>
                                        </div>
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-gray-400">No images</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      <div className="flex flex-col md:flex-row justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-gray-800 dark:text-white">
                            {option.modelName || 'Price Option'}
                            {isSelectedInDatabase && (
                              <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full dark:bg-green-900/30 dark:text-green-400">
                                Selected
                              </span>
                            )}
                          </h4>
                        </div>
                        {/* Remove price from here, now shown in table */}
                      </div>
                      {option.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                          {option.description}
                        </p>
                      )}
                      <div className="flex flex-wrap justify-between items-center">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Estimated Delivery: <span className="font-medium">{option.deliveryTime}</span>
                        </div>
                        <div className="mt-3 md:mt-0">
                          <Button
                            variant={selectedOption === option.id || isSelectedInDatabase ? "primary" : "outline"}
                            size="sm"
                            onClick={() => handleOptionSelect(option.id)}
                            className={selectedOption === option.id || isSelectedInDatabase
                              ? "bg-[#1E88E5] hover:bg-[#0D47A1]" 
                              : "border-[#1E88E5] text-[#1E88E5] hover:bg-[#E3F2FD]"}
                          >
                            {selectedOption === option.id || isSelectedInDatabase ? 'Selected' : 'Select Option'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    
    // For different quotation statuses with no price options
    if (quotation.status === "Pending") {
      return (
        <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center">
          <p className="text-yellow-700 dark:text-yellow-400 mb-2 font-medium">Waiting for price options from administrator</p>
          <p className="text-sm text-yellow-600 dark:text-yellow-500">The administrator is currently preparing price options for this quotation. You will be notified when they are available.</p>
        </div>
      );
    }
    
    if (quotation.status === "Rejected") {
      return (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <p className="text-red-700 dark:text-red-400 mb-2 font-medium">Quotation Rejected</p>
          <p className="text-sm text-red-600 dark:text-red-500">This quotation has been rejected. Please contact customer support for more information.</p>
        </div>
      );
    }
    
    return null;
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      showCloseButton={true}
      className="max-w-4xl h-auto mx-auto p-4 sm:p-6 bg-white dark:bg-gray-800 custom-scrollbar"
    >
      {/* Modal header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-xl font-bold text-[#0D47A1] dark:text-blue-400 flex items-center">
            Quotation Details <span className="ml-2 text-sm font-medium text-gray-600 dark:text-gray-400">ID: {quotation.quotation_id || quotation.id}</span>
          </h2>
          <div className="flex items-center mt-1">
            <span className="text-sm text-gray-500 dark:text-gray-400 mr-3">Created on {quotation.date}</span>
            <Badge
              size="sm"
              color={
                quotation.status === "Approved"
                  ? "success"
                  : quotation.status === "Pending"
                  ? "warning"
                  : "error"
              }
            >
              {quotation.status}
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-h-[calc(100vh-200px)] px-1 py-2">
        {/* Product Information */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
            Product Information
          </h3>
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-1/3">
              <div 
                className="relative w-full h-56 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer"
                onClick={() => handleImageClick(validateImageUrl(quotation.product.image))}
              >
                <Image
                  src={validateImageUrl(quotation.product.image)}
                  alt={quotation.product.name}
                  fill
                  className="object-cover"
                />
                {isPlaceholderImage(quotation.product.image) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700 bg-opacity-90 dark:bg-opacity-90">
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">No image uploaded</p>
                  </div>
                )}
              </div>
            </div>
            <div className="w-full md:w-2/3">
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Product Name</span>
                  <h4 className="text-lg font-medium text-gray-800 dark:text-white">
                    {quotation.product.name}
                  </h4>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Quantity</span>
                  <p className="text-gray-800 dark:text-gray-200">
                    {quotation.quantity}
                  </p>
                </div>
                {quotation.status === "Approved" && quotation.product.unitGrossWeight && (
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Unit Gross Weight</span>
                    <p className="text-gray-800 dark:text-gray-200">
                      {quotation.product.unitGrossWeight}
                    </p>
                  </div>
                )}
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Shipping Method</span>
                  <p className="text-gray-800 dark:text-gray-200">
                    {quotation.shippingMethod}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Destination</span>
                  <p className="text-gray-800 dark:text-gray-200">
                    {quotation.destination}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Shipping Information */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
            Shipping Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Shipping Method</span>
              <p className="text-gray-800 dark:text-gray-200">
                {quotation.shippingMethod}
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Destination</span>
              <p className="text-gray-800 dark:text-gray-200">
                {quotation.destination}
              </p>
            </div>
          </div>
        </div>

        {/* Fees Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
            Fees
          </h3>
          {isLoadingFee ? (
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-gray-500 dark:text-gray-400 text-center">Loading fee...</p>
            </div>
          ) : fee !== null ? (
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-gray-700 dark:text-gray-300 font-medium">Service Fee:</span>
                <span className="text-gray-800 dark:text-white font-semibold text-lg">
                  {formatFee(fee)}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-gray-500 dark:text-gray-400 text-center">No fee associated with this quotation</p>
            </div>
          )}
        </div>

        {/* Price Options Section */}
        {renderPriceOptionsSection()}

        {/* Selected Option Details */}
        {quotation.selected_option && (
          <div className="mt-4">
            <h5 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">Price Details</h5>
            <ul className="text-sm text-gray-700 dark:text-gray-200 space-y-1">
              <li>Price per unit: <span className="font-medium">{
                (() => {
                  let val: unknown = null;
                  if (quotation.priceOptions && quotation.selected_option) {
                    const idx = Number(quotation.selected_option) - 1;
                    if (quotation.priceOptions[idx]) {
                      // Try to get unit price from the dynamic field first
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      val = (quotation.priceOptions[idx] as any)[`unit_price_option${quotation.selected_option}`];
                      // Fallback to price field if dynamic field doesn't exist
                      if (!val) {
                        val = quotation.priceOptions[idx].price;
                      }
                    }
                  }
                  // Fallback to direct field if price is not found in priceOptions
                  if (!val && quotation.selected_option) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    val = (quotation as any)[`unit_price_option${quotation.selected_option}`];
                  }
                  const num = typeof val === 'string' ? parseFloat(val) : typeof val === 'number' ? val : NaN;
                  return !isNaN(num) ? num.toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : 'N/A';
                })()
              }</span></li>
              <li>Quantity: <span className="font-medium">{parseFloat(quotation.quantity).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span></li>
              <li>Service fees: <span className="font-medium">{
                (() => {
                  // First try to use the fetched fee from state
                  if (fee !== null && fee !== undefined) {
                    const feeNum = typeof fee === 'string' ? parseFloat(fee) : typeof fee === 'number' ? fee : NaN;
                    return !isNaN(feeNum) ? feeNum.toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : 'N/A';
                  }
                  
                  // Fallback to quotation object
                  const quotationFee: string | number | undefined = (quotation as QuotationWithFees).Quotation_fees ?? undefined;
                  const feeNum = typeof quotationFee === 'string' ? parseFloat(quotationFee) : typeof quotationFee === 'number' ? quotationFee : NaN;
                  return !isNaN(feeNum) ? feeNum.toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : 'N/A';
                })()
              }</span></li>
              <li>Total price: <span className="font-bold">{(() => {
                // Try to get unit price from priceOptions if available
                let val: unknown = null;
                if (quotation.priceOptions && quotation.selected_option) {
                  const idx = Number(quotation.selected_option) - 1;
                  if (quotation.priceOptions[idx]) {
                    // Try to get unit price from the dynamic field first
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    val = (quotation.priceOptions[idx] as any)[`unit_price_option${quotation.selected_option}`];
                    // Fallback to price field if dynamic field doesn't exist
                    if (!val) {
                      val = quotation.priceOptions[idx].price;
                    }
                  }
                }
                // Fallback to direct field
                if (!val && quotation.selected_option) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  val = (quotation as any)[`unit_price_option${quotation.selected_option}`];
                }
                const num = typeof val === 'string' ? parseFloat(val) : typeof val === 'number' ? val : 0;
                const qty = parseFloat(quotation.quantity) || 0;
                const feeVal = (() => {
                  // First try to use the fetched fee from state
                  if (fee !== null && fee !== undefined) {
                    return typeof fee === 'string' ? parseFloat(fee) : typeof fee === 'number' ? fee : 0;
                  }
                  
                  // Fallback to quotation object
                  const quotationFee: string | number | undefined = (quotation as QuotationWithFees).Quotation_fees ?? undefined;
                  return typeof quotationFee === 'string' ? parseFloat(quotationFee) : typeof quotationFee === 'number' ? quotationFee : 0;
                })();
                // If all are zero, show N/A
                if (!num && !qty && !feeVal) return 'N/A';
                return (num * qty + feeVal).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
              })()}</span></li>
            </ul>
          </div>
        )}

        {/* Action buttons */}
        <div ref={actionButtonsRef} className="mt-6 flex justify-end gap-3">
          {quotation.status === "Pending" ? (
            <Button
              variant="primary"
              disabled={!selectedOption || isSaving}
              onClick={handleAcceptQuote}
              className="bg-[#1E88E5] hover:bg-[#0D47A1] dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              {isSaving ? 'Saving...' : 'Accept Quotation'}
            </Button>
          ) : (
            <>
              {selectedOption && (!savedOption || (selectedOption !== savedOption)) && (
                <Button
                  variant="outline"
                  onClick={handleSaveSelection}
                  disabled={isSaving}
                  className={selectedOption !== String(quotation.selected_option) 
                    ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700 dark:hover:bg-yellow-900/50" 
                    : "bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"}
                >
                  {isSaving 
                    ? 'Saving...' 
                    : selectedOption !== String(quotation.selected_option) 
                      ? 'Change Selection' 
                      : 'Save Selection'}
                </Button>
              )}
              <Button
                variant="primary"
                disabled={(!selectedOption && !savedOption) || isSaving}
                onClick={handlePayNow}
                className="bg-[#1E88E5] hover:bg-[#0D47A1] dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                Pay Now
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Zoom Image Modal */}
      {zoomImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="relative max-w-3xl w-full max-h-[80vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-4 flex flex-col items-center">
            {/* Controls */}
            <ZoomImageControls
              zoomLevel={zoomLevel}
              setZoomLevel={setZoomLevel}
              onClose={() => setZoomImage(null)}
            />
            {/* Image */}
            <ZoomableImage
              src={zoomImage}
              alt="Zoomed image"
              zoomLevel={zoomLevel}
            />
          </div>
        </div>
      )}

      {/* Mock Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-3xl w-full overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Payment Options</h2>
              <button 
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1 text-gray-400 rounded-full hover:bg-gray-100 hover:text-gray-600 dark:text-white dark:hover:bg-gray-700"
              >
                <CloseIcon className="w-6 h-6" />
              </button>
            </div>
            
            <p className="mb-6 text-gray-600 dark:text-gray-300">
              Processing payment for Quotation {quotation.id} - Total: {selectedOption ? displayPriceOptions.find(opt => opt.id === selectedOption)?.price : quotation.price}
            </p>
            
            {/* Payment Methods Tabs */}
            <div className="mb-6">
              <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
                <ul className="flex flex-wrap -mb-px text-sm font-medium text-center">
                  <li className="mr-2">
                    <button className="inline-block p-4 border-b-2 border-blue-500 rounded-t-lg text-blue-500 dark:text-blue-400 dark:border-blue-400">
                      Bank Transfer
                    </button>
                  </li>
                  <li className="mr-2">
                    <button className="inline-block p-4 border-b-2 border-transparent rounded-t-lg hover:text-gray-600 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600">
                      Credit Card
                    </button>
                  </li>
                </ul>
              </div>

              <h3 className="font-medium mb-3 text-lg text-center dark:text-white">THE CLIENT MAKE PAYMENT THROUGHT</h3>
              
              {/* Bank Options */}
              <div className="space-y-6">
                {/* WISE BANK */}
                <div className="border rounded-lg overflow-hidden dark:border-gray-700">
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 flex justify-between items-center cursor-pointer">
                    <div className="flex items-center">
                      <div className="font-semibold text-black dark:text-white">WISE BANK</div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 dark:text-gray-300" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="p-4 border-t border-gray-200 dark:border-gray-600">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
                        <p className="font-medium dark:text-white">Amadour Ltd</p>
                      </div>
                      <div>
                        <button className="text-blue-500 dark:text-blue-400 ml-auto">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
                            <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">IBAN</p>
                        <p className="font-medium flex items-center dark:text-white">
                          BE24 9052 0546 8538
                          <button className="text-blue-500 dark:text-blue-400 ml-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
                              <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z" />
                            </svg>
                          </button>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Can receive EUR and other currencies</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">SWIFT/BIC</p>
                        <p className="font-medium flex items-center dark:text-white">
                          TRWIBEB1XXX
                          <button className="text-blue-500 dark:text-blue-400 ml-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
                              <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z" />
                            </svg>
                          </button>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Only used for international Swift transfers</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Bank name and address</p>
                      <p className="font-medium dark:text-white">Wise, Rue du Trône 100, 3rd floor,</p>
                      <p className="font-medium dark:text-white">Brussels, 1050, Belgium</p>
                    </div>
                  </div>
                </div>

                {/* SOCIETE GENERALE BANK */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 flex justify-between items-center cursor-pointer">
                    <div className="flex items-center">
                      <div className="font-semibold text-black dark:text-white">SOCIETE GENERALE BANK</div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="p-4 border-t border-gray-200 dark:border-gray-600">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Nom titulaire</p>
                        <p className="font-medium">AMADOUR MEHDI</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Code SWIFT</p>
                        <p className="font-medium">SGMBMAMC</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Adresse agence</p>
                        <p className="font-medium">Société générale Maroc</p>
                        <p className="font-medium">LOTISSEMENT ONA 154 BOULEVARD AL QODS AIN CHOCK</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Agence</p>
                        <p className="font-medium">AL QODS OULAD TALEB</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-1">
                      <div className="px-3 py-1 border rounded-md">
                        <p className="text-xs text-gray-500">Code banque</p>
                        <p className="font-medium text-center">022</p>
                      </div>
                      <div className="px-3 py-1 border rounded-md">
                        <p className="text-xs text-gray-500">Code ville</p>
                        <p className="font-medium text-center">780</p>
                      </div>
                      <div className="px-4 py-1 border rounded-md">
                        <p className="text-xs text-gray-500">Numéro du compte</p>
                        <p className="font-medium text-center">000359002837372</p>
                      </div>
                      <div className="px-3 py-1 border rounded-md">
                        <p className="text-xs text-gray-500">Clé RIB</p>
                        <p className="font-medium text-center">74</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Devise</p>
                      <p className="font-medium">MAD</p>
                    </div>
                  </div>
                </div>

                {/* CIH BANK */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 flex justify-between items-center cursor-pointer">
                    <div className="flex items-center">
                      <div className="font-semibold text-black dark:text-white">CIH BANK</div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="p-4 border-t border-gray-200 dark:border-gray-600">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Intitulé du compte</p>
                        <p className="font-medium">MEHDI AMADOUR</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Agence du client</p>
                        <p className="font-medium">BOUSKOURA VILLE VERTE</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Adresse de votre agence</p>
                        <p className="font-medium">PROJET BOUSKOURA GOLF CITY- IMM EP 9-CENTRE COMMERCIAL-MAGASIN 7 BOUSKOURA</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Téléphone de votre agence</p>
                        <p className="font-medium">05 22 88 61 90/93</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead>
                          <tr>
                            <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider text-center bg-gray-50 dark:bg-gray-800">R.I.B.</th>
                            <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider text-center bg-gray-50 dark:bg-gray-800">Code Banque</th>
                            <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider text-center bg-gray-50 dark:bg-gray-800">Code Ville</th>
                            <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider text-center bg-gray-50 dark:bg-gray-800">N° Compte</th>
                            <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider text-center bg-gray-50 dark:bg-gray-800">Clé RIB</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="px-4 py-2 text-sm text-center border">R.I.B.</td>
                            <td className="px-4 py-2 text-sm text-center border">230</td>
                            <td className="px-4 py-2 text-sm text-center border">791</td>
                            <td className="px-4 py-2 text-sm text-center border">4171053210312012</td>
                            <td className="px-4 py-2 text-sm text-center border">39</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3">
                      <p className="text-sm text-gray-500 dark:text-gray-400">I.B.A.N.</p>
                      <p className="font-medium">MA64 2307 9141 7105 3211 0312 0139</p>
                    </div>
                    <div className="mt-3">
                      <p className="text-sm text-gray-500 dark:text-gray-400">B.I.C / SWIFT</p>
                      <p className="font-medium">CIHMMAMCXXX</p>
                    </div>
                  </div>
                </div>

                {/* PAYONEER BANK */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 flex justify-between items-center cursor-pointer">
                    <div className="flex items-center">
                      <div className="font-semibold text-black dark:text-white">PAYONEER BANK</div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="p-4 border-t border-gray-200 dark:border-gray-600">
                    <p className="text-gray-600 dark:text-gray-400">Contact support for Payoneer bank transfer details.</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 text-sm text-gray-600 dark:text-gray-400">
                <p>After transferring the payment amount, please provide the transfer receipt to expedite order processing.</p>
                <p className="mt-2">You can also pay for multiple quotations at once through our <a href="/checkoutpage" className="text-blue-500 hover:underline">checkout page</a>.</p>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end gap-3">
              <button 
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Close
              </button>
              <button 
                onClick={() => {
                  setIsPaymentModalOpen(false);
                  onClose();
                  alert('Thank you for your order! Please complete the bank transfer to process your payment.');
                }}
                className="px-4 py-2 text-white bg-[#1E88E5] rounded-md hover:bg-[#0D47A1] dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                Mark as Paid
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default QuotationDetailsModal; 

function ZoomImageControls({ setZoomLevel, onClose }: { zoomLevel: number, setZoomLevel: React.Dispatch<React.SetStateAction<number>>, onClose: () => void }) {
  const [, setRotation] = React.useState(0);
  return (
    <div className="absolute top-4 right-4 flex gap-2 z-10">
      <button
        className="p-2 rounded-full bg-white/80 dark:bg-gray-800/80 shadow hover:bg-white dark:hover:bg-gray-700 transition"
        aria-label="Zoom in"
        onClick={() => setZoomLevel((z: number) => Math.min(z + 0.2, 3))}
      >
        <svg className="w-6 h-6 text-gray-800 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
      </button>
      <button
        className="p-2 rounded-full bg-white/80 dark:bg-gray-800/80 shadow hover:bg-white dark:hover:bg-gray-700 transition"
        aria-label="Zoom out"
        onClick={() => setZoomLevel((z: number) => Math.max(z - 0.2, 0.5))}
      >
        <svg className="w-6 h-6 text-gray-800 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
      </button>
      <button
        className="p-2 rounded-full bg-white/80 dark:bg-gray-800/80 shadow hover:bg-white dark:hover:bg-gray-700 transition"
        aria-label="Rotate"
        onClick={() => setRotation((r: number) => r + 90)}
      >
        <svg className="w-6 h-6 text-gray-800 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
      </button>
      <button
        className="p-2 rounded-full bg-white/80 dark:bg-gray-800/80 shadow hover:bg-white dark:hover:bg-gray-700 transition"
        aria-label="Close"
        onClick={onClose}
      >
        <svg className="w-6 h-6 text-gray-800 dark:text-white" fill="none" viewBox="0 0 24 24"><path fillRule="evenodd" d="M6.043 16.542a1 1 0 1 0 1.414 1.414L12 13.414l4.542 4.542a1 1 0 0 0 1.414-1.414L13.413 12l4.542-4.542a1 1 0 0 0-1.414-1.414l-4.542 4.542-4.542-4.542A1 1 0 1 0 6.043 7.46L10.585 12z" clipRule="evenodd" /></svg>
      </button>
    </div>
  );
}

function ZoomableImage({ src, alt, zoomLevel }: { src: string, alt: string, zoomLevel: number }) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  return (
    <div className="flex-1 flex items-center justify-center w-full h-full">
      {loading && !error && (
        <div className="flex items-center justify-center w-full h-full">
          <span className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></span>
        </div>
      )}
      {error && (
        <div className="flex flex-col items-center justify-center w-full h-full text-gray-400">
          <span className="text-4xl mb-2">🖼️</span>
          <span>Image failed to load</span>
        </div>
      )}
      {!error && (
        <Image
          src={src}
          alt={alt}
          width={800}
          height={600}
          className="max-w-full max-h-[70vh] object-contain transition-transform duration-200"
          style={{
            transform: `scale(${zoomLevel})`,
            display: loading ? "none" : "block",
          }}
          onLoad={() => setLoading(false)}
          onError={() => { setError(true); setLoading(false); }}
        />
      )}
    </div>
  );
} 