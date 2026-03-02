-- Add delivery partner location columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS delivery_lng DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS delivery_updated_at TIMESTAMP WITH TIME ZONE;