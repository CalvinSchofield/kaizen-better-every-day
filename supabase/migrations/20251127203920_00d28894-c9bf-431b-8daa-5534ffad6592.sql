-- Create competitors table for offline-first competitor cheat sheet
CREATE TABLE IF NOT EXISTS public.competitors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notion_page_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT, -- "Alarm service (monthly)", "Cameras", or "Panels & Equipment"
  main_image_url TEXT,
  alternate_versions JSONB DEFAULT '[]'::jsonb, -- [{ name: "...", image_url: "...", notion_page_id: "..." }]
  monitoring_companies TEXT[] DEFAULT '{}', -- Array of company names
  our_selling_points TEXT[] DEFAULT '{}', -- Array of selling point bullets
  their_selling_points TEXT[] DEFAULT '{}', -- Why customers buy it
  objections JSONB DEFAULT '[]'::jsonb, -- [{ objection: "...", handle: "..." }]
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all competitors
CREATE POLICY "Authenticated users can view competitors"
  ON public.competitors
  FOR SELECT
  TO authenticated
  USING (true);

-- Create index on notion_page_id for fast lookups during sync
CREATE INDEX idx_competitors_notion_page_id ON public.competitors(notion_page_id);

-- Create index on category for filtering
CREATE INDEX idx_competitors_category ON public.competitors(category);

-- Add trigger for updated_at
CREATE TRIGGER update_competitors_updated_at
  BEFORE UPDATE ON public.competitors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();