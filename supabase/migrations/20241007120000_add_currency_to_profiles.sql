-- Add currency field to profiles table
-- This migration adds a currency field with USD as default

-- Add currency column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN currency_code text DEFAULT 'USD';

-- Add index for currency_code for better query performance
CREATE INDEX idx_profiles_currency_code ON public.profiles (currency_code);

-- Update the handle_new_user function to include currency
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone_number, currency_code)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'phone_number',
    COALESCE(new.raw_user_meta_data->>'currency_code', 'USD')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing users to have USD as default currency if they don't have one
UPDATE public.profiles 
SET currency_code = 'USD' 
WHERE currency_code IS NULL;

-- Add comment to document the currency field
COMMENT ON COLUMN public.profiles.currency_code IS 'ISO 4217 currency code for user account (e.g., USD, EUR, GBP)';
