do $$
  declare
    v_user_id uuid;
    v_group_id uuid;
  begin
    -- Get your user ID
    select id into v_user_id
    from auth.users
    where email = 'hrosenberg@gmail.com';

    if v_user_id is null then
      raise exception 'User not found — check the email address';
    end if;

    -- Create your golf group
    insert into public.groups (name, home_course)
    values ('My Golf Group', 'Crystal Springs')
    returning id into v_group_id;

    -- Add you as admin
    insert into public.group_members (group_id, user_id, player_type, is_admin)
    values (v_group_id, v_user_id, 'core', true);

    raise notice 'Done! Group ID: %', v_group_id;
  end $$;
