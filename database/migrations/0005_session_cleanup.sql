-- Migration: 0005_session_cleanup
-- Periodic cleanup of expired/revoked sessions to manage storage

-- This migration can be run periodically (e.g., daily via cron trigger)
-- to purge old sessions and prevent unbounded table growth.

-- Delete sessions that:
-- 1. Have been revoked AND are older than 7 days (revoked sessions no longer needed)
-- 2. Have expired AND are older than 30 days (orphaned expired sessions)
DELETE FROM sessions
WHERE
  (revoked_at IS NOT NULL AND datetime(revoked_at) < datetime('now', '-7 days'))
  OR (revoked_at IS NULL AND datetime(expires_at) < datetime('now', '-30 days'));
