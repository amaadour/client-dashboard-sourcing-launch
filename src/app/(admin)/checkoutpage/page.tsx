"use client"

import type React from "react"
import { useState, useEffect, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useAuth } from "@/context/AuthContext"
import Button from "@/components/ui/button/Button"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/supabase"

// Interface for debug info state
interface DebugInfoData {
  authStatus: string
  dataFetchStatus: string
  quotationsFound: number
  priceOptionsFound: number
  [key: string]: string | number | boolean | null | undefined
}

// Simple component to show debugging info during development
const DebugInfo = ({ data, title }: { data: DebugInfoData; title?: string }) => (
  <div className="mt-4 p-3 bg-gray-100 rounded-md text-xs overflow-auto max-h-40">
    <h4 className="font-bold mb-1">{title || "Debug Info"}</h4>
    <pre>{JSON.stringify(data, null, 2)}</pre>
  </div>
)

interface PriceOption {
  id: string
  price: string
  numericPrice: number
  supplier: string
  deliveryTime: string
  description?: string
  modelName?: string
  modelImage?: string
}

interface QuotationData {
  id: string
  uuid?: string
  product: {
    name: string
    image: string
    category: string
    description?: string
  }
  quantity: number
  status: string
  price?: string
  priceOptions?: PriceOption[]
  selectedOption?: string
  client_label?: string | null
  hasApprovedPayment?: boolean
}

type PaymentInsertData = Database['public']['Tables']['payments']['Insert']

// Component that uses searchParams (client component)
function CheckoutPageContent() {
  const searchParams = useSearchParams()
  const quotationId = searchParams.get("quotation")
  const router = useRouter()
  const { user } = useAuth()

  const [quotations, setQuotations] = useState<QuotationData[]>([])
  const [selectedQuotations, setSelectedQuotations] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedBank, setSelectedBank] = useState<string | null>(null)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [debugState, setDebugState] = useState({
    authStatus: "Checking...",
    dataFetchStatus: "Not started",
    quotationsFound: 0,
    priceOptionsFound: 0,
  })
  const [labels, setLabels] = useState<Record<string, string>>({})
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let isMounted = true

    async function fetchData() {
      try {
        if (!isMounted) return

        setIsLoading(true)
        setError(null)

        // Authentication check logic...
        setDebugState((prev) => ({ ...prev, authStatus: "Checking..." }))
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

        if (!isMounted) return

        if (sessionError) {
          setDebugState((prev) => ({ ...prev, authStatus: "Error: " + sessionError.message }))
          setError("Authentication error. Please log in again.")
          return
        }

        // Get user ID from session
        const userId = sessionData?.session?.user?.id

        // Development bypass
        const isDevelopment = process.env.NODE_ENV === "development"
        const bypassAuth = isDevelopment

        if (!userId && !bypassAuth) {
          setDebugState((prev) => ({ ...prev, authStatus: "No user found" }))
          setError("You need to be logged in to view the checkout page.")
          return
        }

        // Use a valid UUID format for development mode
        const devUserId = "7bd1a436-bb10-4b3f-b09d-2a52876fc4ed" // Valid UUID for development
        const effectiveUserId = userId || (bypassAuth ? devUserId : null)

        setDebugState((prev) => ({
          ...prev,
          authStatus: bypassAuth
            ? "DEV MODE: Authentication bypassed"
            : "Authenticated as: " + effectiveUserId?.substring(0, 8) + "...",
        }))

        // Fetch quotations
        setDebugState((prev) => ({ ...prev, dataFetchStatus: "Fetching quotations..." }))

        // Additional null check for TypeScript
        if (!effectiveUserId) {
          setError("User authentication required.")
          return
        }

        const { data: quotationsData, error: quotationsError } = await supabase
          .from("quotations")
          .select("*")
          .eq("status", "Approved")
          .eq("user_id", effectiveUserId)

        if (!isMounted) return

        if (quotationsError) {
          setDebugState((prev) => ({ ...prev, dataFetchStatus: "Error: " + quotationsError.message }))
          setError("Failed to load quotations. Please try again.")
          return
        }

        if (!quotationsData || quotationsData.length === 0) {
          setDebugState((prev) => ({ ...prev, dataFetchStatus: "No quotations found" }))
          setError("No approved quotations found.")
          return
        }

        setDebugState((prev) => ({
          ...prev,
          dataFetchStatus: "Found quotations",
          quotationsFound: quotationsData.length,
        }))

        // Process all quotations
        const formattedQuotations: QuotationData[] = []
        const initialOptions: Record<string, string> = {}
        const initialQuantities: Record<string, number> = {}
        const initialSelectedQuotations = new Set<string>()

        for (const quotationData of quotationsData) {
          const priceOptions: PriceOption[] = []

          // Add option 1 if it exists
          if (quotationData.title_option1) {
            const extraImages1 = quotationData.extra_images_option1 || [];
            priceOptions.push({
              id: "1",
              price: quotationData.total_price_option1
                ? `$${parseFloat(quotationData.total_price_option1).toLocaleString()}`
                : "N/A",
              numericPrice: parseFloat(quotationData.total_price_option1 || "0"),
              supplier: quotationData.title_option1,
              deliveryTime: quotationData.delivery_time_option1 || "Standard delivery",
              description: quotationData.description_option1,
              modelName: quotationData.title_option1,
              modelImage: (extraImages1.length > 0 ? extraImages1[0] : null) || "/images/product/product-01.jpg",
            })
          }

          // Add option 2 if it exists
          if (quotationData.title_option2) {
            const extraImages2 = quotationData.extra_images_option2 || [];
            priceOptions.push({
              id: "2",
              price: quotationData.total_price_option2
                ? `$${parseFloat(quotationData.total_price_option2).toLocaleString()}`
                : "N/A",
              numericPrice: parseFloat(quotationData.total_price_option2 || "0"),
              supplier: quotationData.title_option2,
              deliveryTime: quotationData.delivery_time_option2 || "Standard delivery",
              description: quotationData.description_option2,
              modelName: quotationData.title_option2,
              modelImage: (extraImages2.length > 0 ? extraImages2[0] : null) || "/images/product/product-01.jpg",
            })
          }

          // Add option 3 if it exists
          if (quotationData.title_option3) {
            const extraImages3 = quotationData.extra_images_option3 || [];
            priceOptions.push({
              id: "3",
              price: quotationData.total_price_option3
                ? `$${parseFloat(quotationData.total_price_option3).toLocaleString()}`
                : "N/A",
              numericPrice: parseFloat(quotationData.total_price_option3 || "0"),
              supplier: quotationData.title_option3,
              deliveryTime: quotationData.delivery_time_option3 || "Standard delivery",
              description: quotationData.description_option3,
              modelName: quotationData.title_option3,
              modelImage: (extraImages3.length > 0 ? extraImages3[0] : null) || "/images/product/product-01.jpg",
            })
          }

          // If no price options found in the quotation data, try to fetch from price_options table
          const formattedPriceOptions = priceOptions

          // Skip fetching from price_options table since it doesn't exist
          // if (priceOptions.length === 0) {
          //   const { data: priceOptionsData } = await supabase
          //     .from("price_options")
          //     .select()
          //     .eq("quotation_ref_id", quotationData.id)

          //   if (!isMounted) return

          //   // Format price options from the price_options table
          //   if (priceOptionsData) {
          //     formattedPriceOptions = priceOptionsData.map((option) => ({
          //       id: option.id,
          //       price: `$${parseFloat(option.price).toLocaleString()}`,
          //       numericPrice: parseFloat(option.price),
          //       supplier: option.supplier,
          //       deliveryTime: option.delivery_time,
          //       description: option.description,
          //       modelName: option.name,
          //       modelImage: option.image || "/images/product/product-01.jpg",
          //     }))
          //   }
          // }

          // Update debug state with price options count
          setDebugState((prev) => ({
            ...prev,
            priceOptionsFound: prev.priceOptionsFound + formattedPriceOptions.length,
          }))

          // Skip fetching user selections since the table doesn't exist
          // const { data: userSelectionData } = effectiveUserId
          //   ? await supabase
          //       .from("user_selections")
          //       .select()
          //       .eq("quotation_id", quotationData.id)
          //       .eq("user_id", effectiveUserId)
          //       .maybeSingle()
          //   : { data: null }

          if (!isMounted) return

          // Set default option
          const quotationIdFormatted = quotationData.quotation_id || `QT-${quotationData.id}`

          // Always use the first price option as default since we don't have user selections
          if (formattedPriceOptions.length > 0) {
            initialOptions[quotationIdFormatted] = formattedPriceOptions[0].id
          }

          // Set default quantity
          initialQuantities[quotationIdFormatted] = 1

          // Calculate base price
          let basePrice = "$0.00"
          if (formattedPriceOptions.length > 0) {
            basePrice = formattedPriceOptions[0].price
          }

          // Create formatted quotation
          formattedQuotations.push({
            id: quotationIdFormatted,
            uuid: quotationData.id,
            product: {
              name: quotationData.product_name || "Unnamed Product",
              image: quotationData.image_url || "/images/product/product-01.jpg",
              category: quotationData.service_type || "Product",
              description: quotationData.product_url || "High-quality product",
            },
            quantity: 1,
            status: quotationData.status || "Approved",
            price: basePrice,
            priceOptions: formattedPriceOptions,
            selectedOption: formattedPriceOptions.length > 0 ? formattedPriceOptions[0].id : undefined
          })

          // If a specific quotation was requested, select it by default
          if (quotationId && quotationIdFormatted === quotationId) {
            initialSelectedQuotations.add(quotationIdFormatted)
          }
        }

        if (isMounted) {
          setQuotations(formattedQuotations)
          setSelectedOptions(initialOptions)
          setQuantities(initialQuantities)

          // Only select specific quotation if provided in query param, otherwise select none
          if (quotationId) {
            setSelectedQuotations(initialSelectedQuotations)
          } else {
            // Initialize with empty set - no auto-selection
            setSelectedQuotations(new Set())
          }
        }
      } catch (err) {
        console.error("Exception fetching data:", err)
        if (isMounted) {
          setError("An unexpected error occurred. Please try again later.")
          setDebugState((prev) => ({ ...prev, dataFetchStatus: "Exception: " + String(err) }))
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      isMounted = false
    }
  }, [quotationId])

  useEffect(() => {
    const checkAuth = async () => {
      // Check session
      const { data: sessionData } = await supabase.auth.getSession()
      console.log("Session check:", {
        hasSession: !!sessionData.session,
        sessionUser: sessionData.session?.user?.id,
        contextUser: user?.id,
      })

      // Double check with getUser
      const { data: userData } = await supabase.auth.getUser()
      console.log("User check:", {
        hasUser: !!userData.user,
        userId: userData.user?.id,
      })
    }
    checkAuth()
  }, [user])

  const handleBankSelection = (bank: string) => {
    setSelectedBank(bank)
  }

  const toggleQuotationSelection = (quotationId: string) => {
    setSelectedQuotations((prev) => {
      const newSelection = new Set(prev)
      if (newSelection.has(quotationId)) {
        newSelection.delete(quotationId)
      } else {
        newSelection.add(quotationId)
      }
      return newSelection
    })
  }

  const handleOptionSelect = (quotationId: string, optionId: string) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [quotationId]: optionId,
    }))
  }

  const getSelectedOptionName = (quotation: QuotationData) => {
    const optionId = selectedOptions[quotation.id] || quotation.selectedOption
    if (optionId && quotation.priceOptions) {
      const option = quotation.priceOptions.find((opt) => opt.id === optionId)
      return option ? `Option ${option.id}` : "Option 1"
    }
    return "Option 1"
  }

  const getQuotationPrice = (quotation: QuotationData) => {
    // Get price based on selected option
    const optionId = selectedOptions[quotation.id] || quotation.selectedOption
    let price = 0

    if (optionId && quotation.priceOptions) {
      const option = quotation.priceOptions.find((opt) => opt.id === optionId)
      if (option) {
        price = option.numericPrice
      }
    } else if (quotation.priceOptions && quotation.priceOptions.length > 0) {
      price = quotation.priceOptions[0].numericPrice
    }

    // Multiply by quantity
    const quantity = quantities[quotation.id] || 1
    const total = price * quantity

    return {
      numeric: total,
      formatted: `$${total.toLocaleString()}`,
    }
  }

  const getTotalAmount = () => {
    const selectedQuotationsList = quotations.filter((q) => selectedQuotations.has(q.id))
    const total = selectedQuotationsList.reduce((sum, quotation) => {
      return sum + getQuotationPrice(quotation).numeric
    }, 0)
    return `$${total.toLocaleString()}`
  }

  const incrementQuantity = (quotationId: string) => {
    setQuantities((prev) => ({
      ...prev,
      [quotationId]: (prev[quotationId] || 1) + 1,
    }))
  }

  const decrementQuantity = (quotationId: string) => {
    setQuantities((prev) => ({
      ...prev,
      [quotationId]: Math.max(1, (prev[quotationId] || 1) - 1),
    }))
  }

  const handleCompletePayment = async () => {
    if (selectedQuotations.size === 0) return

    try {
      // First verify authentication
      const { data: { session } } = await supabase.auth.getSession()
      const isDevelopment = process.env.NODE_ENV === "development"
      
      let effectiveUserId = session?.user?.id

      // In development mode, proceed with a development user ID if no session exists
      if (isDevelopment && !effectiveUserId) {
        console.log("Development mode: Using development user ID")
        effectiveUserId = session?.user?.id // Development user ID
      } else if (!effectiveUserId) {
        // In production, require authentication
        console.error("No authenticated user found")
        alert("Please sign in to complete your payment.")
        router.push("/signin")
        return
      }

      const selectedQuotationsList = quotations.filter((q) => selectedQuotations.has(q.id))
      const totalAmount = selectedQuotationsList.reduce((sum, quotation) => {
        return sum + getQuotationPrice(quotation).numeric
      }, 0)

      // Get UUID values instead of formatted IDs
      const quotationUUIDs = selectedQuotationsList
        .map((quotation) => quotation.uuid)
        .filter((uuid): uuid is string => uuid !== undefined)

      // Additional check to ensure effectiveUserId is not null/undefined
      if (!effectiveUserId) {
        console.error("No authenticated user found")
        alert("Please sign in to complete your payment.")
        router.push("/signin")
        return
      }

      // Create payment data with all required fields
      const paymentData: PaymentInsertData = {
        user_id: effectiveUserId,
        total_amount: totalAmount,
        method: selectedBank || "Other",
        status: "pending" as const,
        quotation_ids: quotationUUIDs
      }

      console.log("Attempting to save payment with data:", paymentData)

      // Insert the payment record
      const { data: paymentResult, error: paymentError } = await supabase
        .from("payments")
        .insert(paymentData)
        .select()
        .single()

      if (paymentError) {
        console.error("Payment database error:", {
          message: paymentError.message,
          details: paymentError.details,
          hint: paymentError.hint,
          code: paymentError.code,
          data: paymentData
        })
        
        let errorMessage = "Payment processing failed"
        if (paymentError.message) {
          errorMessage += `: ${paymentError.message}`
        }
        if (paymentError.details) {
          errorMessage += ` (${paymentError.details})`
        }
        if (paymentError.hint) {
          errorMessage += `\nHint: ${paymentError.hint}`
        }
        alert(errorMessage)
        return
      }

      // If payment was saved successfully, create payment_quotations junction records
      if (paymentResult) {
        // Create payment-quotation links
        const paymentQuotationsData = quotationUUIDs.map((quotationId) => ({
          payment_id: paymentResult.id,
          quotation_id: quotationId,
          user_id: effectiveUserId!  // We already checked this above
        }))

        if (paymentQuotationsData.length > 0) {
          try {
            const { error: junctionError } = await supabase
              .from("payment_quotations")
              .insert(paymentQuotationsData)

            if (junctionError) {
              console.warn("Warning: Failed to link some quotations to payment:", {
                message: junctionError.message,
                details: junctionError.details
              })
            }
          } catch (error) {
            console.warn("Error creating payment-quotation links:", error)
          }
        }

        // Set the current payment ID and open the upload modal
        setCurrentPaymentId(paymentResult.id)
        setIsUploadModalOpen(true)
      } else {
        // Fallback if no payment ID is returned
        alert(
          `Payment of ${getTotalAmount()} for ${selectedQuotations.size} quotation(s) processed successfully via ${selectedBank || "default method"}.`
        )
        router.push("/payment")
      }
    } catch (err) {
      console.error("Payment error:", err)
      alert("Payment processing failed. Please try again.")
    }
  }

  // Close the upload modal
  const closeUploadModal = () => {
    if (!isUploading) {
      setIsUploadModalOpen(false)
      setCurrentPaymentId(null)
      setUploadSuccess(false)
      setUploadError(null)
      // Redirect to payment page regardless of upload status
      router.push("/payment")
    }
  }

  // Handle file input change
  const handleFileChange = () => {
    setUploadError(null)
  }

  // Handle the proof upload
  const handleProofUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPaymentId || !fileInputRef.current?.files?.[0]) {
      setUploadError("Please select a file to upload.")
      return
    }

    const file = fileInputRef.current.files[0]
    setIsUploading(true)
    setUploadError(null)

    try {
      // Upload the file to Supabase Storage
      const fileName = `payment_proof_${currentPaymentId}_${new Date().getTime()}.${file.name.split(".").pop()}`
      const { error: uploadError } = await supabase.storage
        .from("payment_proofs")
        .upload(fileName, file)

      if (uploadError) {
        // Check if this is an RLS policy violation
        if (uploadError.message && uploadError.message.includes("new row violates row-level security policy")) {
          console.error("RLS Policy Violation:", uploadError)
          throw new Error(`Upload failed due to security policy. Please make sure you're logged in and have permission to upload files. 
          Technical details: ${uploadError.message}`)
        }
        
        throw uploadError
      }

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from("payment_proofs")
        .getPublicUrl(fileName)

      // Update the payment record with the proof URL
      const { error: updateError } = await supabase
        .from("payments")
        .update({ proof_url: urlData.publicUrl, payment_proof: urlData.publicUrl, status: "processing" })
        .eq("id", currentPaymentId)

      if (updateError) {
        throw updateError
      }

      setUploadSuccess(true)
      setTimeout(() => {
        setIsUploadModalOpen(false)
        router.push(`/payment?id=${currentPaymentId}`)
      }, 2000)
    } catch (error: unknown) {
        console.error("Upload error:", error)
      let errorMessage = "Failed to upload payment proof."

      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === "object" && error !== null) {
        const anyError = error as Record<string, unknown>
        if (typeof anyError.message === "string") errorMessage = anyError.message
        else if (anyError.error) {
          errorMessage = typeof anyError.error === "string" ? anyError.error : "Server error"
        } else if (typeof anyError.statusText === "string") errorMessage = anyError.statusText
      }

      setUploadError(errorMessage)
    } finally {
      setIsUploading(false)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-4 border-t-blue-500 border-gray-200 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading checkout data...</p>
          {process.env.NODE_ENV === "development" && <DebugInfo data={debugState} title="Loading Status" />}
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 mx-auto my-8 max-w-3xl">
        <h2 className="text-red-700 font-semibold text-lg mb-3">Error</h2>
        <p className="text-red-600">{error}</p>
        <Button
          className="mt-4 bg-red-600 hover:bg-red-700 text-white"
          onClick={() => (window.location.href = "/quotation")}
        >
          Back to Quotations
        </Button>
        {process.env.NODE_ENV === "development" && <DebugInfo data={debugState} title="Error Debug Info" />}
      </div>
    )
  }

  // No quotations
  if (quotations.length === 0) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mx-auto my-8 max-w-3xl">
        <h2 className="text-blue-700 font-semibold text-lg mb-3">No Quotations Found</h2>
        <p className="text-blue-600">No approved quotations are available for checkout.</p>
        <Button
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => (window.location.href = "/quotation")}
        >
          View All Quotations
        </Button>
        {process.env.NODE_ENV === "development" && <DebugInfo data={debugState} title="Debug Info" />}
      </div>
    )
  }

  const selectedQuotationsList = quotations.filter((q) => selectedQuotations.has(q.id))

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6 pb-4 border-b border-[#BBDEFB]">
        <h1 className="text-2xl font-bold text-[#0D47A1]">Complete Payment</h1>
        <p className="text-sm text-[#0D47A1]/60 mt-0.5">Select your quotations and confirm payment</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Content - Product Grid */}
        <div className="w-full lg:w-2/3 space-y-4">
            {quotations.map((quotation) => {
              const selectedOptionId =
                selectedOptions[quotation.id] || quotation.selectedOption || quotation.priceOptions?.[0]?.id || "1"
              const quantity = quantities[quotation.id] || 1
              const isSelected = selectedQuotations.has(quotation.id)

              return (
                <div
                  key={quotation.id}
                  className={`rounded-xl border overflow-hidden transition-all ${
                    isSelected ? "border-[#0D47A1] ring-1 ring-[#0D47A1] shadow-sm" : "border-[#BBDEFB]"
                  }`}
                >
                  {/* Card Header */}
                  <div className={`flex items-center justify-between px-4 py-3 border-b ${
                    isSelected ? "bg-[#0D47A1] border-[#0D47A1]" : "bg-[#E3F2FD] border-[#BBDEFB]"
                  }`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className={`text-sm font-semibold uppercase tracking-wide truncate ${isSelected ? "text-white" : "text-[#0D47A1]"}`}>
                        {quotation.product.name}
                      </h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                        isSelected ? "bg-white/20 text-white" : "bg-[#BBDEFB] text-[#0D47A1]"
                      }`}>{quotation.id}</span>
                    </div>
                    <button
                      onClick={() => toggleQuotationSelection(quotation.id)}
                      className={`w-6 h-6 rounded-full flex items-center justify-center border-2 flex-shrink-0 ml-2 transition-all ${
                        isSelected ? "bg-white border-white text-[#0D47A1]" : "border-[#0D47A1]/40 text-transparent hover:border-[#0D47A1]"
                      }`}
                    >
                      {isSelected && (
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Product Info */}
                  <div className="p-4 bg-white space-y-4">
                    {/* Image + base price */}
                    <div className="flex gap-3 items-start">
                      <div className="w-18 h-18 rounded-lg border border-[#BBDEFB] bg-[#E3F2FD]/40 flex items-center justify-center flex-shrink-0 overflow-hidden" style={{width:72,height:72}}>
                        <Image src={quotation.product.image || "/placeholder.svg"} alt={quotation.product.name} width={72} height={72} className="object-contain max-h-16" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[#0D47A1]/60 uppercase tracking-wide font-medium mb-0.5">Base Price</p>
                        <p className="text-lg font-bold text-[#0D47A1]">{quotation.price}</p>
                        {quotation.product.description && <p className="text-xs text-gray-500 mt-1 truncate">{quotation.product.description}</p>}
                      </div>
                    </div>

                    {/* Price Options */}
                    <div>
                      <p className="text-xs font-semibold text-[#0D47A1]/60 uppercase tracking-wide mb-2">Price Options</p>
                      <div className="space-y-2">
                        {quotation.priceOptions?.map((option) => {
                          const isOptionSelected = selectedOptionId === option.id
                          return (
                            <div
                              key={option.id}
                              className={`border rounded-lg transition-all ${
                                isOptionSelected ? "border-[#0D47A1] bg-[#E3F2FD]" : "border-[#BBDEFB] hover:border-[#0D47A1]/40 hover:bg-[#E3F2FD]/30"
                              }`}
                            >
                              <div className="p-3">
                                <div className="flex items-start justify-between mb-1">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h4 className={`text-sm font-semibold ${isOptionSelected ? "text-[#0D47A1]" : "text-gray-800"}`}>
                                        {option.modelName || `Option ${option.id}`}
                                      </h4>
                                      {isOptionSelected && (
                                        <span className="px-2 py-0.5 bg-[#0D47A1] text-white text-xs rounded-full font-medium">Selected</span>
                                      )}
                                    </div>
                                    <p className="text-xs text-[#0D47A1]/60 mt-0.5">{option.supplier}</p>
                                  </div>
                                  <span className={`text-base font-bold ${isOptionSelected ? "text-[#0D47A1]" : "text-gray-700"}`}>{option.price}</span>
                                </div>
                                {option.description && <p className="text-xs text-gray-500 mb-2">{option.description}</p>}
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-[#0D47A1]/60">Delivery: <span className="font-medium text-gray-700">{option.deliveryTime}</span></span>
                                  <button
                                    onClick={() => handleOptionSelect(quotation.id, option.id)}
                                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                                      isOptionSelected ? "bg-[#0D47A1] text-white" : "border border-[#0D47A1] text-[#0D47A1] hover:bg-[#E3F2FD]"
                                    }`}
                                  >
                                    {isOptionSelected ? "Selected" : "Select"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Shipping Label */}
                    <div className="rounded-lg border border-[#BBDEFB] overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-[#E3F2FD] border-b border-[#BBDEFB]">
                        <span className="text-xs font-semibold text-[#0D47A1] uppercase tracking-wide">Shipping Label</span>
                        {quotation.hasApprovedPayment && (
                          <span className="flex items-center gap-1 text-xs text-[#0D47A1] bg-white border border-[#0D47A1]/30 px-2 py-0.5 rounded-full">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                            Locked
                          </span>
                        )}
                      </div>
                      <div className="px-3 py-2 bg-white">
                        {quotation.hasApprovedPayment ? (
                          <p className="text-sm font-mono text-[#0D47A1]">{labels[quotation.id] || '—'}</p>
                        ) : (
                          <input
                            type="text"
                            value={labels[quotation.id] ?? ''}
                            onChange={(e) => setLabels(prev => ({ ...prev, [quotation.id]: e.target.value }))}
                            placeholder="Enter shipping label…"
                            className="w-full text-sm text-[#0D47A1] placeholder-blue-200 bg-transparent focus:outline-none"
                          />
                        )}
                      </div>
                    </div>

                    {/* Quantity + Total */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1">
                        <button onClick={() => decrementQuantity(quotation.id)} className="w-7 h-7 rounded-lg border border-[#BBDEFB] flex items-center justify-center text-[#0D47A1] hover:bg-[#E3F2FD] font-bold text-sm">−</button>
                        <span className="w-8 text-center text-sm font-semibold text-[#0D47A1]">{quantity}</span>
                        <button onClick={() => incrementQuantity(quotation.id)} className="w-7 h-7 rounded-lg border border-[#BBDEFB] flex items-center justify-center text-[#0D47A1] hover:bg-[#E3F2FD] font-bold text-sm">+</button>
                        <span className="ml-1 text-xs text-[#0D47A1]/50 uppercase tracking-wide">Qty</span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[#0D47A1]/60 uppercase tracking-wide">Total</p>
                        <p className="text-base font-bold text-[#0D47A1]">{getQuotationPrice(quotation).formatted}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
        </div>

        {/* Order Summary */}
        <div className="w-full lg:w-1/3">
          <div className="rounded-xl border border-[#BBDEFB] overflow-hidden sticky top-6">
            {/* Header */}
            <div className="px-4 py-3 bg-[#0D47A1]">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Order Summary</h2>
              <p className="text-xs text-white/60 mt-0.5">{selectedQuotationsList.length} item{selectedQuotationsList.length !== 1 ? 's' : ''} selected</p>
            </div>

            {/* Selected Items */}
            <div className="bg-white divide-y divide-[#E3F2FD]">
              {selectedQuotationsList.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-sm text-[#0D47A1]/40">No items selected yet</p>
                </div>
              ) : (
                selectedQuotationsList.map((quotation) => (
                  <div key={quotation.id} className="px-4 py-3">
                    <div className="flex justify-between items-start mb-0.5">
                      <span className="text-xs font-semibold text-[#0D47A1] truncate pr-2">{quotation.product.name}</span>
                      <span className="text-xs font-bold text-[#0D47A1] flex-shrink-0">{getQuotationPrice(quotation).formatted}</span>
                    </div>
                    <p className="text-xs text-[#0D47A1]/50">{getSelectedOptionName(quotation)} × {quantities[quotation.id] || 1}</p>
                  </div>
                ))
              )}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#E3F2FD] border-t border-[#BBDEFB]">
              <span className="text-sm font-bold text-[#0D47A1] uppercase tracking-wide">Total</span>
              <span className="text-lg font-bold text-[#0D47A1]">{getTotalAmount()}</span>
            </div>

            {/* Payment Method */}
            <div className="bg-white border-t border-[#BBDEFB]">
              <div className="px-4 py-3 bg-[#E3F2FD] border-b border-[#BBDEFB]">
                <h3 className="text-xs font-semibold text-[#0D47A1] uppercase tracking-wide">Payment Method</h3>
              </div>
              <div className="p-3 space-y-2">
                {["BCA Bank Transfer", "Mandiri Bank Transfer", "BNI Bank Transfer", "BRI Bank Transfer"].map((bank) => (
                  <div
                    key={bank}
                    onClick={() => handleBankSelection(bank)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                      selectedBank === bank ? "border-[#0D47A1] bg-[#E3F2FD]" : "border-[#BBDEFB] hover:border-[#0D47A1]/40 hover:bg-[#E3F2FD]/40"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      selectedBank === bank ? "border-[#0D47A1]" : "border-[#BBDEFB]"
                    }`}>
                      {selectedBank === bank && <div className="w-2 h-2 rounded-full bg-[#0D47A1]" />}
                    </div>
                    <span className={`text-sm font-medium ${selectedBank === bank ? "text-[#0D47A1]" : "text-gray-600"}`}>{bank}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Complete Purchase + Back */}
            <div className="p-4 bg-white border-t border-[#BBDEFB]">
              <button
                onClick={handleCompletePayment}
                disabled={selectedQuotationsList.length === 0 || !selectedBank}
                className={`w-full py-3 rounded-lg text-sm font-bold uppercase tracking-wide transition-all ${
                  selectedQuotationsList.length > 0 && selectedBank
                    ? "bg-[#0D47A1] text-white hover:bg-[#1565C0] shadow-sm"
                    : "bg-[#E3F2FD] text-[#0D47A1]/40 cursor-not-allowed"
                }`}
              >
                Complete Purchase
              </button>
              <Link href="/quotation" className="block mt-2">
                <button className="w-full py-2.5 rounded-lg text-sm font-medium text-[#0D47A1] border border-[#BBDEFB] hover:bg-[#E3F2FD] transition-all">
                  Back to Quotations
                </button>
              </Link>
            </div>
          </div>

          {process.env.NODE_ENV === "development" && <DebugInfo data={debugState} title="Debug Info" />}
        </div>
      </div>

      {/* Payment Proof Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full relative overflow-hidden border border-[#BBDEFB]">
            <div className="px-4 py-3 bg-[#0D47A1] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wide">Upload Payment Proof</h3>
                <button onClick={closeUploadModal} disabled={isUploading} className="text-white/70 hover:text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
            </div>

            <div className="p-6">
              {uploadSuccess ? (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <h4 className="text-lg font-medium text-gray-800 mb-2">Payment Proof Uploaded!</h4>
                  <p className="text-gray-600 mb-4">
                    Thank you for your payment. You will be redirected to the payment page.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleProofUpload}>
                  <div className="mb-6">
                    <p className="text-gray-600 mb-4">
                      Please upload a screenshot or photo of your payment receipt. Accepted formats: JPG, PNG, PDF (max
                      5MB).
                    </p>

                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept="image/jpeg,image/png,application/pdf"
                      />
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full">
                        <div className="flex flex-col items-center justify-center">
                          <svg
                            className="w-10 h-10 text-gray-400 mb-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                            ></path>
                          </svg>
                          <div className="text-sm font-medium text-gray-900">Click to upload or drag and drop</div>
                          <p className="text-xs text-gray-500 mt-1">JPG, PNG, or PDF (max. 5MB)</p>
                        </div>
                      </button>
                      {fileInputRef.current?.files?.[0] && (
                        <div className="mt-2 text-sm text-green-600">
                          Selected: {fileInputRef.current.files[0].name}
                        </div>
                      )}
                    </div>

                    {uploadError && <div className="mt-2 text-sm text-red-600">{uploadError}</div>}
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={closeUploadModal}
                      disabled={isUploading}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Skip for now
                    </button>
                    <button
                      type="submit"
                      disabled={isUploading || !fileInputRef.current?.files?.[0]}
                      className={`px-4 py-2 rounded-md text-white ${
                        isUploading || !fileInputRef.current?.files?.[0]
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-blue-500 hover:bg-blue-600"
                      }`}
                    >
                      {isUploading ? (
                        <>
                          <span className="inline-block mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          Uploading...
                        </>
                      ) : (
                        "Upload Proof"
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Main component that wraps the content in Suspense
export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading checkout page...</div>}>
      <CheckoutPageContent />
    </Suspense>
  )
}
