-- Add approval workflow columns to recruits table
ALTER TABLE public.recruits 
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS approved_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Add index for fast pending approval lookups
CREATE INDEX IF NOT EXISTS idx_recruits_approval_status ON public.recruits(approval_status) WHERE approval_status = 'pending';

-- Comment for clarity
COMMENT ON COLUMN public.recruits.approval_status IS 'pending, approved, or rejected. Default approved for manually created recruits.';