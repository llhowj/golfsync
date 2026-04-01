-- Enable RLS on proposal tables that were missing it
ALTER TABLE tee_time_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_responses ENABLE ROW LEVEL SECURITY;

-- tee_time_proposals: group members can view proposals for their tee times
CREATE POLICY "Group members can view proposals"
  ON tee_time_proposals FOR SELECT USING (
    tee_time_id IN (
      SELECT tt.id FROM tee_times tt
      JOIN group_members gm ON gm.group_id = tt.group_id
      WHERE gm.user_id = auth.uid()
    )
  );

-- Admins can manage proposals
CREATE POLICY "Admins can manage proposals"
  ON tee_time_proposals FOR ALL USING (
    tee_time_id IN (
      SELECT tt.id FROM tee_times tt
      JOIN group_members gm ON gm.group_id = tt.group_id
      WHERE gm.user_id = auth.uid() AND gm.is_admin = true
    )
  );

-- proposal_responses: members can view responses for proposals on their tee times
CREATE POLICY "Group members can view proposal responses"
  ON proposal_responses FOR SELECT USING (
    proposal_id IN (
      SELECT p.id FROM tee_time_proposals p
      JOIN tee_times tt ON tt.id = p.tee_time_id
      JOIN group_members gm ON gm.group_id = tt.group_id
      WHERE gm.user_id = auth.uid()
    )
  );

-- Members can manage their own responses
CREATE POLICY "Members can manage their own proposal responses"
  ON proposal_responses FOR ALL USING (
    member_id IN (
      SELECT id FROM group_members WHERE user_id = auth.uid()
    )
  );
