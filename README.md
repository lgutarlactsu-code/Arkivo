# LGU Document Management System

A comprehensive document management system with role-based access control for Local Government Units.

## 🚀 Quick Start (3 Simple Steps)

### 1️⃣ Click the Green Button
Go to the login page and click **"Create All 18 Test Accounts"**

### 2️⃣ Wait for Confirmation
You'll see a success message: "Seeding complete! Created: 18..."

### 3️⃣ Login
Click "Show Test Accounts" → "Quick Login" → Sign In

**That's it! You're ready to test the system.**

---

## 📚 Quick Links

- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Detailed setup instructions and troubleshooting
- **[TEST_ACCOUNTS.md](./TEST_ACCOUNTS.md)** - All 18 test account credentials
- **[AUTHENTICATION_GUIDE.md](./AUTHENTICATION_GUIDE.md)** - Authentication system documentation
- **[QUICK_AUTH_REFERENCE.md](./QUICK_AUTH_REFERENCE.md)** - Quick auth reference

---

## 🎯 What Can You Do?

### As Super Admin (`admin@lgu.gov.ph`)
- ✅ View ALL documents from all departments
- ✅ Manage ALL users
- ✅ Approve/Reject any document
- ✅ View audit logs
- ✅ Access admin panel

### As Department Admin (`finance.admin@lgu.gov.ph`)
- ✅ View department documents
- ✅ Manage department users
- ✅ Approve/Reject department documents
- ✅ Access admin panel

### As Staff (`staff.finance@lgu.gov.ph`)
- ✅ Upload documents
- ✅ View own documents
- ✅ Submit for approval
- ✅ View public documents

### As Public User (`citizen@example.com`)
- ✅ View public documents only

---

## 🏗️ System Architecture

```
Frontend (React + TypeScript)
     ↓
Backend API (Hono + Deno Edge Functions)
     ↓
Supabase (Auth + Storage)
     ↓
KV Store (Database + Sessions)
```

**Authentication**: Custom session token system (not JWT)
- Session tokens stored in KV store
- 7-day expiration
- Immediate revocation on logout

See [AUTHENTICATION_GUIDE.md](./AUTHENTICATION_GUIDE.md) for details.

---

## 🔐 6 User Roles

1. **Super Admin** - Full system access
2. **LGU Head** - Executive access to all documents
3. **Department Admin** - Manage department
4. **Records Officer** - Document management
5. **Staff** - Create and view documents
6. **Public** - View public documents only

---

## 📦 18 Pre-Created Accounts

- 1 Super Admin
- 1 LGU Head
- 7 Department Admins (Finance, Engineering, Health, Social Welfare, Agriculture, Education, Planning)
- 3 Records Officers
- 5 Staff Members
- 1 Public User

See [TEST_ACCOUNTS.md](./TEST_ACCOUNTS.md) for all credentials.

---

## ✨ Key Features

### Security & Access Control
- ✅ Role-based access control (RBAC)
- ✅ Department-level permissions
- ✅ Clearance levels (1-4)
- ✅ Document locking after approval

### Document Management
- ✅ Upload documents (PDF, DOCX, images)
- ✅ Version control
- ✅ Document workflow (Draft → Submitted → Approved/Rejected)
- ✅ Access levels (Public, Restricted, Confidential, Classified)
- ✅ Tag and categorize documents

### Workflow & Notifications
- ✅ Submit for approval
- ✅ Approve/Reject with comments
- ✅ Real-time notifications
- ✅ Email-style notification system

### Audit & Compliance
- ✅ Complete audit trail
- ✅ Track all actions (view, create, update, approve, reject)
- ✅ User activity logs
- ✅ Timestamp all events

### User Management
- ✅ Create users with roles
- ✅ Manage department assignments
- ✅ Activate/Deactivate users
- ✅ View user statistics

---

## 🧪 Testing Scenarios

### Test 1: Document Approval Flow
1. Login as `staff.finance@lgu.gov.ph`
2. Upload a document
3. Submit for approval
4. Logout and login as `finance.admin@lgu.gov.ph`
5. Approve the document

### Test 2: Role-Based Access
1. Login as `staff.finance@lgu.gov.ph`
2. Notice you only see Finance documents
3. Logout and login as `admin@lgu.gov.ph`
4. Notice you see ALL documents

### Test 3: Public Portal
1. Visit `/public` (no login required)
2. See only public documents
3. Login as `citizen@example.com`
4. Still only see public documents

---

## 🛠️ Tech Stack

### Frontend
- React 18
- TypeScript
- React Router (Data Mode)
- Tailwind CSS v4
- Lucide Icons
- Sonner (Toasts)

### Backend
- Hono (Web Framework)
- Deno Edge Functions
- Supabase KV Store
- Supabase Auth

### Infrastructure
- Supabase (BaaS)
- Edge Functions
- Key-Value Database

---

## 📁 File Structure

```
/src/app/
  ├── pages/              # All pages (Dashboard, Documents, Login, etc.)
  ├── components/         # Shared components
  ├── lib/               # Utilities (API, Auth)
  ├── routes.tsx         # Router configuration
  └── App.tsx            # Main app

/supabase/functions/server/
  ├── index.tsx          # API server + seeding logic
  └── kv_store.tsx       # Database utilities (protected)

/TEST_ACCOUNTS.md        # Credentials for all 18 accounts
/SETUP_GUIDE.md          # Complete setup guide
/README.md               # This file
```

---

## 🐛 Common Issues

### "No accounts in Supabase"
**Solution:** Click the green "Create All 18 Test Accounts" button on the login page.

### "Login failed"
**Solution:** Make sure you clicked the seed button first. Accounts don't exist until you create them.

### "Request failed"
**Solution:** Check browser console for details. Make sure you're logged in properly.

---

## 📊 Database Schema

### KV Store Prefixes
- `user:` - User profiles
- `session:` - Authentication session tokens (7-day expiration)
- `document:` - Document metadata and content
- `version:` - Document version history
- `notification:` - User notifications
- `audit:` - Audit log entries

---

## 🎨 UI/UX Features

- Modern neumorphic design
- Responsive layout (mobile-friendly)
- Smooth animations
- Toast notifications
- Loading states
- Error handling
- Color-coded statuses
- Role-based navigation

---

## 🔄 Document Lifecycle

```
Draft → Submit → Under Review → Approved/Rejected
                                    ↓
                                  Locked
```

Once approved, documents are **locked** and cannot be edited.

---

## 📞 Support

For issues or questions:
1. Check [SETUP_GUIDE.md](./SETUP_GUIDE.md) for troubleshooting
2. Review browser console logs
3. Check server logs in Supabase Edge Functions

---

## 📄 License

This project is for demonstration and testing purposes.

---

## 🎉 Credits

Built with React, Supabase, and Tailwind CSS for the LGU Document Management System.

**Happy Testing!** 🚀