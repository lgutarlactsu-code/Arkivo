# LGU Document Management System - Test Accounts

## ⚠️ FIRST TIME SETUP

**Before you can use these accounts, you MUST create them first!**

### How to Create Accounts:

1. **Go to the Login page** (when you first load the app)
2. **Click the green "Create All 18 Test Accounts" button**
3. **Wait for confirmation** - You'll see a success message
4. **Check browser console** for detailed creation logs
5. **Now you can login** with any of the accounts below

**You only need to do this ONCE.** The accounts persist in Supabase.

---

All test accounts are automatically created when you click the seed button.

## 📝 Account Credentials

### Super Administrator
- **Email:** admin@lgu.gov.ph
- **Password:** Admin123!
- **Role:** Super Admin
- **Department:** Administration
- **Access:** Full system access, can view all documents and manage all users

---

### LGU Head
- **Email:** mayor@lgu.gov.ph
- **Password:** Mayor123!
- **Role:** LGU Head
- **Department:** Administration
- **Access:** Can view all documents, approve/reject documents, view audit logs

---

## Department Administrators

### Finance Department
- **Email:** finance.admin@lgu.gov.ph
- **Password:** Finance123!
- **Role:** Department Admin
- **Department:** Finance

### Engineering Department
- **Email:** engineering.admin@lgu.gov.ph
- **Password:** Engineering123!
- **Role:** Department Admin
- **Department:** Engineering

### Health Department
- **Email:** health.admin@lgu.gov.ph
- **Password:** Health123!
- **Role:** Department Admin
- **Department:** Health

### Social Welfare Department
- **Email:** social.admin@lgu.gov.ph
- **Password:** Social123!
- **Role:** Department Admin
- **Department:** Social Welfare

### Agriculture Department
- **Email:** agriculture.admin@lgu.gov.ph
- **Password:** Agriculture123!
- **Role:** Department Admin
- **Department:** Agriculture

### Education Department
- **Email:** education.admin@lgu.gov.ph
- **Password:** Education123!
- **Role:** Department Admin
- **Department:** Education

### Planning & Development Department
- **Email:** planning.admin@lgu.gov.ph
- **Password:** Planning123!
- **Role:** Department Admin
- **Department:** Planning & Development

**Department Admin Access:** Can manage users in their department, view/approve department documents

---

## Records Officers

### Finance Records Officer
- **Email:** records.finance@lgu.gov.ph
- **Password:** Records123!
- **Department:** Finance

### Engineering Records Officer
- **Email:** records.engineering@lgu.gov.ph
- **Password:** Records123!
- **Department:** Engineering

### Health Records Officer
- **Email:** records.health@lgu.gov.ph
- **Password:** Records123!
- **Department:** Health

**Records Officer Access:** Can manage documents in their department

---

## Staff Members

### Finance Staff
- **Email:** staff.finance@lgu.gov.ph
- **Password:** Staff123!
- **Department:** Finance

### Engineering Staff
- **Email:** staff.engineering@lgu.gov.ph
- **Password:** Staff123!
- **Department:** Engineering

### Health Staff
- **Email:** staff.health@lgu.gov.ph
- **Password:** Staff123!
- **Department:** Health

### Agriculture Staff
- **Email:** staff.agriculture@lgu.gov.ph
- **Password:** Staff123!
- **Department:** Agriculture

**Staff Access:** Can create/edit own documents, view public and restricted documents in their department

---

## Public User

- **Email:** citizen@example.com
- **Password:** Citizen123!
- **Role:** Public User
- **Access:** Limited access to public documents only

---

## 🔑 Quick Login Guide

1. Choose an account based on the role you want to test
2. Use the email and password from this document
3. Login at `/login`

## 🎭 Role Comparison

| Role | View All Docs | Manage Dept | Approve Docs | View Audit Logs | Manage Users |
|------|--------------|-------------|--------------|-----------------|--------------|
| Super Admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| LGU Head | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dept Admin | Dept Only | ✅ | Dept Only | ❌ | Dept Only |
| Records Officer | Dept Only | Limited | ❌ | ❌ | ❌ |
| Staff | Own + Public | ❌ | ❌ | ❌ | ❌ |
| Public | Public Only | ❌ | ❌ | ❌ | ❌ |

## 🔄 Auto-Seeding

The test accounts are automatically created when you click the seed button. If an account already exists, it will be skipped. Check the browser console logs for seeding status:

```
🌱 Seeding test accounts...
✅ Created: admin@lgu.gov.ph (super_admin)
✅ Created: mayor@lgu.gov.ph (lgu_head)
...
🎉 Seeding complete! Created: X, Existing: Y, Total: 18
```

## 📧 Password Format

All passwords follow this format:
- Minimum 8 characters
- Contains uppercase letter
- Contains number
- Contains special character (!)

Example: `Admin123!`, `Finance123!`, `Staff123!`