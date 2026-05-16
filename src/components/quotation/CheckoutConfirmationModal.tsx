import React, { useState, useEffect } from 'react';
import { Modal } from "@/components/ui/modal";
import Image from "next/image";
import { QuotationData as BaseQuotationData, PriceOption, CustomizationFile } from '@/types/quotation';
import BankInformation, { BankType } from './BankInformation';
import { sendEmailClient } from '@/lib/sendEmailClient';
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuth } from '@/context/AuthContext';

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

type QuotationWithFees = BaseQuotationData & { Quotation_fees?: string | number | null };

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
  const [custFiles, setCustFiles] = useState<CustomizationFile[]>([]);
  const [isUploadingCust, setIsUploadingCust] = useState(false);
  const custFileRef = React.useRef<HTMLInputElement>(null);
  const [localSelectedVersion, setLocalSelectedVersion] = useState<string | null>(quotation.selected_version || null);
  const [localCustomOption, setLocalCustomOption] = useState<number | null>(quotation.selected_customization_option ?? null);
  const isCustomized = localSelectedVersion === 'customized' && !!quotation.is_customizable;
  const [shippingLabel, setShippingLabel] = useState<string>(quotation.client_label || '');
  
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

    // Fetch customization files if applicable
    if (quotation.id && quotation.is_customizable) {
      supabase.from('customization_files').select('*').eq('quotation_id', quotation.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => { if (data) setCustFiles(data as CustomizationFile[]); });
    }

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

  const hasCustomOption2 = !!(quotation.custom_title_option2 || quotation.custom_unit_price_option2);
  const effectiveCustomOption = isCustomized ? (localCustomOption ?? (!hasCustomOption2 ? 1 : null)) : null;

  const getCustomizedUnitPrice = () => {
    if (effectiveCustomOption === 1 && quotation.custom_unit_price_option1) return quotation.custom_unit_price_option1;
    if (effectiveCustomOption === 2 && quotation.custom_unit_price_option2) return quotation.custom_unit_price_option2;
    return quotation.customization_price ?? null;
  };

  const getTotalToPay = () => {
    const quantity = parseNumeric(quotation.quantity);
    // Customized version: selected custom option unit_price × quantity
    if (isCustomized) {
      const unitPrice = getCustomizedUnitPrice();
      if (unitPrice) return parseNumeric(unitPrice) * quantity;
    }
    if (!selectedPriceOption) return 0;
    const optionNum = selectedPriceOption.id;
    const rawUnitPrice = selectedPriceOption[`unit_price_option${optionNum}`];
    const unitPrice = (typeof rawUnitPrice === 'string' || typeof rawUnitPrice === 'number' || rawUnitPrice == null)
      ? parseNumeric(rawUnitPrice)
      : 0;
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

  const handleCustUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const { user } = auth || {};
    if (!file || !user?.id || !quotation.id) return;
    setIsUploadingCust(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${quotation.id}/${Date.now()}.${ext}`;
      const { data: up, error: upErr } = await supabase.storage
        .from('customization-files').upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('customization-files').getPublicUrl(up.path);
      const { data: inserted } = await supabase.from('customization_files').insert({
        quotation_id: quotation.id, user_id: user.id,
        file_url: urlData.publicUrl, file_name: file.name,
        file_type: file.type, file_size: file.size,
      }).select('*').single();
      if (inserted) setCustFiles(prev => [inserted as CustomizationFile, ...prev]);
    } catch (err) { console.error('Upload error:', err); toast.error('Upload failed'); }
    finally { setIsUploadingCust(false); if (custFileRef.current) custFileRef.current.value = ''; }
  };

  const handleDeleteCustFile = async (file: CustomizationFile) => {
    try {
      // Extract storage path from URL
      const urlParts = file.file_url.split('/customization-files/');
      if (urlParts.length > 1) {
        const storagePath = urlParts[1].split('?')[0];
        await supabase.storage.from('customization-files').remove([storagePath]);
      }
      await supabase.from('customization_files').delete().eq('id', file.id);
      setCustFiles(prev => prev.filter(f => f.id !== file.id));
      toast.success('File removed');
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to remove file');
    }
  };

  if (!priceOptions.length && !quotation.is_customizable) {
    return (
      <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        showCloseButton={true} 
        className="max-w-md mx-auto"
      >
        <div className="p-8 text-center">
          {isLoadingOptions ? (
            <div className="flex flex-col items-center">
              <div className="w-9 h-9 border-4 border-[#0D47A1] border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-3 text-sm text-[#0D47A1]/60">Loading price options…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-[#E3F2FD] flex items-center justify-center mb-3">
                <svg className="w-7 h-7 text-[#0D47A1]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-base font-semibold text-[#0D47A1]">No price options available</p>
              <p className="mt-1 text-sm text-[#0D47A1]/50">This quotation doesn&apos;t have any price options defined.</p>
              <button onClick={onClose} className="mt-5 px-5 py-2.5 bg-[#0D47A1] text-white text-sm font-medium rounded-lg hover:bg-[#1565C0] transition-colors">
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
      const { error: updateError } = await supabase
        .from('quotations')
        .update({
          selected_option: optionIndex + 1,
          selected_version: 'stock',
          updated_at: new Date().toISOString()
        })
        .eq('id', quotationUuid);

      if (updateError) {
        throw new Error(`Failed to update selected option: ${updateError.message}`);
      }

      setSelectedPriceOption(option);
      setLocalSelectedVersion('stock');
      setLocalCustomOption(null);
      toast.success('Price option selected successfully');
    } catch (error) {
      console.error('Error updating selected option:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update selected option');
    } finally {
      setIsUpdatingOption(false);
    }
  };

  const handleCustomizedSelect = async (optNum: number) => {
    if (isUpdatingOption || !quotationUuid) return;
    setIsUpdatingOption(true);
    try {
      const { error } = await supabase
        .from('quotations')
        .update({ selected_version: 'customized', selected_customization_option: optNum, updated_at: new Date().toISOString() })
        .eq('id', quotationUuid);
      if (error) throw new Error(error.message);
      setLocalSelectedVersion('customized');
      setLocalCustomOption(optNum);
      setSelectedPriceOption(null);
      toast.success(`Custom Option C${optNum} selected`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to select customized version');
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
    
    if (!quotationUuid || !selectedBank || (!isCustomized && !selectedPriceOption)) {
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

      // Send payment confirmation email
      if (auth?.user?.email) {
        sendEmailClient({
          type: 'payment_created',
          clientEmail: auth.user.email,
          quotation: {
            quotation_id: quotation.quotation_id,
            product_name: quotation.product?.name || 'Product',
            quantity: quotation.quantity,
            status: quotation.status,
            shipping_country: quotation.destination || '',
          },
          payment: {
            reference_number: referenceNumber,
            amount: amount,
            method: selectedBank,
            status: 'Pending',
          },
        });
      }

      if (shippingLabel.trim()) {
        supabase.from('quotations')
          .update({ client_label: shippingLabel.trim() })
          .eq('id', quotationUuid)
          .then(({ error }) => { if (error) console.error('Failed to save shipping label:', error); });
      }
        
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

  const banks: BankType[] = ['PAYONEER', 'WISE', 'AIRWALLEX', 'WIRE', 'BINANCE'];

  const getBankIcon = (bank: BankType): string | null => {
    switch (bank) {
      case 'PAYONEER': return '/images/banks/payoneer.svg';
      case 'WISE': return '/images/banks/wise1.svg';
      case 'AIRWALLEX': return '/images/banks/airwallex.png';
      case 'WIRE': return '/images/banks/bank-wire.png';
      case 'BINANCE': return '/images/banks/Binance_Logo.svg.png';
    }
  };

  const getBankLabel = (bank: BankType): string => {
    switch (bank) {
      case 'PAYONEER': return 'Payoneer';
      case 'WISE': return 'Wise';
      case 'AIRWALLEX': return 'Airwallex';
      case 'WIRE': return 'Wire';
      case 'BINANCE': return 'Binance';
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

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#BBDEFB] flex-shrink-0 bg-[#E3F2FD]">
          <div>
            <h2 className="text-lg font-bold text-[#0D47A1]">Complete Payment</h2>
            <p className="text-xs text-[#0D47A1]/60 mt-0.5">{quotation.quotation_id} — {quotation.product?.name}</p>
          </div>
          <button
            onClick={onClose}
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

          {/* Select Price Option */}
          <div className="rounded-xl border border-[#BBDEFB] overflow-hidden">
            <div className="px-4 py-3 bg-[#E3F2FD] border-b border-[#BBDEFB]">
              <h3 className="text-xs font-semibold text-[#0D47A1] uppercase tracking-wide">Select Price Option</h3>
            </div>
            <div className="p-4">
            {isLoadingOptions ? (
              <div className="py-6 text-center">
                <div className="inline-block h-7 w-7 animate-spin rounded-full border-4 border-[#0D47A1] border-r-transparent"></div>
                <p className="mt-2 text-sm text-[#0D47A1]/60">Loading price options…</p>
              </div>
            ) : (
              <div className="space-y-2">
                {priceOptions.map((option, index) => {
                  const isSelected = localSelectedVersion !== 'customized' && selectedPriceOption?.id === option.id;
                  const isCurrentlySelected = localSelectedVersion !== 'customized' && option.id === String(quotation.selected_option);
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
                      className={`relative w-full p-3 border rounded-xl transition-all duration-200 text-left ${
                        isSelected
                          ? 'border-[#0D47A1] bg-[#E3F2FD]'
                          : 'border-[#BBDEFB] hover:border-[#0D47A1]/40 hover:bg-[#E3F2FD]/40 bg-white'
                      } ${(isUpdatingOption || !quotationUuid) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-[#BBDEFB] cursor-pointer group"
                          onClick={(e) => handleMediaClick(e, option.modelImage || "/images/product/product-01.jpg")}
                        >
                          {isVideoUrl(option.modelImage || "") ? (
                            <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            </div>
                          ) : (
                            <Image src={option.modelImage || "/images/product/product-01.jpg"} alt={option.modelName || "Option"} fill className="object-cover" />
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <h4 className={`text-sm font-semibold ${isSelected ? 'text-[#0D47A1]' : 'text-gray-800'}`}>
                                Option {parseInt(option.id)} {option.modelName ? `— ${option.modelName}` : ''}
                              </h4>
                              {isCurrentlySelected && (
                                <span className="text-xs font-medium text-white bg-[#0D47A1] px-2 py-0.5 rounded-full">Selected</span>
                              )}
                              {isSelected && !isCurrentlySelected && (
                                <span className="text-xs font-medium text-[#0D47A1] bg-[#BBDEFB] px-2 py-0.5 rounded-full">Choosing</span>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className={`text-base font-bold ${isSelected ? 'text-[#0D47A1]' : 'text-gray-700'}`}>
                                ${unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              <div className="text-xs text-[#0D47A1]/50">per unit</div>
                            </div>
                          </div>
                          <p className="text-xs text-[#0D47A1]/60">Delivery: <span className="font-medium text-gray-700">{option.deliveryTime || 'N/A'}</span></p>
                          {option.description && <p className="text-xs text-gray-500 mt-1 line-clamp-1">{option.description}</p>}
                        </div>
                      </div>
                      {isUpdatingOption && isSelected && (
                        <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-xl">
                          <div className="w-5 h-5 border-2 border-[#0D47A1] border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </button>
                  );
                })}

                {/* Customized option cards — one card per custom option (C1, C2) */}
                {quotation.is_customizable && ([1, 2] as const).map((optNum) => {
                  const custTitle = quotation[`custom_title_option${optNum}`];
                  const custPrice = quotation[`custom_unit_price_option${optNum}`];
                  if (!custTitle && !custPrice) return null;
                  const custDelivery = quotation[`custom_delivery_option${optNum}`];
                  const custWeight = quotation[`custom_unit_weight_option${optNum}`];
                  const custImages = (quotation[`custom_images_option${optNum}`] as string[]) || [];
                  const firstImage = custImages[0] || null;
                  const isThisSelected = isCustomized && localCustomOption === optNum;
                  return (
                    <button
                      key={`custom-${optNum}`}
                      onClick={() => handleCustomizedSelect(optNum)}
                      disabled={isUpdatingOption || !quotationUuid}
                      className={`relative w-full p-3 border rounded-xl transition-all duration-200 text-left ${
                        isThisSelected ? 'border-[#0D47A1] bg-[#E3F2FD]' : 'border-dashed border-[#0D47A1]/40 hover:border-[#0D47A1] hover:bg-[#E3F2FD]/40 bg-white'
                      } ${(isUpdatingOption || !quotationUuid) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Image — zoomable */}
                        <div
                          className={`relative w-16 h-16 rounded-lg flex-shrink-0 overflow-hidden border group ${firstImage ? 'cursor-zoom-in' : ''} ${isThisSelected ? 'border-[#0D47A1]' : 'border-dashed border-[#0D47A1]/40'}`}
                          onClick={firstImage ? (e) => { e.stopPropagation(); setPreviewMedia({ url: firstImage, type: 'image' }); } : undefined}
                        >
                          {firstImage ? (
                            <>
                              <Image src={firstImage} alt={custTitle || `C${optNum}`} fill className="object-cover" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                <svg className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/>
                                </svg>
                              </div>
                            </>
                          ) : (
                            <div className={`w-full h-full flex items-center justify-center ${isThisSelected ? 'bg-[#0D47A1]/10' : 'bg-[#E3F2FD]/50'}`}>
                              <svg className={`w-7 h-7 ${isThisSelected ? 'text-[#0D47A1]' : 'text-[#0D47A1]/40'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold flex-shrink-0 ${isThisSelected ? 'bg-[#0D47A1] text-white' : 'bg-[#BBDEFB] text-[#0D47A1]'}`}>C{optNum}</span>
                              <h4 className={`text-sm font-semibold ${isThisSelected ? 'text-[#0D47A1]' : 'text-gray-800'}`}>{custTitle || `Custom Option ${optNum}`}</h4>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-semibold border border-purple-200">
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                </svg>
                                Custom
                              </span>
                              {isThisSelected && <span className="text-[10px] font-medium text-white bg-[#0D47A1] px-2 py-0.5 rounded-full">Selected</span>}
                            </div>
                            {custPrice && (
                              <div className="text-right flex-shrink-0">
                                <div className={`text-base font-bold ${isThisSelected ? 'text-[#0D47A1]' : 'text-gray-700'}`}>
                                  ${parseNumeric(custPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div className="text-xs text-[#0D47A1]/50">per unit</div>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[#0D47A1]/60">
                            {custDelivery && <span>Delivery: <span className="font-medium text-gray-700">{custDelivery}</span></span>}
                            {custWeight && <span>Weight: <span className="font-medium text-gray-700">{custWeight}g</span></span>}
                          </div>
                          {custImages.length > 1 && (
                            <div className="flex gap-1.5 mt-2 flex-wrap">
                              {custImages.slice(1).map((img, idx) => (
                                <div key={idx} className="relative w-9 h-9 rounded border border-[#BBDEFB] overflow-hidden flex-shrink-0 cursor-zoom-in"
                                  onClick={(e) => { e.stopPropagation(); setPreviewMedia({ url: img, type: 'image' }); }}>
                                  <Image src={img} alt={`img ${idx + 2}`} fill className="object-cover" />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {isUpdatingOption && isThisSelected && (
                        <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-xl">
                          <div className="w-5 h-5 border-2 border-[#0D47A1] border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            </div>
          </div>

          {/* Customization Files — shown right after option selection when customized */}
          {isCustomized && (
            <div className="rounded-xl border border-[#BBDEFB] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-[#E3F2FD] border-b border-[#BBDEFB]">
                <div>
                  <h3 className="text-xs font-semibold text-[#0D47A1] uppercase tracking-wide">
                    Customization Files
                    {custFiles.length === 0 && <span className="ml-2 text-red-500">*required</span>}
                  </h3>
                  <p className="text-xs text-[#0D47A1]/50 mt-0.5">Upload your specs before paying</p>
                </div>
                <button
                  type="button"
                  onClick={() => custFileRef.current?.click()}
                  disabled={isUploadingCust}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0D47A1] text-white text-xs font-medium hover:bg-[#1565C0] disabled:opacity-60 transition-colors"
                >
                  {isUploadingCust ? (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                  )}
                  {isUploadingCust ? 'Uploading…' : 'Upload'}
                </button>
                <input ref={custFileRef} type="file" className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.webm,.zip"
                  onChange={handleCustUpload} />
              </div>
              <div className="p-3 bg-white space-y-2">
                {custFiles.length > 0 ? custFiles.map(file => (
                  <div key={file.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#BBDEFB] bg-[#E3F2FD]/40">
                    <svg className="w-4 h-4 text-[#0D47A1] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#0D47A1] truncate">{file.file_name}</p>
                      {file.file_size && <p className="text-xs text-[#0D47A1]/50">{(file.file_size / 1024).toFixed(0)} KB</p>}
                    </div>
                    {/* Change button */}
                    <label className="flex-shrink-0 cursor-pointer p-1.5 rounded-lg hover:bg-[#E3F2FD] text-[#0D47A1]/50 hover:text-[#0D47A1] transition-colors" title="Replace file">
                      <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.webm,.zip" onChange={handleCustUpload} />
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                      </svg>
                    </label>
                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteCustFile(file)}
                      className="flex-shrink-0 p-1.5 rounded-lg hover:bg-red-50 text-[#0D47A1]/40 hover:text-red-500 transition-colors"
                      title="Remove file"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  </div>
                )) : (
                  <div className="text-center py-5 border border-dashed border-[#BBDEFB] rounded-lg bg-[#E3F2FD]/30">
                    <p className="text-xs text-[#0D47A1]/40">No files uploaded — please upload your customization specs</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Shipping Label */}
          <div className="rounded-xl border border-[#BBDEFB] overflow-hidden">
            <div className="px-4 py-3 bg-[#E3F2FD] border-b border-[#BBDEFB] flex items-center gap-2">
              <svg className="w-4 h-4 text-[#0D47A1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <h3 className="text-xs font-semibold text-[#0D47A1] uppercase tracking-wide">Shipping Label</h3>
              <span className="ml-auto text-xs text-[#0D47A1]/40 italic">optional</span>
            </div>
            <div className="p-4 bg-white">
              <input
                type="text"
                value={shippingLabel}
                onChange={(e) => setShippingLabel(e.target.value)}
                placeholder="Enter a label for your shipment (e.g. Order #123, Summer Batch…)"
                className="w-full px-3 py-2.5 text-sm border border-[#BBDEFB] rounded-lg text-gray-800 placeholder:text-[#0D47A1]/30 focus:outline-none focus:border-[#0D47A1] focus:ring-1 focus:ring-[#0D47A1]/20 transition-colors bg-white"
              />
              <p className="mt-1.5 text-xs text-[#0D47A1]/40">This label will appear on your shipment tracking. You can leave it blank.</p>
            </div>
          </div>

          {/* Payment Method */}
          <div className="rounded-xl border border-[#BBDEFB] overflow-hidden">
            <div className="px-4 py-3 bg-[#E3F2FD] border-b border-[#BBDEFB]">
              <h3 className="text-xs font-semibold text-[#0D47A1] uppercase tracking-wide">Payment Method</h3>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {banks.map((bank) => {
                  const icon = getBankIcon(bank);
                  const label = getBankLabel(bank);
                  return (
                    <button
                      key={bank}
                      onClick={() => setSelectedBank(bank)}
                      className={`relative p-3 border rounded-xl transition-all duration-200 flex flex-col items-center ${
                        selectedBank === bank
                          ? 'border-[#0D47A1] bg-[#E3F2FD] shadow-sm'
                          : 'border-[#BBDEFB] hover:border-[#0D47A1]/40 hover:bg-[#E3F2FD]/40 bg-white'
                      }`}
                    >
                      <div className="relative w-9 h-9 mb-1.5">
                        {icon && <Image src={icon} alt={label} fill className="object-contain" />}
                      </div>
                      <div className={`text-[11px] font-semibold text-center leading-tight ${selectedBank === bank ? 'text-[#0D47A1]' : 'text-gray-600'}`}>
                        {label}
                      </div>
                      {selectedBank === bank && (
                        <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-[#0D47A1] rounded-full flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bank Information */}
          {selectedBank && (
            <div className="rounded-xl border border-[#BBDEFB] overflow-hidden">
              <div className="px-4 py-3 bg-[#E3F2FD] border-b border-[#BBDEFB]">
                <h3 className="text-xs font-semibold text-[#0D47A1] uppercase tracking-wide">Bank Details — {selectedBank ? getBankLabel(selectedBank) : ''}</h3>
              </div>
              <div className="p-4 bg-white">
                <BankInformation bank={selectedBank} />
              </div>
            </div>
          )}

          {/* Price Summary */}
          {(selectedPriceOption || isCustomized) && (
            <div className="rounded-xl border border-[#BBDEFB] overflow-hidden">
              <div className="px-4 py-3 bg-[#0D47A1]">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wide">
                  Price Summary {isCustomized && (
                    <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-[10px]">
                      {effectiveCustomOption === 1 && quotation.custom_title_option1
                        ? quotation.custom_title_option1
                        : effectiveCustomOption === 2 && quotation.custom_title_option2
                        ? quotation.custom_title_option2
                        : 'Customized'}
                    </span>
                  )}
                </h3>
              </div>
              <div className="bg-white divide-y divide-[#E3F2FD]">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-xs font-medium text-[#0D47A1]/60 uppercase tracking-wide">Unit Price</span>
                  <span className="text-sm font-semibold text-gray-800">
                    {isCustomized && getCustomizedUnitPrice()
                      ? `$${parseNumeric(getCustomizedUnitPrice()!).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : (() => {
                          if (!selectedPriceOption) return 'N/A';
                          const val = selectedPriceOption[`unit_price_option${selectedPriceOption.id}`];
                          const num = typeof val === 'string' ? parseFloat(val) : typeof val === 'number' ? val : NaN;
                          return !isNaN(num) ? `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A';
                        })()
                    }
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-xs font-medium text-[#0D47A1]/60 uppercase tracking-wide">Quantity</span>
                  <span className="text-sm font-semibold text-gray-800">{parseNumeric(quotation.quantity)} units</span>
                </div>
                {!isCustomized && quotationFees !== null && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-xs font-medium text-[#0D47A1]/60 uppercase tracking-wide">Service Fee</span>
                    <span className="text-sm font-semibold text-gray-800">
                      ${quotationFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between px-4 py-3 bg-[#E3F2FD]">
                  <span className="text-sm font-bold text-[#0D47A1] uppercase tracking-wide">Total</span>
                  <span className="text-xl font-bold text-[#0D47A1]">
                    ${getTotalToPay().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600">{errorMessage}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#BBDEFB] px-5 py-4 flex-shrink-0 bg-white">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-5 py-3 rounded-lg border border-[#BBDEFB] text-[#0D47A1] text-sm font-medium hover:bg-[#E3F2FD] transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                setErrorMessage(null);
                if (selectedBank) {
                  window.lastSelectedPaymentMethod = selectedBank;
                  try { sessionStorage.setItem('last_selected_payment_method', selectedBank); } catch {}
                }
                const resetTimeout = setTimeout(() => {
                  if (isProcessing) { setIsProcessing(false); setIsLoading(false); setErrorMessage('The operation timed out. Please try again.'); }
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
              disabled={isProcessing || isLoading || !selectedBank || (!isCustomized && !selectedPriceOption) || !quotationUuid || (isCustomized && custFiles.length === 0)}
              className="flex-1 px-6 py-3 bg-[#0D47A1] text-white rounded-lg hover:bg-[#1565C0] transition-all flex items-center justify-center gap-2 disabled:bg-[#E3F2FD] disabled:text-[#0D47A1]/40 disabled:cursor-not-allowed font-semibold shadow-sm"
            >
              {(isProcessing || isLoading) ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
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
