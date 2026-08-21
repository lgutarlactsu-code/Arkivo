# Database Schema Diagram

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         LGU DOCUMENT MANAGEMENT SYSTEM                   │
│                              Database Schema                             │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────┐
│         USERS            │
├──────────────────────────┤
│ PK  id (UUID)            │
│     email (TEXT)         │◄────┐
│     name (TEXT)          │     │
│     role (TEXT)          │     │
│     department (TEXT)    │     │
│     clearance_level (INT)│     │
│     is_active (BOOLEAN)  │     │
│     created_at (TS)      │     │
│     updated_at (TS)      │     │
└──────────────────────────┘     │
         │                       │
         │ 1                     │
         │                       │
         ├──────────────┐        │
         │              │        │
         │ 1            │ 1      │
         ▼              ▼        │
┌──────────────────────────┐   ┌─┴────────────────────────┐
│       SESSIONS           │   │       DOCUMENTS          │
├──────────────────────────┤   ├──────────────────────────┤
│ PK  id (UUID)            │   │ PK  id (UUID)            │
│     token (TEXT)         │   │     title (TEXT)         │
│ FK  user_id (UUID)       │   │     description (TEXT)   │
│     email (TEXT)         │   │     department (TEXT)    │
│     ip_address (TEXT)    │   │ FK  author_id (UUID)     │
│     device_info (JSONB)  │   │     author_name (TEXT)   │
│     user_agent (TEXT)    │   │     file_name (TEXT)     │
│     expires_at (TS)      │   │     file_type (TEXT)     │
│     created_at (TS)      │   │     file_size (INT)      │
│     last_activity (TS)   │   │     file_url (TEXT)      │
└──────────────────────────┘   │     status (TEXT)        │
                               │     access_level (TEXT)  │
                               │     version (INT)        │
┌──────────────────────────┐   │     is_locked (BOOLEAN)  │
│      AUDIT_LOGS          │   │     tags (TEXT[])        │
├──────────────────────────┤   │     metadata (JSONB)     │
│ PK  id (UUID)            │   │     approved_at (TS)     │
│ FK  user_id (UUID)       │   │ FK  approved_by (UUID)   │
│     user_name (TEXT)     │   │     rejected_at (TS)     │
│     user_email (TEXT)    │   │ FK  rejected_by (UUID)   │
│     action (TEXT)        │   │     rejection_reason (T) │
│     resource_type (TEXT) │   │     created_at (TS)      │
│     resource_id (TEXT)   │   │     updated_at (TS)      │
│     details (JSONB)      │   └──────────────────────────┘
│     ip_address (TEXT)    │            │
│     device_info (JSONB)  │            │ 1
│     user_agent (TEXT)    │            │
│     status (TEXT)        │            │ N
│     timestamp (TS)       │            ▼
└──────────────────────────┘   ┌──────────────────────────┐
         ▲                     │   DOCUMENT_HISTORY       │
         │                     ├──────────────────────────┤
         │ N                   │ PK  id (UUID)            │
         │                     │ FK  document_id (UUID)   │
         │                     │ FK  user_id (UUID)       │
         │                     │     user_name (TEXT)     │
         │                     │     action (TEXT)        │
         └─────────────────────┤     previous_status (T)  │
                               │     new_status (TEXT)    │
                               │     comments (TEXT)      │
┌──────────────────────────┐   │     metadata (JSONB)     │
│     NOTIFICATIONS        │   │     created_at (TS)      │
├──────────────────────────┤   └──────────────────────────┘
│ PK  id (UUID)            │
│ FK  user_id (UUID)       │
│     title (TEXT)         │
│     message (TEXT)       │
│     type (TEXT)          │
│     action_url (TEXT)    │
│     is_read (BOOLEAN)    │
│     metadata (JSONB)     │
│     created_at (TS)      │
│     read_at (TS)         │
└──────────────────────────┘


LEGEND:
─────────
PK = Primary Key
FK = Foreign Key
TS = Timestamp with Time Zone
◄─ = One-to-Many Relationship
```

## Table Relationships

### 1. Users → Sessions (1:N)
- One user can have multiple active sessions
- Sessions are automatically deleted when user is deleted (CASCADE)

### 2. Users → Documents (1:N)
- One user (author) can create multiple documents
- Documents reference the author
- Documents can be approved/rejected by other users

### 3. Documents → Document History (1:N)
- One document has multiple history entries
- Tracks all changes and approvals
- History is deleted when document is deleted (CASCADE)

### 4. Users → Audit Logs (1:N)
- One user generates multiple audit log entries
- User deletion sets user_id to NULL (preserves audit trail)

### 5. Users → Notifications (1:N)
- One user receives multiple notifications
- Notifications are deleted when user is deleted (CASCADE)

## Key Features

### Indexes
```sql
-- Users
idx_users_email
idx_users_role
idx_users_department
idx_users_is_active

-- Sessions
idx_sessions_token
idx_sessions_user_id
idx_sessions_expires_at

-- Documents
idx_documents_author_id
idx_documents_department
idx_documents_status
idx_documents_access_level
idx_documents_created_at
idx_documents_title (Full-text search)
idx_documents_description (Full-text search)

-- Audit Logs
idx_audit_logs_user_id
idx_audit_logs_action
idx_audit_logs_resource_type
idx_audit_logs_resource_id
idx_audit_logs_timestamp

-- Document History
idx_document_history_document_id
idx_document_history_user_id
idx_document_history_created_at

-- Notifications
idx_notifications_user_id
idx_notifications_is_read
idx_notifications_created_at
```

### Constraints

#### Check Constraints
```sql
-- Users
role IN ('super_admin', 'lgu_head', 'dept_admin', 'records_officer', 'staff', 'public')
clearance_level BETWEEN 0 AND 4

-- Documents
status IN ('draft', 'pending_approval', 'approved', 'rejected')
access_level IN ('public', 'internal', 'confidential', 'restricted')

-- Audit Logs
status IN ('success', 'failure', 'error')

-- Document History
action IN ('created', 'submitted', 'approved', 'rejected', 'updated', 'deleted')

-- Notifications
type IN ('info', 'success', 'warning', 'error')
```

#### Foreign Keys
```sql
-- Sessions
user_id → users(id) ON DELETE CASCADE

-- Documents
author_id → users(id)
approved_by → users(id)
rejected_by → users(id)

-- Audit Logs
user_id → users(id) ON DELETE SET NULL

-- Document History
document_id → documents(id) ON DELETE CASCADE
user_id → users(id) ON DELETE SET NULL

-- Notifications
user_id → users(id) ON DELETE CASCADE
```

### Triggers
```sql
-- Auto-update updated_at on record modification
update_users_updated_at
update_documents_updated_at
```

### Row Level Security (RLS)

All tables have RLS enabled with service role access:

```sql
-- Public documents are viewable by everyone
CREATE POLICY "Public documents are viewable by everyone" 
  ON documents FOR SELECT 
  USING (access_level = 'public' AND status = 'approved');

-- Service role has full access to all tables
CREATE POLICY "Service role has full access" 
  ON [table_name] FOR ALL 
  USING (auth.role() = 'service_role');
```

## Data Types

### JSONB Fields

#### `device_info` (Sessions & Audit Logs)
```json
{
  "browser": "Chrome",
  "browserVersion": "120.0.0",
  "os": "Windows",
  "osVersion": "11",
  "deviceType": "Desktop"
}
```

#### `metadata` (Documents, Document History, Notifications)
```json
{
  "customField1": "value",
  "customField2": 123,
  "nested": {
    "key": "value"
  }
}
```

#### `details` (Audit Logs)
```json
{
  "action": "document_viewed",
  "documentId": "uuid",
  "documentTitle": "Title",
  "previousValue": "old",
  "newValue": "new"
}
```

## Query Examples

### Find all documents by department with full-text search
```sql
SELECT * FROM documents 
WHERE department = 'finance' 
  AND to_tsvector('english', title || ' ' || description) 
  @@ to_tsquery('english', 'budget');
```

### Get user activity summary
```sql
SELECT 
  u.name,
  COUNT(d.id) as documents_created,
  COUNT(al.id) as total_actions
FROM users u
LEFT JOIN documents d ON u.id = d.author_id
LEFT JOIN audit_logs al ON u.id = al.user_id
GROUP BY u.id, u.name;
```

### Document approval pipeline status
```sql
SELECT 
  department,
  status,
  COUNT(*) as count
FROM documents
GROUP BY department, status
ORDER BY department, status;
```

---

**Schema Version**: 1.0  
**Last Updated**: 2026-03-26
