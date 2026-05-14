"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/button/Button";
import { useAuth } from "@/context/AuthContext";
import { Modal } from "@/components/ui/modal";
import Badge from "@/components/ui/badge/Badge";

const CopyRow = ({ label, value }: { label: string; value: string }) => {
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-[#E3F2FD] last:border-0 group">
      <div className="min-w-0">
        <span className="text-xs text-[#0D47A1]/50 font-medium">{label}</span>
        <p className="text-sm text-gray-800 font-medium break-all">{value}</p>
      </div>
      <button
        onClick={copy}
        className="flex-shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-[#E3F2FD] transition-all text-[#0D47A1]/50 hover:text-[#0D47A1]"
        title={`Copy ${label}`}
      >
        {copied ? (
          <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>
    </div>
  );
};

interface PaymentInfo {
  id: string;
  reference_number?: string;
  amount: number;
  status: "Pending" | "processing" | "completed" | "failed" | "Approved";
  date: string;
  quotations: string[];
  paymentMethod: string;
  proofUrl?: string;
}

interface QuotationInfo {
  id: string;
  uuid: string;
  product_name: string;
  quantity: string;
  status: string | "Approved";
  created_at: string;
  product_images: string[];
  hasImage?: boolean;
  imageUrl?: string;
}

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

// Cache configuration
const CACHE_KEY = 'payment_data_cache';
const CACHE_EXPIRY = 30 * 1000; // 30 seconds in milliseconds (reduced from 5 minutes)

// Define types for error to avoid using 'any'
interface SupabaseError {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
}

// Define the cache structure
interface CacheData {
  payments: PaymentInfo[];
  quotationsMap: Record<string, QuotationInfo[]>;
  timestamp: number;
}

export default function PaymentPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/signup");
    }
  }, [user, loading, router]);

  const [isLoading, setIsLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [quotationsMap, setQuotationsMap] = useState<Record<string, QuotationInfo[]>>({});
  const [expandedPayment, setExpandedPayment] = useState<string | null>(null);
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Quotation details modal states
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [selectedPaymentForQuotation, setSelectedPaymentForQuotation] = useState<PaymentInfo | null>(null);
  const [fullQuotationDetails, setFullQuotationDetails] = useState<FullQuotationDetails[]>([]);
  const [loadingQuotationDetails, setLoadingQuotationDetails] = useState(false);

  const fetchAllQuotationDetails = useCallback(async (paymentsData: PaymentInfo[]) => {
    const quotationMap: Record<string, QuotationInfo[]> = {};
    
    try {
      if (paymentsData.length === 0) return quotationMap;
      
      // Collect all quotation IDs across all payments
      const allQuotationIds: string[] = [];
      const quotationToPaymentMap: Record<string, string> = {};
      
      // First get all relevant quotation IDs
      for (const payment of paymentsData) {
        if (payment.quotations && payment.quotations.length > 0) {
          // Filter out null or invalid UUIDs
          const validQuotations = payment.quotations.filter(qId => {
            // Check if the ID is a valid string and matches UUID format
            const isValidUUID = typeof qId === 'string' && 
              /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(qId);
            if (!isValidUUID) {
              console.warn(`Invalid quotation ID found: ${qId}`);
            }
            return isValidUUID;
          });

          // Add valid quotations to our tracking
          validQuotations.forEach(qId => {
            allQuotationIds.push(qId);
            quotationToPaymentMap[qId] = payment.id;
          });
        } else {
          // Try to get from junction table - could optimize this in the future
          const { data: junctionData, error: junctionError } = await supabase
            .from('payment_quotations')
            .select('quotation_id')
            .eq('payment_id', payment.id);
            
          if (junctionError) {
            console.error("Error fetching junction data:", junctionError);
            continue;
          }
            
          if (junctionData && junctionData.length > 0) {
            // Filter out null or invalid UUIDs from junction data
            const validIds = junctionData
              .map(item => item.quotation_id)
              .filter(qId => {
                const isValidUUID = typeof qId === 'string' && 
                  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(qId);
                if (!isValidUUID) {
                  console.warn(`Invalid quotation ID found in junction table: ${qId}`);
                }
                return isValidUUID;
              });

            // Update the payment with valid quotation IDs
            payment.quotations = validIds;
            
            validIds.forEach(qId => {
              allQuotationIds.push(qId);
              quotationToPaymentMap[qId] = payment.id;
            });
          }
        }
      }
      
      // If no valid quotation IDs found, return empty map
      if (allQuotationIds.length === 0) {
        console.log("No valid quotation IDs found in payments");
        return quotationMap;
      }
      
      // Remove any duplicate IDs
      const uniqueQuotationIds = [...new Set(allQuotationIds)];
      console.log(`Fetching ${uniqueQuotationIds.length} unique quotations`);
      
      // Fetch all quotations in a single query
      const { data: allQuotations, error: quotationsError } = await supabase
        .from('quotations')
        .select('*')
        .in('id', uniqueQuotationIds);
        
      if (quotationsError) {
        console.error("Error fetching quotations:", quotationsError);
        console.error("Error details:", JSON.stringify(quotationsError, null, 2));
        return quotationMap;
      }
        
      if (!allQuotations || allQuotations.length === 0) {
        console.log("No quotations found for the provided IDs");
        return quotationMap;
      }
      
      // Process all quotations and organize them by payment ID
      allQuotations.forEach(q => {
        const paymentId = quotationToPaymentMap[q.id];
        if (!paymentId) {
          console.warn(`No payment ID mapping found for quotation ${q.id}`);
          return;
        }
        
        // Initialize array for this payment if needed
        if (!quotationMap[paymentId]) {
          quotationMap[paymentId] = [];
        }
        
        // Process image URL - simplified logic
        let imageUrl = "/images/product/product-01.jpg";
        let hasImage = false;
              
        if (q.image_url) {
          imageUrl = q.image_url;
          hasImage = true;
        } else if (q.product_images && q.product_images.length > 0 && q.product_images[0]) {
          imageUrl = q.product_images[0];
          hasImage = true;
          
          // Make sure image URL is fully qualified
          if (!imageUrl.includes('://') && !imageUrl.startsWith('/')) {
            imageUrl = `https://cfhochnjniddaztgwrbk.supabase.co/storage/v1/object/public/quotation-images/product-images/${imageUrl}`;
          }
        }
        
        // Create formatted quotation object
        const formattedQuotation: QuotationInfo = {
          id: q.quotation_id || `QT-${q.id}`,
          uuid: q.id,
          product_name: q.product_name || 'Unnamed Product',
          quantity: q.quantity || '0',
          status: q.status || 'Pending',
          created_at: new Date(q.created_at).toLocaleDateString(),
          product_images: q.product_images || [],
          hasImage,
          imageUrl
        };
        
        // Add to the map
        quotationMap[paymentId].push(formattedQuotation);
      });
      
      return quotationMap;
      
    } catch (error) {
      console.error("Error processing quotation details:", error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
      return quotationMap;
    }
  }, []);

  const fetchPayments = useCallback(async (userId: string) => {
      try {
        // Fetch payments from Supabase using updated column names
        const { data, error } = await supabase
          .from('payments')
          .select(`
            id,
            total_amount,
            status,
            created_at,
            method,
            proof_url,
            quotation_ids,
            reference_number
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        // Format the payment data with the new column names
        const formattedPayments = data.map((payment: Record<string, unknown>) => ({
          id: payment.id as string,
          reference_number: payment.reference_number as string | undefined,
          amount: payment.total_amount as number,
          status: payment.status as "Pending" | "processing" | "completed" | "failed" | "Approved",
          date: new Date((payment.created_at as string)).toLocaleDateString(),
          quotations: (payment.quotation_ids as string[] || []),
          paymentMethod: payment.method as string,
          proofUrl: payment.proof_url as string | undefined,
        }));

        setPayments(formattedPayments);
        
    // Fetch all quotation details at once
    const quotationMap = await fetchAllQuotationDetails(formattedPayments);
    
    // Cache the data for future use
    saveToCache(userId, {
      payments: formattedPayments,
      quotationsMap: quotationMap,
      timestamp: Date.now()
    });
    
      } catch (error: unknown) {
        const supabaseError = error as SupabaseError;
        setError(supabaseError.message);
      } finally {
        setIsLoading(false);
      }
  }, [fetchAllQuotationDetails]);

  // Define handleRefreshData with useCallback for better performance
  const handleRefreshData = useCallback(() => {
    // Clear all caches before reloading
    try {
      // Clear all payment caches for all users
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(CACHE_KEY)) {
          localStorage.removeItem(key);
          console.log(`Cleared cache for key: ${key}`);
        }
      });
    } catch (err) {
      console.error('Error clearing cache:', err);
    }
    
    // Force a complete page reload
    window.location.reload();
    
    // The following code will only run if the reload fails
    setIsLoading(true);
    setIsRefreshing(true);
  }, []);

  useEffect(() => {
    const loadData = async () => {
          try {
        // First check authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser();
            
        if (authError) {
          throw authError;
        }
        
        if (!user) {
          router.push('/login');
          return;
            }
            
        // Try to get data from cache first
        const cachedData = getCachedData(user.id);
        const isPageRefresh = performance && 'navigation' in performance 
          ? performance.navigation.type === 1 
          : false;
        
        if (cachedData && !isRefreshing && !isPageRefresh) {
          // Use cached data if available and not explicitly refreshing
          console.log('Using cached payment data');
          setPayments(cachedData.payments);
          setQuotationsMap(cachedData.quotationsMap);
          setIsLoading(false);
          return;
        }
            
        // Fetch fresh data from database
        await fetchPayments(user.id);
        
      } catch (error: unknown) {
        const supabaseError = error as SupabaseError;
        setError(supabaseError.message);
        setIsLoading(false);
      }
    };

    loadData();
    // Reset refreshing flag after data load
    setIsRefreshing(false);
  }, [router, isRefreshing, fetchPayments]);

  // Simple auto-refresh after redirect - checks URL for refresh parameter
  useEffect(() => {
    // Check URL for refresh parameter
    try {
      const url = new URL(window.location.href);
      const needsRefresh = url.searchParams.get('refresh') === 'true';
      
      if (needsRefresh) {
        console.log('Auto-refresh detected - will refresh once in 5 seconds');
        
        // Remove the refresh parameter from URL
        url.searchParams.delete('refresh');
        window.history.replaceState({}, document.title, url.toString());
        
        // Set a timeout to refresh after 5 seconds
        const refreshTimer = setTimeout(() => {
          console.log('Performing auto-refresh after 5 seconds');
          
          // Clear caches before refresh
          try {
            // Clear all payment caches
            Object.keys(localStorage).forEach(key => {
              if (key.startsWith(CACHE_KEY)) {
                localStorage.removeItem(key);
                console.log(`Auto-refresh: Cleared cache for key: ${key}`);
              }
            });
          } catch (err) {
            console.error('Error clearing cache during auto-refresh:', err);
          }
          
          // Force a full page reload
          window.location.reload();
        }, 5000);
        
        // Clean up the timer if component unmounts
        return () => clearTimeout(refreshTimer);
      }
    } catch (error) {
      console.error('Error setting up auto-refresh:', error);
    }
  }, []);

  // Function to get cached data if valid
  const getCachedData = (userId: string): CacheData | null => {
    try {
      const cachedDataString = localStorage.getItem(`${CACHE_KEY}_${userId}`);
      if (!cachedDataString) return null;
      
      const cachedData = JSON.parse(cachedDataString) as CacheData;
      const now = Date.now();
      
      // Check if cache is still valid (not expired)
      if (now - cachedData.timestamp < CACHE_EXPIRY) {
        return cachedData;
                    } 
      
      // Clear expired cache
      localStorage.removeItem(`${CACHE_KEY}_${userId}`);
      return null;
    } catch (error) {
      console.error('Error reading from cache:', error);
        return null;
                  }
    };

  // Function to save data to cache
  const saveToCache = (userId: string, data: CacheData) => {
    try {
      localStorage.setItem(`${CACHE_KEY}_${userId}`, JSON.stringify({
        ...data,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error saving to cache:', error);
      // If caching fails, just continue without caching
      }
    };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'processing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const handleUploadProof = (paymentId: string) => {
    setCurrentPaymentId(paymentId);
    setUploadSuccess(false);
    setUploadError(null);
    setSelectedFile(null);
    
    // Always expand the payment row
    setExpandedPayment(paymentId);
    
    // Reset file input if it exists
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      
      // Basic validation for file type and size
      if (!file.type.includes('image/') && !file.type.includes('application/pdf')) {
        setUploadError("Please upload an image (JPG, PNG) or PDF file.");
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setUploadError("File size should be less than 5MB.");
        return;
      }
      
      if (!currentPaymentId) {
        setUploadError("Payment ID is missing.");
        return;
      }
      
      // Automatically upload the file
      setIsUploading(true);
      setUploadError(null);
      setUploadSuccess(false);
      
      try {
        await handleUploadFile(file);
      } catch (error) {
        console.error("Error during automatic upload:", error);
        setUploadError("Failed to upload the file. Please try again.");
        setIsUploading(false);
      }
      
    } else {
      setSelectedFile(null);
      setUploadSuccess(false);
      setUploadError(null);
    }
  };

  // Helper function to handle file upload
  const handleUploadFile = async (file: File) => {
    if (!currentPaymentId) {
      setUploadError("Payment ID is missing.");
      return;
    }

    // Basic validation for file type and size
    if (!file.type.includes('image/') && !file.type.includes('application/pdf')) {
      setUploadError("Please upload an image (JPG, PNG) or PDF file.");
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setUploadError("File size should be less than 5MB.");
      return;
    }
    
    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(false);
    
    try {
      // Check if payment exists and get its details
      const { data: existingPayment, error: paymentError } = await supabase
        .from('payments')
        .select('*')
        .eq('id', currentPaymentId)
        .single();

      if (paymentError) {
        throw new Error('Payment not found');
      }

      // Upload file to Supabase Storage
      const timestamp = new Date().getTime();
      const fileExt = file.name.split('.').pop();
      const fileName = `payment_proof_${currentPaymentId}_${timestamp}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('payment_proofs')
        .upload(filePath, file);

      if (uploadError) {
        throw new Error('Error uploading file');
      }

      // Get the URL of the uploaded file
      const { data: urlData } = supabase.storage
        .from('payment_proofs')
        .getPublicUrl(filePath);

      const fileUrl = urlData.publicUrl;

      // Update payment record with proof details
      const { error: updateError } = await supabase
        .from('payments')
        .update({
          proof_url: fileUrl,
          status: 'processing'
        })
        .eq('id', currentPaymentId);

      if (updateError) {
        console.error('Supabase update error:', updateError);
        throw new Error(`Error updating payment record: ${updateError.message}`);
      }

      // Update the payment in the local state
      setPayments(prevPayments => 
        prevPayments.map(payment => 
          payment.id === currentPaymentId 
            ? { 
                ...payment, 
                proofUrl: fileUrl,
                status: 'processing'
              } 
            : payment
        )
      );

      setUploadSuccess(true);
      // Refresh payment data
      fetchPayments(existingPayment.user_id);
      
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsUploading(false);
    }
  };

  const renderFileUpload = (payment: PaymentInfo) => {
    if (currentPaymentId !== payment.id) {
      return (
        <div className="flex flex-col">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {payment.proofUrl 
              ? "You've already uploaded proof for this payment."
              : "No payment proof has been uploaded yet."}
          </p>
          <Button
            onClick={() => handleUploadProof(payment.id)} 
            variant={payment.proofUrl ? "outline" : "primary"}
            size="sm"
            className={payment.proofUrl 
              ? "w-fit mt-1 border-blue-300 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 dark:border-blue-500 dark:text-blue-400"
              : "w-fit mt-1 bg-[#1E88E5] hover:bg-[#0D47A1]"}
          >
            {payment.proofUrl ? "Replace Proof" : "Upload Proof"}
          </Button>
        </div>
      );
    }

    return (
      <div className="mt-3 border rounded-lg p-5 bg-gray-50 dark:bg-gray-900 relative overflow-hidden">
        {/* Upload instruction */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Upload Payment Proof
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Please upload an image (JPG, PNG) or PDF file (max 5MB)
          </p>
        </div>
        
        {/* File input area */}
        <label 
          htmlFor="proof" 
          className={`
            relative block w-full p-4 border-2 border-dashed 
            rounded-lg text-center cursor-pointer transition-all
            ${isUploading ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500' : 'border-gray-300 hover:border-blue-400 dark:border-gray-600 dark:hover:border-blue-500'}
            ${selectedFile ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
          `}
        >
          <input
            type="file"
            id="proof"
            name="proof"
            onChange={handleFileChange}
            className="sr-only"
            accept="image/png, image/jpeg, image/jpg, application/pdf"
            disabled={isUploading}
            ref={fileInputRef}
          />
          
          <div className="flex flex-col items-center justify-center">
            {!selectedFile && !isUploading && (
              <>
                <div className="mb-2 rounded-full bg-blue-100 dark:bg-blue-900/40 p-2 text-blue-500 dark:text-blue-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Click to select a file</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">or drag and drop</span>
              </>
            )}
            
            {selectedFile && !isUploading && (
              <>
                <div className="mb-2 rounded-full bg-green-100 dark:bg-green-900/40 p-2 text-green-500 dark:text-green-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-green-600 dark:text-green-400">File selected</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-[240px] truncate">{selectedFile.name}</span>
              </>
            )}
            
            {isUploading && (
              <>
                <div className="mb-2">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Uploading...</span>
                <div className="w-full max-w-xs bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-3">
                  <div className="bg-blue-500 h-1.5 rounded-full animate-pulse" style={{width: '100%'}}></div>
                </div>
              </>
            )}
          </div>
        </label>
        
        {/* File info and results */}
        <div className="mt-4">
          {uploadError && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3 mt-3 flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-400">Upload failed</h3>
                <div className="mt-1 text-xs text-red-700 dark:text-red-300">
                  {uploadError}
                </div>
              </div>
            </div>
          )}

          {uploadSuccess && (
            <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-3 mt-3 flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800 dark:text-green-400">Upload successful</h3>
                <div className="mt-1 text-xs text-green-700 dark:text-green-300">
                  Your payment proof has been uploaded and is being processed.
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Cancel button */}
        {!uploadSuccess && (
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => {
                setCurrentPaymentId(null);
                setSelectedFile(null);
              }}
              variant="outline"
              size="sm"
              className="text-gray-600 border-gray-300 hover:bg-gray-50 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    );
  };


  // Open quotation details modal and fetch full details
  const openQuotationDetailsModal = async (payment: PaymentInfo) => {
    setSelectedPaymentForQuotation(payment);
    setShowQuotationModal(true);
    setFullQuotationDetails([]);
    
    if (payment.quotations && payment.quotations.length > 0) {
      setLoadingQuotationDetails(true);
      try {
        // Filter valid UUIDs
        const validQuotationIds = payment.quotations.filter(qId => {
          return typeof qId === 'string' && 
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(qId);
        });

        if (validQuotationIds.length > 0) {
          // Fetch all quotation details
          const { data: quotationData, error } = await supabase
            .from('quotations')
            .select('*')
            .in('id', validQuotationIds);

          if (error) {
            console.error("Error fetching quotation details:", error);
          } else if (quotationData) {
            setFullQuotationDetails(quotationData);
          }
        }
      } catch (error) {
        console.error("Error fetching quotation details:", error);
      } finally {
        setLoadingQuotationDetails(false);
      }
    }
  };

  // Get status badge color
  const getStatusBadgeColor = (status: string): "primary" | "success" | "warning" | "info" | "error" => {
    if (status === "Approved") return "success";
    if (status === "Rejected") return "error";
    if (status === "Pending") return "warning";
    return "info";
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-4 border-t-blue-500 border-gray-200 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">
            {isRefreshing ? "Refreshing payment data..." : "Loading payment history..."}
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 mx-auto my-8 max-w-3xl">
        <h2 className="text-red-700 font-semibold text-lg mb-3">Error</h2>
        <p className="text-red-600">{error}</p>
        <Button
          variant="primary"
          className="mt-4 bg-[#1E88E5] hover:bg-[#0D47A1]"
          onClick={() => router.push('/dashboard-home')}
        >
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-[#0D47A1] dark:text-white/90">
          Payment History
          </h1>
          <Button 
            variant="outline" 
            size="sm"
            className={`
              ${isRefreshing 
                ? "text-blue-500 border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                : "text-[#1E88E5] border-[#1E88E5] hover:bg-blue-50"
              }
              transition-all duration-300
            `}
            onClick={handleRefreshData}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
                Refreshing...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </>
            )}
          </Button>
      </div>

      {/* Bank Accounts Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-[#BBDEFB] overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-[#BBDEFB] bg-[#E3F2FD]">
          <h2 className="text-base font-semibold text-[#0D47A1]">Bank Account Details</h2>
          <p className="text-xs text-[#0D47A1]/60 mt-0.5">Use one of the following accounts for your payment</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-5">

          {/* Payoneer */}
          <div className="border border-[#BBDEFB] rounded-xl p-4 bg-white">
            <div className="relative w-24 h-8 mb-3"><Image src="/images/banks/payoneer.svg" alt="Payoneer" fill className="object-contain object-left" /></div>
            <CopyRow label="Email" value="Mehdi@sourcinglaunch.com" />
            <CopyRow label="Currency" value="USD" />
          </div>

          {/* Wise */}
          <div className="border border-[#BBDEFB] rounded-xl p-4 bg-white">
            <div className="relative w-16 h-8 mb-3"><Image src="/images/banks/wise1.svg" alt="Wise" fill className="object-contain object-left" /></div>
            <CopyRow label="Email" value="Mehdi@sourcinglaunch.com" />
            <CopyRow label="Currency" value="USD" />
          </div>

          {/* Airwallex */}
          <div className="border border-[#BBDEFB] rounded-xl p-4 bg-white">
            <div className="relative w-28 h-8 mb-3"><Image src="/images/banks/airwallex.png" alt="Airwallex" fill className="object-contain object-left" /></div>
            <CopyRow label="Account Number" value="1011108303257824" />
            <CopyRow label="Alternative Name" value="Dongguan Caiqi Supply Chain Co., Ltd." />
            <CopyRow label="Currency" value="USD" />
          </div>

          {/* Wire Bank Transfer */}
          <div className="border border-[#BBDEFB] rounded-xl p-4 bg-white md:col-span-2 xl:col-span-2">
            <div className="relative w-24 h-10 mb-3"><Image src="/images/banks/bank-wire.png" alt="Wire Transfer" fill className="object-contain object-left" /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <CopyRow label="Account Number" value="7982930215" />
              <CopyRow label="Holder Name" value="Dongguan Caiqi Supply Chain Co., Ltd." />
              <CopyRow label="Bank Name" value="DBS BANK (HONG KONG) LIMITED" />
              <CopyRow label="Country" value="HONG KONG, CHINA" />
              <CopyRow label="Bank Address" value="11th Floor, The Center, 99 Queen's Road Central, Central, Hong Kong" />
              <CopyRow label="Account Type" value="Current" />
              <CopyRow label="Swift / BIC" value="DHBKHKHH" />
              <CopyRow label="Bank Code" value="016" />
              <CopyRow label="Branch Number" value="478" />
              <CopyRow label="Currency" value="USD" />
            </div>
          </div>

          {/* Binance */}
          <div className="border border-[#BBDEFB] rounded-xl p-4 bg-white">
            <div className="relative w-28 h-8 mb-3"><Image src="/images/banks/Binance_Logo.svg.png" alt="Binance" fill className="object-contain object-left" /></div>
            <CopyRow label="Binance ID" value="353293752" />
            <CopyRow label="Name" value="SOURCING LAUNCH LTD" />
            <CopyRow label="Wallet" value="0x236f536f5d68184073057259b1a4da495a28e8a8" />
            <CopyRow label="Network" value="BNB Smart Chain (BEP20)" />
            <CopyRow label="Currency" value="USDT" />
          </div>

        </div>
      </div>

      {payments.length === 0 ? (
        <div className="rounded-xl border border-[#BBDEFB] bg-[#E3F2FD] p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-white border border-[#BBDEFB] flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-[#0D47A1]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[#0D47A1]">No payments yet</p>
          <p className="text-xs text-[#0D47A1]/50 mt-1 mb-4">Your payment history will appear here.</p>
          <Link href="/quotation">
            <Button variant="primary" className="bg-[#0D47A1] hover:bg-[#1565C0]">View Quotations</Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-[#BBDEFB] overflow-hidden bg-white">

          {/* Table header */}
          <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 bg-[#E3F2FD] border-b border-[#BBDEFB]">
            <span className="text-[11px] font-semibold text-[#0D47A1] uppercase tracking-wide">Reference</span>
            <span className="text-[11px] font-semibold text-[#0D47A1] uppercase tracking-wide">Date</span>
            <span className="text-[11px] font-semibold text-[#0D47A1] uppercase tracking-wide">Method</span>
            <span className="text-[11px] font-semibold text-[#0D47A1] uppercase tracking-wide">Amount</span>
            <span className="text-[11px] font-semibold text-[#0D47A1] uppercase tracking-wide">Actions</span>
          </div>

          <div className="divide-y divide-[#E3F2FD]">
            {payments.map((payment) => {
              const isExpanded = expandedPayment === payment.id;
              const statusStyles: Record<string, string> = {
                Approved:   'bg-green-100 text-green-700 border-green-200',
                completed:  'bg-green-100 text-green-700 border-green-200',
                Pending:    'bg-amber-100 text-amber-700 border-amber-200',
                processing: 'bg-blue-100  text-blue-700  border-blue-200',
                failed:     'bg-red-100   text-red-700   border-red-200',
              };
              const ss = statusStyles[payment.status] ?? 'bg-gray-100 text-gray-600 border-gray-200';
              const methodLabel = payment.paymentMethod.charAt(0).toUpperCase() + payment.paymentMethod.slice(1).toLowerCase().replace(/_/g, ' ');

              return (
                <div key={payment.id}>
                  {/* Row */}
                  <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-4 items-center px-5 py-3.5 hover:bg-[#E3F2FD]/30 transition-colors">

                    {/* Reference */}
                    <div className="min-w-0">
                      <p className="text-xs font-mono font-medium text-[#0D47A1] truncate">
                        {payment.reference_number || '—'}
                      </p>
                      {payment.proofUrl && (
                        <span className="inline-flex items-center gap-1 mt-1 text-[11px] text-green-600 font-medium">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                          Proof uploaded
                        </span>
                      )}
                    </div>

                    {/* Date */}
                    <p className="text-sm text-gray-600">{payment.date}</p>

                    {/* Method */}
                    <p className="text-sm text-gray-700 font-medium">{methodLabel}</p>

                    {/* Amount + status */}
                    <div>
                      <p className="text-sm font-bold text-[#0D47A1]">
                        ${payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <span className={`mt-1 inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border ${ss}`}>
                        {payment.status}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUploadProof(payment.id)}
                        title={payment.proofUrl ? 'Update Proof' : 'Upload Proof'}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0D47A1] text-white text-xs font-semibold hover:bg-[#1565C0] transition-colors whitespace-nowrap"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                        </svg>
                        {payment.proofUrl ? 'Update' : 'Proof'}
                      </button>
                      <button
                        onClick={() => openQuotationDetailsModal(payment)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#BBDEFB] text-[#0D47A1] text-xs font-semibold hover:bg-[#E3F2FD] transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                        Details
                      </button>
                    </div>
                  </div>

                  {/* Expanded: upload proof + quotations */}
                  {isExpanded && (
                    <div className="border-t border-[#BBDEFB] bg-[#E3F2FD]/20 px-5 py-4 space-y-4">
                      <div>
                        <p className="text-xs font-semibold text-[#0D47A1] uppercase tracking-wide mb-2">Upload Payment Proof</p>
                        {renderFileUpload(payment)}
                      </div>
                      {quotationsMap[payment.id]?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-[#0D47A1] uppercase tracking-wide mb-2">Linked Quotations</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {quotationsMap[payment.id].map((quotation) => {
                              const qss: Record<string, string> = {
                                Approved: 'bg-green-100 text-green-700',
                                Pending:  'bg-amber-100 text-amber-700',
                                Rejected: 'bg-red-100   text-red-700',
                              };
                              return (
                                <div key={quotation.uuid} className="flex items-center gap-3 p-3 rounded-xl border border-[#BBDEFB] bg-white">
                                  <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-[#BBDEFB] bg-[#E3F2FD] flex items-center justify-center">
                                    {quotation.hasImage ? (
                                      <Image src={quotation.imageUrl || ''} alt={quotation.product_name} width={40} height={40} className="w-full h-full object-cover" />
                                    ) : (
                                      <svg className="w-5 h-5 text-[#0D47A1]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                      </svg>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-800 truncate">{quotation.product_name}</p>
                                    <p className="text-xs text-[#0D47A1]/50 mt-0.5">Qty: {quotation.quantity} · {quotation.id}</p>
                                    <span className={`mt-1 inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${qss[quotation.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                      {quotation.status}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quotation Details Modal */}
      <Modal
        isOpen={showQuotationModal}
        onClose={() => setShowQuotationModal(false)}
        showCloseButton={false}
        className="max-w-4xl mx-4 md:mx-auto"
      >
        {selectedPaymentForQuotation && (
          <div className="flex flex-col h-full max-h-[85vh]">
            {/* Fixed Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Quotation Details</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Payment: <span className="font-medium text-gray-900 dark:text-white">${selectedPaymentForQuotation.amount.toFixed(2)}</span>
                  {selectedPaymentForQuotation.quotations && selectedPaymentForQuotation.quotations.length > 0 && (
                    <span className="ml-2">({selectedPaymentForQuotation.quotations.length} quotation{selectedPaymentForQuotation.quotations.length > 1 ? 's' : ''})</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setShowQuotationModal(false)}
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
              {loadingQuotationDetails ? (
                <div className="flex justify-center items-center py-12">
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Loading quotation details...</p>
                  </div>
                </div>
              ) : fullQuotationDetails.length > 0 ? (
                <div className="space-y-6">
                  {fullQuotationDetails.map((quotation, index) => (
                    <div key={quotation.id || index} className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                      {/* Product Information */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                          {quotation.image_url && (
                            <div className="relative h-56 w-full overflow-hidden rounded-xl mb-4 border-2 border-gray-200 dark:border-gray-700 shadow-md">
                              <Image
                                src={quotation.image_url}
                                alt={quotation.product_name || "Product"}
                                fill
                                className="object-cover"
                              />
                            </div>
                          )}
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{quotation.product_name || "Product"}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Quotation ID: <span className="font-medium text-gray-900 dark:text-white">{quotation.quotation_id || "N/A"}</span>
                          </p>
                        </div>

                        <div className="space-y-4">
                          <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Status</p>
                            <Badge color={getStatusBadgeColor(quotation.status)} size="sm">
                              {quotation.status || "Not Available"}
                            </Badge>
                          </div>

                          <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Quantity</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">{quotation.quantity || "N/A"}</p>
                          </div>

                          {quotation.created_at && (
                            <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Created</p>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {new Date(quotation.created_at).toLocaleString()}
                              </p>
                            </div>
                          )}
                        </div>
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
                            <p className="text-base font-semibold text-gray-900 dark:text-white">{quotation.shipping_country || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">City</p>
                            <p className="text-base font-semibold text-gray-900 dark:text-white">{quotation.shipping_city || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Method</p>
                            <p className="text-base font-semibold text-gray-900 dark:text-white">{quotation.shipping_method || "N/A"}</p>
                          </div>
                          {quotation.service_type && (
                            <div>
                              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Service Type</p>
                              <p className="text-base font-semibold text-gray-900 dark:text-white">{quotation.service_type}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Receiver Address */}
                      {(quotation.receiver_name || quotation.receiver_phone || quotation.receiver_address) && (
                        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mb-6">
                          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Receiver Address
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {quotation.receiver_name && (
                              <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Name</p>
                                <p className="text-base font-semibold text-gray-900 dark:text-white">{quotation.receiver_name}</p>
                              </div>
                            )}
                            {quotation.receiver_phone && (
                              <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Phone</p>
                                <p className="text-base font-semibold text-gray-900 dark:text-white">{quotation.receiver_phone}</p>
                              </div>
                            )}
                            {quotation.receiver_address && (
                              <div className="md:col-span-2">
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Address</p>
                                <p className="text-base font-medium text-gray-900 dark:text-white whitespace-pre-line">{quotation.receiver_address}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Selected Pricing Option */}
                      {quotation.selected_option != null && (() => {
                        const optionNum = quotation.selected_option;
                        const title = quotation[`title_option${optionNum}`] as string | undefined;
                        const totalPrice = quotation[`total_price_option${optionNum}`] as number | undefined;
                        const unitPrice = quotation[`unit_price_option${optionNum}`] as number | undefined;
                        const deliveryTime = quotation[`delivery_time_option${optionNum}`] as string | undefined;
                        const description = quotation[`description_option${optionNum}`] as string | undefined;
                        const priceDescription = quotation[`price_description_option${optionNum}`] as string | undefined;
                        const unitWeight = quotation[`unit_weight_option${optionNum}`] as number | undefined;
                        const quantity = Number(quotation.quantity) || 0;
                        const calculatedTotal = unitPrice ? Number(unitPrice) * quantity : null;

                        if (!title && !totalPrice) return null;

                        return (
                          <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Selected Pricing Option
                            </h4>
                            <div className="rounded-lg p-4 border-2 bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-400">
                              <div className="flex items-center justify-between mb-4">
                                <h5 className="text-base font-bold text-gray-900 dark:text-white">
                                  Option {optionNum}: {title || "N/A"}
                                </h5>
                                <Badge color="primary" size="sm">Selected</Badge>
                              </div>
                              
                              {/* Price Calculation */}
                              {unitPrice && quantity > 0 && (
                                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4 border border-gray-200 dark:border-gray-700">
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-gray-600 dark:text-gray-400">Unit Price</span>
                                      <span className="text-base font-semibold text-gray-900 dark:text-white">${Number(unitPrice).toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-gray-600 dark:text-gray-400">Quantity</span>
                                      <span className="text-base font-semibold text-gray-900 dark:text-white">× {quantity}</span>
                                    </div>
                                    <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-base font-bold text-gray-900 dark:text-white">Total Paid</span>
                                        <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                                          ${calculatedTotal ? calculatedTotal.toFixed(2) : (totalPrice ? Number(totalPrice).toFixed(2) : "0.00")}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
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
                            
                            {quotation.Quotation_fees && (
                              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <div className="flex justify-between items-center">
                                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Quotation Fees</p>
                                  <p className="text-lg font-bold text-gray-900 dark:text-white">${Number(quotation.Quotation_fees).toFixed(2)}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400">No quotation details available</p>
                </div>
              )}
            </div>

            {/* Fixed Footer */}
            <div className="flex justify-end p-5 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800">
              <button
                onClick={() => setShowQuotationModal(false)}
                className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 font-medium shadow-sm hover:shadow-md"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
} 