
-- Allow admins to delete orders
CREATE POLICY "Admins can delete orders"
ON public.orders FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete order items
CREATE POLICY "Admins can delete order items"
ON public.order_items FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
