
-- Org change requests table
CREATE TABLE public.org_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL,
  request_type text NOT NULL, -- 'create_team', 'create_mgmt_group', 'create_sr_mgmt_group', 'create_region', 'create_sr_region', 'create_partner', 'create_division'
  request_data jsonb NOT NULL DEFAULT '{}'::jsonb, -- name, leadUserId, mgmtGroupId, etc.
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Org change approvals (one per required approver)
CREATE TABLE public.org_change_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.org_change_requests(id) ON DELETE CASCADE,
  approver_user_id uuid NOT NULL,
  approver_role text NOT NULL, -- the role level of the approver
  approved boolean, -- null = pending, true = approved, false = rejected
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(request_id, approver_user_id)
);

-- RLS
ALTER TABLE public.org_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_change_approvals ENABLE ROW LEVEL SECURITY;

-- Requesters can see their own requests
CREATE POLICY "Users can view own requests" ON public.org_change_requests
  FOR SELECT TO authenticated
  USING (requested_by = auth.uid());

-- Approvers can see requests they need to approve
CREATE POLICY "Approvers can view assigned requests" ON public.org_change_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_change_approvals
      WHERE request_id = org_change_requests.id
      AND approver_user_id = auth.uid()
    )
  );

-- Users can insert their own requests
CREATE POLICY "Users can insert own requests" ON public.org_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

-- Approvals: approvers can view their own
CREATE POLICY "Approvers can view own approvals" ON public.org_change_approvals
  FOR SELECT TO authenticated
  USING (approver_user_id = auth.uid());

-- Requesters can view approvals on their requests
CREATE POLICY "Requesters can view request approvals" ON public.org_change_approvals
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_change_requests
      WHERE id = org_change_approvals.request_id
      AND requested_by = auth.uid()
    )
  );

-- Service role can manage all (for edge functions)
CREATE POLICY "Service role full access requests" ON public.org_change_requests
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access approvals" ON public.org_change_approvals
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Approvers can update their own approval
CREATE POLICY "Approvers can update own approval" ON public.org_change_approvals
  FOR UPDATE TO authenticated
  USING (approver_user_id = auth.uid());
