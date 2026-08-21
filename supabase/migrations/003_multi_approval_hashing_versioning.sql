-- =====================================================
-- Migration 003: Multi-Approval, SHA-256 Hashing, Version Control
-- =====================================================

-- =====================================================
-- 1. SHA-256 FILE INTEGRITY COLUMNS
-- =====================================================

ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_hash TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS hash_algorithm TEXT DEFAULT 'SHA-256';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS integrity_status TEXT DEFAULT 'unverified'
  CHECK (integrity_status IN ('verified', 'modified', 'unverified'));
ALTER TABLE documents ADD COLUMN IF NOT EXISTS hash_verified_at TIMESTAMP WITH TIME ZONE;

-- =====================================================
-- 2. MULTI-APPROVAL COLUMNS ON DOCUMENTS
-- =====================================================

ALTER TABLE documents ADD COLUMN IF NOT EXISTS required_approvals INTEGER NOT NULL DEFAULT 1;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS current_approvals INTEGER NOT NULL DEFAULT 0;

-- =====================================================
-- 3. VERSION CONTROL COLUMNS ON DOCUMENTS
-- =====================================================

ALTER TABLE documents ADD COLUMN IF NOT EXISTS parent_document_id UUID REFERENCES documents(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS version_tag TEXT DEFAULT 'v1';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS base_title TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS base_file_name TEXT;

-- Update existing documents to populate base_title and version_tag defaults
UPDATE documents SET base_title = title WHERE base_title IS NULL;
UPDATE documents SET version_tag = 'v1' WHERE version_tag IS NULL;
UPDATE documents SET base_file_name = file_name WHERE base_file_name IS NULL;

-- Indexes for version control
CREATE INDEX IF NOT EXISTS idx_documents_parent_document_id ON documents(parent_document_id);
CREATE INDEX IF NOT EXISTS idx_documents_base_file_name ON documents(base_file_name);
CREATE INDEX IF NOT EXISTS idx_documents_file_hash ON documents(file_hash);

-- =====================================================
-- 4. DOCUMENT APPROVALS TABLE (multi-approval tracking)
-- =====================================================

CREATE TABLE IF NOT EXISTS document_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES users(id),
  approver_name TEXT NOT NULL,
  approver_role TEXT NOT NULL,
  approver_department TEXT,
  action TEXT NOT NULL CHECK (action IN ('approved', 'rejected')),
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- One approver can only act once per document
CREATE UNIQUE INDEX IF NOT EXISTS idx_document_approvals_unique
  ON document_approvals(document_id, approver_id);

-- Standard indexes
CREATE INDEX IF NOT EXISTS idx_document_approvals_document_id ON document_approvals(document_id);
CREATE INDEX IF NOT EXISTS idx_document_approvals_approver_id ON document_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_document_approvals_created_at ON document_approvals(created_at DESC);

-- RLS for document_approvals
ALTER TABLE document_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to document_approvals" ON document_approvals
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE document_approvals IS 'Tracks individual approvals for multi-step document approval workflows';

-- =====================================================
-- Migration Complete
-- =====================================================
