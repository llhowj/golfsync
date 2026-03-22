-- Seed file for local development
-- Creates a default group and a placeholder admin invite.
-- When hrosenberg@gmail.com signs up, the handle_new_user trigger
-- automatically links them to this group as admin.

do $$
declare
  v_group_id uuid;
begin
  insert into public.groups (name, home_course)
  values ('My Golf Group', 'Home Course')
  returning id into v_group_id;

  -- Placeholder admin slot — linked to hrosenberg@gmail.com on signup
  insert into public.group_members (group_id, user_id, invited_email, invited_name, player_type, is_admin)
  values (v_group_id, null, 'hrosenberg@gmail.com', 'Howard', 'core', true);
end $$;
