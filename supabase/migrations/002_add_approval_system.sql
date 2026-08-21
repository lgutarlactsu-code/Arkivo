-- =====================================================
-- Account Approval System
-- Add approval status and approval tracking for new user registrations
-- =====================================================

-- Add approval columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE users
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Create index for approval_status for faster queries
CREATE INDEX IF NOT EXISTS idx_users_approval_status ON users(approval_status);

-- Comment
COMMENT ON COLUMN users.approval_status IS 'Account approval status: pending (awaiting approval), approved (can login), rejected (denied access)';
COMMENT ON COLUMN users.approved_by IS 'ID of super admin who approved the account';
COMMENT ON COLUMN users.approved_at IS 'Timestamp when account was approved';
COMMENT ON COLUMN users.rejected_by IS 'ID of super admin who rejected the account';
COMMENT ON COLUMN users.rejected_at IS 'Timestamp when account was rejected';
COMMENT ON COLUMN users.rejection_reason IS 'Reason provided by super admin for rejection';

-- =====================================================
-- Migration Complete
-- =====================================================
