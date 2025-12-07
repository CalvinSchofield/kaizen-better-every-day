-- Add DELETE policy for recruit_activities so users can delete their own activities
CREATE POLICY "Users can delete own activities"
ON public.recruit_activities
FOR DELETE
USING (auth.uid() = logged_by_user_id);