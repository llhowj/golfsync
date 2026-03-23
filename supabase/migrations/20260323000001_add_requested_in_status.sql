-- Add 'requested_in' to rsvp_status enum
-- Used when a player who RSVPed 'out' requests to rejoin; requires admin approval.
ALTER TYPE rsvp_status ADD VALUE IF NOT EXISTS 'requested_in';
