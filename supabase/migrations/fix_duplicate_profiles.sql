-- Fix duplicate profiles issue
-- Keep the most recent profile for each user and delete duplicates

WITH ranked_profiles AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY id ORDER BY created_at DESC) as rn
  FROM public.profiles
),
duplicates_to_delete AS (
  SELECT id
  FROM ranked_profiles
  WHERE rn > 1
)
DELETE FROM public.profiles
WHERE id IN (SELECT id FROM duplicates_to_delete);

-- Add a unique constraint to prevent future duplicates
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_id_unique UNIQUE (id);

-- Add a comment explaining the constraint
COMMENT ON CONSTRAINT profiles_id_unique ON public.profiles IS 'Ensures each user can only have one profile record';
