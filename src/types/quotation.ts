export interface PriceOption {
  id: string;
  price: string;
  supplier: string;
  deliveryTime?: string;
  description?: string;
  modelName?: string;
  modelImage?: string;
  unitWeightGrams?: string | number;
  [key: string]: unknown; // Allow dynamic image fields like image_option1_2
}

export interface QuotationProduct {
  name: string;
  image: string;
  category?: string;
  description?: string;
  unitGrossWeight?: string;
}

export interface QuotationData {
  // The actual UUID from the database
  id: string;
  // The display ID (e.g., QT-1234567890)
  quotation_id: string;
  product: QuotationProduct;
  quantity: string;
  date: string;
  status: string;
  price?: string;
  shippingMethod?: string;
  destination?: string;
  priceOptions?: PriceOption[];
  hasImage?: boolean;
  selected_option?: number;
} 