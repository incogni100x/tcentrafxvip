-- Updated profiles table schema with currency support
-- This is the complete schema including the new currency field

-- Create ENUM type for kyc_status
CREATE TYPE kyc_status_type AS ENUM ('pending', 'verified', 'rejected');

-- Create profiles table with currency support
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, -- same as auth.users
  email text,
  full_name text,
  phone_number text,
  country text,
  currency_code text DEFAULT 'USD', -- ISO 4217 currency code (e.g., USD, EUR, GBP)
  
  cash_balance numeric DEFAULT 0,
  
  referral_code text UNIQUE,       -- assigned by backend only
  referred_by_user_id uuid REFERENCES auth.users(id), -- who referred this user
  
  document_url_1 text,  -- URL for first verification document
  document_url_2 text,  -- URL for second verification document
  
  kyc_status kyc_status_type DEFAULT 'pending',
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Indexes
CREATE INDEX idx_profiles_email ON public.profiles (email);
CREATE INDEX idx_profiles_phone_number ON public.profiles (phone_number);
CREATE INDEX idx_profiles_referral_code ON public.profiles (referral_code);
CREATE INDEX idx_profiles_referred_by_user_id ON public.profiles (referred_by_user_id);
CREATE INDEX idx_profiles_kyc_status ON public.profiles (kyc_status);
CREATE INDEX idx_profiles_currency_code ON public.profiles (currency_code);

-- Add comment to document the currency field
COMMENT ON COLUMN public.profiles.currency_code IS 'ISO 4217 currency code for user account (e.g., USD, EUR, GBP)';
