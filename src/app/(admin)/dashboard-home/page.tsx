"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
 
  BoxIconLine, 
  GroupIcon, 
  PaperPlaneIcon,
  DollarLineIcon
} from "@/icons";
import Badge from "@/components/ui/badge/Badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import Button from "@/components/ui/button/Button";
import Image from "next/image";
import DashboardShippingTracking from "@/components/shipping/DashboardShippingTracking";
import QuotationFormModal from "@/components/quotation/QuotationFormModal";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

// Cache configuration
const CACHE_KEY = 'dashboard_data_cache';
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes in milliseconds

// Define the cache structure
interface CacheData {
  quotationData: QuotationItem[];
  metrics: DashboardMetrics;
  timestamp: number;
  userId: string;
}

// Define the type for quotation data
interface QuotationItem {
  id: string;
  product: {
    name: string;
    image: string;
  };
  quantity: number;
  date: string;
  status: string;
  hasImage: boolean;
  price?: string;
}

// Define type for dashboard metrics
interface DashboardMetrics {
  pendingQuotations: number;
  activeShipments: number;
  deliveredProducts: number;
  totalSpend: number;
}

export default function DashboardHome() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [quotationData, setQuotationData] = useState<QuotationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    pendingQuotations: 0,
    activeShipments: 0,
    deliveredProducts: 0,
    totalSpend: 0
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();
  
  // Get current user from auth context
  const { user, loading } = useAuth();
  const [profileComplete, setProfileComplete] = useState(true);

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

  // Redirect if not authenticated and not loading
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/signup");
    }
  }, [user, loading, router]);

  // Function to get cached data if valid
  const getCachedData = (userId: string): CacheData | null => {
    if (typeof window === 'undefined') return null; // Check for server-side rendering
    
    try {
      const cachedDataString = localStorage.getItem(`${CACHE_KEY}_${userId}`);
      if (!cachedDataString) return null;
      
      const cachedData = JSON.parse(cachedDataString) as CacheData;
      const now = Date.now();
        
      // Check if cache is still valid (not expired) and belongs to the current user
      if (now - cachedData.timestamp < CACHE_EXPIRY && cachedData.userId === userId) {
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
  const saveToCache = (userId: string, data: Partial<CacheData>) => {
    if (typeof window === 'undefined') return; // Check for server-side rendering
    
    try {
      localStorage.setItem(`${CACHE_KEY}_${userId}`, JSON.stringify({
        ...data,
        userId,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error saving to cache:', error);
      // If caching fails, just continue without caching
    }
  };

  const fetchDashboardData = useCallback(async (userId: string) => {
    try {
        // Fetch quotations for the table
        const { data, error } = await supabase
          .from('quotations')
          .select(`
            id,
            quotation_id,
            product_name,
            quantity,
            created_at,
            status,
            image_url,
            total_price_option1,
            total_price_option2,
            total_price_option3
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(3);
          
        if (error) {
          console.error("Error fetching quotations:", error);
          console.error("Error details:", JSON.stringify(error, null, 2));
          setIsLoading(false);
          return;
        }
        
        if (!data) {
          console.warn("No quotation data returned");
          setQuotationData([]);
          setIsLoading(false);
          return;
        }
        
        console.log("Quotations data retrieved:", data.length);
        
        // Transform data to match the format expected by the component
        try {
          const formattedData = data.map(item => {
            // Calculate price from options
            let price;
            const priceOptions = [
              item.total_price_option1,
              item.total_price_option2,
              item.total_price_option3
            ].filter(Boolean);
            
            if (priceOptions.length > 0) {
              const average = priceOptions.reduce((sum, price) => 
                sum + parseFloat(price), 0) / priceOptions.length;
              price = `$${average.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
            
            return {
              id: item.quotation_id || item.id,
              product: {
                name: item.product_name,
                image: item.image_url || "/images/product/product-01.jpg"
              },
              quantity: item.quantity,
              date: new Date(item.created_at).toLocaleDateString(),
              status: item.status || 'Pending',
              hasImage: !!item.image_url,
              price: price
            };
          });
          
          setQuotationData(formattedData);
        
        // Create a new metrics object to track all the metrics
        const newMetrics: DashboardMetrics = {
          pendingQuotations: 0,
          activeShipments: 0,
          deliveredProducts: 0,
          totalSpend: 0
        };
        
          // Fetch pending quotations count
          console.log(`Fetching pending quotations count for user_id: ${userId}...`);
          const { count: pendingCount, error: pendingError } = await supabase
            .from('quotations')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'Pending')
            .eq('user_id', userId);
            
          if (pendingError) {
            console.error("Error fetching pending quotations:", pendingError);
          } else if (pendingCount !== null) {
            console.log("Pending quotations count:", pendingCount);
          newMetrics.pendingQuotations = pendingCount;
        }

            // Fetch count of active shipments (shipments that are not delivered)
            console.log(`Fetching active shipments count for user_id: ${userId}...`);
            const { count: activeShipmentsCount, error: activeShipmentsError } = await supabase
              .from('shipping')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', userId)
              .not('status', 'eq', 'Delivered');

            if (activeShipmentsError) {
              console.error("Error fetching active shipments:", activeShipmentsError);
            } else if (activeShipmentsCount !== null) {
              console.log("Active shipments count:", activeShipmentsCount);
          newMetrics.activeShipments = activeShipmentsCount;
            }

            // Fetch count of delivered products
            console.log(`Fetching delivered products count for user_id: ${userId}...`);
            const { count: deliveredCount, error: deliveredError } = await supabase
              .from('shipping')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', userId)
              .eq('status', 'Delivered');

            if (deliveredError) {
              console.error("Error fetching delivered products:", deliveredError);
            } else if (deliveredCount !== null) {
              console.log("Delivered products count:", deliveredCount);
          newMetrics.deliveredProducts = deliveredCount;
            }

            // Calculate total spend from approved payments
            console.log(`Fetching approved payments for total spend calculation for user_id: ${userId}...`);
            const { data: approvedPayments, error: paymentsError } = await supabase
              .from('payments')
              .select('*')
              .eq('status', 'Approved');

            if (paymentsError) {
              console.error("Error fetching approved payments:", paymentsError);
            } else if (approvedPayments) {
              console.log("Approved payments found:", approvedPayments.length);
              
              // Log each payment for debugging
              approvedPayments.forEach((payment, index) => {
                console.log(`Payment ${index + 1}: ${payment.status} - Amount: ${payment.total_amount}`);
              });
              
              const totalSpend = approvedPayments.reduce((sum, payment) => {
                // Add the payment total_amount to the running sum
                if (payment.total_amount) {
                  const amount = parseFloat(payment.total_amount);
                  console.log(`Adding amount: ${amount} to sum: ${sum}, new total: ${sum + amount}`);
                  return sum + amount;
                }
                return sum;
              }, 0);
              
              console.log(`Final total spend: ${totalSpend}`);
              newMetrics.totalSpend = totalSpend;
            }
        
        // Update the metrics state
        setMetrics(newMetrics);
        
        // Save data to cache
        saveToCache(userId, {
          quotationData: formattedData,
          metrics: newMetrics
        });
        
      } catch (formatError) {
        console.error("Error formatting quotation data:", formatError);
        setQuotationData([]);
      }
    } catch (error) {
      console.error("Exception in fetchDashboardData:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        
        // Get the user ID from auth context
        const userId = user?.id;
        
        if (!userId) {
          console.warn("No user ID available, showing no quotations");
          setQuotationData([]);
          setIsLoading(false);
          return;
        }
        
        // Try to get data from cache first if not refreshing
        if (!isRefreshing) {
          const cachedData = getCachedData(userId);
          if (cachedData) {
            console.log('Using cached dashboard data');
            setQuotationData(cachedData.quotationData);
            setMetrics(cachedData.metrics);
            setIsLoading(false);
            return;
          }
        }
        
        // If no cache or refreshing, fetch fresh data
        console.log(`Fetching dashboard data for user_id: ${userId}...`);
        await fetchDashboardData(userId);
        
      } catch (error) {
        console.error("Exception in loadData:", error);
        setIsLoading(false);
      }
      
      // Reset refreshing flag
      setIsRefreshing(false);
    }
    
    loadData();
  }, [isModalOpen, user?.id, isRefreshing, fetchDashboardData]);
  
  const handleRefreshData = () => {
    setIsLoading(true);
    setIsRefreshing(true);
  };

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);
  
  // Navigation functions
  const goToQuotationsPage = () => router.push('/quotation');
  const goToShipmentTrackingPage = () => router.push('/shipment-tracking');
  
  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
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

      {/* Metric Cards Section */}
      <div className="col-span-12">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:gap-6">
          {/* Quotation Pending Metric */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-800/80 md:p-6 transition-all duration-300 transform hover:scale-105 hover:shadow-lg dark:hover:shadow-gray-700/20">
            <div className="flex items-center justify-center w-12 h-12 bg-[#E3F2FD] rounded-xl dark:bg-blue-900/30">
              <PaperPlaneIcon className="text-[#0D47A1] dark:text-blue-400 size-6" />
            </div>
            <div className="flex items-end justify-between mt-5">
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Quotation Pending
                </span>
                <h4 className="mt-2 font-bold text-[#0D47A1] dark:text-blue-400 text-title-sm">
                  {metrics.pendingQuotations}
                </h4>
              </div>
            </div>
          </div>

          {/* Active Shipments Metric */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-800/80 md:p-6 transition-all duration-300 transform hover:scale-105 hover:shadow-lg dark:hover:shadow-gray-700/20">
            <div className="flex items-center justify-center w-12 h-12 bg-[#E3F2FD] rounded-xl dark:bg-blue-900/30">
              <BoxIconLine className="text-[#0D47A1] dark:text-blue-400 size-6" />
            </div>
            <div className="flex items-end justify-between mt-5">
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Active Shipments
                </span>
                <h4 className="mt-2 font-bold text-[#0D47A1] dark:text-blue-400 text-title-sm">
                  {metrics.activeShipments}
                </h4>
              </div>
            </div>
          </div>

          {/* Delivered Products Metric */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-800/80 md:p-6 transition-all duration-300 transform hover:scale-105 hover:shadow-lg dark:hover:shadow-gray-700/20">
            <div className="flex items-center justify-center w-12 h-12 bg-[#E3F2FD] rounded-xl dark:bg-blue-900/30">
              <GroupIcon className="text-[#0D47A1] dark:text-blue-400 size-6" />
            </div>
            <div className="flex items-end justify-between mt-5">
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Delivered Products
                </span>
                <h4 className="mt-2 font-bold text-[#0D47A1] dark:text-blue-400 text-title-sm">
                  {metrics.deliveredProducts}
                </h4>
              </div>
            </div>
          </div>

          {/* Total Spend Metric */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-800/80 md:p-6 transition-all duration-300 transform hover:scale-105 hover:shadow-lg dark:hover:shadow-gray-700/20">
            <div className="flex items-center justify-center w-12 h-12 bg-[#E3F2FD] rounded-xl dark:bg-blue-900/30">
              <DollarLineIcon className="text-[#0D47A1] dark:text-blue-400 size-6" />
            </div>
            <div className="flex items-end justify-between mt-5">
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Total Spend
                </span>
                <h4 className="mt-2 font-bold text-[#0D47A1] dark:text-blue-400 text-title-sm">
                  ${metrics.totalSpend.toLocaleString()}
                </h4>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Quotations Requests Table */}
      <div className="col-span-12">
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-800/80">
          <div className="flex flex-wrap items-center justify-between gap-4 p-5 md:p-6">
            <h3 className="font-semibold text-[#0D47A1] dark:text-blue-400 text-base">
              Recent Quotation Requests
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <Button 
                variant="primary" 
                size="sm" 
                className="bg-[#1E88E5] hover:bg-[#0D47A1] dark:bg-blue-600 dark:hover:bg-blue-700"
                onClick={openModal}
                disabled={!profileComplete}
              >
                Create New Quote
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="text-[#1E88E5] border-[#64B5F6] hover:bg-[#E3F2FD] dark:text-blue-400 dark:border-blue-700 dark:hover:bg-blue-900/30"
                onClick={handleRefreshData}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <>
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1"></div>
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
              <Button 
                variant="outline" 
                size="sm" 
                className="text-[#1E88E5] border-[#64B5F6] hover:bg-[#E3F2FD] dark:text-blue-400 dark:border-blue-700 dark:hover:bg-blue-900/30"
                onClick={goToQuotationsPage}
              >
                View All
              </Button>
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
                  </TableRow>
                </TableHeader>

                {/* Table Body */}
                <TableBody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {isLoading && (
                    <TableRow>
                      <TableCell className="px-5 py-4 text-gray-500 dark:text-gray-400 text-center">
                        <div className="w-full text-center">Loading latest quotations...</div>
                      </TableCell>
                      <TableCell className="hidden">&nbsp;</TableCell>
                      <TableCell className="hidden">&nbsp;</TableCell>
                      <TableCell className="hidden">&nbsp;</TableCell>
                      <TableCell className="hidden">&nbsp;</TableCell>
                    </TableRow>
                  )}
                  
                  {!isLoading && quotationData.length === 0 && (
                    <TableRow>
                      <TableCell className="px-5 py-4 text-gray-500 dark:text-gray-400 text-center">
                        <div className="w-full text-center">No quotations found</div>
                      </TableCell>
                      <TableCell className="hidden">&nbsp;</TableCell>
                      <TableCell className="hidden">&nbsp;</TableCell>
                      <TableCell className="hidden">&nbsp;</TableCell>
                      <TableCell className="hidden">&nbsp;</TableCell>
                    </TableRow>
                  )}
                  
                  {!isLoading && quotationData.map((item) => (
                    <TableRow 
                      key={item.id}
                      className="transition-all duration-300 hover:bg-[#E3F2FD] dark:hover:bg-blue-900/20 hover:shadow-md cursor-pointer transform hover:translate-x-1 hover:scale-[1.01]"
                    >
                      <TableCell className="px-5 py-4 text-gray-700 text-start text-theme-sm dark:text-gray-300">
                        {item.id}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-start">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 overflow-hidden rounded-lg relative">
                            {item.hasImage ? (
                              <Image
                                width={40}
                                height={40}
                                src={item.product.image}
                                alt={item.product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-xs text-gray-500 dark:text-gray-400">
                                No image
                              </div>
                            )}
                          </div>
                          <span className="font-medium text-gray-800 text-theme-sm dark:text-gray-200">
                            {item.product.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-gray-700 text-start text-theme-sm dark:text-gray-300">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-gray-700 text-start text-theme-sm dark:text-gray-300">
                        {item.date}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-start">
                        <Badge
                          size="sm"
                          color={
                            item.status === "Approved"
                              ? "success"
                              : item.status === "Processing"
                              ? "warning"
                              : "primary"
                          }
                        >
                          {item.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>

      {/* Shipment Tracking Table */}
      <div className="col-span-12">
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-800/80">
          <div className="flex flex-wrap items-center justify-between gap-4 p-5 md:p-6">
            <h3 className="font-semibold text-[#0D47A1] dark:text-blue-400 text-base">
              Recent Shipment Tracking
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                className="text-[#1E88E5] border-[#64B5F6] hover:bg-[#E3F2FD] dark:text-blue-400 dark:border-blue-700 dark:hover:bg-blue-900/30"
                onClick={goToShipmentTrackingPage}
              >
                View All Shipments
              </Button>
            </div>
          </div>

          <DashboardShippingTracking />
        </div>
      </div>

      {/* Modal for New Quotation */}
      <QuotationFormModal isOpen={isModalOpen} onClose={closeModal} />
    </div>
  );
} 