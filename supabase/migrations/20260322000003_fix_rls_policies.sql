-- Fix circular RLS policy on group_members.
-- The old policy checked group membership by querying group_members itself,
-- which meant no one could ever read their own record.

drop policy if exists "Members can view their group members" on group_members;

-- Users can always see their own membership row
create policy "Users can view own membership"
  on group_members for select using (user_id = auth.uid());

-- Users can also see other members in the same group (once they can see themselves)
create policy "Users can view group peers"
  on group_members for select using (
    group_id in (
      select group_id from group_members
      where user_id = auth.uid()
    )
  );
