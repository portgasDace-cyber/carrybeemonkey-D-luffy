-- Create push subscriptions table for web push notifications
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (guests can subscribe)
CREATE POLICY "Anyone can subscribe to push notifications"
ON public.push_subscriptions
FOR INSERT
WITH CHECK (true);

-- Allow anyone to delete their own subscription by endpoint
CREATE POLICY "Anyone can delete subscriptions by endpoint"
ON public.push_subscriptions
FOR DELETE
USING (true);

-- Allow reading own subscriptions
CREATE POLICY "Users can view their own subscriptions"
ON public.push_subscriptions
FOR SELECT
USING (auth.uid() = user_id OR user_id IS NULL);

-- Allow update for linking subscription to user
CREATE POLICY "Anyone can update subscriptions"
ON public.push_subscriptions
FOR UPDATE
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX idx_push_subscriptions_endpoint ON public.push_subscriptions(endpoint);

-- Enable realtime for push_subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE public.push_subscriptions;