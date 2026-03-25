-- ============================================================
-- GolfSync Dev Seed
-- Creates 4 test accounts + a group + tee times
--
-- Accounts (all passwords: password123):
--   admin@test.com  — Howard Admin (group admin)
--   tom@test.com    — Tom Wilson   (core player)
--   mike@test.com   — Mike Davis   (core player)
--   sarah@test.com  — Sarah Chen   (core, invited but not yet registered)
-- ============================================================

create extension if not exists pgcrypto;

do $$
declare
  admin_id   uuid := '00000000-0000-0000-0000-000000000001';
  tom_id     uuid := '00000000-0000-0000-0000-000000000002';
  mike_id    uuid := '00000000-0000-0000-0000-000000000003';

  group_id       uuid;
  admin_mem      uuid;
  tom_mem        uuid;
  mike_mem       uuid;
  sarah_mem      uuid;
  default_rg_id  uuid;

  tt1_id uuid; tt2_id uuid; tt3_id uuid; tt4_id uuid;
begin

  -- ── Auth users ───────────────────────────────────────────────

  insert into auth.users (
    id, instance_id, aud, role,
    email, encrypted_password,
    email_confirmed_at, confirmation_sent_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    created_at, updated_at,
    raw_user_meta_data, raw_app_meta_data,
    is_super_admin
  ) values
  (
    admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'admin@test.com', crypt('password123', gen_salt('bf')),
    now(), now(), '', '', '', '',
    now(), now(),
    '{"full_name": "Howard Admin"}', '{"provider":"email","providers":["email"]}', false
  ),
  (
    tom_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'tom@test.com', crypt('password123', gen_salt('bf')),
    now(), now(), '', '', '', '',
    now(), now(),
    '{"full_name": "Tom Wilson"}', '{"provider":"email","providers":["email"]}', false
  ),
  (
    mike_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'mike@test.com', crypt('password123', gen_salt('bf')),
    now(), now(), '', '', '', '',
    now(), now(),
    '{"full_name": "Mike Davis"}', '{"provider":"email","providers":["email"]}', false
  )
  on conflict (id) do nothing;

  -- Auth identities (required for email/password login)
  insert into auth.identities (user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values
    (admin_id, 'admin@test.com', 'email', jsonb_build_object('sub', admin_id::text, 'email', 'admin@test.com'), now(), now(), now()),
    (tom_id,   'tom@test.com',   'email', jsonb_build_object('sub', tom_id::text,   'email', 'tom@test.com'),   now(), now(), now()),
    (mike_id,  'mike@test.com',  'email', jsonb_build_object('sub', mike_id::text,  'email', 'mike@test.com'),  now(), now(), now())
  on conflict (provider_id, provider) do nothing;

  -- Profiles (trigger auto-creates these on signup; insert here as fallback)
  insert into profiles (id, name, email) values
    (admin_id, 'Howard Admin', 'admin@test.com'),
    (tom_id,   'Tom Wilson',   'tom@test.com'),
    (mike_id,  'Mike Davis',   'mike@test.com')
  on conflict (id) do nothing;

  -- ── Group ────────────────────────────────────────────────────

  insert into groups (name, home_course)
  values ('The Usual Suspects', 'Torrey Pines')
  returning id into group_id;

  -- ── Members ──────────────────────────────────────────────────

  insert into group_members (group_id, user_id, player_type, is_admin)
  values (group_id, admin_id, 'core', true)
  returning id into admin_mem;

  insert into group_members (group_id, user_id, player_type, is_admin)
  values (group_id, tom_id, 'core', false)
  returning id into tom_mem;

  insert into group_members (group_id, user_id, player_type, is_admin)
  values (group_id, mike_id, 'core', false)
  returning id into mike_mem;

  -- Sarah: invited but not yet registered
  insert into group_members (group_id, user_id, invited_email, invited_name, player_type, is_admin)
  values (group_id, null, 'sarah@test.com', 'Sarah Chen', 'core', false)
  returning id into sarah_mem;

  -- ── Roster Groups ─────────────────────────────────────────────

  insert into roster_groups (group_id, name, is_default)
  values (group_id, 'Default', true)
  returning id into default_rg_id;

  insert into roster_group_members (roster_group_id, member_id) values
    (default_rg_id, admin_mem),
    (default_rg_id, tom_mem),
    (default_rg_id, mike_mem),
    (default_rg_id, sarah_mem);

  -- ── Tee Times ────────────────────────────────────────────────

  -- Upcoming 1: ~5 days out
  insert into tee_times (group_id, date, start_time, course, max_slots, created_by, notes)
  values (group_id, current_date + 5, '08:00:00', 'Torrey Pines (South)', 4, admin_id,
          'Bring layers — morning marine layer expected.')
  returning id into tt1_id;

  -- Upcoming 2: ~12 days out
  insert into tee_times (group_id, date, start_time, course, max_slots, created_by)
  values (group_id, current_date + 12, '07:30:00', 'Torrey Pines (North)', 4, admin_id)
  returning id into tt2_id;

  -- Past 1: last week
  insert into tee_times (group_id, date, start_time, course, max_slots, created_by)
  values (group_id, current_date - 7, '08:30:00', 'Torrey Pines (South)', 4, admin_id)
  returning id into tt3_id;

  -- Past 2: two weeks ago
  insert into tee_times (group_id, date, start_time, course, max_slots, created_by)
  values (group_id, current_date - 14, '09:00:00', 'Torrey Pines (North)', 4, admin_id)
  returning id into tt4_id;

  -- ── Invites ──────────────────────────────────────────────────

  insert into invites (tee_time_id, member_id, invite_type) values
    (tt1_id, admin_mem, 'core'), (tt1_id, tom_mem, 'core'),
    (tt1_id, mike_mem,  'core'), (tt1_id, sarah_mem, 'core'),
    (tt2_id, admin_mem, 'core'), (tt2_id, tom_mem, 'core'),
    (tt2_id, mike_mem,  'core'), (tt2_id, sarah_mem, 'core'),
    (tt3_id, admin_mem, 'core'), (tt3_id, tom_mem, 'core'),
    (tt3_id, mike_mem,  'core'), (tt3_id, sarah_mem, 'core'),
    (tt4_id, admin_mem, 'core'), (tt4_id, tom_mem, 'core'),
    (tt4_id, mike_mem,  'core'), (tt4_id, sarah_mem, 'core');

  -- ── RSVPs ────────────────────────────────────────────────────

  -- Upcoming 1: admin + tom in, mike + sarah pending
  insert into rsvps (tee_time_id, member_id, status) values
    (tt1_id, admin_mem, 'in'),    (tt1_id, tom_mem,   'in'),
    (tt1_id, mike_mem,  'pending'),(tt1_id, sarah_mem, 'pending');

  -- Upcoming 2: admin in, rest pending
  insert into rsvps (tee_time_id, member_id, status) values
    (tt2_id, admin_mem, 'in'),    (tt2_id, tom_mem,   'pending'),
    (tt2_id, mike_mem,  'pending'),(tt2_id, sarah_mem, 'pending');

  -- Past 1: everyone in except sarah
  insert into rsvps (tee_time_id, member_id, status, note) values
    (tt3_id, admin_mem, 'in',  null),
    (tt3_id, tom_mem,   'in',  'Shot my best round yet!'),
    (tt3_id, mike_mem,  'in',  null),
    (tt3_id, sarah_mem, 'out', null);

  -- Past 2: mixed
  insert into rsvps (tee_time_id, member_id, status) values
    (tt4_id, admin_mem, 'in'),  (tt4_id, tom_mem,   'out'),
    (tt4_id, mike_mem,  'in'),  (tt4_id, sarah_mem, 'pending');

end $$;
