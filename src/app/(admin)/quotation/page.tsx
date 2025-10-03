"use client";

import { useState, useEffect, useCallback } from "react";
import React from "react";
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
import QuotationFormModal from "@/components/quotation/QuotationFormModal";
import QuotationDetailsModal from "@/components/quotation/QuotationDetailsModal";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import CheckoutConfirmationModal from "@/components/quotation/CheckoutConfirmationModal";
import MultiQuotationModal from "@/components/quotation/MultiQuotationModal";
import { QuotationData, PriceOption } from "@/types/quotation";
import { useRouter } from "next/navigation";

// Metrics interface
interface QuotationMetrics {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
}

export default function QuotationPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<QuotationData | null>(null);
  const [quotationData, setQuotationData] = useState<QuotationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<QuotationMetrics>({
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0
  });
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [selectedCheckoutQuotation, setSelectedCheckoutQuotation] = useState<QuotationData | null>(null);
  const [isMultiQuotationModalOpen, setIsMultiQuotationModalOpen] = useState(false);
  const [approvedQuotations, setApprovedQuotations] = useState<QuotationData[]>([]);
  const [profileComplete, setProfileComplete] = useState(true);
  const router = useRouter();

  // Get the current user from auth context
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/signup");
    }
  }, [user, loading, router]);

  // Function to check if the user profile is complete
  const checkProfileCompleteness = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, phone, country, address, city')
        .eq('id', userId)
        .single();

      if (error) {
        console.error("Error fetching profile data:", error);
        setProfileComplete(false);
        return false;
      }

      // Check if essential profile fields are filled
      const isComplete = data && 
                        data.first_name && 
                        data.last_name && 
                        data.phone && 
                        data.country;
      
      setProfileComplete(!!isComplete);
      return !!isComplete;
    } catch (error) {
      console.error("Error checking profile completeness:", error);
      setProfileComplete(false);
      return false;
    }
  }, []);

  // Check profile completeness when user changes
  useEffect(() => {
    if (user?.id) {
      checkProfileCompleteness(user.id);
    }
  }, [user?.id, checkProfileCompleteness]);

  // Fetch quotation data and metrics from Supabase
  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        
        console.log("Fetching quotations data...");
        
        // Check current user session first
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Session error:", sessionError);
        }
        
        console.log("Current user session:", sessionData?.session ? "Authenticated" : "Not authenticated");
        
        // Get the user ID from the auth context
        const userId = user?.id;
        
        if (!userId) {
          console.warn("No user ID available, showing no quotations");
          setQuotationData([]);
          setIsLoading(false);
          return;
        }
        
        // Fetch quotations with all necessary fields and filter by user_id
        console.log(`Executing quotations query for user_id: ${userId}...`);
        const { data: quotationsData, error: quotationsError } = await supabase
          .from('quotations')
          .select(`
            id,
            quotation_id,
            product_name,
            quantity,
            created_at,
            status,
            shipping_method,
            shipping_country,
            shipping_city,
            image_url,
            service_type,
            product_url,
            selected_option,
            title_option1,
            image_option1,
            total_price_option1,
            delivery_time_option1,
            description_option1,
            title_option2,
            image_option2,
            total_price_option2,
            delivery_time_option2,
            description_option2,
            title_option3,
            image_option3,
            total_price_option3,
            delivery_time_option3,
            description_option3,
            unit_price_option1,
            unit_weight_option1,
            image_option1_2,
            unit_price_option2,
            unit_weight_option2,
            image_option2_2,
            unit_price_option3,
            unit_weight_option3,
            image_option3_2
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
          
        if (quotationsError) {
          console.error("Error fetching quotations:", quotationsError);
          console.error("Error details:", JSON.stringify(quotationsError, null, 2));
          setQuotationData([]);
          setIsLoading(false);
          return;
        }

        if (!quotationsData || quotationsData.length === 0) {
          console.log("No quotations found for this user");
          setQuotationData([]);
          setMetrics({
            total: 0,
            approved: 0,
            pending: 0,
            rejected: 0
          });
          setIsLoading(false);
          return;
        }
        
        console.log(`Quotations retrieved: ${quotationsData.length}`);
        
        // Transform data to match the format expected by the component
        try {
          const formattedData = quotationsData.map(item => {
            // Format price options from the flattened data
            const priceOptions: PriceOption[] = [];
            
            // Add option 1 if it exists
            if (item.title_option1) {
              priceOptions.push({
                id: '1',
                price: item.total_price_option1 ? `$${parseFloat(item.total_price_option1).toLocaleString()}` : 'N/A',
                supplier: item.title_option1,
                deliveryTime: item.delivery_time_option1 || 'N/A',
                description: item.description_option1,
                modelName: item.title_option1,
                modelImage: item.image_option1 || "/images/product/product-01.jpg",
                unit_price_option1: item.unit_price_option1 ?? null,
                unit_weight_option1: item.unit_weight_option1 ?? null,
                image_option1_2: item.image_option1_2 ?? null,
              });
            }
            
            // Add option 2 if it exists
            if (item.title_option2) {
              priceOptions.push({
                id: '2',
                price: item.total_price_option2 ? `$${parseFloat(item.total_price_option2).toLocaleString()}` : 'N/A',
                supplier: item.title_option2,
                deliveryTime: item.delivery_time_option2 || 'N/A',
                description: item.description_option2,
                modelName: item.title_option2,
                modelImage: item.image_option2 || "/images/product/product-01.jpg",
                unit_price_option2: item.unit_price_option2 ?? null,
                unit_weight_option2: item.unit_weight_option2 ?? null,
                image_option2_2: item.image_option2_2 ?? null,
              });
            }
            
            // Add option 3 if it exists
            if (item.title_option3) {
              priceOptions.push({
                id: '3',
                price: item.total_price_option3 ? `$${parseFloat(item.total_price_option3).toLocaleString()}` : 'N/A',
                supplier: item.title_option3,
                deliveryTime: item.delivery_time_option3 || 'N/A',
                description: item.description_option3,
                modelName: item.title_option3,
                modelImage: item.image_option3 || "/images/product/product-01.jpg",
                unit_price_option3: item.unit_price_option3 ?? null,
                unit_weight_option3: item.unit_weight_option3 ?? null,
                image_option3_2: item.image_option3_2 ?? null,
              });
            }

            // Calculate average price from options
            let price;
            if (priceOptions.length > 0) {
              const validPrices = priceOptions
                .map(opt => parseFloat(opt.price.replace(/[$,]/g, '')))
                .filter(p => !isNaN(p));
              
              if (validPrices.length > 0) {
                const average = validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length;
                price = `$${average.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              }
            }
            
            return {
              // Keep the actual UUID as id
              id: item.id,
              // Use quotation_id for display, or generate one from UUID if not available
              quotation_id: item.quotation_id || `QT-${item.id.split('-')[0]}`,
              product: {
                name: item.product_name || "Unnamed Product",
                image: item.image_url || "/images/product/product-01.jpg",
                category: item.service_type || "Uncategorized",
                description: item.product_url ? `Reference URL: ${item.product_url}` : undefined
              },
              quantity: `${item.quantity || 0} units`,
              date: item.created_at ? new Date(item.created_at).toLocaleDateString() : "No date",
              status: item.status || "Pending",
              price: price,
              shippingMethod: item.shipping_method || "Sea Freight",
              destination: `${item.shipping_city || ""}, ${item.shipping_country || ""}`.trim().replace(/^,\s*/, ""),
              priceOptions: priceOptions,
              hasImage: !!item.image_url,
              selected_option: item.selected_option
            };
          });
          
          console.log("Data formatted successfully:", formattedData.length);
          setQuotationData(formattedData);
          
          // Store approved quotations for multi-payment
          const approved = formattedData.filter(item => item.status === "Approved");
          setApprovedQuotations(approved);
          
          // Calculate metrics
          const total = quotationsData.length;
          const approvedCount = quotationsData.filter(item => item.status === "Approved").length;
          const pending = quotationsData.filter(item => item.status === "Pending").length;
          const rejected = quotationsData.filter(item => item.status === "Rejected").length;
          
          console.log(`Metrics - Total: ${total}, Approved: ${approvedCount}, Pending: ${pending}, Rejected: ${rejected}`);
          
          setMetrics({
            total,
            approved: approvedCount,
            pending,
            rejected
          });
        } catch (formatError) {
          console.error("Error formatting data:", formatError);
        }
      } catch (error) {
        console.error("Exception fetching data:", error);
        console.error("Error details:", error instanceof Error ? error.message : String(error));
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchData();
  }, [user?.id]); // Add user?.id as a dependency

  // Check if there are any approved quotations
  // const hasApprovedQuotations = quotationData.some(item => item.status === "Approved");

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const openDetailsModal = (quotation: QuotationData) => {
    setSelectedQuotation(quotation);
    setIsDetailsModalOpen(true);
  };

  const closeDetailsModal = () => {
    setIsDetailsModalOpen(false);
    setSelectedQuotation(null);
  };

  const openCheckoutModal = (quotation: QuotationData) => {
    setSelectedCheckoutQuotation(quotation);
    setIsCheckoutModalOpen(true);
  };

  const closeCheckoutModal = () => {
    setSelectedCheckoutQuotation(null);
    setIsCheckoutModalOpen(false);
  };

  const closeMultiQuotationModal = () => {
    setIsMultiQuotationModalOpen(false);
  };

  const handleCheckoutConfirm = (selectedQuotations: QuotationData[], paymentMethod: string) => {
    try {
      if (!selectedQuotations || selectedQuotations.length === 0) {
        throw new Error("No quotations selected");
      }

      if (!paymentMethod) {
        throw new Error("No payment method selected");
      }

      // If there's only one quotation, use single quotation flow
      if (selectedQuotations.length === 1) {
        const quotationId = selectedQuotations[0].quotation_id || selectedQuotations[0].id;
        const url = `/payment?quotationId=${quotationId}`;
        window.location.href = url;
        return;
      }
      
      // For multiple quotations, create a comma-separated list of quotation IDs
      const quotationIds = selectedQuotations
        .map(q => q.quotation_id || q.id)
        .filter(Boolean)
        .join(',');

      if (!quotationIds) {
        throw new Error("Invalid quotation IDs");
      }

      const url = `/payment`;
      window.location.href = url;
    } catch (error) {
      console.error('Error processing checkout:', error);
      alert('There was an error processing your request. Please try again.');
    }
  };

  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      {/* Page Header Section */}
      <div className="col-span-12">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-[#0D47A1] dark:text-blue-400">
            Quotation Management
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            { /* Temporarily hidden Pay Now button - restore later if needed */ }
            {/*
              <Button 
                variant="primary" 
                size="sm" 
                className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
                onClick={openMultiQuotationModal}
              >
                Pay Now
              </Button>
            */}
            <Button 
              variant="primary" 
              size="sm" 
              className="bg-[#1E88E5] hover:bg-[#0D47A1] dark:bg-blue-600 dark:hover:bg-blue-700"
              onClick={openModal}
              disabled={!profileComplete}
            >
              Create New Quote
            </Button>
          </div>
        </div>
      </div>

      {/* Incomplete Profile Alert */}
      {!profileComplete && (
        <div className="col-span-12 p-5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg shadow-sm mb-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-yellow-100 dark:bg-yellow-700 rounded-full p-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-600 dark:text-yellow-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-base font-medium text-yellow-800 dark:text-yellow-300">Profile Incomplete</h3>
              <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-400">Please complete your profile information before creating quotations.</p>
            </div>
            <div className="ml-auto">
              <Button
                variant="outline"
                className="bg-white text-yellow-700 hover:bg-yellow-50 border-yellow-300 dark:bg-transparent dark:text-yellow-300 dark:border-yellow-600 dark:hover:bg-yellow-900/30"
                onClick={() => router.push('/profile')}
              >
                Complete Profile
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Quotation Summary Cards */}
      <div className="col-span-12">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:gap-6">
          {/* Total Quotes */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-800/80 md:p-6 transition-all duration-300 transform hover:scale-105 hover:shadow-lg dark:hover:shadow-gray-700/20">
            <div className="flex items-center justify-center w-12 h-12 bg-[#E3F2FD] rounded-xl dark:bg-blue-900/30">
              <svg className="text-[#0D47A1] dark:text-blue-400" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7 7H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7 12H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7 17H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="mt-5">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Total Quotes
              </span>
              <h4 className="mt-2 font-bold text-[#0D47A1] text-title-sm dark:text-blue-400">
                {metrics.total}
              </h4>
            </div>
          </div>

          {/* Approved Quotes */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-800/80 md:p-6 transition-all duration-300 transform hover:scale-105 hover:shadow-lg dark:hover:shadow-gray-700/20">
            <div className="flex items-center justify-center w-12 h-12 bg-[#E3F2FD] rounded-xl dark:bg-blue-900/30">
              <svg className="text-[#0D47A1] dark:text-blue-400" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 11L12 14L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M21 12V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="mt-5">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Approved Quotes
              </span>
              <h4 className="mt-2 font-bold text-[#0D47A1] text-title-sm dark:text-blue-400">
                {metrics.approved}
              </h4>
            </div>
          </div>

          {/* Pending Quotes */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-800/80 md:p-6 transition-all duration-300 transform hover:scale-105 hover:shadow-lg dark:hover:shadow-gray-700/20">
            <div className="flex items-center justify-center w-12 h-12 bg-[#E3F2FD] rounded-xl dark:bg-blue-900/30">
              <svg className="text-[#0D47A1] dark:text-blue-400" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 18V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4.93 4.93L7.76 7.76" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16.24 16.24L19.07 19.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18 12H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4.93 19.07L7.76 16.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16.24 7.76L19.07 4.93" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="mt-5">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Pending Quotes
              </span>
              <h4 className="mt-2 font-bold text-[#0D47A1] text-title-sm dark:text-blue-400">
                {metrics.pending}
              </h4>
            </div>
          </div>

          {/* Rejected Quotes */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-800/80 md:p-6 transition-all duration-300 transform hover:scale-105 hover:shadow-lg dark:hover:shadow-gray-700/20">
            <div className="flex items-center justify-center w-12 h-12 bg-[#E3F2FD] rounded-xl dark:bg-blue-900/30">
              <svg className="text-[#0D47A1] dark:text-blue-400" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="mt-5">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Rejected Quotes
              </span>
              <h4 className="mt-2 font-bold text-[#0D47A1] text-title-sm dark:text-blue-400">
                {metrics.rejected}
              </h4>
            </div>
          </div>
        </div>
      </div>

      {/* Quotation Table Section */}
      <div className="col-span-12">
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-800/80">
          <div className="flex flex-wrap items-center justify-between gap-4 p-5 md:p-6">
            <h3 className="font-semibold text-[#0D47A1] dark:text-blue-400 text-base">
              Recent Quotations
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search quotations..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E88E5] focus:border-[#1E88E5] w-64 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400 dark:focus:ring-blue-500 dark:focus:border-blue-500"
                />
                <svg
                  className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500"
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

          <div className="max-w-full overflow-x-auto">
            <div className="min-w-full">
              <Table>
                {/* Table Header */}
                <TableHeader className="border-b border-gray-100 dark:border-gray-700">
                  <TableRow>
                    <TableCell
                      isHeader
                      className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                    >
                      ID
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
                      Quantity
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                    >
                      Date
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
                      Price
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
                <TableBody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {isLoading && (
                    <TableRow>
                      <TableCell className="px-5 py-4 text-gray-500 dark:text-gray-400 text-center">
                        <div className="w-full text-center">Loading quotations...</div>
                      </TableCell>
                      <TableCell>{""}</TableCell>
                      <TableCell>{""}</TableCell>
                      <TableCell>{""}</TableCell>
                      <TableCell>{""}</TableCell>
                      <TableCell>{""}</TableCell>
                      <TableCell>{""}</TableCell>
                    </TableRow>
                  )}
                  
                  {!isLoading && quotationData.length === 0 && (
                    <TableRow>
                      <TableCell className="px-5 py-4 text-gray-500 dark:text-gray-400 text-center">
                        <div className="w-full text-center">No quotations found</div>
                      </TableCell>
                      <TableCell>{""}</TableCell>
                      <TableCell>{""}</TableCell>
                      <TableCell>{""}</TableCell>
                      <TableCell>{""}</TableCell>
                      <TableCell>{""}</TableCell>
                      <TableCell>{""}</TableCell>
                    </TableRow>
                  )}
                  
                  {!isLoading && quotationData.map((item) => (
                    <TableRow 
                      key={item.id}
                      className="transition-all duration-300 hover:bg-[#E3F2FD] dark:hover:bg-blue-900/20 hover:shadow-md cursor-pointer transform hover:translate-x-1 hover:scale-[1.01]"
                    >
                      <TableCell className="px-5 py-4">
                        <span className="text-gray-700 text-sm dark:text-gray-300">
                        {item.quotation_id}
                        </span>
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                            {item.product.image && item.product.image !== "/images/product/product-01.jpg" ? (
                              <Image
                                src={item.product.image}
                                alt={item.product.name}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 text-center p-1">
                                No image uploaded
                              </div>
                            )}
                          </div>
                          <div>
                            <h6 className="font-medium text-gray-700 text-sm dark:text-gray-300">
                              {item.product.name}
                            </h6>
                            <p className="text-gray-500 text-xs dark:text-gray-400">
                              {item.product.category}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <span className="text-gray-700 text-sm dark:text-gray-300">
                        {item.quantity}
                        </span>
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <span className="text-gray-700 text-sm dark:text-gray-300">
                        {item.date}
                        </span>
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <Badge
                          color={
                            item.status === "Approved"
                              ? "success"
                              : item.status === "Pending"
                              ? "warning"
                              : "error"
                          }
                        >
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <span className="text-gray-700 text-sm dark:text-gray-300">
                          {item.price || "N/A"}
                        </span>
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                            onClick={() => openDetailsModal(item)}
                          >
                            Details
                          </Button>
                          {item.status === "Approved" && (
                            <Button
                              variant="primary"
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
                              onClick={() => openCheckoutModal(item)}
                            >
                              Pay Now
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
          
          {/* Pagination */}
          <div className="flex items-center justify-between p-5 border-t border-gray-100 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Showing 1-{quotationData.length} of {metrics.total} items
            </div>
            <div className="flex gap-1">
              <button className="px-3 py-1 text-sm rounded-md border border-gray-300 text-gray-500 hover:bg-[#E3F2FD] hover:text-[#1E88E5] disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600 dark:text-gray-400 dark:hover:bg-blue-900/20 dark:hover:text-blue-400" disabled>
                Previous
              </button>
              <button className="px-3 py-1 text-sm rounded-md bg-[#1E88E5] text-white dark:bg-blue-600">
                1
              </button>
              <button className="px-3 py-1 text-sm rounded-md border border-gray-300 text-gray-500 hover:bg-[#E3F2FD] hover:text-[#1E88E5] dark:border-gray-600 dark:text-gray-400 dark:hover:bg-blue-900/20 dark:hover:text-blue-400">
                2
              </button>
              <button className="px-3 py-1 text-sm rounded-md border border-gray-300 text-gray-500 hover:bg-[#E3F2FD] hover:text-[#1E88E5] dark:border-gray-600 dark:text-gray-400 dark:hover:bg-blue-900/20 dark:hover:text-blue-400">
                3
              </button>
              <button className="px-3 py-1 text-sm rounded-md border border-gray-300 text-gray-500 hover:bg-[#E3F2FD] hover:text-[#1E88E5] dark:border-gray-600 dark:text-gray-400 dark:hover:bg-blue-900/20 dark:hover:text-blue-400">
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <QuotationFormModal isOpen={isModalOpen} onClose={closeModal} />
      {selectedQuotation && (
        <QuotationDetailsModal 
          isOpen={isDetailsModalOpen} 
          onClose={closeDetailsModal}
          quotation={selectedQuotation}
          openCheckoutModal={openCheckoutModal}
        />
      )}
      {selectedCheckoutQuotation && (
        <CheckoutConfirmationModal
          isOpen={isCheckoutModalOpen}
          onClose={closeCheckoutModal}
          onConfirm={(paymentMethod) => handleCheckoutConfirm([selectedCheckoutQuotation], paymentMethod || '')}
          quotation={selectedCheckoutQuotation}
        />
      )}
      <MultiQuotationModal
        isOpen={isMultiQuotationModalOpen}
        onClose={closeMultiQuotationModal}
        quotations={approvedQuotations}
        onProceedToPayment={(selectedQuotations, paymentMethod) => handleCheckoutConfirm(selectedQuotations, paymentMethod)}
      />
    </div>
  );
} 