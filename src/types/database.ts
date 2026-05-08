export interface Database {
  public: {
    Tables: {
      payments: {
        Row: {
          id: string;
          created_at: string;
          amount: number;
          bank_name: string;
          user_id: string;
          status: 'pending' | 'processing' | 'completed' | 'failed';
          proof_url?: string;
        };
        Insert: PaymentInsert;
      };
      payment_quotations: {
        Row: {
          payment_id: string;
          quotation_id: string;
        };
        Insert: PaymentQuotationInsert;
      };
    };
  };
}

export type PaymentInsert = {
  amount: number;
  bank_name: string;
  user_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  proof_url?: string;
};

export type PaymentQuotationInsert = {
  payment_id: string;
  quotation_id: string;
};

export interface User {
  id: string;
  email: string;
  name?: string;
}

export interface PaymentInfo {
  id: string;
  user_id: string;
  total_amount: number;
  bank_name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  proof_url?: string;
  quotations?: string[];
  date?: string;
  paymentMethod?: string;
}

export interface QuotationData {
  id: string;
  uuid?: string;
  quotation_id?: string;
  product_name: string;
  quantity: number;
  status: string;
  created_at: string;
  total_amount: number;
  image_url?: string;
  hasImage?: boolean;
  product: {
    name: string;
    image: string;
    category: string;
    description?: string;
  };
  priceOptions?: Array<{
    id: string;
    price: string;
    numericPrice: number;
    supplier: string;
    deliveryTime: string;
    description?: string;
    modelName?: string;
    modelImage?: string;
  }>;
  selectedOption?: string;
} 