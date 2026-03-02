-- Add store_admin to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'store_admin';

-- Create store_admins table to link users to stores they manage
CREATE TABLE public.store_admins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (user_id, store_id)
);

-- Enable RLS
ALTER TABLE public.store_admins ENABLE ROW LEVEL SECURITY;

-- Create function to check if user is store admin
CREATE OR REPLACE FUNCTION public.is_store_admin(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.store_admins
    WHERE user_id = _user_id
      AND store_id = _store_id
  )
$$;

-- RLS policies for store_admins table
CREATE POLICY "Admins can manage store admins"
ON public.store_admins
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Store admins can view their own assignments"
ON public.store_admins
FOR SELECT
USING (auth.uid() = user_id);

-- Add policy for store admins to view orders for their store
CREATE POLICY "Store admins can view their store orders"
ON public.orders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.store_admins
    WHERE store_admins.user_id = auth.uid()
      AND store_admins.store_id = orders.store_id
  )
);

-- Add policy for store admins to update orders for their store
CREATE POLICY "Store admins can update their store orders"
ON public.orders
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.store_admins
    WHERE store_admins.user_id = auth.uid()
      AND store_admins.store_id = orders.store_id
  )
);

-- Store admins can view order items for their store's orders
CREATE POLICY "Store admins can view their store order items"
ON public.order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders
    JOIN public.store_admins ON store_admins.store_id = orders.store_id
    WHERE orders.id = order_items.order_id
      AND store_admins.user_id = auth.uid()
  )
);