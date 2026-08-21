-- =====================================================================
-- Migration 005 — Lock down Row Level Security (RLS)
-- =====================================================================
--
-- WHY:
--   The Arkivo backend talks to Postgres exclusively through the edge
--   function using the SUPABASE_SERVICE_ROLE_KEY, which BYPASSES RLS.
--   That means the ONLY safe posture for the anon/public roles is: no
--   access at all. If any table has a policy that grants the `anon` or
--   `public` role access, anyone holding the public anon key can read or
--   write your tables directly via PostgREST — completely bypassing every
--   auth, role, and clearance check in the edge function.
--
-- WHAT THIS DOES:
--   1. Enables (and forces) RLS on every application table.
--   2. Drops ALL existing policies on those tables (removes any lingering
--      public/anon "allow all" policies).
--   3. Recreates a single policy per table that grants full access ONLY to
--      the service_role. Nothing is granted to anon or authenticated.
--   4. Revokes table privileges from anon/authenticated as defense in depth.
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → paste this file → Run.
--   (Figma Make cannot run DDL; this must be applied in Supabase directly.)
--
-- SAFE TO RE-RUN: yes — it is idempotent.
-- =====================================================================

-- All application tables. Add/remove names here if your schema differs.
DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
  app_tables TEXT[] := ARRAY[
    'users',
    'sessions',
    'documents',
    'document_history',
    'document_approvals',
    'notifications',
    'audit_logs',
    'kv_store_c5b85875'
  ];
BEGIN
  FOREACH tbl IN ARRAY app_tables LOOP
    -- Skip tables that don't exist in this project
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      RAISE NOTICE 'Skipping missing table: %', tbl;
      CONTINUE;
    END IF;

    -- 1 + 2. Enable and FORCE RLS (FORCE also applies RLS to the table owner)
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', tbl);

    -- 3. Drop every existing policy on the table (clears public/anon grants)
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, tbl);
    END LOOP;

    -- 4. Single policy: full access for service_role ONLY
    EXECUTE format($f$
      CREATE POLICY "service_role_full_access" ON public.%I
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    $f$, tbl);

    -- 5. Defense in depth: strip direct grants from public-facing roles
    EXECUTE format('REVOKE ALL ON public.%I FROM anon;', tbl);
    EXECUTE format('REVOKE ALL ON public.%I FROM authenticated;', tbl);
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', tbl);

    RAISE NOTICE 'Locked down table: %', tbl;
  END LOOP;
END $$;

-- =====================================================================
-- VERIFICATION (optional — run separately to confirm the result)
-- =====================================================================
-- Every listed table should show rowsecurity = true and forcerowsecurity = true:
--
--   SELECT relname, relrowsecurity, relforcerowsecurity
--   FROM pg_class
--   WHERE relname IN (
--     'users','sessions','documents','document_history',
--     'document_approvals','notifications','audit_logs','kv_store_c5b85875'
--   );
--
-- Every policy should target ONLY {service_role} — no anon/public/authenticated:
--
--   SELECT tablename, policyname, roles, cmd
--   FROM pg_policies
--   WHERE schemaname = 'public'
--   ORDER BY tablename;
-- =====================================================================
