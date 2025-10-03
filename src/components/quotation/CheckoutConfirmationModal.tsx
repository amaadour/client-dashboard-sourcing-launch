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
  // onConfirm is still in the props interface for compatibility, but we don't use it
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
  const auth = useAuth(); // Get authentication context
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
  
  // Debug: log the quotation object to check for Quotation_fees
  useEffect(() => {
    console.log('Quotation in modal:', quotation);
  }, [quotation]);
  
  // Log the quotation object for debugging
  useEffect(() => {
    console.log("Quotation object:", quotation);
    
    // Global error handler to prevent browser popups
    const handleGlobalError = (event: ErrorEvent) => {
      // Prevent the browser from showing the default error dialog
      event.preventDefault();
      console.error("Globally caught error:", event.error || event.message);
      return true; // Prevents the browser error popup
    };
    
    window.addEventListener('error', handleGlobalError);
    
    // Add unhandled promise rejection handler
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      console.error("Unhandled promise rejection:", event.reason);
      return true;
    };
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    // Fetch the actual UUID on component load and get complete price options
    const fetchQuotationData = async () => {
      try {
        if (!quotation.quotation_id) return;
        
        setIsLoadingOptions(true);
        
        // Get the quotation UUID and all option data
        const { data, error } = await supabase
          .from('quotations')
          .select('id, title_option1, title_option2, title_option3, total_price_option1, total_price_option2, total_price_option3, delivery_time_option1, delivery_time_option2, delivery_time_option3, description_option1, description_option2, description_option3, image_option1, image_option2, image_option3, selected_option, Quotation_fees')
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
          // Always set the service fee on the quotation object and local state
          if (data.Quotation_fees !== undefined) {
            (quotation as QuotationWithFees).Quotation_fees = data.Quotation_fees;
            let fee = data.Quotation_fees;
            if (typeof fee === 'string') fee = parseFloat(fee);
            if (typeof fee === 'number' && !isNaN(fee)) setQuotationFees(fee);
            else setQuotationFees(null);
          } else {
            setQuotationFees(null);
          }
          
          // Recreate price options array from the database data
          const fullPriceOptions: PriceOption[] = [];
          
          // Add option 1 if it exists
          if (data.title_option1) {
            fullPriceOptions.push({
              id: '1',
              price: data.total_price_option1 ? `$${parseFloat(data.total_price_option1).toLocaleString()}` : 'N/A',
              supplier: data.title_option1,
              deliveryTime: data.delivery_time_option1 || 'N/A',
              description: data.description_option1,
              modelName: data.title_option1,
              modelImage: data.image_option1 || "/images/product/product-01.jpg"
            });
          }
          
          // Add option 2 if it exists
          if (data.title_option2) {
            fullPriceOptions.push({
              id: '2',
              price: data.total_price_option2 ? `$${parseFloat(data.total_price_option2).toLocaleString()}` : 'N/A',
              supplier: data.title_option2,
              deliveryTime: data.delivery_time_option2 || 'N/A',
              description: data.description_option2,
              modelName: data.title_option2,
              modelImage: data.image_option2 || "/images/product/product-01.jpg"
            });
          }
          
          // Add option 3 if it exists
          if (data.title_option3) {
            fullPriceOptions.push({
              id: '3',
              price: data.total_price_option3 ? `$${parseFloat(data.total_price_option3).toLocaleString()}` : 'N/A',
              supplier: data.title_option3,
              deliveryTime: data.delivery_time_option3 || 'N/A',
              description: data.description_option3,
              modelName: data.title_option3,
              modelImage: data.image_option3 || "/images/product/product-01.jpg"
            });
          }
          
          // Set the price options if we found more than what was passed in
          if (fullPriceOptions.length > (quotation.priceOptions?.length || 0)) {
            console.log("Setting full price options:", fullPriceOptions);
            setPriceOptions(fullPriceOptions);
            
            // Set selected option based on the database value
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
    
    // Cleanup event listeners on unmount
    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [quotation]);
  
  // Set initial selected price option based on quotation.selected_option
  useEffect(() => {
    if (quotation.priceOptions?.length && quotation.selected_option) {
      // selected_option is 1-based, array is 0-based
      const optionIndex = quotation.selected_option - 1;
      if (optionIndex >= 0 && optionIndex < quotation.priceOptions.length) {
        setSelectedPriceOption(quotation.priceOptions[optionIndex]);
      }
    }
  }, [quotation.priceOptions, quotation.selected_option]);

  // Add early safety patching
  useEffect(() => {
    // This is a direct patch to fix the parent component's error
    // Create a patching function we can call from anywhere
    const patchParentComponentError = () => {
      try {
        // Define our patch functions
        const safeHandleCheckoutConfirm = (originalFn: (...args: unknown[]) => unknown) => {
          return function patched(this: unknown, ...args: unknown[]) {
            try {
              // If there's no payment method in args, try to get it from our global var
              if (!args[0] && window.lastSelectedPaymentMethod) {
                console.log('PATCH: Injecting payment method from window:', window.lastSelectedPaymentMethod);
                args[0] = window.lastSelectedPaymentMethod;
              }
              
              // Additionally check if there's a missing paymentMethod var in scope
              const fnStr = originalFn.toString();
              if (fnStr.includes("!paymentMethod") || fnStr.includes("No payment method selected")) {
                // This function likely has the error we're trying to patch
                console.log('PATCH: Found target function with payment method check');
                
                // Create a global backup to avoid the error
                (window as Window & typeof globalThis & { __paymentMethod: unknown }).__paymentMethod = window.lastSelectedPaymentMethod;
              }
              
              return originalFn.apply(this, args);
            } catch (e) {
              console.error('Error in patched function:', e);
              // Don't rethrow to prevent UI errors
              return null;
            }
          };
        };
        
        // Try to find and patch the parent component's functions
        if (window.parent) {
          console.log('Attempting to patch parent window');
          // This is a technique to access parent component functions
          // It might not work in all cases but it's worth trying
          const parentWindow = window.parent as Window & typeof globalThis & { __safeHandleCheckoutConfirm: unknown };
          parentWindow.__safeHandleCheckoutConfirm = safeHandleCheckoutConfirm;
        }
      } catch (e) {
        console.error('Error in patch function:', e);
      }
    };
    
    // Apply the patch
    patchParentComponentError();
    
    // Also try to inject a global workaround to the specific error
    try {
      // Create a global variable that matches what the parent is looking for
      const globalWindow = window as Window & typeof globalThis & { paymentMethod: BankType | null };
      globalWindow.paymentMethod = selectedBank;
      console.log('Created global paymentMethod backup:', selectedBank);
    } catch (e) {
      console.error('Failed to create global backup:', e);
    }
  }, [selectedBank]);

  // Calculate the total price for the selected option
  const getTotalToPay = () => {
    if (!selectedPriceOption) return 0;
    // Find the correct unit price and unit weight for the selected option
    const optionNum = selectedPriceOption.id;
    // Try to get unit price and service fee from the selectedPriceOption or quotation
    const rawUnitPrice = selectedPriceOption[`unit_price_option${optionNum}`];
    const unitPrice = (typeof rawUnitPrice === 'string' || typeof rawUnitPrice === 'number' || rawUnitPrice == null)
      ? parseNumeric(rawUnitPrice)
      : 0;
    const quantity = parseNumeric(quotation.quantity);
    // Service fee: try to get from quotation or selectedPriceOption
    let serviceFee = 0;
    if ((quotation as QuotationWithFees)?.Quotation_fees) {
      serviceFee = parseNumeric((quotation as QuotationWithFees).Quotation_fees);
    }
    // Fallback: try to get from selectedPriceOption
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
      
      // Update the selected option in the database using the option index + 1 (1-based indexing)
      const { error: updateError } = await supabase
        .from('quotations')
        .update({ 
          selected_option: optionIndex + 1, // Convert to 1-based index
          updated_at: new Date().toISOString()
        })
        .eq('id', quotationUuid); // Use the UUID, not the formatted ID

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

  // Bypass approach: Direct payment creation without parent callbacks
  const handleDirectPayment = async (): Promise<void> => {
    // Check for critical data first
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
      
      // Extract amount from price
      const amount = getTotalToPay();
      
      if (isNaN(amount)) {
        setErrorMessage('Invalid price format');
        toast.error('Invalid price format');
        setIsLoading(false);
        setIsProcessing(false);
        return;
      }
      
      // Store in sessionStorage before anything else happens
      try {
        sessionStorage.setItem('payment_in_progress', 'true');
        sessionStorage.setItem('payment_method', selectedBank);
        sessionStorage.setItem('quotation_id', quotationUuid);
      } catch (err) {
        console.error('Failed to set session storage:', err);
        // Continue anyway
      }
      
      // Generate reference number
      const timestamp = Date.now().toString().slice(-6);
      const randomPart = Math.random().toString(36).substr(2, 6).toUpperCase();
      const referenceNumber = `PAY-${timestamp}-${randomPart}`;
      
      // Store payment info in window object for recovery
      window.lastPaymentInfo = {
        reference: referenceNumber,
        method: selectedBank,
        amount: amount,
        quotation_id: quotationUuid,
        timestamp: new Date().toISOString()
      };
      
      // Create payment object
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
      
      // Insert payment into Supabase
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
      
      // Update quotation status asynchronously (don't wait)
      updateQuotationStatus(quotationUuid)
        .catch(err => console.error('Failed to update quotation, but payment worked:', err));
        
      // Show success to user
      toast.success('Payment created successfully!');
      
      // Call the onConfirm callback with the selected payment method
      if (typeof onConfirm === 'function') {
        try {
          // Store payment method for global access before calling onConfirm
          window.lastSelectedPaymentMethod = selectedBank;
          
          // Call onConfirm, but don't await the result to avoid dependency on parent implementation
          onConfirm(selectedBank);
        } catch (err) {
          console.error('Error calling onConfirm callback:', err);
          // Continue anyway
        }
      }
      
      // Close modal
      if (typeof onClose === 'function') {
        try {
          onClose();
        } catch (err) {
          console.error('Error closing modal:', err);
        }
      }
      
      // Show final success with redirect info
      toast.success('Redirecting to payment details...');
      
      // Redirect after delay
      setTimeout(() => {
        try {
          // Simply redirect with the refresh parameter to trigger auto-refresh
          window.location.href = `/payment?ref=${referenceNumber}&refresh=true`;
        } catch (err) {
          console.error('Redirect failed:', err);
          // Show clickable link as fallback
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
  
  // Helper function to update quotation status
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="w-full max-w-2xl mx-auto custom-scrollbar bg-white dark:bg-gray-900"
      maxHeight="90vh"
    >
      <div className="flex flex-col">
        {/* Price Options Selection */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Select Price Option</h3>
          {isLoadingOptions ? (
            <div className="py-8 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#1E88E5] border-r-transparent align-[-0.125em]"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-300">Loading all price options...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {priceOptions.map((option, index) => (
                <button
                  key={option.id}
                  onClick={() => handlePriceOptionSelect(option, index)}
                  disabled={isUpdatingOption || !quotationUuid}
                  className={`w-full flex items-center gap-4 p-4 border rounded-lg transition-colors ${
                    selectedPriceOption?.id === option.id
                      ? 'border-[#1E88E5] bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-[#1E88E5]'
                  } ${(isUpdatingOption || !quotationUuid) ? 'opacity-50 cursor-not-allowed' : ''} relative bg-white dark:bg-gray-800`}
                >
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                    <Image
                      src={option.modelImage || "/images/product/product-01.jpg"}
                      alt={option.modelName || "Product Option"}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-grow">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          Option {parseInt(option.id)}
                          {option.id === String(quotation.selected_option) && (
                            <span className="ml-2 text-xs text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                              Currently Selected
                            </span>
                          )}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          Delivery Time: {option.deliveryTime}
                        </p>
                      </div>
                      <span className="text-lg font-bold text-[#1E88E5] dark:text-blue-400">
                        {(() => {
                          const val = option[`unit_price_option${option.id}`];
                          const num = typeof val === 'string' ? parseFloat(val) : typeof val === 'number' ? val : NaN;
                          return !isNaN(num) ? num.toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : 'N/A';
                        })()}
                      </span>
                    </div>
                    {option.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        {option.description}
                      </p>
                    )}
                  </div>
                  {isUpdatingOption && selectedPriceOption?.id === option.id && (
                    <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/70 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Payment Method Selection */}
        <div className="p-4 bg-white dark:bg-gray-900">
          <h4 className="text-base font-medium text-gray-900 dark:text-white mb-3">Select Payment Method</h4>
          <div className="grid grid-cols-3 gap-3">
            {banks.map((bank) => (
              <button
                key={bank}
                onClick={() => setSelectedBank(bank)}
                className={`py-2 px-4 text-center border rounded-lg transition-colors
                  ${selectedBank === bank 
                    ? 'border-[#1E88E5] bg-blue-50 text-[#1E88E5] dark:bg-blue-900/20 dark:text-blue-400' 
                    : 'border-gray-200 dark:border-gray-700 hover:border-[#1E88E5] dark:hover:border-blue-400 text-gray-900 dark:text-white'
                  }`}
              >
                {bank.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Bank Information */}
        {selectedBank && (
          <div className="px-4 pb-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Bank Information</h4>
              <BankInformation bank={selectedBank} />
            </div>
          </div>
        )}

        {/* Option Details Summary (move here) */}
            {selectedPriceOption && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <h4 className="font-semibold mb-2 text-gray-800 dark:text-white">Selected Option Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="mb-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Unit Price:</span>
                  <span className="ml-2 font-medium text-gray-800 dark:text-white">
                    {(() => {
                      const val = selectedPriceOption[`unit_price_option${selectedPriceOption.id}`];
                      if (typeof val === 'string' || typeof val === 'number') return val;
                      return selectedPriceOption.price ?? 'N/A';
                    })()}
                  </span>
                </div>
                <div className="mb-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Unit Weight (grams):</span>
                  <span className="ml-2 font-medium text-gray-800 dark:text-white">
                    {(() => {
                      const val = selectedPriceOption[`unit_weight_option${selectedPriceOption.id}`];
                      if (typeof val === 'string' || typeof val === 'number') return val;
                      return '-';
                    })()}
                  </span>
                </div>
                <div className="mb-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Delivery Time:</span>
                  <span className="ml-2 font-medium text-gray-800 dark:text-white">
                    {(() => {
                      const val = selectedPriceOption[`delivery_time_option${selectedPriceOption.id}`];
                      if (typeof val === 'string') return val;
                      return selectedPriceOption.deliveryTime ?? 'N/A';
                    })()}
                  </span>
                </div>
                <div className="mb-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Description:</span>
                  <span className="ml-2 text-gray-800 dark:text-white">
                    {(() => {
                      const val = selectedPriceOption[`description_option${selectedPriceOption.id}`];
                      if (typeof val === 'string') return val;
                      return selectedPriceOption.description ?? '';
                    })()}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    selectedPriceOption[`image_option${selectedPriceOption.id}`],
                    selectedPriceOption[`image_option${selectedPriceOption.id}_2`]
                  ].filter((img): img is string => typeof img === 'string' && !!img).map((img, idx) => (
                    <div key={idx} className="relative w-16 h-16 rounded overflow-hidden border border-gray-200 dark:border-gray-700">
                      <Image
                        src={img}
                        alt={`Option Image ${idx+1}`}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Price Details at the bottom */}
            <div className="mt-6">
              <h5 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">Price Details</h5>
              <ul className="text-sm text-gray-700 dark:text-gray-200 space-y-1">
                <li>Price per unit: <span className="font-medium">{
                  (() => {
                    const val = selectedPriceOption[`unit_price_option${selectedPriceOption.id}`];
                    const num = typeof val === 'string' ? parseFloat(val) : typeof val === 'number' ? val : NaN;
                    return !isNaN(num) ? num.toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : 'N/A';
                  })()
                }</span></li>
                <li>Quantity: <span className="font-medium">{parseNumeric(quotation.quantity)}</span></li>
                <li>Service fees: <span className="font-medium">{
                  quotationFees !== null
                    ? quotationFees.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
                    : 'N/A'
                }</span></li>
                <li>Total price: <span className="font-bold">{getTotalToPay().toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</span></li>
              </ul>
            </div>
              </div>
            )}

        {/* Action Buttons and Calculation Breakdown */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
          {/* Buttons */}
          <div className="flex flex-col md:flex-row gap-3 w-full">
              <button
                onClick={onClose}
                disabled={isProcessing}
              className="w-full md:w-auto px-5 py-2 border border-f-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 text-black dark:text-white bg-white dark:bg-gray-900"
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
              className="w-full md:w-auto px-5 py-2 bg-[#1E88E5] text-white rounded-lg hover:bg-[#1976D2] dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
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
                  'Proceed to Payment'
                )}
              </button>
          </div>
        </div>
      </div>
      <div className="mt-6">
        {errorMessage && (
          <div className="text-red-500 dark:text-red-400 mb-4">
            {errorMessage}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default CheckoutConfirmationModal; 