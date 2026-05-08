"use client";

import { Suspense } from "react";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";

// Types
interface QuotationDetails {
  id: string;
  quotation_id: string;
  title: string;
  status: string;
  product_name: string;
  quantity: number;
  created_at: string;
  total_price_option1: number;
  total_price_option2: number;
  total_price_option3: number;
  selected_option: number;
  product_images: string[];
  [key: `total_price_option${number}`]: number | undefined;
}

interface PaymentDetails {
  id: string;
  reference_number: string;
  total_amount: number;
  method: string;
  status: string;
  created_at: string;
  quotation_ids: string[];
}

// Content Component
function PaymentDetailsContent() {
  const searchParams = useSearchParams();
  const paymentRef = searchParams.get("ref");
  
  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [quotations, setQuotations] = useState<QuotationDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPaymentData = async () => {
      if (!paymentRef) {
        setError("No payment reference provided");
        setIsLoading(false);
        return;
      }

      try {
        // Fetch payment details
        const { data: paymentData, error: paymentError } = await supabase
          .from('payments')
          .select('*')
          .eq('reference_number', paymentRef)
          .single();

        if (paymentError) {
          throw new Error(`Error fetching payment: ${paymentError.message}`);
        }

        if (!paymentData) {
          throw new Error('Payment not found');
        }

        setPayment(paymentData);

        // Fetch quotations associated with this payment
        if (paymentData.quotation_ids && paymentData.quotation_ids.length > 0) {
          const { data: quotationsData, error: quotationsError } = await supabase
            .from('quotations')
            .select('*')
            .in('id', paymentData.quotation_ids);

          if (quotationsError) {
            throw new Error(`Error fetching quotations: ${quotationsError.message}`);
          }

          setQuotations(quotationsData || []);
        }
      } catch (error) {
        console.error('Error:', error);
        setError(error instanceof Error ? error.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPaymentData();
  }, [paymentRef]);

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      'PENDING': { color: 'bg-yellow-100 text-yellow-800', text: 'Pending' },
      'PROCESSING': { color: 'bg-blue-100 text-blue-800', text: 'Processing' },
      'COMPLETED': { color: 'bg-green-100 text-green-800', text: 'Completed' },
      'FAILED': { color: 'bg-red-100 text-red-800', text: 'Failed' },
      'REJECTED': { color: 'bg-red-100 text-red-800', text: 'Rejected' },
    };

    const { color, text } = statusMap[status] || { color: 'bg-gray-100 text-gray-800', text: status };
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
        {text}
      </span>
    );
  };

  // Helper function to get the selected price safely
  const getSelectedPrice = (quotation: QuotationDetails): string => {
    if (!quotation.selected_option) return 'N/A';
    
    const optionNumber = quotation.selected_option;
    const priceKey = `total_price_option${optionNumber}` as const;
    const price = quotation[priceKey];
    
    return price ? `$${price.toLocaleString()}` : 'N/A';
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
            <p className="text-gray-700">{error}</p>
            <Link href="/" className="mt-6 inline-block px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* Payment Header */}
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-semibold text-gray-900">Payment Details</h1>
            {payment && getStatusBadge(payment.status)}
          </div>
        </div>

        {/* Payment Information */}
        {payment && (
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Reference Number</p>
                <p className="font-medium">{payment.reference_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Amount</p>
                <p className="font-medium">${payment.total_amount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Payment Method</p>
                <p className="font-medium">{payment.method.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Date</p>
                <p className="font-medium">{new Date(payment.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* Quotations */}
        <div className="px-6 py-4">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Quotations in this payment:</h2>
          
          {quotations.length === 0 ? (
            <div className="text-center py-8 border rounded-lg bg-gray-50">
              <p className="text-gray-500">No quotations found for this payment.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {quotations.map((quotation) => (
                <div key={quotation.id} className="border rounded-lg overflow-hidden">
                  <div className="grid md:grid-cols-3 gap-4 p-4">
                    <div className="md:col-span-2">
                      <div className="flex items-start gap-4">
                        <div className="w-20 h-20 bg-gray-100 rounded overflow-hidden relative flex-shrink-0">
                          {quotation.product_images && quotation.product_images[0] ? (
                            <Image 
                              src={quotation.product_images[0]} 
                              alt={quotation.product_name || "Product"} 
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              No image
                            </div>
                          )}
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{quotation.product_name || 'Untitled Product'}</h3>
                          <p className="text-sm text-gray-500 mt-1">Quotation ID: {quotation.quotation_id}</p>
                          <p className="text-sm text-gray-500">Quantity: {quotation.quantity}</p>
                          <p className="text-sm text-gray-500">Created: {new Date(quotation.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Status</p>
                        {getStatusBadge(quotation.status)}
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Selected Price</p>
                        <p className="font-bold text-blue-600">
                          {getSelectedPrice(quotation)}
                        </p>
                      </div>
                      <Link 
                        href={`/quotation/${quotation.quotation_id}`}
                        className="text-sm text-blue-600 hover:text-blue-800 mt-2 inline-block"
                      >
                        View Details →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="bg-gray-50 px-6 py-4 flex justify-between">
          <Link 
            href="/payment"
            className="text-gray-600 hover:text-gray-800"
          >
            ← Back to Payments
          </Link>
        </div>
      </div>
    </div>
  );
}

// Page Component
export default function PaymentDetailsPage() {
  return (
    <Suspense 
      fallback={
        <div className="container mx-auto px-4 py-16 max-w-4xl">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        </div>
      }
    >
      <PaymentDetailsContent />
    </Suspense>
  );
} 