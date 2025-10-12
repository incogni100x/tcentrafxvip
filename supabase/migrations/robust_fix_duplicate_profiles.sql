-- More robust fix for duplicate profiles
-- First, let's see what duplicates exist
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    -- Count duplicates
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT id, COUNT(*) as cnt
        FROM public.profiles
        GROUP BY id
        HAVING COUNT(*) > 1
    ) duplicates;
    
    RAISE NOTICE 'Found % duplicate profile records', duplicate_count;
    
    -- If duplicates exist, clean them up
    IF duplicate_count > 0 THEN
        -- Delete duplicates, keeping the most recent one
        WITH ranked_profiles AS (
            SELECT 
                id,
                ROW_NUMBER() OVER (PARTITION BY id ORDER BY created_at DESC, updated_at DESC) as rn
            FROM public.profiles
        ),
        duplicates_to_delete AS (
            SELECT id
            FROM ranked_profiles
            WHERE rn > 1
        )
        DELETE FROM public.profiles
        WHERE id IN (SELECT id FROM duplicates_to_delete);
        
        RAISE NOTICE 'Cleaned up duplicate profiles';
    END IF;
END $$;

-- Ensure unique constraint exists
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_id_unique' 
        AND table_name = 'profiles'
    ) THEN
        ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_unique;
    END IF;
    
    -- Add unique constraint
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_unique UNIQUE (id);
    
    RAISE NOTICE 'Added unique constraint on profiles.id';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error adding constraint: %', SQLERRM;
END $$;
