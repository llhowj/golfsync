-- Remove core/backup player_type concept entirely
alter table group_members drop column if exists player_type;
alter table group_members drop column if exists backup_rank;
alter table groups drop column if exists max_core_players;

-- Drop invite_type from invites
alter table invites drop column if exists invite_type;

-- Drop play_history table (unused)
drop table if exists play_history;

drop type if exists player_type;
drop type if exists invite_type;
