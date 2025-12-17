-- Create weekly_reports table for storing generated recognition reports
CREATE TABLE public.weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL CHECK (report_type IN ('weekly', 'monthly', 'blitz')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  scope TEXT NOT NULL DEFAULT 'office' CHECK (scope IN ('office', 'mgmt_group', 'team')),
  scope_id TEXT,
  generated_by uuid NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'published')),
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  data JSONB NOT NULL DEFAULT '{}',
  edits JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

-- Area Directors can manage all reports (create, update, delete)
CREATE POLICY "Authenticated users can manage reports"
ON public.weekly_reports
FOR ALL
USING (auth.uid() = generated_by)
WITH CHECK (auth.uid() = generated_by);

-- All authenticated users can read published reports
CREATE POLICY "All users can read published reports"
ON public.weekly_reports
FOR SELECT
USING (status = 'published');

-- Create index for faster queries
CREATE INDEX idx_weekly_reports_status ON public.weekly_reports(status);
CREATE INDEX idx_weekly_reports_period ON public.weekly_reports(period_start, period_end);
CREATE INDEX idx_weekly_reports_generated_by ON public.weekly_reports(generated_by);