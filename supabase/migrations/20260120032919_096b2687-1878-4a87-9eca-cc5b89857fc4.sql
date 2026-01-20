-- Allow leaders (recruiters in upline chain) to delete activities for recruits they can access
DROP POLICY IF EXISTS "Users can delete own activities" ON public.recruit_activities;

CREATE POLICY "Users can delete own or managed activities"
ON public.recruit_activities
FOR DELETE
USING (
  auth.uid() = logged_by_user_id
  OR auth.uid() = assigned_to_user_id
  OR public.can_access_recruit(recruit_id, auth.uid())
);

-- Allow leaders to update activities for recruits they can access (mark complete, reschedule)
DROP POLICY IF EXISTS "Users can update own activities" ON public.recruit_activities;

CREATE POLICY "Users can update own or managed activities"
ON public.recruit_activities
FOR UPDATE
USING (
  auth.uid() = logged_by_user_id
  OR auth.uid() = assigned_to_user_id
  OR public.can_access_recruit(recruit_id, auth.uid())
);