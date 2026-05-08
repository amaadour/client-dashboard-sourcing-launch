import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Check if environment variables are properly configured
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase environment variables.");
}

// Server-side Supabase client with service_role for admin access
const supabaseAdmin = createClient(
  supabaseUrl || '',
  supabaseServiceKey || '', // This is a server-side key with full access
  {
    auth: { persistSession: false }
  }
);

// Define types for API request data
interface QuotationData {
  quotation_id: string;
  product_name: string;
  alibaba_url: string;
  quantity: number;
  destination_country: string;
  destination_city: string;
  shipping_method: string;
  service_type: string;
  status: string;
  user_id?: string;
  image_urls?: string[];
  product_images?: string[];
}

interface ImageUpdateRequest {
  id: string;
  imageUrls: string[];
}

// Handle POST requests to /api/quotations
export async function POST(request: Request) {
  try {
    // Check if Supabase credentials are valid
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Supabase credentials not properly configured");
      return NextResponse.json({ error: "Server configuration error. Please contact support." }, { status: 500 });
    }

    // Parse the request body - now this is directly the quotation data
    const quotationData: QuotationData = await request.json();
    console.log("Received quotation data:", JSON.stringify(quotationData, null, 2));
    
    // Generate a unique quotation_id if not provided
    if (!quotationData.quotation_id) {
      quotationData.quotation_id = `QT-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    }
    
    // Set status to Pending if not provided
    if (!quotationData.status) {
      quotationData.status = 'Pending';
    }
    
    // Validate required fields
    const requiredFields = ['product_name', 'alibaba_url', 'quantity', 'destination_country', 'destination_city', 'shipping_method', 'service_type'];
    
    for (const field of requiredFields) {
      if (quotationData[field as keyof QuotationData] === undefined || 
          quotationData[field as keyof QuotationData] === null || 
          quotationData[field as keyof QuotationData] === '') {
        console.error(`Missing required field: ${field}, value:`, quotationData[field as keyof QuotationData]);
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }
    
    // Insert the quotation using the admin client
    const { data, error } = await supabaseAdmin
      .from('quotations')
      .insert([quotationData])
      .select();
    
    if (error) {
      console.error('Error inserting quotation:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      // Special handling for auth errors
      if (error.code === 'PGRST301' || error.message?.includes('Invalid API key')) {
        console.error('API Key Error. Check SUPABASE_SERVICE_ROLE_KEY in .env');
        return NextResponse.json({ 
          error: "Authentication error. Please check your Supabase service role key." 
        }, { status: 401 });
      }
      
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, data }, { status: 201 });
    
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}

// Handle PATCH requests to update quotations with image URLs
export async function PATCH(request: Request) {
  try {
    const { id, imageUrls }: ImageUpdateRequest = await request.json();
    
    if (!id || !imageUrls || !Array.isArray(imageUrls)) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }
    
    const { data, error } = await supabaseAdmin
      .from('quotations')
      .update({ 
        image_urls: imageUrls,
        product_images: imageUrls // For backwards compatibility
      })
      .eq('id', id)
      .select();
    
    if (error) {
      console.error('Error updating quotation with image URLs:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, data }, { status: 200 });
    
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
} 