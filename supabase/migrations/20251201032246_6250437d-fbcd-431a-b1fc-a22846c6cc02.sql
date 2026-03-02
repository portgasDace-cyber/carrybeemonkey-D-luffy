-- Create stores table
CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  image_url text,
  address text,
  phone text,
  rating numeric DEFAULT 0,
  delivery_time text DEFAULT '30-40 mins',
  is_open boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  price numeric NOT NULL,
  image_url text,
  category text,
  in_stock boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create orders table
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  total_amount numeric NOT NULL,
  status text DEFAULT 'pending',
  delivery_address text NOT NULL,
  phone text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create order_items table
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity integer NOT NULL,
  price numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stores (public read)
CREATE POLICY "Anyone can view stores"
  ON public.stores FOR SELECT
  USING (true);

-- RLS Policies for products (public read)
CREATE POLICY "Anyone can view products"
  ON public.products FOR SELECT
  USING (true);

-- RLS Policies for orders (users can view their own orders)
CREATE POLICY "Users can view their own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for order_items (users can view items from their orders)
CREATE POLICY "Users can view their own order items"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create order items for their orders"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- Insert sample stores
INSERT INTO public.stores (name, category, image_url, address, phone, rating) VALUES
  ('Fresh Mart Grocery', 'grocery', 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=400', 'Main Street, Kunnathur', '+91 9876543210', 4.5),
  ('Green Pharmacy', 'medical', 'https://images.unsplash.com/photo-1576602976047-174e57a47881?w=400', 'Hospital Road, Kunnathur', '+91 9876543211', 4.7),
  ('Veggie Paradise', 'vegetables', 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=400', 'Market Street, Kunnathur', '+91 9876543212', 4.3),
  ('Spice Kitchen', 'restaurant', 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400', 'Food Court, Kunnathur', '+91 9876543213', 4.8),
  ('Sweet Treats Bakery', 'bakery', 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400', 'Baker Lane, Kunnathur', '+91 9876543214', 4.6);

-- Insert sample products for Fresh Mart Grocery
INSERT INTO public.products (store_id, name, description, price, image_url, category) 
SELECT id, 'Fresh Milk 1L', 'Full cream fresh milk', 65, 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300', 'dairy'
FROM public.stores WHERE name = 'Fresh Mart Grocery';

INSERT INTO public.products (store_id, name, description, price, image_url, category) 
SELECT id, 'Brown Bread', 'Whole wheat bread loaf', 40, 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300', 'bakery'
FROM public.stores WHERE name = 'Fresh Mart Grocery';

INSERT INTO public.products (store_id, name, description, price, image_url, category) 
SELECT id, 'Basmati Rice 1kg', 'Premium quality basmati rice', 120, 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300', 'grains'
FROM public.stores WHERE name = 'Fresh Mart Grocery';

-- Insert sample products for Green Pharmacy
INSERT INTO public.products (store_id, name, description, price, image_url, category) 
SELECT id, 'Paracetamol 500mg', 'Pain relief tablets', 20, 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300', 'medicine'
FROM public.stores WHERE name = 'Green Pharmacy';

INSERT INTO public.products (store_id, name, description, price, image_url, category) 
SELECT id, 'Hand Sanitizer 250ml', 'Antibacterial hand sanitizer', 85, 'https://images.unsplash.com/photo-1584483766114-2cea6facdf57?w=300', 'hygiene'
FROM public.stores WHERE name = 'Green Pharmacy';