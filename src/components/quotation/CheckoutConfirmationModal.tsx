import React, { useState, useEffect } from 'react';
import { Modal } from "@/components/ui/modal";
import Image from "next/image";
import { QuotationData as BaseQuotationData, PriceOption } from '@/types/quotation';
import BankInformation from './BankInformation';
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuth } from '@/context/AuthContext';

type BankType = 'WISE' | 'PAYONEER' | 'BINANCE';

// Define interface for global window object extension
interface PaymentInfo {
  reference: string;
  method: BankType;
  amount: number;
  quotation_id: string;
  timestamp: string;
}

// Extend the Window interface
declare global {
  interface Window {
    lastSelectedPaymentMethod?: BankType;
    lastPaymentInfo?: PaymentInfo;
  }
}

// Define a type for quotation with Quotation_fees
interface QuotationWithFees extends BaseQuotationData {
  Quotation_fees?: string | number;
}

interface CheckoutConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (paymentMethod?: string) => void;
  quotation: QuotationWithFees;
}

// Add a helper to get numeric value from a price string or number
function parseNumeric(val: string | number | null | undefined): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val.replace(/[^0-9.-]+/g, ''));
  return 0;
}

const CheckoutConfirmationModal: React.FC<CheckoutConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  quotation
}) => {
  const auth = useAuth();
  const [selectedBank, setSelectedBank] = useState<BankType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPriceOption, setSelectedPriceOption] = useState<PriceOption | null>(null);
  const [isUpdatingOption, setIsUpdatingOption] = useState(false);
  const [quotationUuid, setQuotationUuid] = useState<string | null>(null);
  const [priceOptions, setPriceOptions] = useState<PriceOption[]>(quotation.priceOptions || []);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [quotationFees, setQuotationFees] = useState<number | null>(null);
  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  
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

  const handleMediaClick = (e: React.MouseEvent, mediaSrc: string) => {
    e.stopPropagation();
    const mediaType = isVideoUrl(mediaSrc) ? 'video' : 'image';
    setPreviewMedia({ url: mediaSrc, type: mediaType });
    setZoomLevel(1);
  };
  
  useEffect(() => {
    console.log('Quotation in modal:', quotation);
  }, [quotation]);
  
  useEffect(() => {
    console.log("Quotation object:", quotation);
    
    const handleGlobalError = (event: ErrorEvent) => {
      event.preventDefault();
      console.error("Globally caught error:", event.error || event.message);
      return true;
    };
    
    window.addEventListener('error', handleGlobalError);
    
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      console.error("Unhandled promise rejection:", event.reason);
      return true;
    };
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    const fetchQuotationData = async () => {
      try {
        if (!quotation.quotation_id) return;
        
        setIsLoadingOptions(true);
        
        const { data, error } = await supabase
          .from('quotations')
          .select('id, title_option1, title_option2, title_option3, total_price_option1, total_price_option2, total_price_option3, delivery_time_option1, delivery_time_option2, delivery_time_option3, description_option1, description_option2, description_option3, extra_images_option1, extra_images_option2, extra_images_option3, selected_option, Quotation_fees')
          .eq('quotation_id', quotation.quotation_id)
          .single();
          
        if (error) {
          console.error("Error fetching quotation data:", error);
          setIsLoadingOptions(false);
          return;
        }
        
        if (data) {
          console.log("Full quotation data from database:", data);
          setQuotationUuid(data.id);
          if (data.Quotation_fees !== undefined) {
            (quotation as QuotationWithFees).Quotation_fees = data.Quotation_fees;
            let fee = data.Quotation_fees;
            if (typeof fee === 'string') fee = parseFloat(fee);
            if (typeof fee === 'number' && !isNaN(fee)) setQuotationFees(fee);
            else setQuotationFees(null);
          } else {
            setQuotationFees(null);
          }
          
          const fullPriceOptions: PriceOption[] = [];
          
          if (data.title_option1) {
            const extraImages1 = data.extra_images_option1 || [];
            fullPriceOptions.push({
              id: '1',
              price: data.total_price_option1 ? `$${parseFloat(data.total_price_option1).toLocaleString()}` : 'N/A',
              supplier: data.title_option1,
              deliveryTime: data.delivery_time_option1 || 'N/A',
              description: data.description_option1,
              modelName: data.title_option1,
              modelImage: (extraImages1.length > 0 ? extraImages1[0] : null) || "/images/product/product-01.jpg",
              extra_images_option1: extraImages1
            });
          }
          
          if (data.title_option2) {
            const extraImages2 = data.extra_images_option2 || [];
            fullPriceOptions.push({
              id: '2',
              price: data.total_price_option2 ? `$${parseFloat(data.total_price_option2).toLocaleString()}` : 'N/A',
              supplier: data.title_option2,
              deliveryTime: data.delivery_time_option2 || 'N/A',
              description: data.description_option2,
              modelName: data.title_option2,
              modelImage: (extraImages2.length > 0 ? extraImages2[0] : null) || "/images/product/product-01.jpg",
              extra_images_option2: extraImages2
            });
          }
          
          if (data.title_option3) {
            const extraImages3 = data.extra_images_option3 || [];
            fullPriceOptions.push({
              id: '3',
              price: data.total_price_option3 ? `$${parseFloat(data.total_price_option3).toLocaleString()}` : 'N/A',
              supplier: data.title_option3,
              deliveryTime: data.delivery_time_option3 || 'N/A',
              description: data.description_option3,
              modelName: data.title_option3,
              modelImage: (extraImages3.length > 0 ? extraImages3[0] : null) || "/images/product/product-01.jpg",
              extra_images_option3: extraImages3
            });
          }
          
          if (fullPriceOptions.length > (quotation.priceOptions?.length || 0)) {
            console.log("Setting full price options:", fullPriceOptions);
            setPriceOptions(fullPriceOptions);
            
            if (data.selected_option && data.selected_option > 0 && data.selected_option <= fullPriceOptions.length) {
              setSelectedPriceOption(fullPriceOptions[data.selected_option - 1]);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch quotation data:", err);
      } finally {
        setIsLoadingOptions(false);
      }
    };
    
    fetchQuotationData();
    
    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [quotation]);
  
  useEffect(() => {
    if (quotation.priceOptions?.length && quotation.selected_option) {
      const optionIndex = quotation.selected_option - 1;
      if (optionIndex >= 0 && optionIndex < quotation.priceOptions.length) {
        setSelectedPriceOption(quotation.priceOptions[optionIndex]);
      }
    }
  }, [quotation.priceOptions, quotation.selected_option]);

  useEffect(() => {
    const patchParentComponentError = () => {
      try {
        const safeHandleCheckoutConfirm = (originalFn: (...args: unknown[]) => unknown) => {
          return function patched(this: unknown, ...args: unknown[]) {
            try {
              if (!args[0] && window.lastSelectedPaymentMethod) {
                console.log('PATCH: Injecting payment method from window:', window.lastSelectedPaymentMethod);
                args[0] = window.lastSelectedPaymentMethod;
              }
              
              const fnStr = originalFn.toString();
              if (fnStr.includes("!paymentMethod") || fnStr.includes("No payment method selected")) {
                console.log('PATCH: Found target function with payment method check');
                (window as Window & typeof globalThis & { __paymentMethod: unknown }).__paymentMethod = window.lastSelectedPaymentMethod;
              }
              
              return originalFn.apply(this, args);
            } catch (e) {
              console.error('Error in patched function:', e);
              return null;
            }
          };
        };
        
        if (window.parent) {
          console.log('Attempting to patch parent window');
          const parentWindow = window.parent as Window & typeof globalThis & { __safeHandleCheckoutConfirm: unknown };
          parentWindow.__safeHandleCheckoutConfirm = safeHandleCheckoutConfirm;
        }
      } catch (e) {
        console.error('Error in patch function:', e);
      }
    };
    
    patchParentComponentError();
    
    try {
      const globalWindow = window as Window & typeof globalThis & { paymentMethod: BankType | null };
      globalWindow.paymentMethod = selectedBank;
      console.log('Created global paymentMethod backup:', selectedBank);
    } catch (e) {
      console.error('Failed to create global backup:', e);
    }
  }, [selectedBank]);

  const getTotalToPay = () => {
    if (!selectedPriceOption) return 0;
    const optionNum = selectedPriceOption.id;
    const rawUnitPrice = selectedPriceOption[`unit_price_option${optionNum}`];
    const unitPrice = (typeof rawUnitPrice === 'string' || typeof rawUnitPrice === 'number' || rawUnitPrice == null)
      ? parseNumeric(rawUnitPrice)
      : 0;
    const quantity = parseNumeric(quotation.quantity);
    let serviceFee = 0;
    if ((quotation as QuotationWithFees)?.Quotation_fees) {
      serviceFee = parseNumeric((quotation as QuotationWithFees).Quotation_fees);
    }
    if (!serviceFee && selectedPriceOption.serviceFee) {
      const rawServiceFee = selectedPriceOption.serviceFee;
      serviceFee = (typeof rawServiceFee === 'string' || typeof rawServiceFee === 'number' || rawServiceFee == null)
        ? parseNumeric(rawServiceFee)
        : 0;
    }
    return unitPrice * quantity + serviceFee;
  };

  if (!priceOptions.length) {
    return (
      <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        showCloseButton={true} 
        className="max-w-md mx-auto"
      >
        <div className="p-6 text-center">
          {isLoadingOptions ? (
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-gray-700">Loading price options...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <p className="mt-4 text-lg font-medium text-gray-700">No price options available</p>
              <p className="mt-2 text-gray-500">This quotation doesn&apos;t have any price options defined.</p>
              <button
                onClick={onClose}
                className="mt-6 px-5 py-2 bg-[#1E88E5] text-white rounded-lg hover:bg-[#1976D2] transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </Modal>
    );
  }

  const handlePriceOptionSelect = async (option: PriceOption, optionIndex: number) => {
    if (isUpdatingOption || !quotationUuid) return;
    
    setIsUpdatingOption(true);
    try {
      console.log(`Updating selected_option to ${optionIndex + 1} for quotation ${quotationUuid}`);
      
      const { error: updateError } = await supabase
        .from('quotations')
        .update({ 
          selected_option: optionIndex + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', quotationUuid);

      if (updateError) {
        throw new Error(`Failed to update selected option: ${updateError.message}`);
      }

      setSelectedPriceOption(option);
      toast.success('Price option selected successfully');
    } catch (error) {
      console.error('Error updating selected option:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update selected option');
    } finally {
      setIsUpdatingOption(false);
    }
  };

  const handleDirectPayment = async (): Promise<void> => {
    if (!auth?.user?.id) {
      console.error('No authenticated user found');
      setErrorMessage('Authentication error. Please log in again.');
      setIsLoading(false);
      setIsProcessing(false);
      return;
    }
    
    if (!quotationUuid || !selectedBank || !selectedPriceOption) {
      toast.error("Missing required information");
      setErrorMessage('Please select a payment option and bank before proceeding.');
      setIsLoading(false);
      setIsProcessing(false);
      return;
    }
    
    try {
      setIsLoading(true);
      setIsProcessing(true);
      
      const amount = getTotalToPay();
      
      if (isNaN(amount)) {
        setErrorMessage('Invalid price format');
        toast.error('Invalid price format');
        setIsLoading(false);
        setIsProcessing(false);
        return;
      }
      
      try {
        sessionStorage.setItem('payment_in_progress', 'true');
        sessionStorage.setItem('payment_method', selectedBank);
        sessionStorage.setItem('quotation_id', quotationUuid);
      } catch (err) {
        console.error('Failed to set session storage:', err);
      }
      
      const timestamp = Date.now().toString().slice(-6);
      const randomPart = Math.random().toString(36).substr(2, 6).toUpperCase();
      const referenceNumber = `PAY-${timestamp}-${randomPart}`;
      
      window.lastPaymentInfo = {
        reference: referenceNumber,
        method: selectedBank,
        amount: amount,
        quotation_id: quotationUuid,
        timestamp: new Date().toISOString()
      };
      
      const paymentData = {
        user_id: auth.user.id,
        quotation_ids: [quotationUuid],
        total_amount: amount,
        method: selectedBank,
        status: 'Pending',
        reference_number: referenceNumber,
        created_at: new Date().toISOString()
      };
      
      console.log('Creating payment:', paymentData);
      
      const { data, error } = await supabase
        .from('payments')
        .insert([paymentData])
        .select();
      
      if (error) {
        console.error('Payment creation error:', error);
        toast.error(`Payment failed: ${error.message}`);
        setErrorMessage(`Failed to create payment: ${error.message}`);
        setIsLoading(false);
        setIsProcessing(false);
        return;
      }
      
      console.log('Payment created successfully:', data);
      
      updateQuotationStatus(quotationUuid)
        .catch(err => console.error('Failed to update quotation, but payment worked:', err));
        
      toast.success('Payment created successfully!');
      
      if (typeof onConfirm === 'function') {
        try {
          window.lastSelectedPaymentMethod = selectedBank;
          onConfirm(selectedBank);
        } catch (err) {
          console.error('Error calling onConfirm callback:', err);
        }
      }
      
      if (typeof onClose === 'function') {
        try {
          onClose();
        } catch (err) {
          console.error('Error closing modal:', err);
        }
      }
      
      toast.success('Redirecting to payment details...');
      
      setTimeout(() => {
        try {
          window.location.href = `/payment?ref=${referenceNumber}&refresh=true`;
        } catch (err) {
          console.error('Redirect failed:', err);
          toast.success('Click to view payment details', {
            duration: 10000,
            action: {
              label: 'View Payment',
              onClick: () => window.open(`/payment?ref=${referenceNumber}&refresh=true`, '_blank')
            }
          });
        }
      }, 1500);
    } catch (err) {
      console.error('Unexpected payment error:', err);
      toast.error('An unexpected error occurred');
      setIsLoading(false);
      setIsProcessing(false);
    }
  };
  
  const updateQuotationStatus = async (id: string): Promise<void> => {
    try {
      console.log(`Updating quotation status for ID: ${id}`);
      const { error } = await supabase
        .from('quotations')
        .update({ 
          status: 'Approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
        
      if (error) {
        console.error('Error updating quotation status:', error);
      } else {
        console.log('Quotation status updated successfully');
      }
    } catch (err) {
      console.error('Exception updating quotation status:', err);
    }
  };

  const banks: BankType[] = ['WISE', 'PAYONEER', 'BINANCE'];

  const getBankIcon = (bank: BankType) => {
    switch (bank) {
      case 'WISE':
        return '/images/banks/wise1.svg';
      case 'PAYONEER':
        return '/images/banks/payoneer.svg';
      case 'BINANCE':
        return '/images/banks/Binance_Logo.svg.png';
      default:
        return null;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton={false}
      className="max-w-3xl mx-auto"
    >
      <div className="flex flex-col h-full max-h-[85vh]">
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Complete Payment
          </h2>
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
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 min-h-0">
          {/* Price Options Selection */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Select Price Option
            </h3>
            {isLoadingOptions ? (
              <div className="py-8 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#1E88E5] border-r-transparent"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-300">Loading price options...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {priceOptions.map((option, index) => {
                  const isSelected = selectedPriceOption?.id === option.id;
                  const isCurrentlySelected = option.id === String(quotation.selected_option);
                  const unitPrice = (() => {
                    const val = option[`unit_price_option${option.id}`];
                    const num = typeof val === 'string' ? parseFloat(val) : typeof val === 'number' ? val : NaN;
                    return !isNaN(num) ? num : 0;
                  })();
                  
                  return (
                    <button
                      key={option.id}
                      onClick={() => handlePriceOptionSelect(option, index)}
                      disabled={isUpdatingOption || !quotationUuid}
                      className={`relative w-full p-4 border-2 rounded-xl transition-all duration-200 text-left ${
                        isSelected
                          ? 'border-[#1E88E5] bg-blue-50 dark:bg-blue-900/20 shadow-md'
                          : 'border-gray-200 dark:border-gray-700 hover:border-[#1E88E5] hover:shadow-sm bg-white dark:bg-gray-800'
                      } ${(isUpdatingOption || !quotationUuid) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-start gap-4">
                        <div 
                          className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-700 cursor-pointer group"
                          onClick={(e) => handleMediaClick(e, option.modelImage || "/images/product/product-01.jpg")}
                        >
                          {isVideoUrl(option.modelImage || "") ? (
                            <>
                              <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z"/>
                                </svg>
                              </div>
                              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] px-1 py-0.5 text-center">
                                Video
                              </div>
                            </>
                          ) : (
                            <Image
                              src={option.modelImage || "/images/product/product-01.jpg"}
                              alt={option.modelName || "Product Option"}
                              fill
                              className="object-cover"
                            />
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-gray-900 dark:text-white">
                                Option {parseInt(option.id)}
                              </h4>
                              {isCurrentlySelected && (
                                <span className="text-xs font-medium text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/30 px-2 py-1 rounded-full">
                                  Currently Selected
                                </span>
                              )}
                              {isSelected && !isCurrentlySelected && (
                                <span className="text-xs font-medium text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30 px-2 py-1 rounded-full">
                                  Selected
                                </span>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-bold text-[#1E88E5] dark:text-blue-400">
                                ${unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">per unit</div>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                            <span className="font-medium">Delivery:</span> {option.deliveryTime || 'N/A'}
                          </p>
                          {option.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">
                              {option.description}
                            </p>
                          )}
                        </div>
                      </div>
                      {isUpdatingOption && isSelected && (
                        <div className="absolute inset-0 bg-white/70 dark:bg-gray-900/70 flex items-center justify-center rounded-xl">
                          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payment Method Selection */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Select Payment Method
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {banks.map((bank) => {
                const icon = getBankIcon(bank);
                return (
                  <button
                    key={bank}
                    onClick={() => setSelectedBank(bank)}
                    className={`relative p-4 border-2 rounded-xl transition-all duration-200 ${
                      selectedBank === bank 
                        ? 'border-[#1E88E5] bg-blue-50 dark:bg-blue-900/20 shadow-md' 
                        : 'border-gray-200 dark:border-gray-700 hover:border-[#1E88E5] hover:shadow-sm bg-white dark:bg-gray-800'
                    }`}
                  >
                    {icon && (
                      <div className="relative w-12 h-12 mx-auto mb-2">
                        <Image
                          src={icon}
                          alt={bank}
                          fill
                          className="object-contain"
                        />
                      </div>
                    )}
                    <div className={`text-sm font-medium text-center ${
                      selectedBank === bank
                        ? 'text-[#1E88E5] dark:text-blue-400'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {bank}
                    </div>
                    {selectedBank === bank && (
                      <div className="absolute top-2 right-2">
                        <div className="w-5 h-5 bg-[#1E88E5] rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Price Summary */}
          {selectedPriceOption && (
            <div className="mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-xl p-6 border border-blue-200 dark:border-gray-700">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Price Summary</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Unit Price:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {(() => {
                      const val = selectedPriceOption[`unit_price_option${selectedPriceOption.id}`];
                      const num = typeof val === 'string' ? parseFloat(val) : typeof val === 'number' ? val : NaN;
                      return !isNaN(num) ? `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A';
                    })()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Quantity:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{parseNumeric(quotation.quantity)} units</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Service Fee:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {quotationFees !== null
                      ? `$${quotationFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : 'N/A'}
                  </span>
                </div>
                <div className="border-t border-blue-200 dark:border-gray-600 pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-base font-semibold text-gray-900 dark:text-white">Total Amount:</span>
                    <span className="text-2xl font-bold text-[#1E88E5] dark:text-blue-400">
                      ${getTotalToPay().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bank Information */}
          {selectedBank && (
            <div className="mb-6 bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Bank Information</h4>
              <BankInformation bank={selectedBank} />
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-5 flex-shrink-0 bg-white dark:bg-gray-800">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 sm:flex-none px-6 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 text-gray-700 dark:text-gray-300 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                setErrorMessage(null);
                if (selectedBank) {
                  window.lastSelectedPaymentMethod = selectedBank;
                  try {
                    sessionStorage.setItem('last_selected_payment_method', selectedBank);
                  } catch {}
                }
                const resetTimeout = setTimeout(() => {
                  if (isProcessing) {
                    setIsProcessing(false);
                    setIsLoading(false);
                    setErrorMessage('The operation timed out. Please try again.');
                  }
                }, 15000);
                setTimeout(() => {
                  handleDirectPayment()
                    .then(() => clearTimeout(resetTimeout))
                    .catch(() => {
                      clearTimeout(resetTimeout);
                      setErrorMessage("There was a problem processing your payment. Please try again.");
                      toast.error("Payment processing failed");
                      setIsProcessing(false);
                      setIsLoading(false);
                    });
                }, 0);
              }}
              disabled={isProcessing || isLoading || !selectedBank || !selectedPriceOption || !quotationUuid}
              className="flex-1 px-6 py-3 bg-[#1E88E5] text-white rounded-lg hover:bg-[#1976D2] dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md hover:shadow-lg"
            >
              {(isProcessing || isLoading) ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Proceed to Payment
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Media Preview Modal */}
      {previewMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={() => setPreviewMedia(null)}>
          <div className="relative max-w-5xl w-full max-h-[90vh] bg-black rounded-2xl shadow-2xl p-4 flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {/* Controls */}
            <div className="absolute top-4 right-4 flex gap-2 z-10">
              {previewMedia.type === 'image' && (
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
                  setPreviewMedia(null);
                }}
              >
                <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24"><path fillRule="evenodd" fill="black" d="M6.043 16.542a1 1 0 1 0 1.414 1.414L12 13.414l4.542 4.542a1 1 0 0 0 1.414-1.414L13.413 12l4.542-4.542a1 1 0 0 0-1.414-1.414l-4.542 4.542-4.542-4.542A1 1 0 1 0 6.043 7.46L10.585 12z" clipRule="evenodd" /></svg>
              </button>
            </div>
            {/* Media Content */}
            {previewMedia.type === 'image' ? (
              <div className="flex-1 flex items-center justify-center w-full h-full min-h-[400px]">
                <Image
                  src={previewMedia.url}
                  alt="Preview"
                  width={1200}
                  height={800}
                  className="max-w-full max-h-[80vh] object-contain transition-transform duration-200"
                  style={{
                    transform: `scale(${zoomLevel})`,
                  }}
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center w-full h-full min-h-[400px]">
                <video
                  src={previewMedia.url}
                  controls
                  className="max-w-full max-h-[80vh] w-auto h-auto"
                  preload="metadata"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};

export default CheckoutConfirmationModal;
