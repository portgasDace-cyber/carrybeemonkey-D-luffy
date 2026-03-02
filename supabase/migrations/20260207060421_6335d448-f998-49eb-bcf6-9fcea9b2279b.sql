-- Allow store admins to insert products for their assigned store
CREATE POLICY "Store admins can insert products for their store"
ON public.products
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM store_admins
    WHERE store_admins.user_id = auth.uid()
    AND store_admins.store_id = products.store_id
  )
);
