export interface PriceOption {
  id: string;
  price: string;
  supplier: string;
  deliveryTime?: string;
  description?: string;
  modelName?: string;
  modelImage?: string;
  unitWeightGrams?: string | number;
  [key: string]: unknown; // Allow dynamic image fields like image_option1_2, extra_images_option1, etc.
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
  // Receiver information
  receiver_name?: string;
  receiver_phone?: string;
  receiver_address?: string;
  rejection_reason?: string | null;
  client_label?: string | null;
  product_url?: string;
  service_type?: string;
  image_url?: string;
  shipping_country?: string;
  shipping_city?: string;
  shipping_method_raw?: string;
  // Dual pricing + customization
  is_customizable?: boolean;
  customization_price?: number | null;
  selected_version?: 'stock' | 'customized' | null;
  Quotation_fees?: number | null;
}

export interface CustomizationFile {
  id: string;
  quotation_id: string;
  user_id: string;
  file_url: string;
  file_name: string;
  file_type?: string | null;
  file_size?: number | null;
  created_at: string;
}