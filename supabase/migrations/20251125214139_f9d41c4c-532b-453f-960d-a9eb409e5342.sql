-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Create reps table with Notion-synced properties
CREATE TABLE public.reps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  notion_page_id TEXT UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  recruiter TEXT,
  team_leader TEXT,
  stage TEXT,
  
  -- Journey progress tracking
  onboarding_complete BOOLEAN DEFAULT FALSE,
  trainings_complete BOOLEAN DEFAULT FALSE,
  slack_joined BOOLEAN DEFAULT FALSE,
  
  -- Ramp to Blitz phases
  ramp_phase_1_complete BOOLEAN DEFAULT FALSE,
  ramp_phase_2_complete BOOLEAN DEFAULT FALSE,
  ramp_phase_3_complete BOOLEAN DEFAULT FALSE,
  ramp_phase_4_complete BOOLEAN DEFAULT FALSE,
  
  -- Post-blitz
  blitz_ready BOOLEAN DEFAULT FALSE,
  path_to_pro_started BOOLEAN DEFAULT FALSE,
  path_to_pro_progress INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on reps
ALTER TABLE public.reps ENABLE ROW LEVEL SECURITY;

-- Reps policies
CREATE POLICY "Users can view own rep data"
  ON public.reps
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own rep data"
  ON public.reps
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reps_updated_at
  BEFORE UPDATE ON public.reps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();