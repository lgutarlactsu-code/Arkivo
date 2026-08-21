/**
 * Database Helper Functions
 * SQL-based storage replacing KV store
 */

import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

// Singleton client — reused across all DB calls to avoid per-call overhead
let _client: ReturnType<typeof createClient> | null = null;
const client = () => {
  if (!_client) {
    _client = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
  }
  return _client;
};

// =====================================================
// USER OPERATIONS
// =====================================================

export const createUser = async (user: any) => {
  const supabase = client();
  const { data, error } = await supabase
    .from("users")
    .insert({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      clearance_level: user.clearanceLevel,
      is_active: user.isActive !== undefined ? user.isActive : true,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

// Create user with approval status (for new signup with pending approval)
export const createUserWithApproval = async (user: any) => {
  const supabase = client();

  const { data, error } = await supabase
    .from("users")
    .insert({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      clearance_level: user.clearance_level,
      is_active: user.is_active,
      password_hash: user.password_hash,
      approval_status: user.approval_status,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  return data;
};

export const getUser = async (userId: string) => {
  const supabase = client();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error && error.code !== "PGRST116") throw new Error(error.message);
  return data;
};

export const getUserByEmail = async (email: string) => {
  const supabase = client();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .single();

  if (error && error.code !== "PGRST116") throw new Error(error.message);
  return data;
};

export const getAllUsers = async () => {
  const supabase = client();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
};

export const updateUser = async (userId: string, updates: any) => {
  const supabase = client();
  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

export const approveUser = async (userId: string, approvedBy: string) => {
  const supabase = client();

  const { data, error } = await supabase
    .from("users")
    .update({
      is_active: true,
      approval_status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  return data;
};

export const rejectUser = async (
  userId: string,
  rejectedBy: string,
  reason?: string
) => {
  const supabase = client();

  const { data, error } = await supabase
    .from("users")
    .update({
      is_active: false,
      approval_status: 'rejected',
      rejected_by: rejectedBy,
      rejected_at: new Date().toISOString(),
      rejection_reason: reason || 'No reason provided',
    })
    .eq("id", userId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  return data;
};

// Permanently delete a user and their sessions
export const deleteUser = async (userId: string) => {
  const supabase = client();
  // Remove active sessions first so a deleted user can't keep acting
  await supabase.from("sessions").delete().eq("user_id", userId);
  const { error } = await supabase.from("users").delete().eq("id", userId);
  if (error) throw new Error(error.message);
};

// =====================================================
// SESSION OPERATIONS
// =====================================================

export const createSession = async (session: any) => {
  const supabase = client();
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      token: session.token,
      user_id: session.userId,
      email: session.email,
      ip_address: session.ipAddress,
      device_info: session.deviceInfo,
      user_agent: session.userAgent,
      expires_at: session.expiresAt,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

export const getSession = async (token: string) => {
  const supabase = client();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("token", token)
    .single();

  if (error && error.code !== "PGRST116") throw new Error(error.message);
  return data;
};

export const getUserSessions = async (userId: string) => {
  const supabase = client();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
};

export const deleteSession = async (token: string) => {
  const supabase = client();
  const { error } = await supabase.from("sessions").delete().eq("token", token);

  if (error) throw new Error(error.message);
};

export const deleteExpiredSessions = async () => {
  const supabase = client();
  const { error } = await supabase
    .from("sessions")
    .delete()
    .lt("expires_at", new Date().toISOString());

  if (error) throw new Error(error.message);
};

// Throttled: only writes to DB if last_activity was > 60 seconds ago
export const updateSessionActivity = async (token: string, lastActivity?: string | null) => {
  if (lastActivity) {
    const elapsed = Date.now() - new Date(lastActivity).getTime();
    if (elapsed < 60_000) return; // skip — still fresh
  }
  const supabase = client();
  const { error } = await supabase
    .from("sessions")
    .update({ last_activity: new Date().toISOString() })
    .eq("token", token);

  if (error) throw new Error(error.message);
};

// =====================================================
// DOCUMENT OPERATIONS
// =====================================================

// Columns for list views — excludes file_url (base64 content) to prevent timeouts
const DOC_LIST_COLS = [
  "id","title","description","department","author_id","author_name",
  "file_name","file_type","file_size","status","access_level",
  "version","is_locked","tags","metadata","created_at","updated_at",
  "approved_at","approved_by","rejected_at","rejected_by","rejection_reason",
  "file_hash","hash_algorithm","integrity_status","hash_verified_at",
  "required_approvals","current_approvals",
  "parent_document_id","version_tag","base_title","base_file_name",
].join(",");

export const createDocument = async (document: any) => {
  const supabase = client();
  const { data, error } = await supabase
    .from("documents")
    .insert({
      id: document.id,
      title: document.title,
      description: document.description,
      department: document.department,
      author_id: document.authorId,
      author_name: document.authorName,
      file_name: document.fileName,
      file_type: document.fileType,
      file_size: document.fileSize,
      file_url: document.fileUrl,
      status: document.status ?? "draft",
      access_level: document.accessLevel ?? "internal",
      version: document.version ?? 1,
      is_locked: document.isLocked ?? false,
      tags: document.tags,
      metadata: document.metadata,
      // SHA-256 integrity
      file_hash: document.fileHash,
      hash_algorithm: document.hashAlgorithm ?? 'SHA-256',
      integrity_status: document.integrityStatus ?? 'unverified',
      // Multi-approval
      required_approvals: document.requiredApprovals ?? 1,
      current_approvals: document.currentApprovals ?? 0,
      // Version control
      parent_document_id: document.parentDocumentId ?? null,
      version_tag: document.versionTag ?? 'v1',
      base_title: document.baseTitle ?? document.title,
      base_file_name: document.baseFileName ?? document.fileName,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

export const getDocument = async (documentId: string) => {
  const supabase = client();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .single();

  if (error && error.code !== "PGRST116") throw new Error(error.message);
  return data;
};

// Deduplicate docs to latest version per base_file_name (results already ordered created_at DESC)
const deduplicateVersions = (docs: any[]): any[] => {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const doc of docs) {
    const key = doc.base_file_name || doc.file_name;
    if (!key) { out.push(doc); continue; }
    if (!seen.has(key)) { seen.add(key); out.push(doc); }
  }
  return out;
};

export const getAllDocuments = async () => {
  const supabase = client();
  const { data, error } = await supabase
    .from("documents")
    .select(DOC_LIST_COLS)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return deduplicateVersions(data ?? []);
};

// Fetch only documents visible to a specific user — server-side filtered, no file content
export const getDocumentsForUser = async (userId: string, userProfile: any) => {
  const supabase = client();
  const role = userProfile?.role;
  const department = userProfile?.department;

  let query = supabase
    .from("documents")
    .select(DOC_LIST_COLS)
    .order("created_at", { ascending: false });

  if (role === 'super_admin' || role === 'lgu_head') {
    // no additional filter
  } else if (role === 'dept_admin') {
    query = query.eq("department", department);
  } else {
    // staff / records_officer: own docs OR public OR restricted-in-same-dept
    // Build as separate filters merged client-side to avoid complex OR timeout
    const [own, pub, deptRestricted] = await Promise.all([
      supabase.from("documents").select(DOC_LIST_COLS).eq("author_id", userId).order("created_at", { ascending: false }),
      supabase.from("documents").select(DOC_LIST_COLS).eq("access_level", "public").order("created_at", { ascending: false }),
      supabase.from("documents").select(DOC_LIST_COLS).eq("department", department).eq("access_level", "restricted").order("created_at", { ascending: false }),
    ]);
    if (own.error) throw new Error(own.error.message);
    if (pub.error) throw new Error(pub.error.message);
    if (deptRestricted.error) throw new Error(deptRestricted.error.message);

    // Merge and deduplicate by id, then sort and deduplicate versions
    const byId = new Map<string, any>();
    for (const doc of [...(own.data ?? []), ...(pub.data ?? []), ...(deptRestricted.data ?? [])]) {
      byId.set(doc.id, doc);
    }
    const merged = Array.from(byId.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return deduplicateVersions(merged);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return deduplicateVersions(data ?? []);
};

export const getPublicDocuments = async () => {
  const supabase = client();
  const { data, error } = await supabase
    .from("documents")
    .select(DOC_LIST_COLS)
    .eq("access_level", "public")
    .eq("status", "approved")
    .order("approved_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
};

export const updateDocument = async (documentId: string, updates: any) => {
  const supabase = client();
  const { data, error } = await supabase
    .from("documents")
    .update(updates)
    .eq("id", documentId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

export const deleteDocument = async (documentId: string) => {
  const supabase = client();
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId);

  if (error) throw new Error(error.message);
};

export const searchDocuments = async (query: string) => {
  const supabase = client();
  const { data, error } = await supabase
    .from("documents")
    .select(DOC_LIST_COLS)
    .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
};

// =====================================================
// AUDIT LOG OPERATIONS
// =====================================================

export const createAuditLog = async (log: any) => {
  const supabase = client();
  // Fire-and-forget — don't await to avoid blocking the response
  supabase
    .from("audit_logs")
    .insert({
      user_id: log.userId,
      user_name: log.userName,
      user_email: log.userEmail,
      action: log.action,
      resource_type: log.resourceType,
      resource_id: log.resourceId,
      details: log.details,
      ip_address: log.ipAddress,
      device_info: log.deviceInfo,
      user_agent: log.userAgent,
      status: log.status ?? "success",
    })
    .select()
    .single()
    .then(({ error }) => {
      if (error) console.warn("Audit log write failed (non-blocking):", error.message);
    });
  return null;
};

// Alias for compatibility
export const logAuditTrail = createAuditLog;

export const getAuditLogs = async (limit = 100) => {
  const supabase = client();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
};

export const getUserAuditLogs = async (userId: string, limit = 50) => {
  const supabase = client();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("user_id", userId)
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
};

export const getDocumentAuditLogs = async (documentId: string) => {
  const supabase = client();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("resource_type", "document")
    .eq("resource_id", documentId)
    .order("timestamp", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
};

// =====================================================
// DOCUMENT HISTORY OPERATIONS
// =====================================================

export const createDocumentHistory = async (history: any) => {
  const supabase = client();
  const { data, error } = await supabase
    .from("document_history")
    .insert({
      document_id: history.documentId,
      user_id: history.userId,
      user_name: history.userName,
      action: history.action,
      previous_status: history.previousStatus,
      new_status: history.newStatus,
      comments: history.comments,
      metadata: history.metadata,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

export const getDocumentHistory = async (documentId: string) => {
  const supabase = client();
  const { data, error } = await supabase
    .from("document_history")
    .select("*")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
};

// =====================================================
// NOTIFICATION OPERATIONS
// =====================================================

export const createNotification = async (notification: any) => {
  const supabase = client();

  let notificationType = 'info';
  if (notification.type === 'success' || notification.type === 'document_submitted' || notification.type === 'document_approved') {
    notificationType = 'success';
  } else if (notification.type === 'warning' || notification.type === 'document_rejected') {
    notificationType = 'warning';
  } else if (notification.type === 'error') {
    notificationType = 'error';
  }

  const metadata = {
    ...notification.metadata,
    documentId: notification.documentId,
    documentTitle: notification.documentTitle,
    fromUserId: notification.fromUserId,
    fromUserName: notification.fromUserName,
    originalType: notification.type,
  };

  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id: notification.userId,
      type: notificationType,
      title: notification.title,
      message: notification.message,
      action_url: notification.documentId ? `/documents/${notification.documentId}` : null,
      metadata: metadata,
      is_read: false,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

export const getNotifications = async (userId: string, limit = 50) => {
  const supabase = client();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
};

export const markNotificationAsRead = async (notificationId: string) => {
  const supabase = client();
  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

export const markAllNotificationsAsRead = async (userId: string) => {
  const supabase = client();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) throw new Error(error.message);
};

// =====================================================
// DOCUMENT APPROVALS (Multi-approval workflow)
// =====================================================

export const createDocumentApproval = async (approval: any) => {
  const supabase = client();
  const { data, error } = await supabase
    .from("document_approvals")
    .insert({
      document_id: approval.documentId,
      approver_id: approval.approverId,
      approver_name: approval.approverName,
      approver_role: approval.approverRole,
      approver_department: approval.approverDepartment,
      action: approval.action,
      comments: approval.comments,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

export const getDocumentApprovals = async (documentId: string) => {
  const supabase = client();
  const { data, error } = await supabase
    .from("document_approvals")
    .select("*")
    .eq("document_id", documentId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
};

export const hasApproverActed = async (documentId: string, approverId: string) => {
  const supabase = client();
  const { data, error } = await supabase
    .from("document_approvals")
    .select("id, action")
    .eq("document_id", documentId)
    .eq("approver_id", approverId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw new Error(error.message);
  return data;
};

// =====================================================
// VERSION CONTROL
// =====================================================

export const getDocumentsByBaseFileName = async (baseFileName: string) => {
  const supabase = client();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("base_file_name", baseFileName)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
};

export const getDocumentVersions = async (documentId: string) => {
  const supabase = client();

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .single();

  if (docError) throw new Error(docError.message);
  if (!doc) return [];

  const baseFileName = doc.base_file_name ?? doc.file_name;

  const { data, error } = await supabase
    .from("documents")
    .select("id, title, version, version_tag, file_size, file_hash, status, created_at, author_name, parent_document_id")
    .eq("base_file_name", baseFileName)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
};

// =====================================================
// PASSWORD RESET REQUESTS (admin-mediated)
// =====================================================

// Create a new reset request (status = 'pending' until an admin approves it)
export const createPasswordResetRequest = async (req: {
  userId: string;
  email: string;
  name: string;
}) => {
  const supabase = client();
  const { data, error } = await supabase
    .from("password_reset_requests")
    .insert({
      user_id: req.userId,
      email: req.email,
      name: req.name,
      status: "pending",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

// Does the user already have an open (pending/approved) request? Avoids spam.
export const getOpenResetRequestForUser = async (userId: string) => {
  const supabase = client();
  const { data, error } = await supabase
    .from("password_reset_requests")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["pending", "approved"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw new Error(error.message);
  return data;
};

export const getPasswordResetRequests = async (status?: string) => {
  const supabase = client();
  let query = supabase
    .from("password_reset_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
};

export const getPasswordResetRequest = async (id: string) => {
  const supabase = client();
  const { data, error } = await supabase
    .from("password_reset_requests")
    .select("*")
    .eq("id", id)
    .single();
  if (error && error.code !== "PGRST116") throw new Error(error.message);
  return data;
};

// Attach an approval token + expiry to a request
export const approvePasswordResetRequest = async (
  id: string,
  tokenHash: string,
  expiresAt: string,
  processedBy: string
) => {
  const supabase = client();
  const { data, error } = await supabase
    .from("password_reset_requests")
    .update({
      status: "approved",
      token_hash: tokenHash,
      token_expires_at: expiresAt,
      processed_by: processedBy,
      processed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
};

export const rejectPasswordResetRequest = async (
  id: string,
  processedBy: string,
  reason: string
) => {
  const supabase = client();
  const { data, error } = await supabase
    .from("password_reset_requests")
    .update({
      status: "rejected",
      reject_reason: reason,
      processed_by: processedBy,
      processed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
};

// Look up an approved request by its hashed token (used to complete the reset)
export const getResetRequestByTokenHash = async (tokenHash: string) => {
  const supabase = client();
  const { data, error } = await supabase
    .from("password_reset_requests")
    .select("*")
    .eq("token_hash", tokenHash)
    .eq("status", "approved")
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw new Error(error.message);
  return data;
};

// Mark a request completed and burn the token so it can't be reused
export const completePasswordResetRequest = async (id: string) => {
  const supabase = client();
  const { error } = await supabase
    .from("password_reset_requests")
    .update({
      status: "completed",
      token_hash: null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
};

// =====================================================
// FILE INTEGRITY
// =====================================================

export const updateDocumentIntegrity = async (
  documentId: string,
  integrityStatus: "verified" | "modified" | "unverified",
  fileHash?: string
) => {
  const supabase = client();
  const updates: any = {
    integrity_status: integrityStatus,
    hash_verified_at: new Date().toISOString(),
  };
  if (fileHash) updates.file_hash = fileHash;

  const { data, error } = await supabase
    .from("documents")
    .update(updates)
    .eq("id", documentId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};
