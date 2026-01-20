-- Fix argument order for can_access_recruit() in recruit_activities RLS policies
-- Function signature: can_access_recruit(_user_id uuid, _recruit_id uuid)

DROP POLICY IF EXISTS "Users can delete own or managed activities" ON public.recruit_activities;
CREATE POLICY "Users can delete own or managed activities"
ON public.recruit_activities
FOR DELETE
USING (
  auth.uid() = logged_by_user_id
  OR auth.uid() = assigned_to_user_id
  OR public.can_access_recruit(auth.uid(), recruit_id)
);

DROP POLICY IF EXISTS "Users can update own or managed activities" ON public.recruit_activities;
CREATE POLICY "Users can update own or managed activities"
ON public.recruit_activities
FOR UPDATE
USING (
  auth.uid() = logged_by_user_id
  OR auth.uid() = assigned_to_user_id
  OR public.can_access_recruit(auth.uid(), recruit_id)
);
