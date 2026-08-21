# Role-Based Access Control Guide

## Document Access Rules by Role

### Super Admin (`super_admin`)
- **Can View:** ALL documents from all departments
- **Can Create:** Documents in any department
- **Can Approve:** Any document
- **Can Manage:** All users and system settings
- **Dashboard Shows:** "Total Files" - system-wide count

### LGU Head (`lgu_head`)
- **Can View:** ALL documents from all departments
- **Can Create:** Documents in their department
- **Can Approve:** Any document
- **Can Manage:** View all users, approve/reject pending accounts
- **Dashboard Shows:** "Total Files" - system-wide count

### Department Admin (`dept_admin`)
- **Can View:** Only documents from their OWN department
- **Can Create:** Documents in their department
- **Can Approve:** Documents in their department only
- **Can Manage:** Users in their department
- **Dashboard Shows:** "Dept Files" - department-specific count
- **Access Level:** Clearance Level 2

### Records Officer (`records_officer`)
- **Can View:** Only documents from their OWN department
- **Can Create:** Documents in their department
- **Can Approve:** Cannot approve documents
- **Can Manage:** Limited document management in their department
- **Dashboard Shows:** "Dept Files" - department-specific count
- **Access Level:** Clearance Level 1

### Staff (`staff`)
- **Can View:**
  - Their OWN documents (all statuses: draft, pending, approved, rejected)
  - PUBLIC documents from their department that are approved
  - RESTRICTED documents from their department that are approved (if they have access)
- **Can Create:** Documents in their department
- **Can Approve:** Cannot approve documents
- **Can Manage:** Only their own documents
- **Dashboard Shows:** "Your Files" - personal document count
- **Access Level:** Clearance Level 0

### Public User (`public` or no role)
- **Can View:** Only APPROVED documents with PUBLIC access level
- **Can Create:** Cannot create documents
- **Can Approve:** Cannot approve documents
- **Can Manage:** Cannot manage anything
- **Dashboard Shows:** "Accessible Files" - public document count
- **Access Level:** No clearance

## Document Status Workflow

```
DRAFT → (Submit) → PENDING_APPROVAL → (Approve) → APPROVED
                                    → (Reject)  → REJECTED
```

### Draft Documents
- Only visible to the document creator
- Can be edited by creator
- Cannot be approved/downloaded until submitted

### Pending Approval Documents
- Visible to:
  - Document creator
  - Super Admin / LGU Head
  - Dept Admin (if same department)
  - Assigned approvers
- Cannot be downloaded (except by Super Admin / LGU Head)
- Awaiting approval workflow completion

### Approved Documents
- Visible based on access level:
  - Public: Everyone can see
  - Restricted: Only department members
  - Confidential: Only admins and authorized users
- Can be downloaded by authorized users
- Preview automatically shows (no button click needed)

### Rejected Documents
- Visible to:
  - Document creator
  - Super Admin / LGU Head
  - Original approvers
- Cannot be downloaded
- Shows rejection reason in audit log

## Access Level Hierarchy

1. **Public** - Visible to everyone (including public users)
2. **Restricted** - Department members only
3. **Confidential** - Admins and authorized users only

## Clearance Levels

Documents can be restricted based on user clearance level:

- **Level 4:** Super Admin Only - Most restricted, only super admins can view
- **Level 3:** LGU Head & Super Admin - Senior leadership only
- **Level 2:** Department Admins & Above - Management level access
- **Level 1:** Records Officers & Above - Operational staff with records access
- **Level 0:** Everyone (Staff & Above) - All authenticated users can view (default)
- **No Clearance:** Public users - Only see public documents regardless of level

### How Clearance Levels Work

When uploading a document, the uploader selects a "Who Can View" clearance level:
- **Level 0 (Default):** Any authenticated user can view
- **Level 1:** Only Records Officers, Dept Admins, LGU Head, and Super Admin can view
- **Level 2:** Only Dept Admins, LGU Head, and Super Admin can view
- **Level 3:** Only LGU Head and Super Admin can view
- **Level 4:** Only Super Admin can view

This works in combination with:
1. **Access Level** (Public/Restricted/Confidential)
2. **Department** filtering
3. **User's role** and clearance level

### Example:
A document with:
- Classification: Restricted
- Department: Finance
- Clearance Level: 2 (Dept Admins & Above)

Can be viewed by:
- Finance Dept Admin ✅
- Finance Records Officer ❌ (clearance too low)
- Finance Staff ❌ (clearance too low)
- Super Admin ✅ (can view all)
- LGU Head ✅ (can view all)

## Dashboard Statistics

The dashboard shows only what the current user can access:

- **Total/Dept/Your/Accessible Files:** Count of documents user can view
- **Pending:** Draft + Pending approval documents user can see
- **Approved:** Approved documents user can access
- **Rejected:** Rejected documents user can view

All stats are calculated from the filtered document list that the server returns based on the user's role, department, and clearance level.

## Server-Side Filtering

The backend API automatically filters documents based on:
1. User role
2. User department
3. Document access level
4. Document status
5. User clearance level

The client receives only documents the user is authorized to see, ensuring data security and proper access control.
