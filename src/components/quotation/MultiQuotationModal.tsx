"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CloseIcon } from "@/icons";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { QuotationData } from "@/types/quotation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import BankInformation from "./BankInformation";

// Available payment methods
const PAYMENT_METHODS = [
  { id: 'WISE', name: 'WISE BUSINESS', icon: '\ud83c\udfe6', currency: 'EUR' },
  { id: 'PAYONEER', name: 'CITIBANK (PAYONEER)', icon: '\ud83c\udfe6', currency: 'USD' },
  { id: 'BINANCE', name: 'BINANCE WALLET', icon: '\ud83d\udd11', currency: 'USDT' }
];

interface MultiQuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotations: QuotationData[];
  onProceedToPayment?: (selectedQuotations: QuotationData[], paymentMethod: string) => void;
}

const MultiQuotationModal: React.FC<MultiQuotationModalProps> = ({
  isOpen,
  onClose,
  quotations = [],
  onProceedToPayment,
}) => {
  const { user } = useAuth();
  const [selectedQuotations, setSelectedQuotations] = useState<QuotationData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [selectedOptions, setSelectedOptions] = useState<Record<string, number>>(() => {
    const initialOptions: Record<string, number> = {};
    quotations.forEach((quotation) => {
      initialOptions[quotation.id] = quotation.selected_option || 1;
    });
    return initialOptions;
  });

  // Filter for approved quotations only
  const approvedQuotations = quotations.filter(q => q.status === "Approved");

  const handleOptionChange = (quotationId: string, optionIndex: number) => {
    setSelectedOptions(prev => ({
      ...prev,
      [quotationId]: optionIndex
    }));

    setSelectedQuotations(prev => 
      prev.map(q => 
        q.id === quotationId 
          ? { ...q, selected_option: optionIndex }
          : q
      )
    );
  };

  const toggleQuotationSelection = (quotation: QuotationData) => {
    setSelectedQuotations((prev) =>
      prev.some((q) => q.id === quotation.id)
        ? prev.filter((q) => q.id !== quotation.id)
        : [...prev, quotation]
    );
  };

  const handleSelectAll = () => {
    setSelectedQuotations(approvedQuotations);
  };

  const handleDeselectAll = () => {
    setSelectedQuotations([]);
  };

  const calculateTotalPrice = () => {
    return selectedQuotations.reduce((total, quotation) => {
      const selectedOption = selectedOptions[quotation.id];
      if (selectedOption && quotation.priceOptions) {
        const price = quotation.priceOptions[selectedOption - 1]?.price;
        const numericPrice = typeof price === 'string' 
          ? parseFloat(price.replace(/[^0-9.-]+/g, ""))
          : 0;
        return total + numericPrice;
      }
      return total;
    }, 0);
  };

  const generateReferenceNumber = () => {
    const timestamp = new Date().getTime().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `PAY-${timestamp}-${random}`;
  };

  const handleProceedToPayment = async () => {
    try {
      if (selectedQuotations.length === 0) {
        alert("Please select at least one quotation to proceed.");
        return;
      }

      if (!selectedPaymentMethod) {
        alert("Please select a payment method to proceed.");
        return;
      }

      if (!user?.id) {
        alert("Please login to proceed with payment.");
        return;
      }

      setIsProcessing(true);

      // Get the selected payment method details
      const selectedMethod = PAYMENT_METHODS.find(m => m.id === selectedPaymentMethod);
      if (!selectedMethod) {
        throw new Error("Invalid payment method selected");
      }

      const totalAmount = calculateTotalPrice();
      const referenceNumber = generateReferenceNumber();

      // Ensure we have valid UUIDs for all selected quotations
      const quotationUuids = selectedQuotations.map(q => {
        // If id is a UUID, use it directly
        if (q.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q.id)) {
          return q.id;
        }
        // If id starts with QT-, it's a display ID, so we need to extract the actual UUID from somewhere else
        // For now, we'll throw an error if we can't find a valid UUID
        throw new Error(`Invalid quotation ID format: ${q.id}`);
      });

      // Create payment record
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert([{
          user_id: user.id,
          total_amount: parseFloat(totalAmount.toString()),
          method: selectedMethod.id,
          status: 'pending',
          quotation_ids: quotationUuids,
          reference_number: referenceNumber,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      console.log("Attempting to save payment with data:", {
        user_id: user.id,
        total_amount: parseFloat(totalAmount.toString()),
        method: selectedMethod.id,
        status: 'pending',
        quotation_ids: quotationUuids,
        reference_number: referenceNumber
      });

      if (paymentError) {
        console.error("Payment Error Details:", {
          message: paymentError.message,
          details: paymentError.details,
          hint: paymentError.hint,
          code: paymentError.code
        });
        throw new Error("Failed to create payment record. Please try again.");
      }

      if (!payment) {
        throw new Error("Failed to create payment record");
      }

      console.log("Payment data:", {
        user_id: user.id,
        total_amount: parseFloat(totalAmount.toString()),
        method: selectedMethod.id,
        status: 'pending',
        quotation_ids: quotationUuids,
        reference_number: referenceNumber
      });
      
      console.log("Payment response:", payment);

      // Update quotations with payment reference
      const updatePromises = selectedQuotations.map(quotation => {
        const quotationId = quotation.id;
        // Skip if not a valid UUID
        if (!quotationId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(quotationId)) {
          console.error(`Invalid quotation ID for update: ${quotationId}`);
          return Promise.resolve();
        }
        
        return supabase
          .from('quotations')
          .update({ 
            payment_id: payment.id,
            selected_option: selectedOptions[quotation.id] || quotation.selected_option || 1
          })
          .eq('id', quotationId);
      });

      await Promise.all(updatePromises.filter(Boolean));

      // Call the optional callback if provided
      if (onProceedToPayment) {
        onProceedToPayment(selectedQuotations, selectedPaymentMethod);
      }

      // Close the modal
      onClose();
      
      // Redirect to payment page
      window.location.href = "/payment";
    } catch (error) {
      console.error("Payment processing error:", error);
      // Display error message to user
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
      alert(`Failed to process payment: ${errorMessage}`);
      // Or use a toast notification if available
      // toast.error(`Failed to process payment: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-5xl bg-white rounded-lg shadow-xl flex flex-col max-h-[90vh] p-0 overflow-hidden">
        <div className="pt-6"></div>
        
        <div className="px-6 pb-4">
          <DialogTitle className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
            Payment Details
          </DialogTitle>
          <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">
            Select the quotations you wish to pay and choose your preferred payment method
          </p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-6 bg-white dark:bg-gray-900">
          {approvedQuotations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">No approved quotations available for payment.</p>
            </div>
          ) : (
            <div className="p-4 sm:p-6">
              {/* Selection Controls */}
              <div className="mb-6 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">Available Quotations</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {approvedQuotations.length} approved quotation(s) available for payment
                    </p>
                  </div>
                  <div className="flex space-x-3">
                    <Button
                      variant="outline"
                      onClick={handleSelectAll}
                      className="text-xs sm:text-sm px-2 sm:px-4 py-1 sm:py-2"
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleDeselectAll}
                      className="text-xs sm:text-sm px-2 sm:px-4 py-1 sm:py-2"
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>
              </div>

              {/* Quotations Section */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Selected Quotations</h3>
                <div className="space-y-3 sm:space-y-4">
                  {approvedQuotations.map((quotation) => {
                    const isSelected = selectedQuotations.some((q) => q.id === quotation.id);
                    const currentOption = selectedOptions[quotation.id];
                    const selectedPrice = currentOption && quotation.priceOptions
                      ? quotation.priceOptions[currentOption - 1]?.price
                      : 0;

                    return (
                      <div
                        key={quotation.id}
                        className={`p-3 sm:p-4 border rounded-lg transition-colors ${
                          isSelected ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                        }`}
                      >
                        <div className="flex flex-col space-y-3 sm:space-y-4">
                          <div className="flex flex-wrap sm:flex-nowrap items-start sm:items-center justify-between gap-2">
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleQuotationSelection(quotation)}
                                  className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <h3 className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">
                                  Quotation {quotation.quotation_id || quotation.id}
                                </h3>
                                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                                  {quotation.product?.name || "Unnamed Product"}
                                </p>
                                <Badge
                                  variant="light"
                                  color="success"
                                >
                                  <span className="text-xs mt-2">Approved</span>
                                </Badge>
                              </div>
                            </div>
                            <div className="ml-7 sm:ml-0">
                              <div className="text-right">
                                <span className="font-semibold text-gray-900 dark:text-white text-base sm:text-lg block">
                                  {selectedPrice || '$0.00'}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400 block mt-1">
                                  Selected option: {currentOption || 1}
                                </span>
                              </div>
                            </div>
                          </div>

                          {quotation.priceOptions && (
                            <div className="ml-7 sm:ml-9 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {quotation.priceOptions.map((option, index) => (
                                <label
                                  key={index}
                                  className={`flex items-center justify-between p-2 sm:p-3 rounded-lg border ${
                                    currentOption === index + 1
                                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-400 bg-white dark:bg-gray-800'
                                  }`}
                                >
                                  <div className="flex items-center space-x-2 sm:space-x-3">
                                    <input
                                      type="radio"
                                      name={`option-${quotation.id}`}
                                      checked={currentOption === index + 1}
                                      onChange={() => handleOptionChange(quotation.id, index + 1)}
                                      className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                    />
                                    <div className="flex flex-col">
                                      <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                                        Option {index + 1}
                                      </span>
                                      {option.description && (
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                          {option.description}
                                        </span>
                                      )}
                                      {option.deliveryTime && (
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                          Delivery: {option.deliveryTime}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white">
                                    {option.price || '$0.00'}
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Payment Summary Section */}
              <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-400">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Payment Summary</h3>
                <div className="flex justify-between items-center py-2 border-b border-blue-100 dark:border-blue-400">
                  <span className="text-sm text-gray-700 dark:text-gray-200">Selected Quotations</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{selectedQuotations.length}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-blue-100 dark:border-blue-400">
                  <span className="text-sm text-gray-700 dark:text-gray-200">Subtotal</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">${calculateTotalPrice().toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2 mt-1">
                  <span className="text-base font-semibold text-gray-900 dark:text-white">Total Amount</span>
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-400">${calculateTotalPrice().toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Method Section */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Payment Method</h3>
                <p className="text-sm text-gray-500 dark:text-gray-300 mb-4">
                  Select your preferred payment method. Bank details will be displayed below.
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {PAYMENT_METHODS.map((method) => (
                    <div key={method.id} className="relative">
                      <div>
                        <button
                          key={method.id}
                          onClick={() => setSelectedPaymentMethod(method.id)}
                          className={`py-3 px-4 border rounded-lg text-left w-full ${
                            selectedPaymentMethod === method.id
                              ? 'border-[#1E88E5] bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                          } text-gray-900 dark:text-white`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{method.icon}</span>
                              <span className="font-medium text-gray-900 dark:text-white">{method.name}</span>
                            </div>
                            {selectedPaymentMethod === method.id && (
                              <div className="w-5 h-5 rounded-full bg-[#1E88E5] flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </button>
                        {selectedPaymentMethod === method.id && (
                          <BankInformation bank={method.id as 'WISE' | 'PAYONEER' | 'BINANCE'} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t p-4 sm:p-6 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              {selectedQuotations.length > 0 ? (
                <span className="text-gray-500 dark:text-gray-300">You are about to pay for {selectedQuotations.length} quotation(s)</span>
              ) : (
                <span className="text-gray-500 dark:text-gray-300">Please select at least one quotation to proceed</span>
              )}
            </div>
            <div className="flex justify-end space-x-3 sm:space-x-4">
              <Button
                variant="outline"
                onClick={onClose}
                className="px-3 sm:px-6 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleProceedToPayment}
                disabled={selectedQuotations.length === 0 || !selectedPaymentMethod || isProcessing}
                className="px-3 sm:px-6 py-2 text-sm bg-[#1E88E5] text-white rounded-lg hover:bg-[#1976D2] dark:bg-blue-600 dark:hover:bg-blue-700 border border-transparent"
              >
                {isProcessing ? "Processing..." : "Proceed to Payment"}
              </Button>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
        >
          <CloseIcon className="w-5 h-5 sm:w-6 sm:h-6 text-gray-500 dark:text-gray-300" />
        </button>
      </DialogContent>
    </Dialog>
  );
};

export default MultiQuotationModal; 