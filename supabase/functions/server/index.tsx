import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as db from "./database.tsx";
import pg from "npm:pg";
import {
  rateLimit,
  validation,
  secureHeaders,
  loginBruteForceProtection
} from "./security.tsx";
import { secureLog } from "./secureLog.tsx";
import { sendEmail, passwordResetEmailHtml, getAppUrl } from "./email.tsx";

const app = new Hono();

// Password hashing functions using Web Crypto API
const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  const hash = await hashPassword(password);
  return hash === hashedPassword;
};

// Enable logger
app.use('*', logger(console.log));

// Add security headers to all responses
app.use('*', secureHeaders);

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-Session-Token", "x-session-token", "X-Device-Info"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);


// Helper function to extract device and IP information from request
const getRequestInfo = (c: any) => {
  // Get IP address
  const ipAddress = 
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 
    c.req.header('x-real-ip') || 
    c.req.header('cf-connecting-ip') || // Cloudflare
    'Unknown';
  
  // Get device info from custom header
  let deviceInfo: any = {};
  try {
    const deviceInfoHeader = c.req.header('X-Device-Info');
    if (deviceInfoHeader) {
      deviceInfo = JSON.parse(deviceInfoHeader);
    }
  } catch (error) {
    console.error('Failed to parse device info:', error);
  }
  
  return {
    ipAddress,
    deviceInfo,
    userAgent: c.req.header('user-agent') || 'Unknown',
  };
};

// Helper: Convert SQL row format to camelCase API format for users
const formatUser = (user: any) => {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    department: user.department,
    clearanceLevel: user.clearance_level,
    isActive: user.is_active,
    approvalStatus: user.approval_status,
    rejectionReason: user.rejection_reason,
    approvedBy: user.approved_by,
    approvedAt: user.approved_at,
    createdAt: user.created_at,
  };
};

// Helper: Convert SQL row format to camelCase API format for documents
const formatDocument = (doc: any) => {
  if (!doc) return null;
  return {
    id: doc.id,
    title: doc.title,
    description: doc.description,
    department: doc.department,
    authorId: doc.author_id,
    authorName: doc.author_name,
    fileName: doc.file_name,
    fileType: doc.file_type,
    fileSize: doc.file_size,
    fileUrl: doc.file_url,
    fileData: doc.file_data, // Legacy field
    status: doc.status,
    accessLevel: doc.access_level,
    version: doc.version,
    isLocked: doc.is_locked,
    tags: doc.tags,
    metadata: doc.metadata,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
    approvedAt: doc.approved_at,
    approvedBy: doc.approved_by,
    rejectedAt: doc.rejected_at,
    rejectedBy: doc.rejected_by,
    rejectionReason: doc.rejection_reason,
    // SHA-256 integrity fields
    fileHash: doc.file_hash,
    hashAlgorithm: doc.hash_algorithm ?? 'SHA-256',
    integrityStatus: doc.integrity_status ?? 'unverified',
    hashVerifiedAt: doc.hash_verified_at,
    // Multi-approval fields
    requiredApprovals: doc.required_approvals ?? 1,
    currentApprovals: doc.current_approvals ?? 0,
    // Version control fields
    parentDocumentId: doc.parent_document_id,
    versionTag: doc.version_tag ?? 'v1',
    baseTitle: doc.base_title ?? doc.title,
    baseFileName: doc.base_file_name ?? doc.file_name,
  };
};

// Centralized read-access check for a document row (SQL snake_case shape).
// Mirrors getDocumentsForUser so single-document reads can't bypass list filtering.
const canReadDocument = (document: any, userId: string, userProfile: any): boolean => {
  if (!document || !userProfile) return false;
  const role = userProfile.role;
  if (role === 'super_admin' || role === 'lgu_head') return true;
  if (document.author_id === userId) return true;
  if (role === 'dept_admin' && document.department === userProfile.department) return true;
  if (document.access_level === 'public') return true;
  // staff / records_officer may see restricted docs within their own department
  if (document.department === userProfile.department && document.access_level === 'restricted') return true;
  return false;
};

// Hash file data using SHA-256 (Web Crypto API - available in Deno)
const hashFileData = async (fileData: string): Promise<string> => {
  try {
    const base64 = fileData.includes(',') ? fileData.split(',')[1] : fileData;
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Hash computation failed:', error);
    return '';
  }
};

// Helper: Convert SQL row format to camelCase API format for notifications
const formatNotification = (notif: any) => {
  if (!notif) return null;
  return {
    id: notif.id,
    userId: notif.user_id,
    type: notif.metadata?.originalType || notif.type, // Use original type from metadata if available
    title: notif.title,
    message: notif.message,
    documentId: notif.metadata?.documentId,
    documentTitle: notif.metadata?.documentTitle,
    fromUserId: notif.metadata?.fromUserId,
    fromUserName: notif.metadata?.fromUserName,
    actionUrl: notif.action_url,
    metadata: notif.metadata,
    isRead: notif.is_read,
    createdAt: notif.created_at,
    readAt: notif.read_at,
  };
};

// Auth middleware - Uses SQL sessions only
const requireAuth = async (c: any, next: any) => {
  let sessionToken = c.req.header('X-Session-Token') || c.req.header('x-session-token');

  if (!sessionToken) {
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token !== Deno.env.get('SUPABASE_ANON_KEY')) {
        sessionToken = token;
      }
    }
  }

  if (!sessionToken) {
    return c.json({ error: 'Unauthorized - No token provided', needsLogin: true }, 401);
  }

  try {
    // Fetch session + user profile in parallel to cut latency
    const session = await db.getSession(sessionToken);

    if (!session) {
      return c.json({
        error: 'Session expired or invalid. Please log in again.',
        needsLogin: true,
        hint: 'Your session may have expired. Please refresh the page and log in again.'
      }, 401);
    }

    const expiresAt = new Date(session.expires_at);
    if (expiresAt < new Date()) {
      await db.deleteSession(sessionToken);
      return c.json({ error: 'Session expired. Please log in again.', needsLogin: true }, 401);
    }

    // Throttled activity update — only writes if last_activity is stale (>60s)
    db.updateSessionActivity(sessionToken, session.last_activity);

    // Fetch full user profile and cache it in context for all downstream handlers
    const userProfile = await db.getUser(session.user_id);

    c.set('userId', session.user_id);
    c.set('userEmail', session.email);
    c.set('userProfile', userProfile); // cached — no extra DB call in handlers
    await next();
  } catch (error: any) {
    console.error('❌ Auth middleware error:', error.message);
    return c.json({
      error: 'Authentication failed. Please log in again.',
      details: error.message,
      needsLogin: true
    }, 401);
  }
};

// ============ PUBLIC ROUTES ============

// Health check endpoint
app.get("/make-server-c5b85875/health", (c) => {
  return c.json({ status: "ok" });
});

// Run migration 003 — idempotent DDL for multi-approval, hashing, version control
// SECURITY: Gated behind a super-admin session. Running DDL must never be public.
app.post("/make-server-c5b85875/run-migration-003", requireAuth, async (c) => {
  const steps: string[] = [];
  let pgClient: any = null;

  if (c.get('userProfile')?.role !== 'super_admin') {
    return c.json({ error: 'Unauthorized - Super admin access required' }, 403);
  }

  try {
    const dbUrl = Deno.env.get('SUPABASE_DB_URL');
    if (!dbUrl) {
      return c.json({ error: 'SUPABASE_DB_URL not configured' }, 500);
    }

    const { Client } = pg;
    pgClient = new Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
      query_timeout: 20000,
    });

    await pgClient.connect();
    console.log('✅ DB connection established for migration 003');

    const run = async (label: string, ddl: string) => {
      try {
        await pgClient.query(ddl);
        steps.push(`✅ ${label}`);
        console.log(`  ✅ ${label}`);
      } catch (e: any) {
        // Ignore "already exists" / "duplicate column" errors — migration is idempotent
        if (e.code === '42701' || e.code === '42P07' || e.code === '42710') {
          steps.push(`⏭️  ${label} (already exists)`);
        } else {
          steps.push(`❌ ${label}: ${e.message}`);
          console.warn(`  ❌ ${label}:`, e.message);
        }
      }
    };

    // 1. SHA-256 integrity columns
    await run('file_hash column', `ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_hash TEXT`);
    await run('hash_algorithm column', `ALTER TABLE documents ADD COLUMN IF NOT EXISTS hash_algorithm TEXT DEFAULT 'SHA-256'`);
    await run('integrity_status column', `ALTER TABLE documents ADD COLUMN IF NOT EXISTS integrity_status TEXT DEFAULT 'unverified'`);
    await run('hash_verified_at column', `ALTER TABLE documents ADD COLUMN IF NOT EXISTS hash_verified_at TIMESTAMP WITH TIME ZONE`);

    // 2. Multi-approval columns
    await run('required_approvals column', `ALTER TABLE documents ADD COLUMN IF NOT EXISTS required_approvals INTEGER NOT NULL DEFAULT 1`);
    await run('current_approvals column', `ALTER TABLE documents ADD COLUMN IF NOT EXISTS current_approvals INTEGER NOT NULL DEFAULT 0`);

    // 3. Version control columns
    await run('parent_document_id column', `ALTER TABLE documents ADD COLUMN IF NOT EXISTS parent_document_id UUID REFERENCES documents(id)`);
    await run('version_tag column', `ALTER TABLE documents ADD COLUMN IF NOT EXISTS version_tag TEXT DEFAULT 'v1'`);
    await run('base_title column', `ALTER TABLE documents ADD COLUMN IF NOT EXISTS base_title TEXT`);
    await run('base_file_name column', `ALTER TABLE documents ADD COLUMN IF NOT EXISTS base_file_name TEXT`);

    // Backfill existing rows
    await run('backfill base_title', `UPDATE documents SET base_title = title WHERE base_title IS NULL`);
    await run('backfill version_tag', `UPDATE documents SET version_tag = 'v1' WHERE version_tag IS NULL`);
    await run('backfill base_file_name', `UPDATE documents SET base_file_name = file_name WHERE base_file_name IS NULL`);

    // 4. Indexes
    await run('idx parent_document_id', `CREATE INDEX IF NOT EXISTS idx_documents_parent_document_id ON documents(parent_document_id)`);
    await run('idx base_file_name', `CREATE INDEX IF NOT EXISTS idx_documents_base_file_name ON documents(base_file_name)`);
    await run('idx file_hash', `CREATE INDEX IF NOT EXISTS idx_documents_file_hash ON documents(file_hash)`);

    // 5. document_approvals table
    await run('document_approvals table', `
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
      )
    `);
    await run('unique idx approvals', `CREATE UNIQUE INDEX IF NOT EXISTS idx_document_approvals_unique ON document_approvals(document_id, approver_id)`);
    await run('idx approvals doc', `CREATE INDEX IF NOT EXISTS idx_document_approvals_document_id ON document_approvals(document_id)`);
    await run('idx approvals approver', `CREATE INDEX IF NOT EXISTS idx_document_approvals_approver_id ON document_approvals(approver_id)`);

    // 6. RLS
    await run('RLS on document_approvals', `ALTER TABLE document_approvals ENABLE ROW LEVEL SECURITY`);
    await run('RLS policy document_approvals', `
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE tablename = 'document_approvals'
            AND policyname = 'Service role has full access to document_approvals'
        ) THEN
          CREATE POLICY "Service role has full access to document_approvals"
            ON document_approvals FOR ALL USING (auth.role() = 'service_role');
        END IF;
      END $$
    `);

    await pgClient.end();

    console.log('✅ Migration 003 complete. Steps:', steps.length);
    return c.json({ success: true, steps, message: 'Migration 003 applied successfully' });
  } catch (error: any) {
    console.error('❌ Migration 003 failed:', error.message, error.code);
    if (pgClient) { try { await pgClient.end(); } catch {} }
    return c.json({ error: `Migration failed: ${error.message}`, code: error.code }, 500);
  }
});

// Run migration 004 — critical performance indexes
// SECURITY: Gated behind a super-admin session. Running DDL must never be public.
app.post("/make-server-c5b85875/run-migration-004", requireAuth, async (c) => {
  const steps: string[] = [];
  let pgClient: any = null;

  if (c.get('userProfile')?.role !== 'super_admin') {
    return c.json({ error: 'Unauthorized - Super admin access required' }, 403);
  }

  try {
    const dbUrl = Deno.env.get('SUPABASE_DB_URL');
    if (!dbUrl) return c.json({ error: 'SUPABASE_DB_URL not configured' }, 500);

    const pg = await import("npm:pg");
    const { Client } = pg.default ?? pg;
    pgClient = new Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
      query_timeout: 30000,
    });

    await pgClient.connect();

    const run = async (label: string, ddl: string) => {
      try {
        await pgClient.query(ddl);
        steps.push(`✅ ${label}`);
      } catch (e: any) {
        if (e.code === '42701' || e.code === '42P07' || e.code === '42710') {
          steps.push(`⏭️  ${label} (already exists)`);
        } else {
          steps.push(`❌ ${label}: ${e.message}`);
          console.warn(`  ❌ ${label}:`, e.message);
        }
      }
    };

    // sessions.token — used on every authenticated request (~19K lookups)
    await run('idx_sessions_token', `CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`);
    // sessions cleanup
    await run('idx_sessions_expires_at', `CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`);
    await run('idx_sessions_user_id', `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`);

    // documents.created_at — main list query ORDER BY created_at DESC
    await run('idx_documents_created_at', `CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC)`);
    // documents.id is the PK but make sure it exists
    await run('idx_documents_id', `CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_id ON documents(id)`);
    // for role-based filtering pushed to DB
    await run('idx_documents_author_id', `CREATE INDEX IF NOT EXISTS idx_documents_author_id ON documents(author_id)`);
    await run('idx_documents_department', `CREATE INDEX IF NOT EXISTS idx_documents_department ON documents(department)`);
    await run('idx_documents_status', `CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status)`);
    await run('idx_documents_access_level', `CREATE INDEX IF NOT EXISTS idx_documents_access_level ON documents(access_level)`);
    await run('idx_documents_dept_status', `CREATE INDEX IF NOT EXISTS idx_documents_dept_status ON documents(department, status)`);

    // users
    await run('idx_users_email', `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await run('idx_users_role', `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
    await run('idx_users_approval_status', `CREATE INDEX IF NOT EXISTS idx_users_approval_status ON users(approval_status)`);

    // notifications
    await run('idx_notifications_user_id', `CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`);
    await run('idx_notifications_user_read', `CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read)`);

    // audit_logs
    await run('idx_audit_logs_timestamp', `CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC)`);
    await run('idx_audit_logs_user_id', `CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)`);

    // document_history
    await run('idx_document_history_doc_id', `CREATE INDEX IF NOT EXISTS idx_document_history_doc_id ON document_history(document_id)`);

    await pgClient.end();

    console.log('✅ Migration 004 complete. Steps:', steps.length);
    return c.json({ success: true, steps, message: 'Migration 004 (performance indexes) applied successfully' });
  } catch (error: any) {
    console.error('❌ Migration 004 failed:', error.message, error.code);
    if (pgClient) { try { await pgClient.end(); } catch {} }
    return c.json({ error: `Migration failed: ${error.message}`, code: error.code }, 500);
  }
});

// NOTE: The following unauthenticated endpoints were REMOVED as security
// vulnerabilities:
//   - GET  /public-documents      (exposed documents without a session)
//   - GET  /debug-user/:email     (leaked account existence, role, hash preview)
//   - POST /seed-accounts         (created pre-approved admin accounts, no auth)
//   - POST /create-test-account   (anyone could create a super_admin, no auth)
//   - POST /migrate-passwords     (unauthenticated bulk data mutation)
//   - POST /migrate-approvals     (unauthenticated bulk data mutation)
// Account provisioning now happens only through the authenticated signup +
// super-admin approval flow.

// ============ AUTH ROUTES ============

// Login - Creates a session token in SQL with rate limiting and brute force protection
app.post("/make-server-c5b85875/login", rateLimit(10, 60000), async (c) => {
  try {
    console.log('🔐 Login attempt started');
    const { email, password, turnstileToken } = await c.req.json();
    console.log(`🔐 Login request for email: ${email}`);

    // Validate presence and shape before doing any work
    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return c.json({ error: 'Invalid login credentials', message: 'Email and password are required' }, 400);
    }
    if (!validation.email(email)) {
      return c.json({ error: 'Invalid login credentials', message: 'Invalid email or password' }, 401);
    }

    // Brute-force lockout — keyed by IP + email so one attacker can't lock everyone out
    const ipForLockout = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const lockoutKey = `${ipForLockout}:${email.toLowerCase()}`;
    const lockout = loginBruteForceProtection.checkLockout(lockoutKey);
    if (lockout.locked) {
      console.warn(`🔒 Login locked out for ${lockoutKey}, retry in ${lockout.retryAfter}s`);
      return c.json({
        error: 'Too many failed attempts',
        message: `Account temporarily locked due to repeated failed logins. Try again in ${Math.ceil((lockout.retryAfter ?? 900) / 60)} minute(s).`,
        retryAfter: lockout.retryAfter,
      }, 429);
    }

    // Verify Cloudflare Turnstile token (skipped in demo mode)
    const CAPTCHA_ENABLED = false; // Set to true to re-enable for production
    if (CAPTCHA_ENABLED) {
      const secretKey = Deno.env.get('CLOUDFLARE_TURNSTILE_SECRET_KEY');
      if (!secretKey) {
        console.error('❌ CLOUDFLARE_TURNSTILE_SECRET_KEY not configured');
        return c.json({ error: 'Server misconfiguration: CAPTCHA secret not set' }, 500);
      }
      if (!turnstileToken) {
        console.warn('⚠️ Missing Turnstile token in login request');
        return c.json({ error: 'CAPTCHA verification required. Please complete the security check.' }, 400);
      }
      const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'Unknown';
      const turnstileFormData = new FormData();
      turnstileFormData.append('secret', secretKey);
      turnstileFormData.append('response', turnstileToken);
      turnstileFormData.append('remoteip', ip);
      const turnstileRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: turnstileFormData,
      });
      const turnstileData: any = await turnstileRes.json();
      console.log('🛡️ Turnstile verification result:', turnstileData.success);
      if (!turnstileData.success) {
        console.warn('❌ Turnstile verification failed:', turnstileData['error-codes']);
        return c.json({ error: 'CAPTCHA verification failed. Please refresh and try again.' }, 400);
      }
    } else {
      console.log('🛡️ CAPTCHA disabled (demo mode) — skipping Turnstile verification');
    }
    
    const requestInfo = getRequestInfo(c);
    
    // Get user profile from SQL database by email
    console.log(`🔍 Looking up user profile for: ${email}`);
    const userProfile = await db.getUserByEmail(email);
    
    // Use a single generic response for every "bad credentials" case so we never
    // leak whether an account exists or whether a password is configured.
    const invalidCreds = () => {
      loginBruteForceProtection.recordFailedAttempt(lockoutKey);
      return c.json({ error: 'Invalid login credentials', message: 'Invalid email or password' }, 401);
    };

    if (!userProfile) {
      console.error(`❌ User not found: ${email}`);
      return invalidCreds();
    }

    const userId = userProfile.id;
    console.log(`✅ User found: ${userId}`);

    // Get password hash from SQL — treat a missing hash as invalid credentials
    if (!userProfile.password_hash) {
      console.error(`❌ No password hash found for user: ${userId}`);
      return invalidCreds();
    }

    // Verify password
    console.log(`🔐 Verifying password for: ${email}`);
    const isValidPassword = await verifyPassword(password, userProfile.password_hash);
    if (!isValidPassword) {
      console.error(`❌ Invalid password for user: ${email}`);
      return invalidCreds();
    }

    // Successful credential check — clear the failed-attempt counter
    loginBruteForceProtection.resetAttempts(lockoutKey);
    console.log(`✅ Password verified for user: ${email}`);
    
    // Check if account is pending approval
    if (userProfile.approval_status === 'pending') {
      console.log(`⏳ Account pending approval: ${email}`);
      return c.json({ 
        error: 'Account pending approval',
        message: 'Your account is awaiting administrator approval. Please wait for approval before logging in.',
        isPending: true
      }, 403);
    }
    
    // Check if account is rejected
    if (userProfile.approval_status === 'rejected') {
      console.log(`❌ Account rejected: ${email}`);
      return c.json({ 
        error: 'Account access denied',
        message: userProfile.rejection_reason || 'Your account registration was not approved.',
        isRejected: true
      }, 403);
    }
    
    // Check if account is inactive
    if (!userProfile.is_active) {
      console.log(`❌ Account inactive: ${email}`);
      return c.json({ 
        error: 'Account inactive',
        message: 'Your account has been deactivated. Please contact an administrator.',
        isInactive: true
      }, 403);
    }
    
    console.log(`✅ User profile found: ${userProfile.name} (${userProfile.role})`);
    
    // Create custom session token
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Session expires in 7 days
    
    const sessionData = {
      token: sessionToken,
      userId,
      email,
      ipAddress: requestInfo.ipAddress,
      deviceInfo: requestInfo.deviceInfo,
      userAgent: requestInfo.userAgent,
      expiresAt: expiresAt.toISOString(),
    };
    
    // Store session in SQL database
    console.log(`💾 Storing session token: ${sessionToken.substring(0, 8)}...`);
    await db.createSession(sessionData);
    console.log('✅ Session stored successfully');
    
    // Create audit log for login
    await db.createAuditLog({
      userId,
      userName: userProfile.name,
      userEmail: email,
      action: 'USER_LOGIN',
      resourceType: 'session',
      resourceId: sessionToken,
      details: { email },
      ipAddress: requestInfo.ipAddress,
      deviceInfo: requestInfo.deviceInfo,
      userAgent: requestInfo.userAgent,
    });
    
    console.log(`✅ Login successful for ${email}, session created`);
    
    return c.json({ 
      success: true, 
      token: sessionToken,
      user: formatUser(userProfile)
    });
  } catch (error: any) {
    console.error('❌ Login error:', error);
    console.error('❌ Error stack:', error.stack);
    return c.json({ error: `Login failed: ${error.message}` }, 500);
  }
});

// Logout - Invalidate session token in SQL
app.post("/make-server-c5b85875/logout", requireAuth, async (c) => {
  try {
    let sessionToken = c.req.header('X-Session-Token') || c.req.header('x-session-token');
    
    if (!sessionToken) {
      const authHeader = c.req.header('Authorization');
      const token = authHeader?.split(' ')[1];
      if (token && token !== Deno.env.get('SUPABASE_ANON_KEY')) {
        sessionToken = token;
      }
    }
    
    if (sessionToken) {
      // Delete session from SQL database
      await db.deleteSession(sessionToken);
      console.log('✅ Session invalidated');
    }
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Logout error:', error);
    return c.json({ error: `Logout failed: ${error.message}` }, 500);
  }
});

// Register/Sign up - Creates user in SQL with pending approval
app.post("/make-server-c5b85875/signup", rateLimit(5, 300000), async (c) => {
  try {
    const { email, password, name, role = 'staff', department } = await c.req.json();
    
    console.log('📝 Signup request received:', { email, name, role, department });
    
    // Validate input
    if (!validation.email(email)) {
      return c.json({ error: 'Invalid email format' }, 400);
    }
    
    const passwordValidation = validation.password(password);
    if (!passwordValidation.valid) {
      return c.json({ 
        error: 'Password does not meet requirements', 
        details: passwordValidation.errors 
      }, 400);
    }
    
    if (!validation.role(role)) {
      return c.json({ error: 'Invalid role' }, 400);
    }

    // SECURITY: Self-registration must never be able to request a privileged role.
    // Elevated roles (dept_admin, lgu_head, super_admin) can only be assigned by
    // an existing super admin. Anything else is coerced down to 'staff'.
    const SELF_SIGNUP_ROLES = ['staff', 'records_officer', 'public'];
    const requestedRole = SELF_SIGNUP_ROLES.includes(role) ? role : 'staff';

    if (!validation.department(department)) {
      return c.json({ error: 'Invalid department' }, 400);
    }

    // Validate name
    const safeName = validation.sanitizeString(name ?? '', 120);
    if (!safeName || safeName.length < 2) {
      return c.json({ error: 'Name is required (minimum 2 characters)' }, 400);
    }
    
    // Check if user already exists in SQL database
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      console.log('❌ Email already exists:', email);
      return c.json({ error: 'Email already registered. Please login or use a different email.' }, 400);
    }
    
    // Hash password
    const hashedPassword = await hashPassword(password);
    console.log('🔒 Password hashed successfully');
    
    // Generate UUID for user
    const userId = crypto.randomUUID();
    console.log('🆔 Generated user ID:', userId);
    
    // Create user profile in SQL database with pending approval status
    const userProfile = {
      id: userId,
      email,
      password_hash: hashedPassword,
      name: safeName,
      role: requestedRole,
      department,
      // Self-signup never yields elevated clearance
      clearance_level: requestedRole === 'records_officer' ? 1 : 1,
      is_active: false, // Inactive until approved
      approval_status: 'pending', // Pending approval
      created_at: new Date().toISOString(),
    };
    
    await db.createUserWithApproval(userProfile);
    console.log('✅ User created in SQL database with pending approval status');
    
    // Log account creation in audit trail (pass userName from signup form, not from database)
    await db.logAuditTrail({
      userId,
      userName: name, // Use name from signup form
      userEmail: email,
      action: 'account_created',
      resourceType: 'user',
      resourceId: userId,
      details: JSON.stringify({ 
        email, 
        name, 
        role, 
        department,
        approvalStatus: 'pending'
      }),
      ipAddress: c.req.header('x-forwarded-for') || 'Unknown',
      userAgent: c.req.header('user-agent') || 'Unknown',
    });
    
    // Note: User cannot login until approved by super admin
    return c.json({ 
      success: true, 
      message: 'Account created successfully. Please wait for admin approval before logging in.',
      requiresApproval: true,
      userId
    });
  } catch (error: any) {
    console.error('❌ Signup error:', error);
    console.error('❌ Error stack:', error.stack);
    return c.json({ error: `Signup failed: ${error.message}` }, 500);
  }
});

// Get current user profile from SQL
app.get("/make-server-c5b85875/me", requireAuth, async (c) => {
  try {
    const userProfile = c.get('userProfile');
    if (!userProfile) return c.json({ error: 'User profile not found' }, 404);
    return c.json({ user: formatUser(userProfile) });
  } catch (error: any) {
    console.error('Get user profile error:', error);
    return c.json({ error: `Failed to get profile: ${error.message}` }, 500);
  }
});

// ============ DOCUMENT ROUTES ============

// Upload document - Stores in SQL with SHA-256 hashing and version control
app.post("/make-server-c5b85875/documents", requireAuth, async (c) => {
  try {
    const userId = c.get('userId');
    const userProfile = c.get('userProfile');
    const requestInfo = getRequestInfo(c);

    const {
      title, description, tags, department, accessLevel,
      fileData, fileName, fileType, fileSize,
      requiredApprovals, requiredApproverIds, clientFileHash,
    } = await c.req.json();

    // ---- Input validation ----
    const safeTitle = validation.sanitizeString(title ?? '', 300);
    if (!safeTitle || safeTitle.length < 2) {
      return c.json({ error: 'A document title is required (minimum 2 characters)' }, 400);
    }
    if (!department || !validation.department(department)) {
      return c.json({ error: 'A valid department is required' }, 400);
    }
    const resolvedAccessLevel = accessLevel || 'restricted';
    if (!validation.accessLevel(resolvedAccessLevel)) {
      return c.json({ error: 'Invalid access level' }, 400);
    }
    if (fileType && !validation.fileType(fileType)) {
      return c.json({ error: 'Unsupported file type' }, 400);
    }
    const safeDescription = validation.sanitizeString(description ?? '', 5000);
    const safeTags = Array.isArray(tags)
      ? tags.slice(0, 30).map((t: any) => validation.sanitizeString(String(t), 50))
      : [];

    const docId = crypto.randomUUID();

    // Calculate file size if not provided
    let calculatedFileSize = fileSize;
    if (!calculatedFileSize && fileData) {
      try {
        const base64Length = fileData.replace(/^data:.*?;base64,/, '').length;
        calculatedFileSize = Math.floor((base64Length * 3) / 4);
      } catch (e) {
        calculatedFileSize = 0;
      }
    }

    // Enforce max file size (10MB) — base64 in a JSON row does not scale beyond this
    if (calculatedFileSize && !validation.fileSize(calculatedFileSize)) {
      return c.json({ error: 'File exceeds the maximum allowed size (10MB)' }, 400);
    }

    // Compute SHA-256 hash of file data (server-side verification)
    let fileHash = clientFileHash || '';
    if (fileData && !fileHash) {
      fileHash = await hashFileData(fileData);
    }
    console.log(`🔒 Document hash (SHA-256): ${fileHash.substring(0, 16)}...`);

    // Version control: check for existing documents with same file name
    const baseFileName = fileName || 'document';
    const existingVersions = await db.getDocumentsByBaseFileName(baseFileName);

    let versionNumber = 1;
    let parentDocumentId: string | null = null;
    let versionTag = 'v1';
    let documentTitle = safeTitle;
    let baseTitle = safeTitle;

    if (existingVersions.length > 0) {
      // Find the highest version number in the group
      const maxVersion = existingVersions.reduce((max: number, doc: any) => {
        const ver = parseInt((doc.version_tag || 'v1').replace('v', '')) || 1;
        return ver > max ? ver : max;
      }, 1);

      versionNumber = maxVersion + 1;
      versionTag = `v${versionNumber}`;

      // Parent is the first version (no parent_document_id) or the oldest
      const rootDoc = existingVersions.find((d: any) => !d.parent_document_id) || existingVersions[0];
      parentDocumentId = rootDoc.id;

      // Append version tag to title
      baseTitle = safeTitle;
      documentTitle = `${safeTitle} ${versionTag}`;

      console.log(`📁 Version control: Creating ${versionTag} of "${baseFileName}" (parent: ${parentDocumentId})`);
    }

    const document = {
      id: docId,
      title: documentTitle,
      description: safeDescription,
      tags: safeTags,
      department,
      accessLevel: resolvedAccessLevel,
      status: 'draft',
      authorId: userId,
      authorName: userProfile?.name || 'Unknown',
      fileName: baseFileName,
      fileType: fileType || 'application/octet-stream',
      fileSize: calculatedFileSize || 0,
      fileUrl: fileData,
      version: versionNumber,
      isLocked: false,
      // SHA-256 integrity
      fileHash,
      hashAlgorithm: 'SHA-256',
      integrityStatus: 'verified',
      // Multi-approval — use named approver count if list provided
      requiredApprovals: requiredApproverIds?.length > 0
        ? requiredApproverIds.length
        : Math.max(1, parseInt(requiredApprovals) || 1),
      currentApprovals: 0,
      // Version control
      parentDocumentId,
      versionTag,
      baseTitle,
      baseFileName,
      // Store named approver IDs in metadata for per-person tracking
      metadata: { requiredApproverIds: requiredApproverIds || [] },
    };

    await db.createDocument(document);

    // Create audit log
    await db.createAuditLog({
      userId,
      userName: userProfile?.name,
      userEmail: userProfile?.email,
      action: 'DOCUMENT_CREATED',
      resourceType: 'document',
      resourceId: docId,
      details: {
        title: documentTitle,
        department,
        versionTag,
        fileHash: fileHash.substring(0, 16) + '...',
        requiredApprovals: document.requiredApprovals,
      },
      ipAddress: requestInfo.ipAddress,
      deviceInfo: requestInfo.deviceInfo,
      userAgent: requestInfo.userAgent,
    });

    return c.json({ success: true, document: formatDocument(await db.getDocument(docId)) });
  } catch (error: any) {
    console.error('Document upload error:', error);
    return c.json({ error: `Upload failed: ${error.message}` }, 500);
  }
});

// Get all documents (with filtering) from SQL
app.get("/make-server-c5b85875/documents", requireAuth, async (c) => {
  try {
    const userId = c.get('userId');
    const userProfile = c.get('userProfile');
    // Server-side filtered query — avoids fetching all rows for non-admin users
    const documents = await db.getDocumentsForUser(userId, userProfile);
    return c.json({ documents: documents.map(formatDocument) });
  } catch (error: any) {
    console.error('Get documents error:', error);
    return c.json({ error: `Failed to get documents: ${error.message}` }, 500);
  }
});

// Get single document from SQL
app.get("/make-server-c5b85875/documents/:id", requireAuth, async (c) => {
  try {
    const docId = c.req.param('id');
    const userId = c.get('userId');
    const userProfile = c.get('userProfile');

    if (!validation.uuid(docId)) {
      return c.json({ error: 'Invalid document id' }, 400);
    }

    const document = await db.getDocument(docId);

    if (!document) {
      return c.json({ error: 'Document not found' }, 404);
    }

    if (!canReadDocument(document, userId, userProfile)) {
      return c.json({ error: 'Access denied' }, 403);
    }

    // Create audit log for document access
    await db.createAuditLog({
      userId,
      userName: userProfile?.name,
      userEmail: userProfile?.email,
      action: 'DOCUMENT_VIEWED',
      resourceType: 'document',
      resourceId: docId,
    });

    return c.json({ document: formatDocument(document) });
  } catch (error: any) {
    console.error('Get document error:', error);
    return c.json({ error: `Failed to get document: ${error.message}` }, 500);
  }
});

// Update document in SQL
app.put("/make-server-c5b85875/documents/:id", requireAuth, async (c) => {
  try {
    const docId = c.req.param('id');
    const userId = c.get('userId');
    const userProfile = c.get('userProfile');
    const requestInfo = getRequestInfo(c);

    if (!validation.uuid(docId)) {
      return c.json({ error: 'Invalid document id' }, 400);
    }

    const document = await db.getDocument(docId);

    if (!document) {
      return c.json({ error: 'Document not found' }, 404);
    }

    // Check if document is locked
    if (document.is_locked) {
      return c.json({ error: 'Document is locked and cannot be edited' }, 403);
    }

    // A document already in the approval pipeline can't be edited in place —
    // editing must go through re-submission so approvals aren't silently bypassed.
    if (document.status === 'approved' || document.status === 'pending_approval') {
      return c.json({ error: `Documents with status '${document.status}' cannot be edited` }, 403);
    }

    // Check edit permission
    const canEdit =
      document.author_id === userId ||
      userProfile?.role === 'super_admin' ||
      (userProfile?.role === 'dept_admin' && document.department === userProfile.department);

    if (!canEdit) {
      return c.json({ error: 'No permission to edit this document' }, 403);
    }

    const body = await c.req.json();

    // SECURITY: whitelist editable fields. The client must never be able to set
    // status, approval counts, ownership, locking, hashes, or version metadata —
    // those are controlled only by the approval workflow.
    const updates: any = {};
    if (typeof body.title === 'string') updates.title = validation.sanitizeString(body.title, 300);
    if (typeof body.description === 'string') updates.description = validation.sanitizeString(body.description, 5000);
    if (Array.isArray(body.tags)) {
      updates.tags = body.tags.slice(0, 30).map((t: any) => validation.sanitizeString(String(t), 50));
    }
    if (typeof body.accessLevel === 'string') {
      if (!validation.accessLevel(body.accessLevel)) {
        return c.json({ error: 'Invalid access level' }, 400);
      }
      updates.access_level = body.accessLevel;
    }
    if (typeof body.department === 'string') {
      if (!validation.department(body.department)) {
        return c.json({ error: 'Invalid department' }, 400);
      }
      updates.department = body.department;
    }

    if (Object.keys(updates).length === 0) {
      return c.json({ error: 'No editable fields provided' }, 400);
    }

    updates.updated_at = new Date().toISOString();

    // Save to document history
    await db.createDocumentHistory({
      documentId: docId,
      userId,
      userName: userProfile?.name,
      action: 'updated', // Changed from 'DOCUMENT_UPDATED' to match CHECK constraint
      previousStatus: document.status,
      newStatus: document.status,
      metadata: updates,
    });

    // Update document with incremented version
    const updatedDoc = await db.updateDocument(docId, {
      ...updates,
      version: document.version + 1,
    });

    // Audit log
    await db.createAuditLog({
      userId,
      userName: userProfile?.name,
      userEmail: userProfile?.email,
      action: 'DOCUMENT_UPDATED',
      resourceType: 'document',
      resourceId: docId,
      details: updates,
      ipAddress: requestInfo.ipAddress,
      deviceInfo: requestInfo.deviceInfo,
      userAgent: requestInfo.userAgent,
    });
    
    return c.json({ success: true, document: formatDocument(updatedDoc) });
  } catch (error: any) {
    console.error('Update document error:', error);
    return c.json({ error: `Update failed: ${error.message}` }, 500);
  }
});

// Submit document for approval
app.post("/make-server-c5b85875/documents/:id/submit", requireAuth, async (c) => {
  try {
    const docId = c.req.param('id');
    const userId = c.get('userId');
    const userProfile = c.get('userProfile');
    const requestInfo = getRequestInfo(c);

    if (!validation.uuid(docId)) {
      return c.json({ error: 'Invalid document id' }, 400);
    }

    const document = await db.getDocument(docId);

    if (!document) {
      return c.json({ error: 'Document not found' }, 404);
    }

    if (document.author_id !== userId) {
      return c.json({ error: 'Only the author can submit the document' }, 403);
    }

    // Only draft or rejected documents may be (re)submitted for approval
    if (document.status !== 'draft' && document.status !== 'rejected') {
      return c.json({ error: `A document with status '${document.status}' cannot be submitted` }, 400);
    }

    // Update document status to pending_approval (not submitted)
    const updatedDoc = await db.updateDocument(docId, {
      status: 'pending_approval',
      updated_at: new Date().toISOString(),
    });
    
    // Document history
    await db.createDocumentHistory({
      documentId: docId,
      userId,
      userName: userProfile?.name,
      action: 'submitted', // Changed from 'DOCUMENT_SUBMITTED' to match CHECK constraint
      previousStatus: document.status,
      newStatus: 'pending_approval',
    });
    
    // Create notifications — send to named required approvers if set, else to all eligible
    const allUsers = await db.getAllUsers();
    const requiredApproverIds: string[] = document.metadata?.requiredApproverIds || [];
    const notifyTargets = requiredApproverIds.length > 0
      ? allUsers.filter((u: any) => requiredApproverIds.includes(u.id))
      : allUsers.filter((u: any) =>
          (u.role === 'dept_admin' && u.department === document.department) ||
          u.role === 'lgu_head' ||
          u.role === 'super_admin' ||
          (u.role === 'records_officer' && u.department === document.department)
        );

    for (const approver of notifyTargets) {
      await db.createNotification({
        userId: approver.id,
        type: 'document_submitted',
        title: 'New Document for Approval',
        message: `${userProfile?.name} submitted "${document.title}" for your approval`,
        documentId: docId,
        documentTitle: document.title,
        fromUserId: userId,
        fromUserName: userProfile?.name,
      });
    }
    
    // Audit log
    await db.createAuditLog({
      userId,
      userName: userProfile?.name,
      userEmail: userProfile?.email,
      action: 'DOCUMENT_SUBMITTED',
      resourceType: 'document',
      resourceId: docId,
      ipAddress: requestInfo.ipAddress,
      deviceInfo: requestInfo.deviceInfo,
      userAgent: requestInfo.userAgent,
    });
    
    return c.json({ success: true, document: formatDocument(updatedDoc) });
  } catch (error: any) {
    console.error('Submit document error:', error);
    return c.json({ error: `Submit failed: ${error.message}` }, 500);
  }
});

// Approve document (multi-approval workflow)
app.post("/make-server-c5b85875/documents/:id/approve", requireAuth, async (c) => {
  try {
    const docId = c.req.param('id');
    const userId = c.get('userId');
    const userProfile = c.get('userProfile');
    const requestInfo = getRequestInfo(c);
    const body = await c.req.json().catch(() => ({}));
    const comments = validation.sanitizeString(body?.comments ?? '', 1000);

    if (!validation.uuid(docId)) {
      return c.json({ error: 'Invalid document id' }, 400);
    }

    const document = await db.getDocument(docId);

    if (!document) {
      return c.json({ error: 'Document not found' }, 404);
    }

    // Only documents that are actually awaiting approval can be approved
    if (document.status !== 'pending_approval') {
      return c.json({ error: `A document with status '${document.status}' cannot be approved` }, 400);
    }

    // Check approval permission
    const isSuperAdmin = userProfile?.role === 'super_admin';
    const isLguHead = userProfile?.role === 'lgu_head';
    const isDeptAdmin = userProfile?.role === 'dept_admin' && document.department === userProfile.department;
    const isRecordsOfficer = userProfile?.role === 'records_officer' && document.department === userProfile.department;
    const canApprove = isSuperAdmin || isLguHead || isDeptAdmin || isRecordsOfficer;

    if (!canApprove) {
      const userRole = userProfile?.role ?? 'unknown';
      const userDept = userProfile?.department ?? 'unknown';
      const docDept = document.department;
      let reason = `Role '${userRole}' is not authorized to approve documents`;
      if ((userRole === 'dept_admin' || userRole === 'records_officer') && userDept !== docDept) {
        reason = `You can only approve documents from your department (${userDept}). This document belongs to '${docDept}'`;
      }
      console.warn(`❌ Approval denied for user ${userProfile?.email}: ${reason}`);
      return c.json({ error: reason }, 403);
    }

    // If the document has named required approvers, enforce the list
    const requiredApproverIds: string[] = document.metadata?.requiredApproverIds || [];

    // Debug logging
    console.log('[Approval Check] User ID:', userId, 'Type:', typeof userId);
    console.log('[Approval Check] Required Approver IDs:', requiredApproverIds);
    console.log('[Approval Check] Required Approver IDs Types:', requiredApproverIds.map(id => typeof id));

    // Convert both to strings for comparison to handle any type mismatches
    const userIdStr = String(userId);
    const requiredApproverIdsStr = requiredApproverIds.map(id => String(id));

    if (requiredApproverIdsStr.length > 0 && !requiredApproverIdsStr.includes(userIdStr)) {
      console.log('[Approval Check] User NOT in approvers list');
      console.log('[Approval Check] Looking for:', userIdStr);
      console.log('[Approval Check] In list:', requiredApproverIdsStr);
      return c.json({
        error: 'You are not in the designated approvers list for this document. Only the selected approvers can sign off on it.',
      }, 403);
    }

    console.log('[Approval Check] User IS in approvers list or no specific approvers required');

    // Check if this approver has already acted
    const existingAction = await db.hasApproverActed(docId, userId);
    if (existingAction) {
      return c.json({
        error: `You have already ${existingAction.action} this document`,
      }, 409);
    }

    // Record individual approval
    await db.createDocumentApproval({
      documentId: docId,
      approverId: userId,
      approverName: userProfile?.name,
      approverRole: userProfile?.role,
      approverDepartment: userProfile?.department,
      action: 'approved',
      comments,
    });

    // Count total approvals for this document
    const allApprovals = await db.getDocumentApprovals(docId);
    const approvalCount = allApprovals.filter((a: any) => a.action === 'approved').length;
    const requiredApprovals = document.required_approvals ?? 1;
    const isFullyApproved = approvalCount >= requiredApprovals;

    // Build update payload
    const updatePayload: any = {
      current_approvals: approvalCount,
    };

    if (isFullyApproved) {
      updatePayload.status = 'approved';
      updatePayload.approved_at = new Date().toISOString();
      updatePayload.approved_by = userId;
      updatePayload.is_locked = true;
    }

    const updatedDoc = await db.updateDocument(docId, updatePayload);

    // Document history entry
    await db.createDocumentHistory({
      documentId: docId,
      userId,
      userName: userProfile?.name,
      action: isFullyApproved ? 'approved' : 'updated',
      previousStatus: document.status,
      newStatus: isFullyApproved ? 'approved' : document.status,
      comments: isFullyApproved
        ? `Final approval by ${userProfile?.name} (${approvalCount}/${requiredApprovals} approvals)`
        : `Partial approval by ${userProfile?.name} (${approvalCount}/${requiredApprovals} approvals)`,
      metadata: { approvalCount, requiredApprovals, approverRole: userProfile?.role },
    });

    // Notify author
    if (isFullyApproved) {
      await db.createNotification({
        userId: document.author_id,
        type: 'document_approved',
        title: 'Document Fully Approved',
        message: `Your document "${document.title}" has received all ${requiredApprovals} required approval(s) and is now approved.`,
        documentId: docId,
        documentTitle: document.title,
        fromUserId: userId,
        fromUserName: userProfile?.name,
      });
    } else {
      await db.createNotification({
        userId: document.author_id,
        type: 'info',
        title: 'Document Partially Approved',
        message: `"${document.title}" received approval ${approvalCount}/${requiredApprovals} from ${userProfile?.name}. Awaiting more approvals.`,
        documentId: docId,
        documentTitle: document.title,
        fromUserId: userId,
        fromUserName: userProfile?.name,
      });
    }

    // Audit log
    await db.createAuditLog({
      userId,
      userName: userProfile?.name,
      userEmail: userProfile?.email,
      action: isFullyApproved ? 'DOCUMENT_APPROVED' : 'DOCUMENT_PARTIALLY_APPROVED',
      resourceType: 'document',
      resourceId: docId,
      details: { approvalCount, requiredApprovals, isFullyApproved, comments },
      ipAddress: requestInfo.ipAddress,
      deviceInfo: requestInfo.deviceInfo,
      userAgent: requestInfo.userAgent,
    });

    return c.json({
      success: true,
      document: formatDocument(updatedDoc),
      approvalCount,
      requiredApprovals,
      isFullyApproved,
    });
  } catch (error: any) {
    console.error('Approve document error:', error);
    return c.json({ error: `Approval failed: ${error.message}` }, 500);
  }
});

// Reject document
app.post("/make-server-c5b85875/documents/:id/reject", requireAuth, async (c) => {
  try {
    const docId = c.req.param('id');
    const userId = c.get('userId');
    const userProfile = c.get('userProfile');
    const requestInfo = getRequestInfo(c);
    
    const body = await c.req.json().catch(() => ({}));
    const reason = validation.sanitizeString(body?.reason ?? '', 1000);

    if (!validation.uuid(docId)) {
      return c.json({ error: 'Invalid document id' }, 400);
    }
    if (!reason || reason.length < 3) {
      return c.json({ error: 'A rejection reason is required (minimum 3 characters)' }, 400);
    }

    const document = await db.getDocument(docId);

    if (!document) {
      return c.json({ error: 'Document not found' }, 404);
    }

    // Check rejection permission
    const canReject =
      userProfile?.role === 'super_admin' ||
      userProfile?.role === 'lgu_head' ||
      (userProfile?.role === 'dept_admin' && document.department === userProfile.department) ||
      (userProfile?.role === 'records_officer' && document.department === userProfile.department);

    if (!canReject) {
      const userRole = userProfile?.role ?? 'unknown';
      const userDept = userProfile?.department ?? 'unknown';
      let reason = `Role '${userRole}' is not authorized to reject documents`;
      if ((userRole === 'dept_admin' || userRole === 'records_officer') && userDept !== document.department) {
        reason = `You can only reject documents from your department (${userDept})`;
      }
      return c.json({ error: reason }, 403);
    }
    
    // Update document status
    const updatedDoc = await db.updateDocument(docId, {
      status: 'rejected',
      rejected_at: new Date().toISOString(),
      rejected_by: userId,
      rejection_reason: reason,
    });
    
    // Document history
    await db.createDocumentHistory({
      documentId: docId,
      userId,
      userName: userProfile?.name,
      action: 'rejected', // Changed from 'DOCUMENT_REJECTED' to match CHECK constraint
      previousStatus: document.status,
      newStatus: 'rejected',
      comments: reason,
    });
    
    // Notify the author
    await db.createNotification({
      userId: document.author_id,
      type: 'document_rejected',
      title: 'Document Rejected',
      message: `Your document "${document.title}" was rejected by ${userProfile?.name}. Reason: ${reason}`,
      documentId: docId,
      documentTitle: document.title,
      fromUserId: userId,
      fromUserName: userProfile?.name,
      metadata: { reason },
    });
    
    // Audit log
    await db.createAuditLog({
      userId,
      userName: userProfile?.name,
      userEmail: userProfile?.email,
      action: 'DOCUMENT_REJECTED',
      resourceType: 'document',
      resourceId: docId,
      details: { reason },
      ipAddress: requestInfo.ipAddress,
      deviceInfo: requestInfo.deviceInfo,
      userAgent: requestInfo.userAgent,
    });
    
    return c.json({ success: true, document: formatDocument(updatedDoc) });
  } catch (error: any) {
    console.error('Reject document error:', error);
    return c.json({ error: `Rejection failed: ${error.message}` }, 500);
  }
});

// Download document
app.get("/make-server-c5b85875/documents/:id/download", requireAuth, async (c) => {
  try {
    const docId = c.req.param('id');
    const userId = c.get('userId');
    const userProfile = c.get('userProfile');

    if (!validation.uuid(docId)) {
      return c.json({ error: 'Invalid document id' }, 400);
    }

    const document = await db.getDocument(docId);

    if (!document) {
      return c.json({ error: 'Document not found' }, 404);
    }

    if (!canReadDocument(document, userId, userProfile)) {
      return c.json({ error: 'Access denied' }, 403);
    }

    // Create audit log for download
    await db.createAuditLog({
      userId,
      userName: userProfile?.name,
      userEmail: userProfile?.email,
      action: 'DOCUMENT_DOWNLOADED',
      resourceType: 'document',
      resourceId: docId,
    });
    
    // Return file data (in production, return signed URL from Supabase Storage)
    return c.json({ 
      success: true,
      fileData: document.file_url || document.file_data,
      fileName: document.file_name,
      fileType: document.file_type,
    });
  } catch (error: any) {
    console.error('Download document error:', error);
    return c.json({ error: `Download failed: ${error.message}` }, 500);
  }
});

// Verify document integrity (compare hash)
app.post("/make-server-c5b85875/documents/:id/verify-hash", requireAuth, async (c) => {
  try {
    const docId = c.req.param('id');
    const userId = c.get('userId');
    const userProfile = c.get('userProfile');
    const { fileHash } = await c.req.json();

    if (!validation.uuid(docId)) {
      return c.json({ error: 'Invalid document id' }, 400);
    }

    const document = await db.getDocument(docId);
    if (!document) {
      return c.json({ error: 'Document not found' }, 404);
    }

    if (!canReadDocument(document, userId, userProfile)) {
      return c.json({ error: 'Access denied' }, 403);
    }

    if (!document.file_hash) {
      return c.json({
        verified: false,
        integrityStatus: 'unverified',
        message: 'No hash stored for this document',
      });
    }

    const isVerified = fileHash === document.file_hash;
    const integrityStatus = isVerified ? 'verified' : 'modified';

    // Update integrity status in database
    await db.updateDocumentIntegrity(docId, integrityStatus);

    // Audit log
    await db.createAuditLog({
      userId,
      userName: userProfile?.name,
      userEmail: userProfile?.email,
      action: isVerified ? 'DOCUMENT_HASH_VERIFIED' : 'DOCUMENT_INTEGRITY_FAILED',
      resourceType: 'document',
      resourceId: docId,
      details: { integrityStatus, storedHash: document.file_hash.substring(0, 16) + '...' },
    });

    return c.json({
      verified: isVerified,
      integrityStatus,
      storedHash: document.file_hash,
      providedHash: fileHash,
      message: isVerified
        ? 'Document integrity verified — file has not been modified'
        : 'Document hash mismatch — file may have been modified',
    });
  } catch (error: any) {
    console.error('Verify hash error:', error);
    return c.json({ error: `Verification failed: ${error.message}` }, 500);
  }
});

// Get document approvals (multi-approval progress) — includes named required approvers
app.get("/make-server-c5b85875/documents/:id/approvals", requireAuth, async (c) => {
  try {
    const docId = c.req.param('id');
    const userId = c.get('userId');
    const userProfile = c.get('userProfile');

    if (!validation.uuid(docId)) {
      return c.json({ error: 'Invalid document id' }, 400);
    }

    const document = await db.getDocument(docId);
    if (!document) {
      return c.json({ error: 'Document not found' }, 404);
    }

    if (!canReadDocument(document, userId, userProfile)) {
      return c.json({ error: 'Access denied' }, 403);
    }

    const [approvals, allUsers] = await Promise.all([
      db.getDocumentApprovals(docId),
      db.getAllUsers(),
    ]);

    // Build required approvers list with names from stored IDs
    const requiredApproverIds: string[] = document.metadata?.requiredApproverIds || [];
    const requiredApprovers = requiredApproverIds.map((rid: string) => {
      const u = allUsers.find((u: any) => u.id === rid);
      const acted = approvals.find((a: any) => a.approver_id === rid);
      return {
        id: rid,
        name: u?.name ?? 'Unknown User',
        role: u?.role ?? '',
        department: u?.department ?? '',
        status: acted ? acted.action : 'pending',
        comments: acted?.comments ?? null,
        actedAt: acted?.created_at ?? null,
      };
    });

    const approvedCount = requiredApproverIds.length > 0
      ? requiredApprovers.filter(r => r.status === 'approved').length
      : approvals.filter((a: any) => a.action === 'approved').length;

    return c.json({
      approvals: approvals.map((a: any) => ({
        id: a.id,
        approverId: a.approver_id,
        approverName: a.approver_name,
        approverRole: a.approver_role,
        approverDepartment: a.approver_department,
        action: a.action,
        comments: a.comments,
        createdAt: a.created_at,
      })),
      requiredApprovers,
      currentApprovals: approvedCount,
      requiredApprovals: document.required_approvals ?? 1,
      hasNamedApprovers: requiredApproverIds.length > 0,
    });
  } catch (error: any) {
    console.error('Get approvals error:', error);
    return c.json({ error: `Failed to get approvals: ${error.message}` }, 500);
  }
});

// Get available approvers (users who can approve documents)
app.get("/make-server-c5b85875/users/approvers", requireAuth, async (c) => {
  try {
    const allUsers = await db.getAllUsers();
    const approvers = allUsers.filter((u: any) =>
      ['super_admin', 'lgu_head', 'dept_admin', 'records_officer'].includes(u.role) &&
      u.is_active &&
      u.approval_status === 'approved'
    );
    return c.json({
      approvers: approvers.map((u: any) => ({
        id: u.id,
        name: u.name,
        role: u.role,
        department: u.department,
        email: u.email,
      })),
    });
  } catch (error: any) {
    console.error('Get approvers error:', error);
    return c.json({ error: `Failed to get approvers: ${error.message}` }, 500);
  }
});

// Get document version history
app.get("/make-server-c5b85875/documents/:id/versions", requireAuth, async (c) => {
  try {
    const docId = c.req.param('id');
    const userId = c.get('userId');
    const userProfile = c.get('userProfile');

    if (!validation.uuid(docId)) {
      return c.json({ error: 'Invalid document id' }, 400);
    }

    const document = await db.getDocument(docId);
    if (!document) {
      return c.json({ error: 'Document not found' }, 404);
    }
    if (!canReadDocument(document, userId, userProfile)) {
      return c.json({ error: 'Access denied' }, 403);
    }

    const versions = await db.getDocumentVersions(docId);

    return c.json({
      versions: versions.map((v: any) => ({
        id: v.id,
        title: v.title,
        version: v.version,
        versionTag: v.version_tag ?? 'v1',
        fileSize: v.file_size,
        fileHash: v.file_hash,
        status: v.status,
        createdAt: v.created_at,
        authorName: v.author_name,
        parentDocumentId: v.parent_document_id,
      })),
    });
  } catch (error: any) {
    console.error('Get versions error:', error);
    return c.json({ error: `Failed to get versions: ${error.message}` }, 500);
  }
});

// ============ NOTIFICATION ROUTES ============

// Get notifications from SQL
app.get("/make-server-c5b85875/notifications", requireAuth, async (c) => {
  try {
    const userId = c.get('userId');
    const notifications = await db.getNotifications(userId, 50);
    
    return c.json({ 
      notifications: notifications.map(formatNotification),
      unreadCount: notifications.filter((n: any) => !n.is_read).length,
    });
  } catch (error: any) {
    console.error('Get notifications error:', error);
    return c.json({ error: `Failed to get notifications: ${error.message}` }, 500);
  }
});

// Mark notification as read in SQL
app.post("/make-server-c5b85875/notifications/:id/read", requireAuth, async (c) => {
  try {
    const notificationId = c.req.param('id');
    const userId = c.get('userId');
    
    // Verify notification belongs to user
    const notifications = await db.getNotifications(userId);
    const notification = notifications.find((n: any) => n.id === notificationId);
    
    if (!notification) {
      return c.json({ error: 'Notification not found or access denied' }, 404);
    }
    
    await db.markNotificationAsRead(notificationId);
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Mark notification read error:', error);
    return c.json({ error: `Failed to mark notification as read: ${error.message}` }, 500);
  }
});

// Mark all notifications as read in SQL
app.post("/make-server-c5b85875/notifications/read-all", requireAuth, async (c) => {
  try {
    const userId = c.get('userId');
    await db.markAllNotificationsAsRead(userId);
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Mark all notifications read error:', error);
    return c.json({ error: `Failed to mark all notifications as read: ${error.message}` }, 500);
  }
});

// ============ USER MANAGEMENT ROUTES ============

// Change password
app.post("/make-server-c5b85875/change-password", requireAuth, async (c) => {
  try {
    const userId = c.get('userId');
    const { currentPassword, newPassword } = await c.req.json();

    const userProfile = c.get('userProfile');
    if (!userProfile) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Validate inputs
    if (!currentPassword || typeof currentPassword !== 'string' ||
        !newPassword || typeof newPassword !== 'string') {
      return c.json({ error: 'Current and new password are required' }, 400);
    }

    // Enforce password strength on the new password
    const strength = validation.password(newPassword);
    if (!strength.valid) {
      return c.json({ error: 'New password does not meet requirements', details: strength.errors }, 400);
    }

    // Verify the current password against the SQL hash — this is the single
    // source of truth for auth (the app does NOT use Supabase Auth passwords).
    if (!userProfile.password_hash) {
      return c.json({ error: 'Current password is incorrect' }, 401);
    }
    const currentValid = await verifyPassword(currentPassword, userProfile.password_hash);
    if (!currentValid) {
      return c.json({ error: 'Current password is incorrect' }, 401);
    }

    // Reject no-op changes
    if (await verifyPassword(newPassword, userProfile.password_hash)) {
      return c.json({ error: 'New password must be different from the current password' }, 400);
    }

    // Hash and persist the new password in SQL
    const newHash = await hashPassword(newPassword);
    await db.updateUser(userId, { password_hash: newHash });

    // Invalidate all other sessions for this user so a stolen session can't persist
    try {
      const sessions = await db.getUserSessions(userId);
      const currentToken = c.req.header('X-Session-Token') || c.req.header('x-session-token');
      await Promise.all(
        sessions
          .filter((s: any) => s.token !== currentToken)
          .map((s: any) => db.deleteSession(s.token))
      );
    } catch (e) {
      console.warn('Failed to revoke other sessions after password change:', e);
    }

    // Audit log
    await db.createAuditLog({
      userId,
      userName: userProfile.name,
      userEmail: userProfile.email,
      action: 'PASSWORD_CHANGED',
      resourceType: 'user',
      resourceId: userId,
    });
    
    return c.json({ success: true, message: 'Password updated successfully' });
  } catch (error: any) {
    console.error('Change password error:', error);
    return c.json({ error: `Password change failed: ${error.message}` }, 500);
  }
});

// Update user name in SQL
app.post("/make-server-c5b85875/update-name", requireAuth, async (c) => {
  try {
    const userId = c.get('userId');
    const { name } = await c.req.json();

    if (!name || name.trim().length === 0) {
      return c.json({ error: 'Name cannot be empty' }, 400);
    }

    const userProfile = c.get('userProfile');
    const updatedUser = await db.updateUser(userId, { name: name.trim() });

    db.createAuditLog({
      userId,
      userName: name,
      userEmail: updatedUser.email ?? userProfile?.email,
      action: 'NAME_UPDATED',
      resourceType: 'user',
      resourceId: userId,
      details: { newName: name },
    });
    
    return c.json({ success: true, user: formatUser(updatedUser) });
  } catch (error: any) {
    console.error('Update name error:', error);
    return c.json({ error: `Name update failed: ${error.message}` }, 500);
  }
});

// ============ ADMIN ROUTES ============

// Get audit logs from SQL (admin only)
app.get("/make-server-c5b85875/audit-logs", requireAuth, async (c) => {
  try {
    const userId = c.get('userId');
    const userProfile = c.get('userProfile');
    
    // Only admins can view audit logs
    if (!['super_admin', 'lgu_head', 'dept_admin'].includes(userProfile?.role)) {
      return c.json({ error: 'Unauthorized - Admin access required' }, 403);
    }
    
    const logs = await db.getAuditLogs(200);
    
    // Format logs to camelCase
    const formattedLogs = logs.map((log: any) => ({
      id: log.id,
      userId: log.user_id,
      userName: log.user_name,
      userEmail: log.user_email,
      action: log.action,
      resourceType: log.resource_type,
      resourceId: log.resource_id,
      details: log.details,
      ipAddress: log.ip_address,
      deviceInfo: log.device_info,
      userAgent: log.user_agent,
      status: log.status,
      timestamp: log.timestamp,
    }));
    
    return c.json({ logs: formattedLogs });
  } catch (error: any) {
    console.error('Get audit logs error:', error);
    return c.json({ error: `Failed to get audit logs: ${error.message}` }, 500);
  }
});

// Get users from SQL (admin only)
app.get("/make-server-c5b85875/users", requireAuth, async (c) => {
  try {
    const userId = c.get('userId');
    const userProfile = c.get('userProfile');
    
    // Only admins can view all users
    if (!['super_admin', 'lgu_head', 'dept_admin'].includes(userProfile?.role)) {
      return c.json({ error: 'Unauthorized - Admin access required' }, 403);
    }
    
    const users = await db.getAllUsers();
    
    // Format users - all data is now in SQL
    const formattedUsers = users.map((u: any) => formatUser(u));
    
    console.log(`📊 Returning ${formattedUsers.length} users to admin`);
    console.log(`⏳ Pending users: ${formattedUsers.filter(u => u.approvalStatus === 'pending').length}`);
    
    return c.json({ users: formattedUsers });
  } catch (error: any) {
    console.error('Get users error:', error);
    return c.json({ error: `Failed to get users: ${error.message}` }, 500);
  }
});

// Approve user account (super admin only)
app.post("/make-server-c5b85875/users/:id/approve", requireAuth, async (c) => {
  try {
    const targetUserId = c.req.param('id');
    const approverId = c.get('userId');
    const approverProfile = c.get('userProfile');
    const requestInfo = getRequestInfo(c);
    
    // Only super admin can approve users
    if (approverProfile?.role !== 'super_admin') {
      return c.json({ error: 'Unauthorized - Super admin access required' }, 403);
    }

    if (!validation.uuid(targetUserId)) {
      return c.json({ error: 'Invalid user id' }, 400);
    }

    // Approve the user
    const approvedUser = await db.approveUser(targetUserId, approverId);
    
    // Create notification for the approved user
    await db.createNotification({
      userId: targetUserId,
      type: 'success',
      title: 'Account Approved',
      message: `Your account was approved by ${approverProfile.name}. You can now log in to the system.`,
      fromUserId: approverId,
      fromUserName: approverProfile.name,
    });
    
    // Audit log
    await db.createAuditLog({
      userId: approverId,
      userName: approverProfile.name,
      userEmail: approverProfile.email,
      action: 'USER_APPROVED',
      resourceType: 'user',
      resourceId: targetUserId,
      details: { approvedUserEmail: approvedUser.email },
      ipAddress: requestInfo.ipAddress,
      deviceInfo: requestInfo.deviceInfo,
      userAgent: requestInfo.userAgent,
    });
    
    return c.json({ success: true, message: 'User account approved successfully' });
  } catch (error: any) {
    console.error('Approve user error:', error);
    return c.json({ error: `Failed to approve user: ${error.message}` }, 500);
  }
});

// Reject user account (super admin only)
app.post("/make-server-c5b85875/users/:id/reject", requireAuth, async (c) => {
  try {
    const targetUserId = c.req.param('id');
    const rejecterId = c.get('userId');
    const rejecterProfile = c.get('userProfile');
    const requestInfo = getRequestInfo(c);
    
    const body = await c.req.json().catch(() => ({}));
    const reason = validation.sanitizeString(body?.reason ?? '', 1000);

    // Only super admin can reject users
    if (rejecterProfile?.role !== 'super_admin') {
      return c.json({ error: 'Unauthorized - Super admin access required' }, 403);
    }

    if (!validation.uuid(targetUserId)) {
      return c.json({ error: 'Invalid user id' }, 400);
    }

    // Reject the user
    const rejectedUser = await db.rejectUser(targetUserId, rejecterId, reason);
    
    // Create notification for the rejected user
    await db.createNotification({
      userId: targetUserId,
      type: 'warning',
      title: 'Account Rejected',
      message: `Your account registration was rejected by ${rejecterProfile.name}. Reason: ${reason || 'No reason provided'}`,
      fromUserId: rejecterId,
      fromUserName: rejecterProfile.name,
      metadata: { reason },
    });
    
    // Audit log
    await db.createAuditLog({
      userId: rejecterId,
      userName: rejecterProfile.name,
      userEmail: rejecterProfile.email,
      action: 'USER_REJECTED',
      resourceType: 'user',
      resourceId: targetUserId,
      details: { rejectedUserEmail: rejectedUser.email, reason },
      ipAddress: requestInfo.ipAddress,
      deviceInfo: requestInfo.deviceInfo,
      userAgent: requestInfo.userAgent,
    });
    
    return c.json({ success: true, message: 'User account rejected' });
  } catch (error: any) {
    console.error('Reject user error:', error);
    return c.json({ error: `Failed to reject user: ${error.message}` }, 500);
  }
});

// Delete user account (super admin only)
app.delete("/make-server-c5b85875/users/:id", requireAuth, async (c) => {
  try {
    const targetUserId = c.req.param('id');
    const actorId = c.get('userId');
    const actorProfile = c.get('userProfile');
    const requestInfo = getRequestInfo(c);

    // Only super admin can delete users
    if (actorProfile?.role !== 'super_admin') {
      return c.json({ error: 'Unauthorized - Super admin access required' }, 403);
    }

    // Validate the id
    if (!validation.uuid(targetUserId)) {
      return c.json({ error: 'Invalid user id' }, 400);
    }

    // Prevent a super admin from deleting their own account
    if (targetUserId === actorId) {
      return c.json({ error: 'You cannot delete your own account' }, 400);
    }

    const target = await db.getUser(targetUserId);
    if (!target) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Guard the last super admin — never allow the system to be left without one
    if (target.role === 'super_admin') {
      const allUsers = await db.getAllUsers();
      const remainingSuperAdmins = allUsers.filter(
        (u: any) => u.role === 'super_admin' && u.id !== targetUserId
      ).length;
      if (remainingSuperAdmins === 0) {
        return c.json({ error: 'Cannot delete the last remaining super admin' }, 400);
      }
    }

    await db.deleteUser(targetUserId);

    // Audit log
    await db.createAuditLog({
      userId: actorId,
      userName: actorProfile.name,
      userEmail: actorProfile.email,
      action: 'USER_DELETED',
      resourceType: 'user',
      resourceId: targetUserId,
      details: { deletedUserEmail: target.email, deletedUserRole: target.role },
      ipAddress: requestInfo.ipAddress,
      deviceInfo: requestInfo.deviceInfo,
      userAgent: requestInfo.userAgent,
    });

    return c.json({ success: true, message: 'User account deleted' });
  } catch (error: any) {
    console.error('Delete user error:', error);
    return c.json({ error: `Failed to delete user: ${error.message}` }, 500);
  }
});

// Get dashboard stats from SQL
app.get("/make-server-c5b85875/stats", requireAuth, async (c) => {
  try {
    const userId = c.get('userId');
    const userProfile = c.get('userProfile');

    if (!userProfile) return c.json({ error: 'User not found' }, 404);

    // Fetch documents and users in parallel
    const [documents, users] = await Promise.all([
      db.getDocumentsForUser(userId, userProfile),
      db.getAllUsers(),
    ]);
    
    // documents is already filtered for the user's role by getDocumentsForUser
    const stats = {
      totalDocuments: documents.length,
      pendingApprovals: documents.filter((d: any) => d.status === 'pending_approval').length,
      approvedDocuments: documents.filter((d: any) => d.status === 'approved').length,
      rejectedDocuments: documents.filter((d: any) => d.status === 'rejected').length,
      draftDocuments: documents.filter((d: any) => d.status === 'draft').length,
      totalUsers: users.length,
      activeUsers: users.filter((u: any) => u.is_active).length,

      departmentStats: {} as any,

      recentDocuments: documents
        .slice(0, 5)
        .map(formatDocument),
    };

    const departments = [...new Set(documents.map((d: any) => d.department))];
    for (const dept of departments) {
      const deptDocs = documents.filter((d: any) => d.department === dept);
      stats.departmentStats[dept] = {
        total: deptDocs.length,
        approved: deptDocs.filter((d: any) => d.status === 'approved').length,
        pending: deptDocs.filter((d: any) => d.status === 'pending_approval').length,
        draft: deptDocs.filter((d: any) => d.status === 'draft').length,
      };
    }
    
    return c.json({ stats });
  } catch (error: any) {
    console.error('Get stats error:', error);
    return c.json({ error: `Failed to get stats: ${error.message}` }, 500);
  }
});

// ============ TEST ACCOUNT SEEDING ============
// REMOVED: the hardcoded seedTestAccounts() list (plaintext admin/staff
// passwords baked into source) has been deleted. Shipping known credentials
// in the codebase is a critical vulnerability. Provision accounts via the
// authenticated signup + super-admin approval flow instead.


// ============ PASSWORD RESET (admin-mediated) ============
//
// Flow:
//   1. User submits their email at /password-reset/request (public).
//   2. A super_admin sees the request and approves it, which generates a
//      one-time token, emails the user a reset link, and marks the request
//      approved.
//   3. User opens the link (/reset-password?token=...) and sets a new password
//      via /password-reset/complete. The token is single-use and expires in 1h.

// SECURITY: tokens are stored only as SHA-256 hashes, never in plaintext.
const hashToken = (token: string) => hashPassword(token);

// Run migration 006 — password_reset_requests table (super_admin only)
app.post("/make-server-c5b85875/run-migration-006", requireAuth, async (c) => {
  if (c.get('userProfile')?.role !== 'super_admin') {
    return c.json({ error: 'Unauthorized - Super admin access required' }, 403);
  }
  let pgClient: any = null;
  try {
    const dbUrl = Deno.env.get('SUPABASE_DB_URL');
    if (!dbUrl) return c.json({ error: 'SUPABASE_DB_URL not configured' }, 500);
    const { Client } = pg;
    pgClient = new Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
      query_timeout: 20000,
    });
    await pgClient.connect();
    await pgClient.query(`
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
      )
    `);
    await pgClient.query(`CREATE INDEX IF NOT EXISTS idx_prr_status ON password_reset_requests(status)`);
    await pgClient.query(`CREATE INDEX IF NOT EXISTS idx_prr_user_id ON password_reset_requests(user_id)`);
    await pgClient.query(`CREATE INDEX IF NOT EXISTS idx_prr_token_hash ON password_reset_requests(token_hash)`);
    await pgClient.query(`ALTER TABLE password_reset_requests ENABLE ROW LEVEL SECURITY`);
    await pgClient.query(`ALTER TABLE password_reset_requests FORCE ROW LEVEL SECURITY`);
    await pgClient.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE tablename = 'password_reset_requests'
            AND policyname = 'service_role_full_access'
        ) THEN
          CREATE POLICY "service_role_full_access" ON password_reset_requests
            FOR ALL TO service_role USING (true) WITH CHECK (true);
        END IF;
      END $$
    `);
    await pgClient.end();
    return c.json({ success: true, message: 'Migration 006 applied (password_reset_requests)' });
  } catch (error: any) {
    if (pgClient) { try { await pgClient.end(); } catch {} }
    return c.json({ error: `Migration failed: ${error.message}` }, 500);
  }
});

// PUBLIC: submit a password reset request. Always returns a generic success so
// it never reveals whether an email is registered.
app.post("/make-server-c5b85875/password-reset/request", rateLimit(5, 300000), async (c) => {
  const genericOk = () =>
    c.json({
      success: true,
      message:
        'If an account exists for that email, an administrator has been notified and will review your request.',
    });
  try {
    const { email } = await c.req.json().catch(() => ({}));
    if (!email || typeof email !== 'string' || !validation.email(email)) {
      // Still return generic success to avoid enumeration
      return genericOk();
    }

    const user = await db.getUserByEmail(email);
    if (!user) return genericOk();

    // Don't create duplicate open requests
    const existing = await db.getOpenResetRequestForUser(user.id);
    if (existing) return genericOk();

    await db.createPasswordResetRequest({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    // Notify all super admins that a reset request is waiting
    try {
      const allUsers = await db.getAllUsers();
      const admins = allUsers.filter((u: any) => u.role === 'super_admin' && u.is_active);
      for (const admin of admins) {
        await db.createNotification({
          userId: admin.id,
          type: 'warning',
          title: 'Password Reset Request',
          message: `${user.name} (${user.email}) requested a password reset. Review it in the Admin panel.`,
        });
      }
    } catch (e) {
      console.warn('Failed to notify admins of reset request:', e);
    }

    return genericOk();
  } catch (error: any) {
    console.error('Password reset request error:', error);
    // Never leak details
    return genericOk();
  }
});

// ADMIN: list password reset requests
app.get("/make-server-c5b85875/password-reset/requests", requireAuth, async (c) => {
  try {
    if (c.get('userProfile')?.role !== 'super_admin') {
      return c.json({ error: 'Unauthorized - Super admin access required' }, 403);
    }
    const requests = await db.getPasswordResetRequests();
    return c.json({
      requests: requests.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        email: r.email,
        name: r.name,
        status: r.status,
        rejectReason: r.reject_reason,
        processedAt: r.processed_at,
        completedAt: r.completed_at,
        createdAt: r.created_at,
      })),
    });
  } catch (error: any) {
    console.error('List reset requests error:', error);
    return c.json({ error: `Failed to load requests: ${error.message}` }, 500);
  }
});

// ADMIN: approve a reset request → generate token + email the link
app.post("/make-server-c5b85875/password-reset/requests/:id/approve", requireAuth, async (c) => {
  try {
    const actor = c.get('userProfile');
    if (actor?.role !== 'super_admin') {
      return c.json({ error: 'Unauthorized - Super admin access required' }, 403);
    }
    const reqId = c.req.param('id');
    if (!validation.uuid(reqId)) {
      return c.json({ error: 'Invalid request id' }, 400);
    }

    const request = await db.getPasswordResetRequest(reqId);
    if (!request) return c.json({ error: 'Request not found' }, 404);
    if (request.status !== 'pending') {
      return c.json({ error: `This request has already been ${request.status}` }, 400);
    }

    // Generate a single-use token; store only its hash
    const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    await db.approvePasswordResetRequest(reqId, tokenHash, expiresAt, c.get('userId'));

    const resetLink = `${getAppUrl()}/reset-password?token=${token}`;
    const emailResult = await sendEmail({
      to: request.email,
      subject: 'Reset your Arkivo password',
      html: passwordResetEmailHtml(request.name, resetLink),
      fallbackLink: resetLink,
    });

    // Notify the user in-app as well
    try {
      await db.createNotification({
        userId: request.user_id,
        type: 'success',
        title: 'Password Reset Approved',
        message: 'Your password reset was approved. Check your email for the reset link (valid for 1 hour).',
        fromUserId: c.get('userId'),
        fromUserName: actor.name,
      });
    } catch {}

    await db.createAuditLog({
      userId: c.get('userId'),
      userName: actor.name,
      userEmail: actor.email,
      action: 'PASSWORD_RESET_APPROVED',
      resourceType: 'user',
      resourceId: request.user_id,
      details: { email: request.email, emailSent: emailResult.sent },
    });

    return c.json({
      success: true,
      emailSent: emailResult.sent,
      // Only present when email delivery isn't configured — lets the admin copy it
      fallbackLink: emailResult.sent ? undefined : emailResult.fallbackLink,
      message: emailResult.sent
        ? 'Reset link emailed to the user.'
        : 'Email delivery is not configured. Share the reset link with the user manually.',
    });
  } catch (error: any) {
    console.error('Approve reset request error:', error);
    return c.json({ error: `Failed to approve request: ${error.message}` }, 500);
  }
});

// ADMIN: reject a reset request
app.post("/make-server-c5b85875/password-reset/requests/:id/reject", requireAuth, async (c) => {
  try {
    const actor = c.get('userProfile');
    if (actor?.role !== 'super_admin') {
      return c.json({ error: 'Unauthorized - Super admin access required' }, 403);
    }
    const reqId = c.req.param('id');
    if (!validation.uuid(reqId)) {
      return c.json({ error: 'Invalid request id' }, 400);
    }
    const body = await c.req.json().catch(() => ({}));
    const reason = validation.sanitizeString(body?.reason ?? '', 500);

    const request = await db.getPasswordResetRequest(reqId);
    if (!request) return c.json({ error: 'Request not found' }, 404);
    if (request.status !== 'pending') {
      return c.json({ error: `This request has already been ${request.status}` }, 400);
    }

    await db.rejectPasswordResetRequest(reqId, c.get('userId'), reason);

    try {
      await db.createNotification({
        userId: request.user_id,
        type: 'warning',
        title: 'Password Reset Declined',
        message: `Your password reset request was declined.${reason ? ' Reason: ' + reason : ''}`,
        fromUserId: c.get('userId'),
        fromUserName: actor.name,
      });
    } catch {}

    await db.createAuditLog({
      userId: c.get('userId'),
      userName: actor.name,
      userEmail: actor.email,
      action: 'PASSWORD_RESET_REJECTED',
      resourceType: 'user',
      resourceId: request.user_id,
      details: { email: request.email, reason },
    });

    return c.json({ success: true, message: 'Reset request declined' });
  } catch (error: any) {
    console.error('Reject reset request error:', error);
    return c.json({ error: `Failed to reject request: ${error.message}` }, 500);
  }
});

// PUBLIC: verify a reset token is valid + unexpired (used to gate the reset form)
app.post("/make-server-c5b85875/password-reset/verify", rateLimit(20, 300000), async (c) => {
  try {
    const { token } = await c.req.json().catch(() => ({}));
    if (!token || typeof token !== 'string') {
      return c.json({ valid: false }, 200);
    }
    const tokenHash = await hashToken(token);
    const request = await db.getResetRequestByTokenHash(tokenHash);
    if (!request) return c.json({ valid: false }, 200);
    if (new Date(request.token_expires_at) < new Date()) {
      return c.json({ valid: false, expired: true }, 200);
    }
    return c.json({ valid: true, email: request.email });
  } catch (error: any) {
    console.error('Verify reset token error:', error);
    return c.json({ valid: false }, 200);
  }
});

// PUBLIC: complete the reset with a valid token + new password
app.post("/make-server-c5b85875/password-reset/complete", rateLimit(10, 300000), async (c) => {
  try {
    const { token, newPassword } = await c.req.json().catch(() => ({}));
    if (!token || typeof token !== 'string' || !newPassword || typeof newPassword !== 'string') {
      return c.json({ error: 'Token and new password are required' }, 400);
    }

    const strength = validation.password(newPassword);
    if (!strength.valid) {
      return c.json({ error: 'Password does not meet requirements', details: strength.errors }, 400);
    }

    const tokenHash = await hashToken(token);
    const request = await db.getResetRequestByTokenHash(tokenHash);
    if (!request) {
      return c.json({ error: 'This reset link is invalid or has already been used.' }, 400);
    }
    if (new Date(request.token_expires_at) < new Date()) {
      return c.json({ error: 'This reset link has expired. Please request a new one.' }, 400);
    }

    // Update password + burn the token
    const newHash = await hashPassword(newPassword);
    await db.updateUser(request.user_id, { password_hash: newHash });
    await db.completePasswordResetRequest(request.id);

    // Invalidate all existing sessions for this user
    try {
      const sessions = await db.getUserSessions(request.user_id);
      await Promise.all(sessions.map((s: any) => db.deleteSession(s.token)));
    } catch (e) {
      console.warn('Failed to revoke sessions after reset:', e);
    }

    await db.createAuditLog({
      userId: request.user_id,
      userName: request.name,
      userEmail: request.email,
      action: 'PASSWORD_RESET_COMPLETED',
      resourceType: 'user',
      resourceId: request.user_id,
    });

    return c.json({ success: true, message: 'Your password has been reset. You can now log in.' });
  } catch (error: any) {
    console.error('Complete reset error:', error);
    return c.json({ error: `Password reset failed: ${error.message}` }, 500);
  }
});

// Start server
Deno.serve(app.fetch);