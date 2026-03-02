-- Create table for daily offers/deals
CREATE TABLE public.daily_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  discount_percentage integer,
  image_url text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_offers ENABLE ROW LEVEL SECURITY;

-- Anyone can view active offers
CREATE POLICY "Anyone can view active offers"
ON public.daily_offers
FOR SELECT
USING (is_active = true);

-- Admins can manage offers
CREATE POLICY "Admins can insert offers"
ON public.daily_offers
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update offers"
ON public.daily_offers
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete offers"
ON public.daily_offers
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all offers"
ON public.daily_offers
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create table for product requests
CREATE TABLE public.product_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  store_id uuid REFERENCES public.stores(id),
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  product_description text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can create product requests
CREATE POLICY "Anyone can create product requests"
ON public.product_requests
FOR INSERT
WITH CHECK (true);

-- Admins can view all requests
CREATE POLICY "Admins can view all requests"
ON public.product_requests
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));