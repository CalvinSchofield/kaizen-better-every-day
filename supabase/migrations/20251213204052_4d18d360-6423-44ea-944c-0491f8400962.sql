-- Make user_id nullable to support ghost reps (reps from Notion without app accounts)
ALTER TABLE public.reps ALTER COLUMN user_id DROP NOT NULL;

-- Add unique constraint on notion_page_id for upsert operations
ALTER TABLE public.reps ADD CONSTRAINT reps_notion_page_id_unique UNIQUE (notion_page_id);

-- Create function to link ghost reps when user signs up
CREATE OR REPLACE FUNCTION public.link_ghost_rep_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Update any ghost rep record that matches this email
  UPDATE public.reps 
  SET user_id = NEW.id,
      updated_at = NOW()
  WHERE user_id IS NULL 
    AND LOWER(email) = LOWER(NEW.email);
  
  RETURN NEW;
END;
$$;

-- Create trigger to run on new user signup
DROP TRIGGER IF EXISTS on_auth_user_created_link_ghost_rep ON auth.users;
CREATE TRIGGER on_auth_user_created_link_ghost_rep
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_ghost_rep_on_signup();

-- Update RLS policies to allow viewing ghost reps
DROP POLICY IF EXISTS "Authenticated users can view all reps for leaderboards" ON public.reps;
CREATE POLICY "Authenticated users can view all reps for leaderboards" 
  ON public.reps 
  FOR SELECT 
  USING (true);