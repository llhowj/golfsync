-- GolfSync Initial Schema
-- Enables UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- GROUPS
-- Each group is an independent tenant (e.g., one golf circle)
-- ============================================================
create table groups (
  id                          uuid primary key default uuid_generate_v4(),
  name                        text not null,
  home_course                 text,
  max_core_players            int not null default 4,  -- configurable per group
  cancellation_deadline_hours int not null default 48,
  deadline_alerts_enabled     boolean not null default true,
  created_at                  timestamptz not null default now()
);

-- ============================================================
-- PROFILES
-- Extends Supabase auth.users with app-level data
-- ============================================================
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  name         text not null,
  email        text not null,
  phone        text,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- GROUP MEMBERS
-- Links a user to a group with their role and preferences
-- ============================================================
create type player_type as enum ('core', 'backup');
create type notification_channel as enum ('email', 'sms', 'push');

create table group_members (
  id                    uuid primary key default uuid_generate_v4(),
  group_id              uuid not null references groups(id) on delete cascade,
  user_id               uuid references profiles(id) on delete set null,
  -- used for invited-but-not-yet-registered players:
  invited_email         text,
  invited_name          text,
  player_type           player_type not null default 'core',
  backup_rank           int,           -- rank in backup queue; null for core players
  notification_channels notification_channel[] not null default '{email}',
  is_admin              boolean not null default false,
  created_at            timestamptz not null default now(),
  -- a user can only belong to a group once
  unique (group_id, user_id)
);

-- ============================================================
-- TEE TIMES
-- ============================================================
create table tee_times (
  id             uuid primary key default uuid_generate_v4(),
  group_id       uuid not null references groups(id) on delete cascade,
  date           date not null,
  start_time     time not null,
  course         text not null,
  max_slots      int not null default 4,
  created_by     uuid not null references profiles(id),
  notes          text,
  time_changed_at timestamptz,
  deleted_at     timestamptz,  -- soft delete; null = active
  created_at     timestamptz not null default now()
);

-- ============================================================
-- INVITES
-- Tracks which players were invited to each tee time
-- ============================================================
create type invite_type as enum ('core', 'backup');

create table invites (
  id           uuid primary key default uuid_generate_v4(),
  tee_time_id  uuid not null references tee_times(id) on delete cascade,
  member_id    uuid not null references group_members(id) on delete cascade,
  invite_type  invite_type not null,
  sequence_num int,           -- order in which backups were invited
  invited_at   timestamptz not null default now(),
  unique (tee_time_id, member_id)
);

-- ============================================================
-- RSVPs
-- ============================================================
create type rsvp_status as enum ('in', 'out', 'pending');

create table rsvps (
  id          uuid primary key default uuid_generate_v4(),
  tee_time_id uuid not null references tee_times(id) on delete cascade,
  member_id   uuid not null references group_members(id) on delete cascade,
  status      rsvp_status not null default 'pending',
  note        text check (char_length(note) <= 140),
  updated_at  timestamptz not null default now(),
  unique (tee_time_id, member_id)
);

-- ============================================================
-- POLLS  (admin polls players on a potential time change)
-- ============================================================
create table polls (
  id             uuid primary key default uuid_generate_v4(),
  tee_time_id    uuid not null references tee_times(id) on delete cascade,
  created_by     uuid not null references profiles(id),
  proposed_date  date not null,
  proposed_time  time not null,
  created_at     timestamptz not null default now()
);

create type poll_preference as enum ('new', 'keep', 'no_preference');

create table poll_responses (
  id          uuid primary key default uuid_generate_v4(),
  poll_id     uuid not null references polls(id) on delete cascade,
  member_id   uuid not null references group_members(id) on delete cascade,
  preference  poll_preference not null,
  responded_at timestamptz not null default now(),
  unique (poll_id, member_id)
);

-- ============================================================
-- NOTIFICATIONS
-- Audit log of every notification sent
-- ============================================================
create type notification_type as enum (
  'tee_time_posted',
  'tee_time_changed',
  'tee_time_deleted',
  'backup_invited',
  'slot_filled',
  'rsvp_reminder',
  'deadline_alert',
  'rsvp_change',
  'time_change_poll'
);

create type notification_status as enum ('pending', 'sent', 'failed');

create table notifications (
  id          uuid primary key default uuid_generate_v4(),
  member_id   uuid not null references group_members(id) on delete cascade,
  tee_time_id uuid references tee_times(id) on delete set null,
  channel     notification_channel not null,
  type        notification_type not null,
  payload     jsonb,            -- full message content for audit
  status      notification_status not null default 'pending',
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- PLAY HISTORY
-- Recorded after each round
-- ============================================================
create table play_history (
  id          uuid primary key default uuid_generate_v4(),
  tee_time_id uuid not null references tee_times(id) on delete cascade,
  member_id   uuid not null references group_members(id) on delete cascade,
  player_type player_type not null,
  attended    boolean not null default true,
  recorded_at timestamptz not null default now(),
  unique (tee_time_id, member_id)
);

-- ============================================================
-- DEADLINE ALERT TRACKING  (idempotency — one alert per tee time)
-- ============================================================
create table deadline_alerts (
  id          uuid primary key default uuid_generate_v4(),
  tee_time_id uuid not null references tee_times(id) on delete cascade,
  sent_at     timestamptz not null default now(),
  unique (tee_time_id)  -- ensures only one alert is ever sent per tee time
);

-- ============================================================
-- ROW-LEVEL SECURITY
-- Groups cannot access each other's data
-- ============================================================
alter table groups          enable row level security;
alter table profiles        enable row level security;
alter table group_members   enable row level security;
alter table tee_times       enable row level security;
alter table invites         enable row level security;
alter table rsvps           enable row level security;
alter table polls           enable row level security;
alter table poll_responses  enable row level security;
alter table notifications   enable row level security;
alter table play_history    enable row level security;
alter table deadline_alerts enable row level security;

-- Profiles: users can only read/update their own profile
create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

-- Group members: can see other members in the same group
create policy "Members can view their group members"
  on group_members for select using (
    group_id in (
      select group_id from group_members where user_id = auth.uid()
    )
  );

-- Groups: members can view their own group
create policy "Members can view their group"
  on groups for select using (
    id in (
      select group_id from group_members where user_id = auth.uid()
    )
  );

-- Admins can update their group
create policy "Admins can update their group"
  on groups for update using (
    id in (
      select group_id from group_members
      where user_id = auth.uid() and is_admin = true
    )
  );

-- Tee times: members can see tee times for their group
create policy "Members can view their group tee times"
  on tee_times for select using (
    group_id in (
      select group_id from group_members where user_id = auth.uid()
    )
  );

-- Admins can create/update/delete tee times
create policy "Admins can manage tee times"
  on tee_times for all using (
    group_id in (
      select group_id from group_members
      where user_id = auth.uid() and is_admin = true
    )
  );

-- Invites: players can see their own invites
create policy "Players can view their own invites"
  on invites for select using (
    member_id in (
      select id from group_members where user_id = auth.uid()
    )
  );

-- Admins can manage invites
create policy "Admins can manage invites"
  on invites for all using (
    tee_time_id in (
      select tt.id from tee_times tt
      join group_members gm on gm.group_id = tt.group_id
      where gm.user_id = auth.uid() and gm.is_admin = true
    )
  );

-- RSVPs: players can see RSVPs for their invited tee times
create policy "Players can view RSVPs for their tee times"
  on rsvps for select using (
    tee_time_id in (
      select tee_time_id from invites
      where member_id in (
        select id from group_members where user_id = auth.uid()
      )
    )
  );

-- Players can manage their own RSVPs
create policy "Players can manage their own RSVPs"
  on rsvps for all using (
    member_id in (
      select id from group_members where user_id = auth.uid()
    )
  );

-- Notifications: users can view their own
create policy "Users can view own notifications"
  on notifications for select using (
    member_id in (
      select id from group_members where user_id = auth.uid()
    )
  );

-- Polls: members of the group can view
create policy "Group members can view polls"
  on polls for select using (
    tee_time_id in (
      select tt.id from tee_times tt
      join group_members gm on gm.group_id = tt.group_id
      where gm.user_id = auth.uid()
    )
  );

-- Poll responses: members can view and manage their own
create policy "Members can manage their poll responses"
  on poll_responses for all using (
    member_id in (
      select id from group_members where user_id = auth.uid()
    )
  );

-- Play history: group members can view
create policy "Group members can view play history"
  on play_history for select using (
    tee_time_id in (
      select tt.id from tee_times tt
      join group_members gm on gm.group_id = tt.group_id
      where gm.user_id = auth.uid()
    )
  );

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Auto-update rsvps.updated_at
create or replace function update_updated_at()
returns trigger language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger rsvps_updated_at
  before update on rsvps
  for each row execute function update_updated_at();

-- ============================================================
-- INDEXES
-- ============================================================
create index on tee_times (group_id, date);
create index on tee_times (deleted_at) where deleted_at is null;
create index on invites (tee_time_id);
create index on invites (member_id);
create index on rsvps (tee_time_id);
create index on rsvps (member_id);
create index on group_members (group_id);
create index on group_members (user_id);
create index on notifications (member_id, created_at);
create index on deadline_alerts (tee_time_id);
