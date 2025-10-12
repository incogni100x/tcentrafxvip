-- Test function to check user profile
CREATE OR REPLACE FUNCTION public.test_user_profile()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  user_profile RECORD;
  auth_user RECORD;
BEGIN
  -- Check if user is authenticated
  IF current_user_id IS NULL THEN
    RETURN json_build_object(
      'authenticated', false,
      'message', 'User not authenticated'
    );
  END IF;

  -- Check auth.users table
  SELECT id, email, created_at INTO auth_user FROM auth.users WHERE id = current_user_id;
  
  -- Check profiles table
  SELECT * INTO user_profile FROM public.profiles WHERE id = current_user_id;
  
  RETURN json_build_object(
    'authenticated', true,
    'user_id', current_user_id,
    'auth_user', CASE WHEN auth_user.id IS NOT NULL THEN row_to_json(auth_user) ELSE NULL END,
    'profile', CASE WHEN user_profile.id IS NOT NULL THEN row_to_json(user_profile) ELSE NULL END,
    'profile_exists', user_profile.id IS NOT NULL
  );
END;
$$;
