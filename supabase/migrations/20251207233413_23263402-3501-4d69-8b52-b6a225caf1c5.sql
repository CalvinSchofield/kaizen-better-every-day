-- Allow users to delete their own pending suggestions
CREATE POLICY "Users can delete own pending suggestions"
ON public.recruit_suggestions
FOR DELETE
USING (auth.uid() = suggested_by_user_id AND status = 'pending');

-- Allow users to update their own pending suggestions
CREATE POLICY "Users can update own pending suggestions"
ON public.recruit_suggestions
FOR UPDATE
USING (auth.uid() = suggested_by_user_id AND status = 'pending')
WITH CHECK (auth.uid() = suggested_by_user_id AND status = 'pending');