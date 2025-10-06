"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/button/Button";
import { useAuth } from "@/context/AuthContext";

interface PaymentInfo {
  id: string;
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
        quotation_ids
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        // Format the payment data with the new column names
        const formattedPayments = data.map((payment: Record<string, unknown>) => ({
          id: payment.id as string,
          amount: payment.total_amount as number,
          status: payment.status as "Pending" | "processing" | "completed" | "failed" | "Approved",
          date: new Date((payment.created_at as string)).toLocaleDateString(),
      quotations: (payment.quotation_ids as string[] || []), // Use quotation_ids directly if available
          paymentMethod: payment.method as string,
          proofUrl: payment.proof_url as string | undefined
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

  const toggleExpandPayment = (paymentId: string) => {
    if (expandedPayment === paymentId) {
      setExpandedPayment(null);
    } else {
      setExpandedPayment(paymentId);
      // Reset selected file when expanding to ensure correct UI state
      setSelectedFile(null);
    }
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

      {/* Bank Accounts Section - updated for dark mode */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
            Bank Account Details
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Please use one of the following bank accounts for your payments
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5">
          {/* Wise Bank */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800/60">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center">
                <Image 
                  src="/images/banks/wise1.svg" 
                  alt="Wise Bank" 
                  width={60} 
                  height={60} 
                  className="mr-3"
                />
                <h3 className="text-lg font-medium text-gray-800 dark:text-white">Wise Bank</h3>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-900/20"
                onClick={() => navigator.clipboard.writeText("BE24 9052 0546 8538")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </Button>
            </div>
            <div className="space-y-2 text-sm text-gray-800 dark:text-gray-300">
              <p><span className="font-medium">Beneficiary Name:</span> SOURCING LAUNCH LTD</p>
              <p><span className="font-medium">Email:</span> mehdi@sourcinglaunch.com</p>
              <p><span className="font-medium">IBAN:</span> BE24 9052 0546 8538</p>
              <p><span className="font-medium">Swift/BIC:</span> TRWIBEB1XXX</p>
              <p><span className="font-medium">Currency:</span> EUR</p>
              <p><span className="font-medium">Address:</span> Wise, Rue du Trône 100, 3rd floor, Brussels, 1050, Belgium</p>
            </div>
          </div>

          {/* Citibank (Payoneer) - Replacing Société Générale */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800/60">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center">
                <Image 
                  src="/images/banks/payoneer.svg" 
                  alt="Citibank (Payoneer)" 
                  width={60} 
                  height={60} 
                  className="mr-3"
                />
                <h3 className="text-lg font-medium text-gray-800 dark:text-white">Citibank (Payoneer)</h3>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-900/20"
                onClick={() => navigator.clipboard.writeText("70583160001753419")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </Button>
            </div>
            <div className="space-y-2 text-sm text-gray-800 dark:text-gray-300">
              <p><span className="font-medium">Beneficiary Name:</span> SOURCING LAUNCH LTD</p>
              <p><span className="font-medium">Email:</span> mehdi@sourcinglaunch.com</p>
              <p><span className="font-medium">Account Number:</span> 70583160001753419</p>
              <p><span className="font-medium">Account Type:</span> CHECKING</p>
              <p><span className="font-medium">Routing (ABA):</span> 031100209</p>
              <p><span className="font-medium">SWIFT Code:</span> CITIUS33</p>
              <p><span className="font-medium">Bank Address:</span> 111 Wall Street New York, NY 10043 USA</p>
              <p><span className="font-medium">Currency:</span> USD</p>
            </div>
          </div>

          {/* Binance Wallet */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800/60">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center">
                <Image 
                  src="/images/banks/Binance_Logo.svg.png" 
                  alt="Binance Logo" 
                  width={60} 
                  height={60} 
                  className="mr-3"
                />
                <h3 className="text-lg font-medium text-gray-800 dark:text-white">Binance Wallet</h3>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-900/20"
                onClick={() => navigator.clipboard.writeText("0x236f536f5d68184073057259b1a4da495a28e8a8")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </Button>
            </div>
            <div className="space-y-2 text-sm text-gray-800 dark:text-gray-300">
              <p><span className="font-medium">Network:</span> BNB Smart Chain (BEP20)</p>
              <p><span className="font-medium">Deposit Address:</span> 0x236f536f5d68184073057259b1a4da495a28e8a8</p>
              <p><span className="font-medium">Currency:</span> USDT</p>
            </div>
          </div>
        </div>
      </div>

      {payments.length === 0 ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-blue-700 font-semibold text-lg mb-3">No Payments Found</h2>
          <p className="text-blue-600 mb-4">You haven&apos;t made any payments yet.</p>
          <Link href="/quotation">
            <Button variant="primary" className="bg-[#1E88E5] hover:bg-[#0D47A1]">
              View Quotations
            </Button>
          </Link>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-5 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
              Recent Payments
            </h2>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {payments.map((payment) => (
              <div key={payment.id} className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Payment ID:</span>
                      <span className="font-medium text-gray-800 dark:text-white">{payment.id}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Date:</span>
                      <span className="text-gray-700 dark:text-gray-300">{payment.date}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Method:</span>
                      <span className="capitalize text-gray-700 dark:text-gray-300">{payment.paymentMethod.toLowerCase().replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Status:</span>
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
  payment.status === 'Approved'
    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    : getStatusColor(payment.status)
}`}>
                        {payment.status}
                      </span>
                    </div>
                    {payment.quotations && payment.quotations.length > 0 && (
                      <div className="mt-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Quotation IDs:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {payment.quotations.map((qId) => (
                            <span key={qId} className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded-full">
                              {qId}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col md:items-end gap-2">
                    <div className="text-xl font-bold text-gray-900 dark:text-white">${payment.amount.toFixed(2)}</div>

                      <Button
                        onClick={() => handleUploadProof(payment.id)}
                        variant="primary"
                        size="sm"
                      className={payment.proofUrl ? "bg-[#1E88E5] hover:bg-[#0D47A1]" : "bg-[#1E88E5] hover:bg-[#0D47A1]"}
                      >
                      {payment.proofUrl ? "Update Proof" : "Upload Proof"}
                      </Button>
                    
                    <Button
                      onClick={() => toggleExpandPayment(payment.id)}
                      variant="outline"
                      size="sm"
                      className="text-[#1E88E5] border-[#1E88E5] hover:bg-blue-50 dark:text-blue-400 dark:border-blue-400"
                    >
                      {expandedPayment === payment.id ? 'Hide Details' : 'View Details'}
                    </Button>
                  </div>
                </div>
                
                {/* Quotation details - shown when expanded */}
                {expandedPayment === payment.id && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    {/* Payment Proof Upload Section */}
                    <div className="mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Payment Proof
                    </h4>
                    
                      {renderFileUpload(payment)}
                    </div>
                  
                    {quotationsMap[payment.id]?.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {quotationsMap[payment.id].map((quotation) => (
                          <div 
                            key={quotation.uuid} 
                            className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-start gap-3 bg-gray-50 dark:bg-gray-900"
                          >
                            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0">
                              {quotation.hasImage ? (
                                <Image
                                  src={quotation.imageUrl || ''} 
                                  alt={quotation.product_name}
                                  width={48}
                                  height={48}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            </div>
                              )}
                            </div>
                            <div className="flex-grow">
                              <h5 className="text-sm font-medium text-gray-800 dark:text-white">
                                {quotation.product_name}
                              </h5>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                <p>Quantity: {quotation.quantity}</p>
                                <p>Quotation ID: {quotation.id}</p>
                              </div>
                              {/* Status badge */}
                              <div className="mt-2">
                                <span
                                  className={`px-2 py-1 text-xs font-semibold rounded-full
                                    ${quotation.status === 'Rejected'
                                      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                      : quotation.status === 'Pending'
                                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                      : quotation.status === 'Approved'
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                      : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'}
                                  `}
                                >
                                  {quotation.status}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
              ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        
                      </p>
                    )}
                </div>
              )}
            </div>
            ))}
            </div>
          </div>
        )}
    </div>
  );
} 