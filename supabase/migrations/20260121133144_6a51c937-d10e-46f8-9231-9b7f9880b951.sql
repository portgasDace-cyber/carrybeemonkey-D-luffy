-- Add operating hours to stores
ALTER TABLE public.stores 
ADD COLUMN opening_time time DEFAULT '07:00'::time,
ADD COLUMN closing_time time DEFAULT '22:00'::time;

-- Add offer fields to products
ALTER TABLE public.products 
ADD COLUMN offer_percentage integer DEFAULT NULL,
ADD COLUMN offer_price numeric DEFAULT NULL,
ADD COLUMN offer_active boolean DEFAULT false;