-- Allow admins to insert new members into their group
create policy "Admins can insert group members"
  on group_members for insert with check (
    group_id in (
      select group_id from group_members
      where user_id = auth.uid() and is_admin = true
    )
  );

-- Allow admins to update group members (e.g. backup_rank reorder)
create policy "Admins can update group members"
  on group_members for update using (
    group_id in (
      select group_id from group_members
      where user_id = auth.uid() and is_admin = true
    )
  );

-- Allow users to read profiles of people in their group
create policy "Users can view profiles in their group"
  on profiles for select using (
    id in (
      select user_id from group_members
      where group_id in (
        select group_id from group_members where user_id = auth.uid()
      )
      and user_id is not null
    )
  );
