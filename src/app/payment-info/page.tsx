"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

interface Payment {
  id: string;
  reference_number: string | null;
  total_amount: number;
  method: string;
  status: string;
  created_at: string;
  quotation_ids: string[];
}

interface Quotation {
  id: string;
  quotation_id: string;
  title: string;
  product_name: string;
  quantity: number;
  status: string;
  created_at: string;
  total_price_option1?: number;
  total_price_option2?: number;
  total_price_option3?: number;
  selected_option?: number;
  product_images?: string[];
  [key: string]: string | number | string[] | undefined | null; // More specific index signature
}

export default function PaymentInfoPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [quotations, setQuotations] = useState<Record<string, Quotation[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPayment, setExpandedPayment] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPaymentsAndQuotations() {
      try {
        // Fetch payments
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('payments')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);

        if (paymentsError) {
          throw new Error(`Error fetching payments: ${paymentsError.message}`);
        }

        setPayments(paymentsData || []);

        // Collect all quotation IDs
        const allQuotationIds: string[] = [];
        paymentsData?.forEach(payment => {
          if (payment.quotation_ids && payment.quotation_ids.length > 0) {
            allQuotationIds.push(...payment.quotation_ids);
          }
        });

        // Fetch quotations if there are any quotation IDs
        if (allQuotationIds.length > 0) {
          const { data: quotationsData, error: quotationsError } = await supabase
            .from('quotations')
            .select('*')
            .in('id', allQuotationIds);

          if (quotationsError) {
            throw new Error(`Error fetching quotations: ${quotationsError.message}`);
          }

          // Organize quotations by payment ID
          const quotationsByPayment: Record<string, Quotation[]> = {};
          
          paymentsData?.forEach(payment => {
            if (payment.quotation_ids && payment.quotation_ids.length > 0) {
              quotationsByPayment[payment.id] = quotationsData?.filter(
                quotation => payment.quotation_ids.includes(quotation.id)
              ) || [];
            } else {
              quotationsByPayment[payment.id] = [];
            }
          });

          setQuotations(quotationsByPayment);
        }
      } catch (err) {
        console.error('Error:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    fetchPaymentsAndQuotations();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      'PENDING': { color: 'bg-yellow-100 text-yellow-800', text: 'Pending' },
      'pending': { color: 'bg-yellow-100 text-yellow-800', text: 'Pending' },
      'PROCESSING': { color: 'bg-blue-100 text-blue-800', text: 'Processing' },
      'COMPLETED': { color: 'bg-green-100 text-green-800', text: 'Completed' },
      'FAILED': { color: 'bg-red-100 text-red-800', text: 'Failed' },
      'REJECTED': { color: 'bg-red-100 text-red-800', text: 'Rejected' },
      'Approved': { color: 'bg-green-100 text-green-800', text: 'Approved' },
    };

    const { color, text } = statusMap[status] || { color: 'bg-gray-100 text-gray-800', text: status };

    return (
      <span
        className={`inline-flex items-center border text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent shadow px-2 py-1 font-medium rounded-full ${
          status === 'Approved'
            ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-400'
            : color
        }`}
      >
        {text}
      </span>
    );
  };

  const toggleExpand = (paymentId: string) => {
    setExpandedPayment(expandedPayment === paymentId ? null : paymentId);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-5xl">
        <h1 className="text-2xl font-bold mb-6">Payment Information</h1>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-5xl">
        <h1 className="text-2xl font-bold mb-6">Payment Information</h1>
        <div className="bg-red-50 p-4 rounded-md border border-red-200 text-red-700">
          <p className="font-medium">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">Payment Information</h1>
      
      {payments.length === 0 ? (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center">
          <p className="text-gray-500">No payments found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {payments.map((payment) => (
            <div key={payment.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div 
                className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50" 
                onClick={() => toggleExpand(payment.id)}
              >
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium">
                      {payment.reference_number || 'Payment #' + payment.id.substring(0, 8)}
                    </h3>
                    {getStatusBadge(payment.status)}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatDate(payment.created_at)} • {payment.method.replace('_', ' ')}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-blue-600">${parseFloat(payment.total_amount.toString()).toLocaleString()}</span>
                  <svg 
                    className={`w-5 h-5 text-gray-400 transition-transform ${expandedPayment === payment.id ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </div>
              </div>
              
              {expandedPayment === payment.id && (
                <div className="border-t border-gray-200 p-4">
                  <h4 className="font-medium mb-3">Quotations in this payment:</h4>
                  
                  {!quotations[payment.id] || quotations[payment.id].length === 0 ? (
                    <div className="text-center py-4 bg-gray-50 rounded border border-gray-100">
                      <p className="text-gray-500">No quotations found for this payment</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {quotations[payment.id].map((quotation) => (
                        <div key={quotation.id} className="border rounded-lg p-3">
                          <div className="flex justify-between">
                            <div>
                              <h5 className="font-medium">{quotation.product_name || quotation.title || 'Untitled Quotation'}</h5>
                              <p className="text-sm text-gray-500">ID: {quotation.quotation_id}</p>
                              <p className="text-sm text-gray-500">Quantity: {quotation.quantity}</p>
                              <p className="text-sm text-gray-500">Created: {formatDate(quotation.created_at)}</p>
                            </div>
                            <div className="text-right">
                              <div className="mb-1">{getStatusBadge(quotation.status)}</div>
                              {quotation.selected_option && quotation[`total_price_option${quotation.selected_option}`] && (
                                <p className="font-bold text-blue-600">
                                  ${parseFloat(quotation[`total_price_option${quotation.selected_option}`]?.toString() || "0").toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="mt-2">
                            <Link 
                              href={`/quotation/${quotation.quotation_id}`}
                              className="text-sm text-blue-600 hover:text-blue-800"
                            >
                              View Details →
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="mt-4 flex justify-end">
                    <Link 
                      href={`/payment-details?ref=${payment.reference_number}`}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      View Full Payment Details →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 