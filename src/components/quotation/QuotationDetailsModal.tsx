"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Modal } from "@/components/ui/modal";
import { CloseIcon } from "@/icons";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { supabase } from "@/lib/supabase";
import { QuotationData, CustomizationFile } from '@/types/quotation';
import { useAuth } from '@/context/AuthContext';

interface QuotationDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: QuotationData;
  openCheckoutModal: (quotation: QuotationData) => void;
}

type QuotationWithFees = QuotationData & { Quotation_fees?: string | number | null };

const QuotationDetailsModal: React.FC<QuotationDetailsProps> = ({ isOpen, onClose, quotation, openCheckoutModal }) => {
  const { user } = useAuth();
  const [selectedOption, setSelectedOption] = useState<string | null>(
    quotation.selected_option ? String(quotation.selected_option) : null
  );
  const [savedOption, setSavedOption] = useState<string | null>(
    quotation.selected_option ? String(quotation.selected_option) : null
  );
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const actionButtonsRef = React.useRef<HTMLDivElement>(null);
  const [fee, setFee] = useState<number | null>(null);
  const [isLoadingFee, setIsLoadingFee] = useState(false);

  // Dual pricing / customization state
  const [selectedVersion, setSelectedVersion] = useState<'stock' | 'customized'>(
    quotation.selected_version === 'customized' ? 'customized' : 'stock'
  );
  const hasCustomOption2 = !!(quotation.custom_title_option2 || quotation.custom_unit_price_option2);
  const [selectedCustomOption, setSelectedCustomOption] = useState<number | null>(
    quotation.selected_customization_option
      ?? (hasCustomOption2 ? null : (quotation.custom_title_option1 || quotation.custom_unit_price_option1 ? 1 : null))
  );
  const [custFiles, setCustFiles] = useState<CustomizationFile[]>([]);
  const [isUploadingCust, setIsUploadingCust] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!quotation.id || !quotation.is_customizable) return;
    const fetchFiles = async () => {
      const { data } = await supabase
        .from('customization_files')
        .select('*')
        .eq('quotation_id', quotation.id)
        .order('created_at', { ascending: false });
      if (data) setCustFiles(data as CustomizationFile[]);
    };
    fetchFiles();
  }, [quotation.id, quotation.is_customizable]);

  const handleVersionChange = async (version: 'stock' | 'customized') => {
    setSelectedVersion(version);
    // Clear the other version's selection locally to prevent both showing as selected
    if (version === 'stock') setSelectedCustomOption(null);
    if (version === 'customized') setSelectedOption(null);
    await supabase.from('quotations').update({ selected_version: version } as never).eq('id', quotation.id);
  };

  const handleCustomOptionSelect = async (optNum: number) => {
    setSelectedCustomOption(optNum);
    await supabase.from('quotations').update({ selected_customization_option: optNum } as never).eq('id', quotation.id);
  };

  // Auto-save selection when only 1 custom option exists
  useEffect(() => {
    if (quotation.is_customizable && !hasCustomOption2 && (quotation.custom_title_option1 || quotation.custom_unit_price_option1)) {
      if (!quotation.selected_customization_option) {
        supabase.from('quotations').update({ selected_customization_option: 1 } as never).eq('id', quotation.id);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotation.id]);

  const selectedCustomPrice = selectedCustomOption === 1
    ? quotation.custom_unit_price_option1
    : selectedCustomOption === 2
    ? quotation.custom_unit_price_option2
    : null;

  const handleCustomizationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    setIsUploadingCust(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${quotation.id}/${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('customization-files')
        .upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('customization-files').getPublicUrl(uploadData.path);
      const { data: inserted, error: insertError } = await supabase
        .from('customization_files')
        .insert({
          quotation_id: quotation.id,
          user_id: user.id,
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
        })
        .select('*')
        .single();
      if (insertError) throw insertError;
      setCustFiles(prev => [inserted as CustomizationFile, ...prev]);
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Upload failed. Please try again.');
    } finally {
      setIsUploadingCust(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteCustFile = async (file: CustomizationFile) => {
    if (!confirm(`Delete "${file.file_name}"?`)) return;
    const urlPath = file.file_url.split('/customization-files/')[1];
    await supabase.storage.from('customization-files').remove([urlPath]);
    await supabase.from('customization_files').delete().eq('id', file.id);
    setCustFiles(prev => prev.filter(f => f.id !== file.id));
  };

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
    if (quotation.is_customizable && selectedVersion === 'customized') {
      onClose();
      openCheckoutModal({ ...quotation, selected_version: 'customized', selected_customization_option: selectedCustomOption ?? undefined });
      return;
    }
    const optionToUse = savedOption || selectedOption;
    if (!optionToUse) return;
    onClose();
    openCheckoutModal(quotation);
  };



  // Check if URL is a video based on extension or content type
  const isVideoUrl = (url: string): boolean => {
    if (!url) return false;
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.flv', '.wmv'];
    const lowerUrl = url.toLowerCase();
    return videoExtensions.some(ext => lowerUrl.includes(ext)) || 
           lowerUrl.includes('video/') || 
           lowerUrl.includes('.m3u8') ||
           lowerUrl.includes('youtube.com') ||
           lowerUrl.includes('youtu.be') ||
           lowerUrl.includes('vimeo.com');
  };

  const handleMediaClick = (mediaSrc: string) => {
    const mediaType = isVideoUrl(mediaSrc) ? 'video' : 'image';
    setPreviewMedia({ url: validateImageUrl(mediaSrc), type: mediaType });
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
          {quotation.selected_option && selectedVersion !== 'customized' && (
            <div className={`mb-4 flex items-center justify-between rounded-lg px-4 py-3 ${
              selectedOption && selectedOption !== String(quotation.selected_option)
                ? 'bg-[#E3F2FD] border border-[#BBDEFB] dark:bg-blue-900/20 dark:border-blue-800'
                : 'bg-[#E3F2FD] border border-[#BBDEFB] dark:bg-blue-900/20 dark:border-blue-800'
            }`}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#0D47A1] dark:bg-blue-400 flex-shrink-0" />
                <p className="text-sm font-semibold text-[#0D47A1] dark:text-blue-300">
                  {selectedOption && selectedOption !== String(quotation.selected_option)
                    ? `Option ${quotation.selected_option} selected — switching to Option ${selectedOption}`
                    : `Option ${quotation.selected_option} selected`
                  }
                </p>
              </div>
              {selectedOption && selectedOption !== String(quotation.selected_option) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveSelection}
                  disabled={isSaving}
                  className="border-[#0D47A1] text-[#0D47A1] hover:bg-[#BBDEFB] dark:border-blue-500 dark:text-blue-300 dark:hover:bg-blue-900/40 text-xs"
                >
                  {isSaving ? 'Saving…' : 'Confirm'}
                </Button>
              )}
            </div>
          )}
          <div className="space-y-6">
            {displayPriceOptions.map((option) => {
              const isSelectedInDatabase = selectedVersion !== 'customized' && quotation.selected_option === parseInt(option.id, 10);
              const optionNum = option.id;
              // Dynamic keys for unit price and unit weight
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const rawUnitPrice = (option as any)[`unit_price_option${optionNum}`] as unknown as string | number | undefined;
              const unitPrice = (typeof rawUnitPrice === 'string' || typeof rawUnitPrice === 'number') ? rawUnitPrice : (option.price ?? 'N/A');
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const rawUnitWeight = (option as any)[`unit_weight_option${optionNum}`] as unknown as string | number | undefined;
              const unitWeight = (typeof rawUnitWeight === 'string' || typeof rawUnitWeight === 'number') ? rawUnitWeight : (option.unitWeightGrams ?? '-');
              // Gather all image fields for this option
              const extraImagesKey = `extra_images_option${optionNum}`;
              const extraImages = (option[extraImagesKey] as string[] | undefined) || [];
              const allImages = [
                option.modelImage,
                ...Object.keys(option)
                  .filter((key) => key.startsWith(`image_option${optionNum}_`) && option[key])
                  .map((key) => option[key]),
                ...extraImages
              ].filter(Boolean);
              // Remove duplicates by using Set
              const imageFields = [...new Set(allImages)];

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
                      <table className="min-w-full border-collapse mb-3 rounded-lg overflow-hidden border border-[#BBDEFB] dark:border-blue-900/40">
                        <thead>
                          <tr>
                            <th className="px-4 py-2.5 text-xs font-semibold text-[#0D47A1] uppercase tracking-wide text-center bg-[#E3F2FD] dark:bg-blue-900/20 border border-[#BBDEFB] dark:border-blue-900/40">Unit Price</th>
                            <th className="px-4 py-2.5 text-xs font-semibold text-[#0D47A1] uppercase tracking-wide text-center bg-[#E3F2FD] dark:bg-blue-900/20 border border-[#BBDEFB] dark:border-blue-900/40">Unit Weight (g)</th>
                            <th className="px-4 py-2.5 text-xs font-semibold text-[#0D47A1] uppercase tracking-wide text-center bg-[#E3F2FD] dark:bg-blue-900/20 border border-[#BBDEFB] dark:border-blue-900/40">Images</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="px-4 py-2.5 text-sm text-center border border-[#BBDEFB] dark:border-blue-900/40 font-bold text-[#0D47A1] dark:text-blue-300">${unitPrice}</td>
                            <td className="px-4 py-2.5 text-sm text-center border border-[#BBDEFB] dark:border-blue-900/40 text-gray-800 dark:text-white">{unitWeight}</td>
                            <td className="px-4 py-2.5 text-sm text-center border border-[#BBDEFB] dark:border-blue-900/40">
                              <div className="flex flex-wrap gap-2 justify-center">
                                {imageFields.length > 0 ? (
                                  imageFields.map((img, idx) => (
                                    <div key={idx} className="relative w-16 h-16 rounded overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer group" onClick={() => handleMediaClick(img as string)}>
                                      {isVideoUrl(img as string) ? (
                                        <>
                                          <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                                            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                                              <path d="M8 5v14l11-7z"/>
                                            </svg>
                                          </div>
                                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 text-center">
                                            Video
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          <Image
                                            src={validateImageUrl(img as string)}
                                            alt={`Option Media ${idx+1}`}
                                            fill
                                            className="object-cover"
                                          />
                                          {isPlaceholderImage(img as string) && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700 bg-opacity-90 dark:bg-opacity-90">
                                              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">No image</p>
                                            </div>
                                          )}
                                        </>
                                      )}
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
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
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <div className="flex items-start gap-3 mb-3">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-red-700 dark:text-red-400 font-semibold text-base">Quotation Rejected</p>
              {quotation.rejection_reason ? (
                <div className="mt-2">
                  <p className="text-sm text-red-600 dark:text-red-500 font-medium mb-1">Reason from administrator:</p>
                  <p className="text-sm text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 rounded-md px-3 py-2 leading-relaxed">
                    {quotation.rejection_reason}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-red-600 dark:text-red-500 mt-1">Please contact customer support for more information.</p>
              )}
            </div>
          </div>
        </div>
      );
    }
    
    return null;
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      showCloseButton={false}
      className="max-w-4xl mx-auto"
    >
      <div className="flex flex-col h-full max-h-[85vh]">
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 pb-4 border-b border-[#BBDEFB] dark:border-blue-900/40 flex-shrink-0 bg-[#E3F2FD] dark:bg-blue-900/20">
          <div className="flex-1">
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
          <button
            onClick={onClose}
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
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 min-h-0 space-y-5">

        {/* Product Information */}
        <div className="rounded-xl border border-[#BBDEFB] dark:border-blue-900/40 overflow-hidden">
          <div className="px-4 py-3 bg-[#E3F2FD] dark:bg-blue-900/20 border-b border-[#BBDEFB] dark:border-blue-900/40">
            <h3 className="text-sm font-semibold text-[#0D47A1] dark:text-blue-300 uppercase tracking-wide">Product Information</h3>
          </div>
          <div className="p-4 bg-white dark:bg-gray-800">
          <div className="flex flex-col md:flex-row gap-5">
            <div className="w-full md:w-1/3">
              <div
                className="relative w-full h-52 rounded-lg overflow-hidden border border-[#BBDEFB] dark:border-blue-900/40 cursor-pointer group"
                onClick={() => handleMediaClick(quotation.product.image)}
              >
                {isVideoUrl(quotation.product.image) ? (
                  <>
                    <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                      <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-3 py-2 text-center">Click to preview video</div>
                  </>
                ) : (
                  <>
                    <Image src={validateImageUrl(quotation.product.image)} alt={quotation.product.name} fill className="object-cover"/>
                    {isPlaceholderImage(quotation.product.image) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-[#E3F2FD] dark:bg-blue-900/20">
                        <p className="text-[#0D47A1]/60 text-sm font-medium">No image uploaded</p>
                      </div>
                    )}
                  </>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              </div>
            </div>
            <div className="w-full md:w-2/3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 pb-2 border-b border-[#E3F2FD] dark:border-blue-900/30">
                  <span className="text-xs font-medium text-[#0D47A1]/60 dark:text-blue-400/60 uppercase tracking-wide">Product Name</span>
                  <h4 className="text-base font-semibold text-[#0D47A1] dark:text-blue-200 mt-0.5">{quotation.product.name}</h4>
                </div>
                <div>
                  <span className="text-xs font-medium text-[#0D47A1]/60 dark:text-blue-400/60 uppercase tracking-wide">Quantity</span>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{quotation.quantity}</p>
                </div>
                {quotation.status === "Approved" && quotation.product.unitGrossWeight && (
                  <div>
                    <span className="text-xs font-medium text-[#0D47A1]/60 dark:text-blue-400/60 uppercase tracking-wide">Unit Weight</span>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{quotation.product.unitGrossWeight}</p>
                  </div>
                )}
                <div>
                  <span className="text-xs font-medium text-[#0D47A1]/60 dark:text-blue-400/60 uppercase tracking-wide">Shipping</span>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{quotation.shippingMethod}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-[#0D47A1]/60 dark:text-blue-400/60 uppercase tracking-wide">Destination</span>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{quotation.destination}</p>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* Receiver Information */}
        {(quotation.receiver_name || quotation.receiver_phone || quotation.receiver_address) && (
          <div className="rounded-xl border border-[#BBDEFB] dark:border-blue-900/40 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-[#E3F2FD] dark:bg-blue-900/20 border-b border-[#BBDEFB] dark:border-blue-900/40">
              <svg className="w-4 h-4 text-[#0D47A1]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              <h3 className="text-sm font-semibold text-[#0D47A1] dark:text-blue-300 uppercase tracking-wide">Receiver Information</h3>
            </div>
            <div className="p-4 bg-white dark:bg-gray-800">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <span className="text-xs font-medium text-[#0D47A1]/60 dark:text-blue-400/60 uppercase tracking-wide">Receiver Name</span>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{quotation.receiver_name || "—"}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-[#0D47A1]/60 dark:text-blue-400/60 uppercase tracking-wide">Phone Number</span>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{quotation.receiver_phone || "—"}</p>
                </div>
                <div className="md:col-span-2">
                  <span className="text-xs font-medium text-[#0D47A1]/60 dark:text-blue-400/60 uppercase tracking-wide">Delivery Address</span>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-0.5 whitespace-pre-line">{quotation.receiver_address || "—"}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dual Pricing + Customization */}
        {quotation.is_customizable && (
          <div className="rounded-xl border border-[#BBDEFB] dark:border-blue-900/40 overflow-hidden">
            <div className="px-4 py-3 bg-[#E3F2FD] dark:bg-blue-900/20 border-b border-[#BBDEFB]">
              <h3 className="text-xs font-semibold text-[#0D47A1] dark:text-blue-300 uppercase tracking-wide">Product Version</h3>
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 space-y-4">
              {/* Version toggle */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleVersionChange('stock')}
                  className={`flex flex-col items-center px-4 py-3 rounded-xl border-2 transition-all ${
                    selectedVersion === 'stock'
                      ? 'border-[#0D47A1] bg-[#E3F2FD] dark:bg-blue-900/20'
                      : 'border-[#BBDEFB] hover:border-[#0D47A1]/40'
                  }`}
                >
                  <svg className={`w-5 h-5 mb-1 ${selectedVersion === 'stock' ? 'text-[#0D47A1]' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <span className={`text-sm font-semibold ${selectedVersion === 'stock' ? 'text-[#0D47A1]' : 'text-gray-600'}`}>Stock</span>
                  <span className="text-xs text-gray-400 mt-0.5">Standard product</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleVersionChange('customized')}
                  className={`flex flex-col items-center px-4 py-3 rounded-xl border-2 transition-all ${
                    selectedVersion === 'customized'
                      ? 'border-[#0D47A1] bg-[#E3F2FD] dark:bg-blue-900/20'
                      : 'border-[#BBDEFB] hover:border-[#0D47A1]/40'
                  }`}
                >
                  <svg className={`w-5 h-5 mb-1 ${selectedVersion === 'customized' ? 'text-[#0D47A1]' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span className={`text-sm font-semibold ${selectedVersion === 'customized' ? 'text-[#0D47A1]' : 'text-gray-600'}`}>Customized</span>
                  {quotation.customization_price ? (
                    <div className="text-center mt-0.5">
                      <span className="text-xs font-bold text-[#0D47A1]">${quotation.customization_price} / unit</span>
                      <span className="block text-xs text-[#0D47A1]/60">
                        × {parseFloat(quotation.quantity)} = <span className="font-bold">${(quotation.customization_price * parseFloat(quotation.quantity)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 mt-0.5">Custom version</span>
                  )}
                </button>
              </div>

              {/* Version description */}
              {selectedVersion === 'customized' && (
                <p className="text-xs text-[#0D47A1]/50 text-center">Select a customized price option below</p>
              )}
            </div>
          </div>
        )}

        {/* Customized Options — select one of 2 custom options */}
        {quotation.is_customizable && selectedVersion === 'customized' ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-[#BBDEFB] overflow-hidden">
              <div className="px-4 py-3 bg-[#E3F2FD] border-b border-[#BBDEFB]">
                <h3 className="text-xs font-semibold text-[#0D47A1] uppercase tracking-wide">
                  {hasCustomOption2 ? 'Select Customized Option' : 'Customized Option'}
                </h3>
              </div>
              <div className="p-3 space-y-2">
                {([1, 2] as const).map(optNum => {
                  const title = quotation[`custom_title_option${optNum}`];
                  const price = quotation[`custom_unit_price_option${optNum}`];
                  const weight = quotation[`custom_unit_weight_option${optNum}`];
                  const delivery = quotation[`custom_delivery_option${optNum}`];
                  const description = quotation[`custom_description_option${optNum}`];
                  const images = (quotation[`custom_images_option${optNum}`] as string[]) || [];
                  if (!title && !price) return null;
                  const isSelected = selectedVersion === 'customized' && selectedCustomOption === optNum;
                  const qty = parseFloat(quotation.quantity || '1');
                  return (
                    <div
                      key={optNum}
                      className={`p-4 border rounded-lg transition-all ${isSelected ? 'border-[#1E88E5] bg-blue-50 dark:bg-blue-900/10' : 'border-gray-200 hover:border-[#1E88E5] dark:border-gray-700'}`}
                    >
                      {/* Option title row */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold flex-shrink-0 ${isSelected ? 'bg-[#0D47A1] text-white' : 'bg-[#BBDEFB] text-[#0D47A1]'}`}>C{optNum}</span>
                          <h4 className="font-medium text-gray-800 dark:text-white">{title || `Custom Option ${optNum}`}</h4>
                          {isSelected && <span className="ml-1 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full dark:bg-green-900/30 dark:text-green-400">Selected</span>}
                        </div>
                      </div>

                      {/* Table — same style as stock price options */}
                      <table className="min-w-full border-collapse mb-3 rounded-lg overflow-hidden border border-[#BBDEFB] dark:border-blue-900/40">
                        <thead>
                          <tr>
                            <th className="px-4 py-2.5 text-xs font-semibold text-[#0D47A1] uppercase tracking-wide text-center bg-[#E3F2FD] dark:bg-blue-900/20 border border-[#BBDEFB] dark:border-blue-900/40">Unit Price</th>
                            <th className="px-4 py-2.5 text-xs font-semibold text-[#0D47A1] uppercase tracking-wide text-center bg-[#E3F2FD] dark:bg-blue-900/20 border border-[#BBDEFB] dark:border-blue-900/40">Unit Weight (g)</th>
                            <th className="px-4 py-2.5 text-xs font-semibold text-[#0D47A1] uppercase tracking-wide text-center bg-[#E3F2FD] dark:bg-blue-900/20 border border-[#BBDEFB] dark:border-blue-900/40">Est. Delivery</th>
                            <th className="px-4 py-2.5 text-xs font-semibold text-[#0D47A1] uppercase tracking-wide text-center bg-[#E3F2FD] dark:bg-blue-900/20 border border-[#BBDEFB] dark:border-blue-900/40">Images</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="px-4 py-2.5 text-sm text-center border border-[#BBDEFB] dark:border-blue-900/40 font-bold text-[#0D47A1] dark:text-blue-300">
                              {price ? `$${Number(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-center border border-[#BBDEFB] dark:border-blue-900/40 text-gray-800 dark:text-white">
                              {weight ? `${weight}` : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-center border border-[#BBDEFB] dark:border-blue-900/40 text-gray-800 dark:text-white">
                              {delivery || '—'}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-center border border-[#BBDEFB] dark:border-blue-900/40">
                              <div className="flex flex-wrap gap-2 justify-center">
                                {images.length > 0 ? images.map((imgUrl, imgIdx) => (
                                  <div
                                    key={imgIdx}
                                    className="relative w-16 h-16 rounded overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer group"
                                    onClick={() => setPreviewMedia({ url: imgUrl, type: 'image' })}
                                  >
                                    <Image src={imgUrl} alt={`Custom ${optNum} img ${imgIdx + 1}`} fill className="object-cover" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                      <svg className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/>
                                      </svg>
                                    </div>
                                  </div>
                                )) : <span className="text-gray-400 text-xs">No images</span>}
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>

                      {/* Description */}
                      {description && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{description}</p>
                      )}

                      {/* Total + Select button */}
                      <div className="flex items-center justify-between">
                        {price && (
                          <p className="text-sm text-[#0D47A1]/60">
                            Total: <span className="font-bold text-[#0D47A1]">${(Number(price) * qty).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <span className="text-xs ml-1">({qty} units)</span>
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCustomOptionSelect(optNum)}
                          className={`ml-auto px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                            isSelected
                              ? 'bg-[#0D47A1] text-white cursor-default'
                              : 'bg-[#E3F2FD] text-[#0D47A1] border border-[#BBDEFB] hover:bg-[#0D47A1] hover:text-white'
                          }`}
                        >
                          {isSelected ? '✓ Selected' : 'Select'}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {!quotation.custom_title_option1 && !quotation.custom_unit_price_option1 && !quotation.custom_title_option2 && !quotation.custom_unit_price_option2 && (
                  <p className="text-xs text-center text-[#0D47A1]/40 py-4">No customized options configured yet</p>
                )}
              </div>
            </div>

            {/* Customization Files — shown after option is selected */}
            {selectedCustomOption && (
              <div className="rounded-xl border border-[#BBDEFB] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-[#E3F2FD] border-b border-[#BBDEFB]">
                  <div>
                    <h3 className="text-xs font-semibold text-[#0D47A1] uppercase tracking-wide">
                      Customization Files
                      {custFiles.length === 0 && <span className="ml-2 text-red-500 normal-case">*required before paying</span>}
                    </h3>
                    <p className="text-xs text-[#0D47A1]/50 mt-0.5">PDF, images, video, ZIP — max 50 MB</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingCust}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0D47A1] text-white text-xs font-medium hover:bg-[#1565C0] disabled:opacity-60 transition-colors"
                  >
                    {isUploadingCust ? (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                      </svg>
                    )}
                    {isUploadingCust ? 'Uploading…' : 'Upload File'}
                  </button>
                  <input ref={fileInputRef} type="file" className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.webm,.zip"
                    onChange={handleCustomizationUpload} />
                </div>
                <div className="p-3 bg-white space-y-2">
                  {custFiles.length > 0 ? custFiles.map(file => (
                    <div key={file.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-[#BBDEFB] bg-[#E3F2FD]/40">
                      <div className="flex items-center gap-2 min-w-0">
                        <svg className="w-4 h-4 text-[#0D47A1] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                        </svg>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[#0D47A1] truncate">{file.file_name}</p>
                          <p className="text-xs text-[#0D47A1]/50">{file.file_size ? `${(file.file_size / 1024).toFixed(0)} KB` : ''}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => handleDeleteCustFile(file)}
                        className="flex-shrink-0 p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </div>
                  )) : (
                    <div className="text-center py-4 border border-dashed border-[#BBDEFB] rounded-lg bg-[#E3F2FD]/30">
                      <p className="text-xs text-[#0D47A1]/40">No files uploaded yet — upload your specs before paying</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Price Summary for selected custom option */}
            {selectedCustomOption && selectedCustomPrice && (
              <div className="rounded-xl border border-[#BBDEFB] overflow-hidden">
                <div className="px-4 py-3 bg-[#0D47A1]">
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wide">Price Summary — Custom Option {selectedCustomOption}</h3>
                </div>
                <div className="bg-white divide-y divide-[#E3F2FD]">
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-xs font-medium text-[#0D47A1]/60 uppercase tracking-wide">Unit Price</span>
                    <span className="text-sm font-semibold text-gray-800">${Number(selectedCustomPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-xs font-medium text-[#0D47A1]/60 uppercase tracking-wide">Quantity</span>
                    <span className="text-sm font-semibold text-gray-800">{parseFloat(quotation.quantity || '1').toLocaleString()} units</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 bg-[#E3F2FD]">
                    <span className="text-sm font-bold text-[#0D47A1] uppercase tracking-wide">Total</span>
                    <span className="text-base font-bold text-[#0D47A1]">${(Number(selectedCustomPrice) * parseFloat(quotation.quantity || '1')).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          renderPriceOptionsSection()
        )}

        {/* Selected Option Details — fee integrated here */}
        {quotation.selected_option && selectedVersion !== 'customized' && (
          <div className="rounded-xl border border-[#BBDEFB] dark:border-blue-900/40 overflow-hidden">
            <div className="px-4 py-3 bg-[#0D47A1] dark:bg-blue-900/50">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wide">Price Summary</h3>
            </div>
            <div className="bg-white dark:bg-gray-800">
              {/* Price per unit row */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#E3F2FD] dark:border-blue-900/30">
                <span className="text-xs font-medium text-[#0D47A1]/60 dark:text-blue-400/60 uppercase tracking-wide">Price / Unit</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{
                  (() => {
                    let val: unknown = null;
                    if (quotation.priceOptions && quotation.selected_option) {
                      const idx = Number(quotation.selected_option) - 1;
                      if (quotation.priceOptions[idx]) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        val = (quotation.priceOptions[idx] as any)[`unit_price_option${quotation.selected_option}`];
                        if (!val) val = quotation.priceOptions[idx].price;
                      }
                    }
                    if (!val && quotation.selected_option) {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      val = (quotation as any)[`unit_price_option${quotation.selected_option}`];
                    }
                    const num = typeof val === 'string' ? parseFloat(val) : typeof val === 'number' ? val : NaN;
                    return !isNaN(num) ? num.toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : 'N/A';
                  })()
                }</span>
              </div>
              {/* Quantity row */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#E3F2FD] dark:border-blue-900/30">
                <span className="text-xs font-medium text-[#0D47A1]/60 dark:text-blue-400/60 uppercase tracking-wide">Quantity</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{parseFloat(quotation.quantity).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
              </div>
              {/* Service fee row — only show when a real fee exists */}
              {(() => {
                let feeNum = NaN;
                if (fee !== null && fee !== undefined) {
                  feeNum = typeof fee === 'string' ? parseFloat(fee) : typeof fee === 'number' ? fee : NaN;
                } else {
                  const qf: string | number | undefined = (quotation as QuotationWithFees).Quotation_fees ?? undefined;
                  feeNum = typeof qf === 'string' ? parseFloat(qf) : typeof qf === 'number' ? qf : NaN;
                }
                if (isNaN(feeNum)) return null;
                return (
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#E3F2FD] dark:border-blue-900/30">
                    <span className="text-xs font-medium text-[#0D47A1]/60 dark:text-blue-400/60 uppercase tracking-wide">Service Fee</span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {feeNum.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                    </span>
                  </div>
                );
              })()}
              {/* Total row — highlighted */}
              <div className="flex items-center justify-between px-4 py-3 bg-[#E3F2FD] dark:bg-blue-900/20">
                <span className="text-sm font-bold text-[#0D47A1] dark:text-blue-300 uppercase tracking-wide">Total</span>
                <span className="text-base font-bold text-[#0D47A1] dark:text-blue-200">{
                  (() => {
                    let val: unknown = null;
                    if (quotation.priceOptions && quotation.selected_option) {
                      const idx = Number(quotation.selected_option) - 1;
                      if (quotation.priceOptions[idx]) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        val = (quotation.priceOptions[idx] as any)[`unit_price_option${quotation.selected_option}`];
                        if (!val) val = quotation.priceOptions[idx].price;
                      }
                    }
                    if (!val && quotation.selected_option) {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      val = (quotation as any)[`unit_price_option${quotation.selected_option}`];
                    }
                    const num = typeof val === 'string' ? parseFloat(val) : typeof val === 'number' ? val : 0;
                    const qty = parseFloat(quotation.quantity) || 0;
                    const feeVal = (() => {
                      if (fee !== null && fee !== undefined) return typeof fee === 'string' ? parseFloat(fee) : typeof fee === 'number' ? fee : 0;
                      const qf: string | number | undefined = (quotation as QuotationWithFees).Quotation_fees ?? undefined;
                      return typeof qf === 'string' ? parseFloat(qf) : typeof qf === 'number' ? qf : 0;
                    })();
                    if (!num && !qty && !feeVal) return 'N/A';
                    return (num * qty + feeVal).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
                  })()
                }</span>
              </div>
            </div>
          </div>
        )}

        </div>

        {/* Fixed Footer with Action buttons */}
        <div ref={actionButtonsRef} className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 flex-shrink-0 bg-white dark:bg-gray-800">
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
              {/* Hide Change/Save Selection when customized version is active */}
              {!(quotation.is_customizable && selectedVersion === 'customized') &&
                selectedOption && (!savedOption || (selectedOption !== savedOption)) && (
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
                disabled={
                  isSaving || (
                    quotation.is_customizable && selectedVersion === 'customized'
                      ? !selectedCustomOption  // customized: needs a custom option selected
                      : !selectedOption && !savedOption  // stock: needs a selected option
                  )
                }
                onClick={handlePayNow}
                className="bg-[#1E88E5] hover:bg-[#0D47A1] dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                Pay Now
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Media Preview Modal */}
      {previewMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={() => setPreviewMedia(null)}>
          <div className="relative max-w-5xl w-full max-h-[90vh] bg-black rounded-2xl shadow-2xl p-4 flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {/* Controls */}
            <MediaPreviewControls
              setZoomLevel={setZoomLevel}
              onClose={() => setPreviewMedia(null)}
              mediaType={previewMedia.type}
            />
            {/* Media Content */}
            {previewMedia.type === 'image' ? (
              <ZoomableImage
                src={previewMedia.url}
                alt="Preview"
                zoomLevel={zoomLevel}
              />
            ) : (
              <VideoPreview
                src={previewMedia.url}
              />
            )}
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

function MediaPreviewControls({ 
  setZoomLevel, 
  onClose, 
  mediaType 
}: { 
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>; 
  onClose: () => void;
  mediaType: 'image' | 'video';
}) {
  return (
    <div className="absolute top-4 right-4 flex gap-2 z-10">
      {mediaType === 'image' && (
        <>
          <button
            className="p-2 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-lg hover:bg-white dark:hover:bg-gray-700 transition"
            aria-label="Zoom in"
            onClick={(e) => {
              e.stopPropagation();
              setZoomLevel((z: number) => Math.min(z + 0.2, 3));
            }}
          >
            <svg className="w-6 h-6 text-gray-800 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          </button>
          <button
            className="p-2 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-lg hover:bg-white dark:hover:bg-gray-700 transition"
            aria-label="Zoom out"
            onClick={(e) => {
              e.stopPropagation();
              setZoomLevel((z: number) => Math.max(z - 0.2, 0.5));
            }}
          >
            <svg className="w-6 h-6 text-gray-800 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
          </button>
        </>
      )}
      <button
        className="p-2 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-lg hover:bg-white dark:hover:bg-gray-700 transition"
        aria-label="Close"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24"><path fillRule="evenodd" fill="black" d="M6.043 16.542a1 1 0 1 0 1.414 1.414L12 13.414l4.542 4.542a1 1 0 0 0 1.414-1.414L13.413 12l4.542-4.542a1 1 0 0 0-1.414-1.414l-4.542 4.542-4.542-4.542A1 1 0 1 0 6.043 7.46L10.585 12z" clipRule="evenodd" /></svg>
      </button>
    </div>
  );
}

function ZoomableImage({ src, alt, zoomLevel }: { src: string, alt: string, zoomLevel: number }) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  return (
    <div className="flex-1 flex items-center justify-center w-full h-full min-h-[400px]">
      {loading && !error && (
        <div className="flex items-center justify-center w-full h-full">
          <span className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></span>
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
          width={1200}
          height={800}
          className="max-w-full max-h-[80vh] object-contain transition-transform duration-200"
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

function VideoPreview({ src }: { src: string }) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  return (
    <div className="flex-1 flex items-center justify-center w-full h-full min-h-[400px]">
      {loading && !error && (
        <div className="flex items-center justify-center w-full h-full">
          <span className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></span>
        </div>
      )}
      {error && (
        <div className="flex flex-col items-center justify-center w-full h-full text-gray-400">
          <span className="text-4xl mb-2">🎥</span>
          <span>Video failed to load</span>
        </div>
      )}
      {!error && (
        <video
          ref={videoRef}
          src={src}
          controls
          className="max-w-full max-h-[80vh] w-auto h-auto"
          onLoadedData={() => setLoading(false)}
          onError={() => { setError(true); setLoading(false); }}
          preload="metadata"
        >
          Your browser does not support the video tag.
        </video>
      )}
    </div>
  );
} 