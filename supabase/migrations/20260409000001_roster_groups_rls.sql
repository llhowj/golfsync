-- Enable RLS on roster_groups and roster_group_members
-- These tables were created without RLS, flagged as a security vulnerability by Supabase.

alter table roster_groups       enable row level security;
alter table roster_group_members enable row level security;

-- roster_groups: any member of the group can view; only admins can write

create policy "roster_groups_select"
  on roster_groups for select
  using (
    exists (
      select 1 from group_members
      where group_members.group_id = roster_groups.group_id
        and group_members.user_id = auth.uid()
    )
  );

create policy "roster_groups_insert"
  on roster_groups for insert
  with check (
    exists (
      select 1 from group_members
      where group_members.group_id = roster_groups.group_id
        and group_members.user_id = auth.uid()
        and group_members.is_admin = true
    )
  );

create policy "roster_groups_update"
  on roster_groups for update
  using (
    exists (
      select 1 from group_members
      where group_members.group_id = roster_groups.group_id
        and group_members.user_id = auth.uid()
        and group_members.is_admin = true
    )
  );

create policy "roster_groups_delete"
  on roster_groups for delete
  using (
    exists (
      select 1 from group_members
      where group_members.group_id = roster_groups.group_id
        and group_members.user_id = auth.uid()
        and group_members.is_admin = true
    )
  );

-- roster_group_members: any member of the parent group can view; only admins can write

create policy "roster_group_members_select"
  on roster_group_members for select
  using (
    exists (
      select 1 from roster_groups rg
      join group_members gm on gm.group_id = rg.group_id
      where rg.id = roster_group_members.roster_group_id
        and gm.user_id = auth.uid()
    )
  );

create policy "roster_group_members_insert"
  on roster_group_members for insert
  with check (
    exists (
      select 1 from roster_groups rg
      join group_members gm on gm.group_id = rg.group_id
      where rg.id = roster_group_members.roster_group_id
        and gm.user_id = auth.uid()
        and gm.is_admin = true
    )
  );

create policy "roster_group_members_delete"
  on roster_group_members for delete
  using (
    exists (
      select 1 from roster_groups rg
      join group_members gm on gm.group_id = rg.group_id
      where rg.id = roster_group_members.roster_group_id
        and gm.user_id = auth.uid()
        and gm.is_admin = true
    )
  );
