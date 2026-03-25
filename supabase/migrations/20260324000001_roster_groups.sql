-- Roster groups: named subsets of a group's players used for tee time invites
create table if not exists roster_groups (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references groups(id) on delete cascade,
  name       text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- Only one default group per golf group
create unique index if not exists roster_groups_one_default_per_group
  on roster_groups(group_id)
  where is_default = true;

-- Roster group membership (many-to-many)
create table if not exists roster_group_members (
  roster_group_id uuid not null references roster_groups(id) on delete cascade,
  member_id       uuid not null references group_members(id) on delete cascade,
  primary key (roster_group_id, member_id)
);
