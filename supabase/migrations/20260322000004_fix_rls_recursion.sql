-- Drop the recursive policy that causes infinite recursion.
-- Users can see their own row — that's enough for the dashboard query.
-- Admin queries for all group members use the service role key (bypasses RLS).
drop policy if exists "Users can view group peers" on group_members;
