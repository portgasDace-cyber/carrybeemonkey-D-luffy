-- Add latitude and longitude to stores for distance-based delivery fee calculation
ALTER TABLE public.stores 
ADD COLUMN latitude numeric,
ADD COLUMN longitude numeric;

-- Update existing stores with approximate Kunnathur coordinates (can be updated later)
UPDATE public.stores 
SET latitude = 9.2876, longitude = 77.5234 
WHERE latitude IS NULL;