-- =====================================================================
-- Migration 006 — Password reset requests (admin-mediated)
-- =====================================================================
-- Backs the "forgot password" flow: a user requests a reset, a super admin
-- approves it, and a one-time token (stored only as a SHA-256 hash) is emailed.
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste → Run.
--   (Or call POST /make-server-c5b85875/run-migration-006 as a super admin.)
-- SAFE TO RE-RUN: yes.
-- =====================================================================

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','completed')),
  token_hash TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  reject_reason TEXT,
  processed_by UUID REFERENCES users(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prr_status ON password_reset_requests(status);
CREATE INDEX IF NOT EXISTS idx_prr_user_id ON password_reset_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_prr_token_hash ON password_reset_requests(token_hash);

-- Lock down: service_role only (edge function bypasses RLS via service key)
ALTER TABLE password_reset_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_requests FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'password_reset_requests'
      AND policyname = 'service_role_full_access'
  ) THEN
    CREATE POLICY "service_role_full_access" ON password_reset_requests
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON password_reset_requests FROM anon;
REVOKE ALL ON password_reset_requests FROM authenticated;
GRANT ALL ON password_reset_requests TO service_role;
