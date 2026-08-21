# Database Migration Guide

## Overview

This migration moves data from the KV Store (single table) to proper SQL tables with normalized schema.

## 📊 New Database Schema

### Tables Created

1. **`users`** - User accounts and profiles
2. **`sessions`** - Active user sessions with device tracking
3. **`documents`** - Document management with workflow
4. **`audit_logs`** - System audit trail for all actions
5. **`document_history`** - Document approval workflow history
6. **`notifications`** - User notifications

## 🚀 Migration Steps

### Step 1: Run SQL Migration

Execute the migration file in your Supabase SQL Editor:

```bash
# Navigate to Supabase Dashboard
# Go to: SQL Editor → New Query
# Copy and paste the contents of: /supabase/migrations/001_create_tables.sql
# Click "Run"
```

Or via Supabase CLI:

```bash
supabase db push
```

### Step 2: Verify Tables Created

Check in Supabase Dashboard:
- Go to **Database** → **Tables**
- Verify all 6 tables are created:
  - ✅ users
  - ✅ sessions
  - ✅ documents
  - ✅ audit_logs
  - ✅ document_history
  - ✅ notifications

### Step 3: Run Data Migration

Trigger the migration endpoint to move data from KV to SQL:

```bash
# Via HTTP request
POST https://[your-project].supabase.co/functions/v1/make-server-c5b85875/migrate-to-sql
Authorization: Bearer [your-anon-key]
```

Or add this endpoint to your server:

```typescript
// In /supabase/functions/server/index.tsx
import { migrateKVToSQL } from "./migration.tsx";

app.post("/make-server-c5b85875/migrate-to-sql", async (c) => {
  try {
    console.log('🔄 Migration triggered');
    const results = await migrateKVToSQL();
    return c.json({ 
      success: true, 
      message: 'Migration completed',
      results 
    });
  } catch (error: any) {
    console.error('Migration failed:', error);
    return c.json({ 
      success: false, 
      error: error.message 
    }, 500);
  }
});
```

### Step 4: Update Application Code

Replace KV store calls with database calls:

**Before (KV Store):**
```typescript
import * as kv from "./kv_store.tsx";

const user = await kv.get(`user:${userId}`);
await kv.set(`user:${userId}`, userData);
```

**After (SQL Database):**
```typescript
import * as db from "./database.tsx";

const user = await db.getUser(userId);
await db.createUser(userData);
```

### Step 5: Test Everything

1. ✅ Login/Logout works
2. ✅ Document creation works
3. ✅ Document viewing works
4. ✅ Audit logs are created
5. ✅ Notifications work
6. ✅ User management works

### Step 6: Cleanup (Optional)

After verifying everything works, you can optionally clean up the old KV store:

```sql
-- CAUTION: This will delete all KV data
-- Make sure SQL migration is successful first!
DROP TABLE IF EXISTS kv_store_c5b85875;
```

## 📋 Schema Comparison

### Before (KV Store)
```
kv_store_c5b85875
├── user:*         (All users mixed)
├── session:*      (All sessions mixed)
├── document:*     (All documents mixed)
└── audit:*        (All audit logs mixed)
```

### After (SQL Tables)
```
users              (Normalized user data)
sessions           (Session tracking with device info)
documents          (Documents with proper relationships)
audit_logs         (Structured audit trail)
document_history   (Workflow tracking)
notifications      (User notifications)
```

## 🎯 Benefits of SQL Migration

### 1. **Performance**
- ✅ Indexed queries (much faster than KV prefix search)
- ✅ Efficient joins between tables
- ✅ Query optimization by PostgreSQL

### 2. **Data Integrity**
- ✅ Foreign key constraints
- ✅ Data type validation
- ✅ Referential integrity

### 3. **Scalability**
- ✅ Can handle millions of records
- ✅ Efficient pagination
- ✅ Complex queries support

### 4. **Features**
- ✅ Full-text search on documents
- ✅ Advanced filtering and sorting
- ✅ Aggregation queries (stats, analytics)
- ✅ Audit trail with relationships

### 5. **Maintenance**
- ✅ Clear schema documentation
- ✅ Easy to backup/restore
- ✅ Version control for schema
- ✅ Migration history

## 🔍 Example Queries

### Get all documents by a user
```typescript
const documents = await db.getAllDocuments();
const userDocs = documents.filter(doc => doc.author_id === userId);
```

### Get user's audit trail
```typescript
const logs = await db.getUserAuditLogs(userId);
```

### Search documents
```typescript
const results = await db.searchDocuments("budget report");
```

### Get unread notifications
```typescript
const notifications = await db.getUnreadNotifications(userId);
```

## ⚠️ Important Notes

1. **Backup First**: Always backup your KV store data before migration
2. **Test in Staging**: Run migration in a test environment first
3. **Monitor Logs**: Watch Supabase logs during migration
4. **Downtime**: Plan for brief downtime during migration
5. **Rollback Plan**: Keep KV store intact until SQL is verified

## 🆘 Troubleshooting

### Migration fails midway
- Check Supabase logs for specific errors
- Verify all tables are created correctly
- Ensure foreign key relationships are valid

### Duplicate key errors
- Migration script skips existing records
- Safe to re-run migration

### Performance issues
- Run `ANALYZE` on tables after migration
- Check indexes are created
- Monitor query performance in Supabase Dashboard

## 📞 Support

If you encounter issues:
1. Check Supabase Dashboard → Logs
2. Verify table structure matches migration file
3. Review error messages in migration results
4. Contact system administrator

## ✅ Post-Migration Checklist

- [ ] All tables created successfully
- [ ] Data migrated (users, sessions, documents, audit logs)
- [ ] Indexes created and working
- [ ] Foreign keys established
- [ ] RLS policies enabled
- [ ] Application updated to use SQL queries
- [ ] All features tested and working
- [ ] Old KV store backed up
- [ ] Documentation updated

---

**Migration Version**: 1.0  
**Created**: 2026-03-26  
**Schema Version**: 001_create_tables.sql
