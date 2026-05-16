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
import QuotationFormModal, { EditQuotationData } from "@/components/quotation/QuotationFormModal";
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
  const [editQuotation, setEditQuotation] = useState<EditQuotationData | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('');
  // Label modal state
  const [labelModalQuotation, setLabelModalQuotation] = useState<QuotationData | null>(null);
  const [labelText, setLabelText] = useState('');
  const [isSavingLabel, setIsSavingLabel] = useState(false);
  const [labelTemplates, setLabelTemplates] = useState<{id: string; name: string; label_text: string}[]>([]);
  const [templateName, setTemplateName] = useState('');
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
            total_price_option1,
            delivery_time_option1,
            description_option1,
            title_option2,
            total_price_option2,
            delivery_time_option2,
            description_option2,
            title_option3,
            total_price_option3,
            delivery_time_option3,
            description_option3,
            unit_price_option1,
            unit_weight_option1,
            unit_price_option2,
            unit_weight_option2,
            unit_price_option3,
            unit_weight_option3,
            extra_images_option1,
            extra_images_option2,
            extra_images_option3,
            receiver_name,
            receiver_phone,
            receiver_address,
            rejection_reason,
            client_label,
            is_customizable,
            customization_price,
            selected_version,
            custom_title_option1, custom_unit_price_option1, custom_unit_weight_option1, custom_images_option1, custom_description_option1, custom_delivery_option1,
            custom_title_option2, custom_unit_price_option2, custom_unit_weight_option2, custom_images_option2, custom_description_option2, custom_delivery_option2,
            selected_customization_option
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
              const extraImages1 = item.extra_images_option1 ?? [];
              priceOptions.push({
                id: '1',
                price: item.total_price_option1 ? `$${parseFloat(item.total_price_option1).toLocaleString()}` : 'N/A',
                supplier: item.title_option1,
                deliveryTime: item.delivery_time_option1 || 'N/A',
                description: item.description_option1,
                modelName: item.title_option1,
                modelImage: (extraImages1.length > 0 ? extraImages1[0] : null) || "/images/product/product-01.jpg",
                unit_price_option1: item.unit_price_option1 ?? null,
                unit_weight_option1: item.unit_weight_option1 ?? null,
                image_option1_2: extraImages1.length > 1 ? extraImages1[1] : null,
                extra_images_option1: extraImages1,
              });
            }
            
            // Add option 2 if it exists
            if (item.title_option2) {
              const extraImages2 = item.extra_images_option2 ?? [];
              priceOptions.push({
                id: '2',
                price: item.total_price_option2 ? `$${parseFloat(item.total_price_option2).toLocaleString()}` : 'N/A',
                supplier: item.title_option2,
                deliveryTime: item.delivery_time_option2 || 'N/A',
                description: item.description_option2,
                modelName: item.title_option2,
                modelImage: (extraImages2.length > 0 ? extraImages2[0] : null) || "/images/product/product-01.jpg",
                unit_price_option2: item.unit_price_option2 ?? null,
                unit_weight_option2: item.unit_weight_option2 ?? null,
                image_option2_2: extraImages2.length > 1 ? extraImages2[1] : null,
                extra_images_option2: extraImages2,
              });
            }
            
            // Add option 3 if it exists
            if (item.title_option3) {
              const extraImages3 = item.extra_images_option3 ?? [];
              priceOptions.push({
                id: '3',
                price: item.total_price_option3 ? `$${parseFloat(item.total_price_option3).toLocaleString()}` : 'N/A',
                supplier: item.title_option3,
                deliveryTime: item.delivery_time_option3 || 'N/A',
                description: item.description_option3,
                modelName: item.title_option3,
                modelImage: (extraImages3.length > 0 ? extraImages3[0] : null) || "/images/product/product-01.jpg",
                unit_price_option3: item.unit_price_option3 ?? null,
                unit_weight_option3: item.unit_weight_option3 ?? null,
                image_option3_2: extraImages3.length > 1 ? extraImages3[1] : null,
                extra_images_option3: extraImages3,
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
              selected_option: item.selected_option,
              // Receiver information
              receiver_name: item.receiver_name || undefined,
              receiver_phone: item.receiver_phone || undefined,
              receiver_address: item.receiver_address || undefined,
              rejection_reason: item.rejection_reason || null,
              client_label: item.client_label || null,
              is_customizable: item.is_customizable ?? false,
              customization_price: item.customization_price ?? null,
              selected_version: (item.selected_version as 'stock' | 'customized' | null) ?? null,
              custom_title_option1: (item as Record<string, unknown>).custom_title_option1 as string ?? null,
              custom_unit_price_option1: (item as Record<string, unknown>).custom_unit_price_option1 as number ?? null,
              custom_unit_weight_option1: (item as Record<string, unknown>).custom_unit_weight_option1 as number ?? null,
              custom_images_option1: ((item as Record<string, unknown>).custom_images_option1 as string[]) ?? [],
              custom_description_option1: (item as Record<string, unknown>).custom_description_option1 as string ?? null,
              custom_delivery_option1: (item as Record<string, unknown>).custom_delivery_option1 as string ?? null,
              custom_title_option2: (item as Record<string, unknown>).custom_title_option2 as string ?? null,
              custom_unit_price_option2: (item as Record<string, unknown>).custom_unit_price_option2 as number ?? null,
              custom_unit_weight_option2: (item as Record<string, unknown>).custom_unit_weight_option2 as number ?? null,
              custom_images_option2: ((item as Record<string, unknown>).custom_images_option2 as string[]) ?? [],
              custom_description_option2: (item as Record<string, unknown>).custom_description_option2 as string ?? null,
              custom_delivery_option2: (item as Record<string, unknown>).custom_delivery_option2 as string ?? null,
              selected_customization_option: (item as Record<string, unknown>).selected_customization_option as number ?? null,
              // Raw fields for edit mode
              product_url: item.product_url || undefined,
              service_type: item.service_type || undefined,
              image_url: item.image_url || undefined,
              shipping_country: item.shipping_country || undefined,
              shipping_city: item.shipping_city || undefined,
              shipping_method_raw: item.shipping_method || undefined,
            };
          });
          
          console.log("Data formatted successfully:", formattedData.length);
          setQuotationData(formattedData);
          setCurrentPage(1);
          
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
  }, [user?.id, fetchKey]); // Add user?.id and fetchKey as dependencies

  // Check if there are any approved quotations
  // const hasApprovedQuotations = quotationData.some(item => item.status === "Approved");

  const filteredData = quotationData.filter(item => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      item.quotation_id.toLowerCase().includes(q) ||
      item.product.name.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
    const matchesCountry = !countryFilter || item.shipping_country === countryFilter;
    return matchesSearch && matchesStatus && matchesCountry;
  });

  const openLabelModal = async (quotation: QuotationData) => {
    setLabelModalQuotation(quotation);
    setLabelText(quotation.client_label || '');
    setTemplateName('');
    // Load templates
    if (user?.id) {
      const { data } = await supabase
        .from('label_templates')
        .select('id, name, label_text')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setLabelTemplates(data || []);
    }
  };

  const handleSaveLabel = async () => {
    if (!labelModalQuotation) return;
    setIsSavingLabel(true);
    try {
      const trimmed = labelText.trim();

      const { error } = await supabase
        .from('quotations')
        .update({ client_label: trimmed || null })
        .eq('id', labelModalQuotation.id);
      if (error) throw error;

      // Auto-save as template whenever a non-empty label is saved
      if (trimmed && user?.id) {
        const autoName = templateName.trim() || trimmed.slice(0, 50);
        // Avoid duplicate templates with the same label_text
        const exists = labelTemplates.some(t => t.label_text === trimmed);
        if (!exists) {
          const { data: inserted } = await supabase.from('label_templates').insert({
            user_id: user.id,
            name: autoName,
            label_text: trimmed,
          }).select('id, name, label_text').single();
          if (inserted) {
            setLabelTemplates(prev => [inserted, ...prev]);
          }
        }
      }

      setQuotationData(prev => prev.map(q =>
        q.id === labelModalQuotation.id ? { ...q, client_label: trimmed || null } : q
      ));
      setLabelModalQuotation(null);
    } catch {
      alert('Failed to save label. Please try again.');
    } finally {
      setIsSavingLabel(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    await supabase.from('label_templates').delete().eq('id', templateId);
    setLabelTemplates(prev => prev.filter(t => t.id !== templateId));
  };

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
          <div className="p-5 md:p-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold text-[#0D47A1] dark:text-blue-400 text-base">
                Recent Quotations
              </h3>
              {(searchQuery || statusFilter !== 'All' || countryFilter) && (
                <button
                  onClick={() => { setSearchQuery(''); setStatusFilter('All'); setCountryFilter(''); setCurrentPage(1); }}
                  className="flex items-center gap-1 text-xs text-red-500 border border-red-300 rounded-lg px-2.5 py-1.5 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  Clear filters
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  placeholder="Search by ID or product name..."
                  className="pl-9 pr-4 py-2 w-full border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E88E5] focus:border-[#1E88E5] dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400"
                />
                <svg className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500" width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E88E5]"
              >
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
              {/* Country filter */}
              <select
                value={countryFilter}
                onChange={e => { setCountryFilter(e.target.value); setCurrentPage(1); }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E88E5]"
              >
                <option value="">All Countries</option>
                {[...new Set(quotationData.map(q => q.shipping_country).filter(Boolean))].sort().map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
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
                      Destination
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
                  
                  {!isLoading && filteredData.length === 0 && (
                    <TableRow>
                      <TableCell className="px-5 py-4 text-gray-500 dark:text-gray-400 text-center">
                        <div className="w-full text-center">
                          {quotationData.length === 0 ? 'No quotations found' : 'No results match your filters'}
                        </div>
                      </TableCell>
                      <TableCell>{""}</TableCell>
                      <TableCell>{""}</TableCell>
                      <TableCell>{""}</TableCell>
                      <TableCell>{""}</TableCell>
                      <TableCell>{""}</TableCell>
                      <TableCell>{""}</TableCell>
                    </TableRow>
                  )}

                  {!isLoading && filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((item) => (
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
                          {item.destination || <span className="text-gray-400">—</span>}
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
                          {item.status === "Pending" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20"
                              onClick={() => setEditQuotation({
                                id: item.id,
                                product_name: item.product.name,
                                product_url: item.product_url,
                                quantity: item.quantity,
                                shipping_country: item.shipping_country || '',
                                shipping_city: item.shipping_city || '',
                                shipping_method: item.shipping_method_raw || '',
                                service_type: item.service_type,
                                image_url: item.image_url,
                                receiver_name: item.receiver_name,
                                receiver_phone: item.receiver_phone,
                                receiver_address: item.receiver_address,
                              })}
                            >
                              Edit
                            </Button>
                          )}
                          <button
                            onClick={() => openLabelModal(item)}
                            title={item.client_label ? `Label: ${item.client_label}` : 'Add shipping label'}
                            className={`inline-flex items-center justify-center gap-2 w-[110px] whitespace-nowrap py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                              item.client_label
                                ? "bg-[#0D47A1] text-white hover:bg-[#1565C0] shadow-sm"
                                : "bg-white border border-[#0D47A1] text-[#0D47A1] hover:bg-[#E3F2FD]"
                            }`}
                          >
                            {item.client_label ? (
                              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l3 3 5-5" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z" />
                              </svg>
                            )}
                            {item.client_label ? 'Labeled' : 'Label'}
                          </button>
                          {item.status === "Approved" && (
                            <Button
                              variant="primary"
                              size="sm"
                              className="w-[110px] whitespace-nowrap !bg-[#1B5E20] hover:!bg-[#2E7D32] !text-[#ffffff] shadow-sm"
                              onClick={() => openCheckoutModal(item)}
                              startIcon={
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                </svg>
                              }
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
          {(() => {
            const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
            const rangeStart = filteredData.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
            const rangeEnd = Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length);
            if (filteredData.length === 0) return null;
            return (
          <div className="flex items-center justify-between p-5 border-t border-gray-100 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Showing {rangeStart}-{rangeEnd} of {filteredData.length} items
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm rounded-md border border-gray-300 text-gray-500 hover:bg-[#E3F2FD] hover:text-[#1E88E5] disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600 dark:text-gray-400 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1 text-sm rounded-md ${
                    currentPage === page
                      ? 'bg-[#1E88E5] text-white dark:bg-blue-600'
                      : 'border border-gray-300 text-gray-500 hover:bg-[#E3F2FD] hover:text-[#1E88E5] dark:border-gray-600 dark:text-gray-400 dark:hover:bg-blue-900/20 dark:hover:text-blue-400'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm rounded-md border border-gray-300 text-gray-500 hover:bg-[#E3F2FD] hover:text-[#1E88E5] disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600 dark:text-gray-400 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
              >
                Next
              </button>
            </div>
          </div>
            );
          })()}
        </div>
      </div>

      {/* Modals */}
      <QuotationFormModal isOpen={isModalOpen} onClose={closeModal} />
      {editQuotation && (
        <QuotationFormModal
          isOpen={!!editQuotation}
          onClose={() => setEditQuotation(null)}
          editQuotation={editQuotation}
          onEditSuccess={() => {
            setEditQuotation(null);
            setFetchKey(k => k + 1);
          }}
        />
      )}
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

      {/* Label Modal */}
      {labelModalQuotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Shipping Label</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{labelModalQuotation.quotation_id} — {labelModalQuotation.product.name}</p>
                </div>
                <button onClick={() => !isSavingLabel && setLabelModalQuotation(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Label input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Label Text
                </label>
                <textarea
                  rows={3}
                  value={labelText}
                  onChange={e => setLabelText(e.target.value)}
                  placeholder="e.g. FRAGILE — Handle with care — Box 1 of 3"
                  disabled={isSavingLabel}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E88E5] dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-none"
                />
              </div>

              {/* Saved templates */}
              {labelTemplates.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Saved Templates</p>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {labelTemplates.map(t => (
                      <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-[#1E88E5] group">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{t.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{t.label_text}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setLabelText(t.label_text)}
                          className="text-xs text-[#1E88E5] font-medium hover:underline flex-shrink-0"
                        >
                          Use
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplate(t.id)}
                          className="text-xs text-red-400 hover:text-red-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete template"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Auto save as template */}
              <div className="mb-5 rounded-lg border border-[#1E88E5]/30 bg-[#E3F2FD] px-3 py-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <svg className="w-4 h-4 text-[#0D47A1] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-xs font-semibold text-[#0D47A1]">Auto-saved as template on every save</span>
                </div>
                <input
                  type="text"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  placeholder={labelText.trim().slice(0, 50) || 'Template name (auto-filled from label)'}
                  disabled={isSavingLabel}
                  className="w-full px-2.5 py-1.5 text-xs border border-[#1E88E5]/40 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1E88E5]/30 text-[#0D47A1] placeholder-blue-300 dark:bg-gray-700 dark:text-blue-300 dark:border-blue-700"
                />
                <p className="text-xs text-[#1E88E5]/70 mt-1">Leave blank to use the label text as the name</p>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setLabelModalQuotation(null)}
                  disabled={isSavingLabel}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveLabel}
                  disabled={isSavingLabel}
                  className="px-4 py-2 text-sm text-white bg-[#1E88E5] rounded-lg hover:bg-[#0D47A1] disabled:opacity-60 flex items-center gap-2"
                >
                  {isSavingLabel && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {isSavingLabel ? 'Saving...' : 'Save Label'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 