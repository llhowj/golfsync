-- When a new user signs up, link them to any pending group invites by email
create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  -- Create the profile
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  );

  -- Link any pending group invites that match this email
  update public.group_members
  set
    user_id = new.id,
    invited_email = null
  where
    invited_email = new.email
    and user_id is null;

  return new;
end;
$$;
