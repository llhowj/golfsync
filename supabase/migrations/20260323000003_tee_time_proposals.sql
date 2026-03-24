-- Proposed tee time changes that require player consensus
CREATE TABLE IF NOT EXISTS tee_time_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tee_time_id UUID NOT NULL REFERENCES tee_times(id) ON DELETE CASCADE,
  proposed_date DATE NOT NULL,
  proposed_start_time TIME NOT NULL,
  proposed_course TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'cancelled'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-member yes/no responses to a proposal
CREATE TABLE IF NOT EXISTS proposal_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES tee_time_proposals(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
  response TEXT DEFAULT NULL, -- NULL = awaiting, 'yes', 'no'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(proposal_id, member_id)
);
