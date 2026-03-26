-- ============================================================
-- TEE TIME WATCH
-- ============================================================

create type watch_mode as enum ('notify', 'book');

create table tee_time_watches (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid not null references groups(id) on delete cascade,
  created_by     uuid not null references profiles(id),
  days_of_week   int[] not null,
  earliest_time  time not null,
  latest_time    time not null,
  min_slots      int not null default 4,
  mode           watch_mode not null default 'notify',
  repeat         boolean not null default true,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index on tee_time_watches (group_id, is_active);

create trigger tee_time_watches_updated_at
  before update on tee_time_watches
  for each row execute function update_updated_at();

-- ============================================================

create type watch_alert_status as enum ('pending', 'gone', 'booked');

create table watch_alerts (
  id                  uuid primary key default gen_random_uuid(),
  watch_id            uuid not null references tee_time_watches(id) on delete cascade,
  group_id            uuid not null references groups(id) on delete cascade,
  scraped_date        date not null,
  scraped_time        time not null,
  scraped_course      text not null,
  available_slots     int not null,
  first_seen_at       timestamptz not null default now(),
  last_seen_at        timestamptz not null default now(),
  gone_at             timestamptz,
  status              watch_alert_status not null default 'pending',
  booked_tee_time_id  uuid references tee_times(id) on delete set null,
  booked_at           timestamptz,
  sms_sid             text,
  created_at          timestamptz not null default now()
);

-- One active alert per watch + date + time slot
create unique index watch_alerts_active_slot_unique
  on watch_alerts (watch_id, scraped_date, scraped_time)
  where status = 'pending';

create index on watch_alerts (group_id, status);
create index on watch_alerts (watch_id, status);

-- ============================================================
-- RLS
-- ============================================================

alter table tee_time_watches enable row level security;
alter table watch_alerts     enable row level security;

create policy "Admins manage watches"
  on tee_time_watches for all using (
    group_id in (
      select group_id from group_members
      where user_id = auth.uid() and is_admin = true
    )
  );

create policy "Admins view alerts"
  on watch_alerts for select using (
    group_id in (
      select group_id from group_members
      where user_id = auth.uid() and is_admin = true
    )
  );

create policy "Admins update alerts"
  on watch_alerts for update using (
    group_id in (
      select group_id from group_members
      where user_id = auth.uid() and is_admin = true
    )
  );
