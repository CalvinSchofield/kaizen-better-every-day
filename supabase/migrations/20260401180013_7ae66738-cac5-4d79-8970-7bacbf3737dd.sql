create policy "Users can view own recruit record"
on public.recruits
for select
to authenticated
using (
  exists (
    select 1
    from public.reps
    where reps.id = recruits.id
      and reps.user_id = auth.uid()
  )
);