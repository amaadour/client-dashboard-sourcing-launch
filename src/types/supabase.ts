export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      payments: {
        Row: {
          id: string
          user_id: string
          total_amount: number
          method: string
          status: 'pending' | 'processing' | 'completed' | 'failed'
          created_at: string
          proof_url?: string
          quotation_ids?: string[]
        }
        Insert: {
          id?: string
          user_id: string
          total_amount: number
          method: string
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          created_at?: string
          proof_url?: string
          quotation_ids?: string[]
        }
        Update: {
          id?: string
          user_id?: string
          total_amount?: number
          method?: string
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          created_at?: string
          proof_url?: string
          quotation_ids?: string[]
        }
      }
      payment_quotations: {
        Row: {
          id: string
          payment_id: string
          quotation_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          payment_id: string
          quotation_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          payment_id?: string
          quotation_id?: string
          user_id?: string
          created_at?: string
        }
      }
      quotations: {
        Row: {
          id: string
          quotation_id: string
          product_name: string
          quantity: number
          status: string
          created_at: string
          product_images?: string[]
          image_url?: string
          hasImage?: boolean
        }
        Insert: {
          id?: string
          quotation_id: string
          product_name: string
          quantity: number
          status?: string
          created_at?: string
          product_images?: string[]
          image_url?: string
          hasImage?: boolean
        }
        Update: {
          id?: string
          quotation_id?: string
          product_name?: string
          quantity?: number
          status?: string
          created_at?: string
          product_images?: string[]
          image_url?: string
          hasImage?: boolean
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
} 