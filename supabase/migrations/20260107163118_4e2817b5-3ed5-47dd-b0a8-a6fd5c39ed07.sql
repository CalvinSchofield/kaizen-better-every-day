-- Create table to store proposed challenge edits
CREATE TABLE public.challenge_edit_proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  proposed_by UUID NOT NULL,
  proposed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  proposed_changes JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create table to track approvals for each edit proposal
CREATE TABLE public.challenge_edit_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.challenge_edit_proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  approved BOOLEAN,
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(proposal_id, user_id)
);

-- Enable RLS on both tables
ALTER TABLE public.challenge_edit_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_edit_approvals ENABLE ROW LEVEL SECURITY;

-- RLS policies for challenge_edit_proposals
CREATE POLICY "Users can view proposals for challenges they participate in"
ON public.challenge_edit_proposals
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.challenge_participants
    WHERE challenge_participants.challenge_id = challenge_edit_proposals.challenge_id
    AND challenge_participants.user_id = auth.uid()
  )
);

CREATE POLICY "Challenge participants can create proposals"
ON public.challenge_edit_proposals
FOR INSERT
WITH CHECK (
  proposed_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.challenge_participants
    WHERE challenge_participants.challenge_id = challenge_edit_proposals.challenge_id
    AND challenge_participants.user_id = auth.uid()
  )
);

CREATE POLICY "Proposer can update their own pending proposals"
ON public.challenge_edit_proposals
FOR UPDATE
USING (proposed_by = auth.uid() AND status = 'pending');

-- RLS policies for challenge_edit_approvals
CREATE POLICY "Users can view approvals for proposals they can see"
ON public.challenge_edit_approvals
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.challenge_edit_proposals cep
    JOIN public.challenge_participants cp ON cp.challenge_id = cep.challenge_id
    WHERE cep.id = challenge_edit_approvals.proposal_id
    AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own approval"
ON public.challenge_edit_approvals
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own approval"
ON public.challenge_edit_approvals
FOR UPDATE
USING (user_id = auth.uid());

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenge_edit_proposals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenge_edit_approvals;