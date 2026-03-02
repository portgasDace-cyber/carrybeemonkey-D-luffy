-- Add RLS policy for store admins to update their store's products
CREATE POLICY "Store admins can update their store products"
ON public.products
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM store_admins
    WHERE store_admins.user_id = auth.uid()
      AND store_admins.store_id = products.store_id
  )
);

-- Add RLS policy for store admins to view their store's products
CREATE POLICY "Store admins can view their store products"
ON public.products
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM store_admins
    WHERE store_admins.user_id = auth.uid()
      AND store_admins.store_id = products.store_id
  )
);