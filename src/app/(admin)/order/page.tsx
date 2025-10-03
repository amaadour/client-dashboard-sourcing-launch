"use client";

import React, { useState, useEffect } from "react";
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
import { Modal } from "@/components/ui/modal";
import { CloseIcon } from "@/icons";

// Define proper interfaces
interface ClientInfo {
  name: string;
  phone: string;
  address: string;
}

interface Product {
  name: string;
  image: string;
}

interface Order {
  id: string;
  product: Product;
  quantity: string;
  date: string;
  timestamp?: string;
  status: string;
  amount: string;
  clientInfo: ClientInfo;
  destinationCountry?: string; // Added destination country
}

// Order Details Modal Component
interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onSaveShippingInfo?: (info: {name: string; phone: string; address: string}) => void;
}

// Add a new ProcessingOrderView component for different processing states
interface ProcessingOrderViewProps {
  order: Order;
  canEdit: boolean;
}

const ProcessingOrderView: React.FC<ProcessingOrderViewProps> = ({ order, canEdit }) => {
  // Use existing state and functions from the parent OrderDetailsModal
  const [editingShipping, setEditingShipping] = useState(false);
  const [shippingInfo, setShippingInfo] = useState({
    name: order.clientInfo.name || "",
    phone: order.clientInfo.phone || "",
    address: order.clientInfo.address || ""
  });

  // Handle saving edited shipping info
  const handleSaveShipping = () => {
    // Here you would update the backend with the new shipping info
    console.log(`Updating shipping info for order ${order.id}:`, shippingInfo);
    setEditingShipping(false);
  };

  return (
    <div className="max-h-[calc(100vh-240px)] px-1 py-2">
      {/* Product Information - Same for both views */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Product Information
        </h3>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-1/3">
            <div className="relative w-full h-56 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              <Image
                src={order.product.image}
                alt={order.product.name}
                fill
                className="object-cover"
              />
            </div>
          </div>
          <div className="w-full md:w-2/3">
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Product Name</span>
                <h4 className="text-lg font-medium text-gray-800 dark:text-white">
                  {order.product.name}
                </h4>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Quantity</span>
                <p className="text-gray-800 dark:text-gray-200">
                  {order.quantity}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Total Amount</span>
                <p className="text-gray-800 dark:text-gray-200 font-semibold">
                  {order.amount}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Destination</span>
                <p className="text-gray-800 dark:text-gray-200">
                  {order.destinationCountry || (order.clientInfo && order.clientInfo.address 
                    ? order.clientInfo.address.split(", ").pop() 
                    : "Not specified")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Shipping Information */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            Shipping Information
          </h3>
          {!editingShipping && canEdit && (
            <Button
              size="sm"
              variant="outline"
              className="text-blue-600 border-blue-300 hover:bg-blue-50"
              onClick={() => setEditingShipping(true)}
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
              </svg>
              View
            </Button>
          )}
          {editingShipping && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-gray-600 border-gray-300"
                onClick={() => setEditingShipping(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-[#1E88E5] hover:bg-[#0D47A1] text-white"
                onClick={handleSaveShipping}
              >
                Save Changes
              </Button>
            </div>
          )}
        </div>
        
        <div className="space-y-4">
          {editingShipping ? (
            // Editable form for shipping info
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Receiver Name
                </label>
                <input
                  type="text"
                  value={shippingInfo.name}
                  onChange={(e) => setShippingInfo({...shippingInfo, name: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter receiver's full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Receiver Phone Number
                </label>
                <input
                  type="text"
                  value={shippingInfo.phone}
                  onChange={(e) => setShippingInfo({...shippingInfo, phone: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Country Destination
                  <span className="text-gray-400 text-xs ml-2">(Cannot be changed)</span>
                </label>
                <input
                  type="text"
                  value={order.destinationCountry || ""}
                  disabled
                  className="w-full border border-gray-200 bg-gray-50 rounded-md px-3 py-2 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Country destination cannot be modified</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Exact Address
                </label>
                <textarea
                  value={shippingInfo.address}
                  onChange={(e) => setShippingInfo({...shippingInfo, address: e.target.value})}
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter complete shipping address"
                ></textarea>
              </div>
            </>
          ) : (
            // Read-only display
            <>
              <div className={`border rounded-lg p-4 relative ${canEdit ? 'border-gray-200' : 'bg-amber-50 border-amber-200'}`}>
                {canEdit && (
                  <Button
                    size="sm"
                    className="absolute top-3 right-3 bg-blue-600 hover:bg-blue-700 text-white flex items-center"
                    onClick={() => setEditingShipping(true)}
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                    </svg>
                    View
                  </Button>
                )}
                
                {!canEdit && (
                  <div className="mb-4">
                    <div className="flex items-start">
                      <div className="rounded-full p-1 bg-amber-100 mr-3 mt-0.5">
                        <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-amber-700">Need to change shipping information?</p>
                        <p className="text-sm text-amber-600 mt-1">
                          Please contact our customer support team to update shipping details for this order.
                        </p>
                        <p className="text-xs text-amber-600 mt-2">
                          Contact: <a href="mailto:support@example.com" className="underline">support@example.com</a> or call <a href="tel:+1234567890" className="underline">+1 (234) 567-890</a>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Receiver Name</span>
                  <p className="text-gray-800 dark:text-gray-200">
                    {order.clientInfo.name || "Not provided"}
                  </p>
                </div>
                <div className="mt-3">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Receiver Phone Number</span>
                  <p className="text-gray-800 dark:text-gray-200">
                    {order.clientInfo.phone || "Not provided"}
                  </p>
                </div>
                <div className="mt-3">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Country Destination</span>
                  <p className="text-gray-800 dark:text-gray-200">
                    {order.destinationCountry || "Not specified"}
                  </p>
                </div>
                <div className="mt-3">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Exact Address</span>
                  <p className="text-gray-800 dark:text-gray-200">
                    {order.clientInfo.address || "Not provided"}
                  </p>
                </div>
              </div>
            </>
          )}
          
          {/* Shipping Information Rules */}
          <div className="mt-4 bg-blue-50 border-blue-200 border rounded-lg p-4">
            <p className="text-sm font-medium text-blue-700">
              Shipping Information Rules:
            </p>
            <ul className="text-xs text-blue-600 mt-1 list-disc pl-5">
              <li><strong>Only Processing orders</strong> can have shipping information changed</li>
              <li>For Shipped/Delivered orders, please contact customer support for any changes</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ isOpen, onClose, order, onSaveShippingInfo }) => {
  // Initialize state at the top level, not conditionally
  const [editingShipping, setEditingShipping] = useState(false);
  const [shippingInfo, setShippingInfo] = useState({
    name: "",
    phone: "",
    address: ""
  });
  
  // Update shipping info when order changes
  useEffect(() => {
    if (order) {
      setShippingInfo({
        name: order.clientInfo.name || "",
        phone: order.clientInfo.phone || "",
        address: order.clientInfo.address || ""
      });
    }
  }, [order]);
  
  // Add effect to check localStorage flag to start editing
  useEffect(() => {
    const shouldStartEditing = localStorage.getItem('startEditingShipping') === 'true';
    // Only allow editing for Processing status
    if (shouldStartEditing && order && order.status === "Processing") {
      setEditingShipping(true);
      // Clear the flag
      localStorage.removeItem('startEditingShipping');
    }
  }, [order]);
  
  if (!order) return null;
  
  // Check if order is within 3 hours of creation
  const isWithin3Hours = () => {
    // Use timestamp if available, otherwise fall back to date
    const orderTime = order.timestamp ? new Date(order.timestamp) : new Date(order.date);
    const now = new Date();
    const threeHoursInMs = 3 * 60 * 60 * 1000;
    return now.getTime() - orderTime.getTime() < threeHoursInMs;
  };
  
  // Only allow editing for Processing status and within 3 hours
  const canEditShipping = order.status === "Processing" && isWithin3Hours();
  
  // Handle saving edited shipping info
  const handleSaveShipping = () => {
    if (onSaveShippingInfo) {
      onSaveShippingInfo(shippingInfo);
    }
    setEditingShipping(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} showCloseButton={false} className="max-w-4xl h-auto mx-auto p-4 sm:p-6 bg-white dark:bg-gray-800 custom-scrollbar">
      {/* Modal header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-xl font-bold text-[#0D47A1] dark:text-white">
            Order {order.id}
          </h2>
          <div className="flex items-center mt-1">
            <span className="text-sm text-gray-500 mr-3">Ordered on {order.date}</span>
            <Badge
              size="sm"
              color={
                order.status === "Delivered"
                  ? "success"
                  : order.status === "Processing"
                  ? "warning"
                  : order.status === "Shipped"
                  ? "info"
                  : "error"
              }
            >
              {order.status}
            </Badge>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-1 text-gray-400 rounded-full hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
        >
          <CloseIcon className="w-6 h-6" />
        </button>
      </div>

      {/* Use ProcessingOrderView for Processing orders */}
      {order.status === "Processing" ? (
        <ProcessingOrderView 
          order={order} 
          canEdit={isWithin3Hours()} 
        />
      ) : (
        // Existing content for non-Processing orders
        <div className="max-h-[calc(100vh-200px)] px-1 py-2">
          {/* Product Information */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
              Product Information
            </h3>
            <div className="flex flex-col md:flex-row gap-6">
              <div className="w-full md:w-1/3">
                <div className="relative w-full h-56 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                  <Image
                    src={order.product.image}
                    alt={order.product.name}
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
              <div className="w-full md:w-2/3">
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Product Name</span>
                    <h4 className="text-lg font-medium text-gray-800 dark:text-white">
                      {order.product.name}
                    </h4>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Quantity</span>
                    <p className="text-gray-800 dark:text-gray-200">
                      {order.quantity}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Total Amount</span>
                    <p className="text-gray-800 dark:text-gray-200 font-semibold">
                      {order.amount}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Destination</span>
                    <p className="text-gray-800 dark:text-gray-200">
                      {order.destinationCountry || (order.clientInfo && order.clientInfo.address 
                        ? order.clientInfo.address.split(", ").pop() 
                        : "Not specified")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Shipping Information - Only shown if status is not Waiting for information */}
          {order.status !== "Waiting for information" && (
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                  Shipping Information
                </h3>
                {!editingShipping && (
                  <div className="flex items-center">
                    {canEditShipping && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-blue-600 border-blue-300 hover:bg-blue-50"
                        onClick={() => setEditingShipping(true)}
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                        </svg>
                        View
                      </Button>
                    )}
                  </div>
                )}
                {editingShipping && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-gray-600 border-gray-300"
                      onClick={() => setEditingShipping(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="bg-[#1E88E5] hover:bg-[#0D47A1] text-white"
                      onClick={handleSaveShipping}
                    >
                      Save Changes
                    </Button>
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                {editingShipping ? (
                  // Editable form
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Receiver Name
                      </label>
                      <input
                        type="text"
                        value={shippingInfo.name}
                        onChange={(e) => setShippingInfo({...shippingInfo, name: e.target.value})}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter receiver's full name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Receiver Phone Number
                      </label>
                      <input
                        type="text"
                        value={shippingInfo.phone}
                        onChange={(e) => setShippingInfo({...shippingInfo, phone: e.target.value})}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter phone number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Country Destination
                        <span className="text-gray-400 text-xs ml-2">(Cannot be changed)</span>
                      </label>
                      <input
                        type="text"
                        value={order.destinationCountry || ""}
                        disabled
                        className="w-full border border-gray-200 bg-gray-50 rounded-md px-3 py-2 text-gray-500 cursor-not-allowed"
                      />
                      <p className="text-xs text-gray-500 mt-1">Country destination cannot be modified</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Exact Address
                      </label>
                      <textarea
                        value={shippingInfo.address}
                        onChange={(e) => setShippingInfo({...shippingInfo, address: e.target.value})}
                        rows={3}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter complete shipping address"
                      ></textarea>
                    </div>
                  </>
                ) : (
                  // Read-only display
                  <>
                    <div className="border rounded-lg p-4 relative">
                      {order.status === "Processing" && (
                        <Button
                          size="sm"
                          className="absolute top-3 right-3 bg-blue-600 hover:bg-blue-700 text-white flex items-center"
                          onClick={() => setEditingShipping(true)}
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                          </svg>
                          View
                        </Button>
                      )}
                      <div>
                        <span className="text-sm text-gray-500 dark:text-gray-400">Receiver Name</span>
                        <p className="text-gray-800 dark:text-gray-200">
                          {order.clientInfo.name || "Not provided"}
                        </p>
                      </div>
                      <div className="mt-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Receiver Phone Number</span>
                        <p className="text-gray-800 dark:text-gray-200">
                          {order.clientInfo.phone || "Not provided"}
                        </p>
                      </div>
                      <div className="mt-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Country Destination</span>
                        <p className="text-gray-800 dark:text-gray-200">
                          {order.destinationCountry || "Not specified"}
                        </p>
                      </div>
                      <div className="mt-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Exact Address</span>
                        <p className="text-gray-800 dark:text-gray-200">
                          {order.clientInfo.address || "Not provided"}
                        </p>
                      </div>
                    </div>
                  </>
                )}
                
                {/* Processing orders notification */}
                {order.status === "Processing" && !editingShipping && (
                  <div className="mt-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-blue-700 dark:text-blue-400 text-sm font-medium">
                      Shipping Information Rules:
                    </p>
                    <ul className="text-xs text-blue-600 dark:text-blue-500 mt-1 list-disc pl-5">
                      <li><strong>Only Processing orders</strong> can have shipping information changed</li>
                      <li>For Shipped/Delivered orders, please contact customer support for any changes</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status-specific content */}
          {order.status === "Waiting for information" && (
            <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center">
              <p className="text-yellow-700 dark:text-yellow-400 mb-2 font-medium">Additional information required</p>
              <p className="text-sm text-yellow-600 dark:text-yellow-500 mb-4">Please provide shipping information to proceed with this order.</p>
              <Button
                variant="primary"
                className="bg-[#1E88E5] hover:bg-[#0D47A1] inline-block"
                onClick={onClose}
              >
                Add Information
              </Button>
            </div>
          )}
          
          {order.status === "Shipped" && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="border-gray-300"
                onClick={onClose}
              >
                View
              </Button>
            </div>
          )}

          {/* Add a notice for non-editable shipping information in Shipped and Delivered statuses */}
          {order.status === "Shipped" || order.status === "Delivered" ? (
            <div className="mt-4 bg-gray-50 dark:bg-gray-900/10 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
              <p className="text-gray-700 dark:text-gray-400 text-sm font-medium">
                Shipping Information cannot be modified
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-500 mt-1">
                Orders in {order.status} status cannot have their shipping information changed.
                {order.status === "Shipped" ? " Please contact customer support if you need to redirect your shipment." : ""}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
};

// Shipping Information Modal Component
interface ShippingInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onSubmit: (info: { name: string; phone: string; address: string }) => void;
}

const ShippingInfoModal: React.FC<ShippingInfoModalProps> = ({ isOpen, onClose, order, onSubmit }) => {
  const [shippingInfo, setShippingInfo] = useState({
    name: "",
    phone: "",
    address: ""
  });

  // Update shipping info when order changes
  useEffect(() => {
    if (order) {
      setShippingInfo({
        name: order.clientInfo.name || "",
        phone: order.clientInfo.phone || "",
        address: order.clientInfo.address || ""
      });
    }
  }, [order]);

  if (!order) return null;

  // Prevent editing for non-Processing orders
  const canEdit = order.status === "Processing" || order.status === "Waiting for information";

  const handleSubmit = () => {
    onSubmit(shippingInfo);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} showCloseButton={false} className="max-w-md h-auto mx-auto p-4 sm:p-6 custom-scrollbar">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-xl font-bold text-[#0D47A1] dark:text-white">
            Shipping Information
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Order ID: {order.id}
          </p>
          {order.status === "Shipped" || order.status === "Delivered" ? (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400 font-medium">
              Shipping information cannot be modified for {order.status} orders
            </p>
          ) : null}
        </div>
        <button 
          onClick={onClose}
          className="p-1 text-gray-400 rounded-full hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
        >
          <CloseIcon className="w-6 h-6" />
        </button>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Receiver Name
          </label>
          <input
            type="text"
            value={shippingInfo.name}
            onChange={(e) => setShippingInfo({...shippingInfo, name: e.target.value})}
            className={`w-full border rounded-md px-3 py-2 ${canEdit ? 'border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500' : 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed'}`}
            placeholder="Enter receiver's full name"
            disabled={!canEdit}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Receiver Phone Number
          </label>
          <input
            type="text"
            value={shippingInfo.phone}
            onChange={(e) => setShippingInfo({...shippingInfo, phone: e.target.value})}
            className={`w-full border rounded-md px-3 py-2 ${canEdit ? 'border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500' : 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed'}`}
            placeholder="Enter phone number"
            disabled={!canEdit}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Country Destination
          </label>
          <input
            type="text"
            value={order.destinationCountry || ""}
            disabled
            className="w-full border border-gray-200 bg-gray-50 rounded-md px-3 py-2 text-gray-500 cursor-not-allowed"
          />
          <p className="text-xs text-gray-500 mt-1">Country cannot be changed for this order</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Exact Address
          </label>
          <textarea
            value={shippingInfo.address}
            onChange={(e) => setShippingInfo({...shippingInfo, address: e.target.value})}
            rows={3}
            className={`w-full border rounded-md px-3 py-2 ${canEdit ? 'border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500' : 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed'}`}
            placeholder="Enter complete shipping address"
            disabled={!canEdit}
          ></textarea>
        </div>
        
        <div className="pt-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Note: Shipping information can only be modified for Processing orders. For other statuses, please contact customer support.
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
        >
          Cancel
        </Button>
        {canEdit ? (
          <Button
            variant="primary"
            size="sm"
            className="bg-[#1E88E5] hover:bg-[#0D47A1]"
            onClick={handleSubmit}
            disabled={!shippingInfo.name || !shippingInfo.phone || !shippingInfo.address}
          >
            Submit Information
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="text-gray-500 border-gray-300 cursor-not-allowed"
            disabled
          >
            Cannot Modify
          </Button>
        )}
      </div>
    </Modal>
  );
};

// Sample product images
const productImages = [
  "/images/product/product-01.jpg",
  "/images/product/product-02.jpg",
  "/images/product/product-03.jpg",
  "/images/product/product-04.jpg",
  "/images/product/product-05.jpg",
];

// Sample order data
const orderData: Order[] = [
  {
    id: "MES-00001",
    product: {
      name: "Industrial Water Pump",
      image: productImages[0],
    },
    quantity: "2 units",
    date: "2023-12-15",
    timestamp: "2023-12-15T10:30:00",
    status: "Processing",
    amount: "$12,500",
    clientInfo: {
      name: "Acme Industries",
      phone: "+1 555-123-4567",
      address: "123 Industrial Blvd, New York, NY 10001",
    },
    destinationCountry: "United States"
  },
  // New order with a recent timestamp (within 3 hours)
  {
    id: "MES-00006",
    product: {
      name: "CNC Machining Center",
      image: productImages[2],
    },
    quantity: "1 unit",
    date: "2025-04-05",
    timestamp: "2025-04-05T20:30:00",
    status: "Processing",
    amount: "$28,750",
    clientInfo: {
      name: "Dynamic Manufacturing",
      phone: "+1 555-321-7890",
      address: "567 Industrial Park, Boston, MA 02108",
    },
    destinationCountry: "United States"
  },
  {
    id: "MES-00002",
    product: {
      name: "Electric Motors",
      image: productImages[2],
    },
    quantity: "5 units",
    date: "2023-12-18",
    timestamp: "2023-12-18T14:25:00",
    status: "Shipped",
    amount: "$8,750",
    clientInfo: {
      name: "Global Manufacturing",
      phone: "+1 555-987-6543",
      address: "456 Factory Ave, Chicago, IL 60007",
    },
    destinationCountry: "United States"
  },
  {
    id: "MES-00003",
    product: {
      name: "Solar Panel System",
      image: productImages[3],
    },
    quantity: "1 system",
    date: "2023-12-20",
    timestamp: "2023-12-20T09:15:00",
    status: "Delivered",
    amount: "$15,200",
    clientInfo: {
      name: "Tech Solutions Inc.",
      phone: "+1 555-789-0123",
      address: "789 Tech Park, San Francisco, CA 94105",
    },
    destinationCountry: "United States"
  },
  {
    id: "MES-00004",
    product: {
      name: "Industrial Air Compressor",
      image: productImages[4],
    },
    quantity: "3 units",
    date: "2023-12-22",
    timestamp: "2023-12-22T16:40:00",
    status: "Waiting for information",
    amount: "$22,500",
    clientInfo: {
      name: "",
      phone: "",
      address: "",
    },
    destinationCountry: "Not specified"
  },
  {
    id: "MES-00005",
    product: {
      name: "Control Panel",
      image: productImages[1],
    },
    quantity: "2 units",
    date: "2023-12-25",
    timestamp: "2023-12-25T11:20:00",
    status: "Processing",
    amount: "$5,800",
    clientInfo: {
      name: "Construction Partners",
      phone: "+1 555-456-7890",
      address: "321 Building St, Dallas, TX 75001",
    },
    destinationCountry: "United States"
  }
];

// Add a function to format time ago for recent orders
const getTimeAgo = (timestamp: string) => {
  const now = new Date();
  const orderTime = new Date(timestamp);
  const diffMs = now.getTime() - orderTime.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
};

// Add a helper function to check if an order is within 3 hours
const isWithin3Hours = (order: Order) => {
  const orderTime = order.timestamp ? new Date(order.timestamp) : new Date(order.date);
  const now = new Date();
  const threeHoursInMs = 3 * 60 * 60 * 1000;
  return now.getTime() - orderTime.getTime() < threeHoursInMs;
};

export default function OrderPage() {
  const [isShippingModalOpen, setIsShippingModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isOrderDetailsModalOpen, setIsOrderDetailsModalOpen] = useState(false);
  // Add state to track changed shipping info
  const [changedShippingInfo, setChangedShippingInfo] = useState<{
    orderId: string;
    before: { name: string; phone: string; address: string };
    after: { name: string; phone: string; address: string };
  } | null>(null);
  const [showChangedInfo, setShowChangedInfo] = useState(false);

  // Map status to component supported badge colors (primary, success, error, warning, info, light, dark)
  const getStatusBadgeColor = (status: string): "primary" | "success" | "warning" | "info" | "error" => {
    switch (status) {
      case "Delivered":
        return "success";
      case "Shipped":
        return "info";
      case "Processing":
        return "warning";
      case "Waiting for information":
        return "error";
      default:
        return "primary";
    }
  };

  const handleShippingInfoSubmit = (info: { name: string; phone: string; address: string }) => {
    // Here you would typically send this data to your backend
    // For this demo, we'll just update our local state
    if (selectedOrder) {
      // Simulate updating the data
      console.log("Updated shipping info for order", selectedOrder.id, info);
      
      // Reset and close modal
      setIsShippingModalOpen(false);
      setSelectedOrder(null);
    }
  };

  const openShippingModal = (order: Order) => {
    setSelectedOrder(order);
    setIsShippingModalOpen(true);
  };

  const openOrderDetailsModal = (order: Order) => {
    setSelectedOrder(order);
    setIsOrderDetailsModalOpen(true);
  };

  const handleSaveShippingInfo = (info: { name: string; phone: string; address: string }) => {
    // Here you would update the backend with the new shipping info
    if (selectedOrder) {
      console.log(`Updating shipping info for order ${selectedOrder.id}:`, info);
      
      // For prototype purposes, save the before/after state
      setChangedShippingInfo({
        orderId: selectedOrder.id,
        before: {
          name: selectedOrder.clientInfo.name,
          phone: selectedOrder.clientInfo.phone,
          address: selectedOrder.clientInfo.address
        },
        after: info
      });
      
      // Show the prototype display
      setShowChangedInfo(true);
      
      // In a real app, update the backend here
    }
  };

  // Function to directly open edit mode for shipping info
  const openEditShippingInfo = (order: Order) => {
    setSelectedOrder(order);
    setIsOrderDetailsModalOpen(true);
    // Force editing mode on next render via localStorage
    localStorage.setItem('startEditingShipping', 'true');
  };

  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      {/* Page Header Section */}
      <div className="col-span-12">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-[#0D47A1] dark:text-white/90">
            Order Management
          </h1>
        </div>
      </div>

      {/* Prototype Display for Changed Shipping Information */}
      {showChangedInfo && changedShippingInfo && (
        <div className="col-span-12">
          <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-green-700 dark:text-green-400 font-medium">
                  Shipping Information Updated for Order {changedShippingInfo.orderId}
                </p>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 bg-white dark:bg-gray-800 rounded-lg">
                    <h4 className="text-gray-500 text-sm mb-2 font-medium">Previous Information</h4>
                    <p className="text-gray-800 dark:text-white text-sm">
                      <span className="font-medium">Name:</span> {changedShippingInfo.before.name}
                    </p>
                    <p className="text-gray-800 dark:text-white text-sm my-1">
                      <span className="font-medium">Phone:</span> {changedShippingInfo.before.phone}
                    </p>
                    <p className="text-gray-800 dark:text-white text-sm">
                      <span className="font-medium">Address:</span> {changedShippingInfo.before.address}
                    </p>
                  </div>
                  <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border-2 border-green-300">
                    <h4 className="text-green-600 text-sm mb-2 font-medium">Updated Information</h4>
                    <p className="text-gray-800 dark:text-white text-sm">
                      <span className="font-medium">Name:</span> {changedShippingInfo.after.name}
                    </p>
                    <p className="text-gray-800 dark:text-white text-sm my-1">
                      <span className="font-medium">Phone:</span> {changedShippingInfo.after.phone}
                    </p>
                    <p className="text-gray-800 dark:text-white text-sm">
                      <span className="font-medium">Address:</span> {changedShippingInfo.after.address}
                    </p>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setShowChangedInfo(false)}
                className="p-1 text-gray-400 rounded-full hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
              >
                <CloseIcon className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Summary Cards */}
      <div className="col-span-12">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:gap-6">
          {/* Total Orders */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 transition-all duration-300 transform hover:scale-105 hover:shadow-lg">
            <div className="flex items-center justify-center w-12 h-12 bg-[#E3F2FD] rounded-xl">
              <svg className="text-[#0D47A1]" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19.5 14.25V10.5C19.5 6.34784 19.0312 5.25 15 5.25C10.9688 5.25 10.5 6.34784 10.5 10.5V14.25H8.25C7.85218 14.25 7.47064 14.408 7.18934 14.6893C6.90804 14.9706 6.75 15.3522 6.75 15.75V18.75C6.75 19.1478 6.90804 19.5294 7.18934 19.8107C7.47064 20.092 7.85218 20.25 8.25 20.25H21.75C22.1478 20.25 22.5294 20.092 22.8107 19.8107C23.092 19.5294 23.25 19.1478 23.25 18.75V15.75C23.25 15.3522 23.092 14.9706 22.8107 14.6893C22.5294 14.408 22.1478 14.25 21.75 14.25H19.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M15 14.25C16.0355 14.25 16.875 13.4105 16.875 12.375C16.875 11.3395 16.0355 10.5 15 10.5C13.9645 10.5 13.125 11.3395 13.125 12.375C13.125 13.4105 13.9645 14.25 15 14.25Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="mt-5">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Total Orders
              </span>
              <h4 className="mt-2 font-bold text-[#0D47A1] text-title-sm dark:text-white/90">
                142
              </h4>
            </div>
          </div>

          {/* Delivered Orders */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 transition-all duration-300 transform hover:scale-105 hover:shadow-lg">
            <div className="flex items-center justify-center w-12 h-12 bg-[#E3F2FD] rounded-xl">
              <svg className="text-[#0D47A1]" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 11L12 14L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M21 12V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="mt-5">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Delivered Orders
              </span>
              <h4 className="mt-2 font-bold text-[#0D47A1] text-title-sm dark:text-white/90">
                54
              </h4>
            </div>
          </div>

          {/* Processing Orders */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 transition-all duration-300 transform hover:scale-105 hover:shadow-lg">
            <div className="flex items-center justify-center w-12 h-12 bg-[#E3F2FD] rounded-xl">
              <svg className="text-[#0D47A1]" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
                Processing Orders
              </span>
              <h4 className="mt-2 font-bold text-[#0D47A1] text-title-sm dark:text-white/90">
                68
              </h4>
            </div>
          </div>

          {/* Waiting for Information */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 transition-all duration-300 transform hover:scale-105 hover:shadow-lg">
            <div className="flex items-center justify-center w-12 h-12 bg-[#E3F2FD] rounded-xl">
              <svg className="text-[#0D47A1]" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 8V12L14 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="mt-5">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Waiting for Information
              </span>
              <h4 className="mt-2 font-bold text-[#0D47A1] text-title-sm dark:text-white/90">
                20
              </h4>
            </div>
          </div>
        </div>
      </div>

      {/* Order Table Section */}
      <div className="col-span-12">
        <div className="rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="flex flex-wrap items-center justify-between gap-4 p-5 md:p-6">
            <h3 className="font-semibold text-[#0D47A1] text-base dark:text-white/90">
              Order Management
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search orders..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E88E5] focus:border-[#1E88E5] w-64 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                />
                <svg
                  className="absolute left-3 top-2.5 text-gray-400"
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
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell
                      isHeader
                      className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                    >
                      Order ID
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
                      Order Date
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
                      Total Amount
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
                <TableBody>
                  {orderData.map((order, index) => (
                    <TableRow
                      key={index}
                      className={`border-b border-gray-100 last:border-b-0 dark:border-white/[0.05] dark:bg-transparent dark:text-white ${
                        order.status === "Processing" ? "bg-blue-50 dark:bg-blue-900/10" : ""
                      } transition-all duration-300 hover:bg-[#E3F2FD] hover:shadow-md cursor-pointer transform hover:translate-x-1 hover:scale-[1.01]`}
                    >
                      <TableCell className="px-5 py-3 text-theme-sm">
                        {order.id}
                      </TableCell>
                      <TableCell className="px-5 py-3 text-theme-sm">
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 overflow-hidden rounded-lg">
                            <Image
                              src={order.product.image}
                              alt={order.product.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <span className="font-medium">{order.product.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-3 text-theme-sm">
                        {order.quantity}
                      </TableCell>
                      <TableCell className="px-5 py-3 text-theme-sm">
                        <div title={order.timestamp 
                          ? `Order placed: ${new Date(order.timestamp).toLocaleString([], {dateStyle: 'medium', timeStyle: 'short'})}`
                          : `Order placed: ${order.date}`
                        }>
                          <div>{order.date}</div>
                          {order.timestamp && (
                            <div className="text-xs text-gray-500">
                              {new Date(order.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              {' • '}
                              <span>
                                {getTimeAgo(order.timestamp)}
                                {order.status === "Processing" && !isWithin3Hours(order) ? null : null}
                              </span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-3 text-theme-sm">
                        <Badge color={getStatusBadgeColor(order.status)} size="sm">
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-5 py-3 text-theme-sm">
                        {order.amount}
                      </TableCell>
                      <TableCell className="px-5 py-3 text-theme-sm">
                        {order.status === "Waiting for information" ? (
                          <Button
                            size="sm"
                            className="bg-[#1E88E5] hover:bg-[#0D47A1] text-white"
                            onClick={() => openShippingModal(order)}
                          >
                            Add Information
                          </Button>
                        ) : order.status === "Shipped" ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-gray-300"
                              onClick={() => openOrderDetailsModal(order)}
                            >
                              View
                            </Button>
                          </div>
                        ) : order.status === "Processing" ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-gray-300"
                              onClick={() => openEditShippingInfo(order)}
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                              </svg>
                              <span className="font-medium">View</span>
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-gray-300"
                              onClick={() => openOrderDetailsModal(order)}
                            >
                              View
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>

      {/* Order Details Modal */}
      <OrderDetailsModal 
        isOpen={isOrderDetailsModalOpen} 
        onClose={() => setIsOrderDetailsModalOpen(false)} 
        order={selectedOrder}
        onSaveShippingInfo={handleSaveShippingInfo} 
      />

      {/* Shipping Information Modal */}
      <ShippingInfoModal 
        isOpen={isShippingModalOpen}
        onClose={() => setIsShippingModalOpen(false)}
        order={selectedOrder}
        onSubmit={handleShippingInfoSubmit}
      />
    </div>
  );
} 