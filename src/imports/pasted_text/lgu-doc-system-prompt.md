Here is the **enhanced, complete prompt** with all missing parts added. This version is ready for real system build, capstone defense, or AI generator.

---

# LGU DOCUMENT MANAGEMENT SYSTEM – FULL WEBSITE PROMPT

Build a **secure, scalable, web-based LGU Document Management System** with **RBAC, workflow automation, audit logging, and high-performance search**.

---

# 1. SYSTEM GOAL

Create a centralized platform where LGU offices:

* Store documents
* Control access
* Track activity
* Approve workflows
* Retrieve files fast

Target:

* Replace paper-based process
* Improve security
* Improve efficiency

---

# 2. SYSTEM ARCHITECTURE

Use a **client-server architecture**:

### Flow

* User → Frontend (React)
* Frontend → API (Node.js / Supabase)
* API → PostgreSQL Database
* API → Secure File Storage

### Layers

* Presentation layer (UI)
* Application layer (API)
* Data layer (DB + Storage)

---

# 3. TECH STACK

* Frontend: React + Tailwind
* Backend: Node.js (Express) or Supabase
* Database: PostgreSQL
* Auth: JWT + bcrypt
* Storage: Encrypted file storage
* Indexing: Dynamic Inverted Index

---

# 4. USER ROLES

### Super Admin

* Full control
* Manage system

### LGU Head

* Approve all documents
* View reports

### Department Admin

* Manage department users and files

### Records Officer

* Validate and organize documents

### Staff

* Upload and edit own files

### Public User

* View approved public documents

---

# 5. ACCESS CONTROL SYSTEM

### Multi-layer security

Check:

* Role
* Department
* Clearance level
* Document permission override

### Access Levels

* Public
* Restricted
* Confidential
* Highly Confidential

### Advanced Access

* Time-based access expiration
* Download restrictions
* Watermark protected viewing

---

# 6. DOCUMENT MANAGEMENT

### Upload

* Drag and drop
* Multiple file upload
* Auto naming

### Metadata

* Title
* Description
* Tags
* Department
* Author
* Access level
* Status

### Version Control

* Version history
* Rollback option
* Change tracking

---

# 7. IMMUTABLE DOCUMENT SYSTEM

Implement:

* Finalized documents cannot be deleted
* Use soft-lock after approval
* Store all versions permanently

---

# 8. WORKFLOW SYSTEM

### Lifecycle

* Draft
* Submitted
* Under Review
* Approved
* Rejected
* Archived

### Features

* Multi-level approval
* Auto routing per department
* Comment system
* Revision requests

---

# 9. SEARCH SYSTEM

### Features

* Instant search
* Full-text search
* Filter system

### Filters

* Date
* Department
* Status
* Tags

### Performance

* Use Dynamic Inverted Index
* Incremental updates

---

# 10. NOTIFICATION SYSTEM

* Real-time notifications
* Email alerts

### Trigger

* Submission
* Approval request
* Rejection
* Expiration warning

---

# 11. AUDIT LOG SYSTEM

Track:

* Login attempts
* File access
* Edits
* Deletions
* Downloads

Store:

* User ID
* Timestamp
* Action
* IP address

---

# 12. SECURITY FEATURES

* JWT authentication
* bcrypt password hashing
* AES-256 file encryption
* HTTPS enforcement
* Rate limiting
* CSRF protection
* Secure file access token
* Session timeout

---

# 13. DIGITAL SIGNATURE

* eSignature support
* Upload signed documents
* QR code verification
* Integrity validation

---

# 14. BACKUP AND RECOVERY

* Automated daily backups
* Version restore
* Disaster recovery plan

---

# 15. DATABASE STRUCTURE

### Core Tables

* users
* roles
* permissions
* departments
* documents
* document_versions
* document_metadata
* access_control_list
* audit_logs
* notifications
* approvals

---

# 16. API STRUCTURE

### Auth

* POST /login
* POST /register
* POST /logout

### Documents

* POST /documents
* GET /documents
* GET /documents/:id
* PUT /documents/:id
* DELETE /documents/:id

### Workflow

* POST /approve
* POST /reject
* POST /submit

### Users

* GET /users
* POST /users
* PUT /users/:id

---

# 17. UI DESIGN

### Style

* Minimal
* Clean
* Neumorphism
* Soft shadows

---

### Pages

#### Dashboard

* Stats
* Recent activity
* Pending approvals

#### Document List

* Table view
* Filters
* Search bar

#### Document Viewer

* Preview
* Metadata
* Version history
* Comments

#### Admin Panel

* User management
* Role assignment
* Logs

---

# 18. PERFORMANCE TARGETS

* Search response < 2 seconds
* 99% uptime
* Support concurrent users

---

# 19. TESTING PLAN

* Functional testing
* Security testing
* Load testing
* User Acceptance Testing

Tools:

* Postman
* JMeter

---

# 20. ANALYTICS AND REPORTS

* Document usage stats
* Approval time tracking
* User activity logs

---

# 21. PUBLIC PORTAL

* View public documents
* Download approved files
* Transparency page

---

# 22. ADVANCED FEATURES

* OCR for scanned documents
* AI auto-tagging
* Smart recommendations

---

# 23. DEVELOPMENT MODEL

Use Agile:

### Sprint Plan

* Week 1–2: Requirements
* Week 3–6: Development
* Week 7–8: Testing
* Week 9: Deployment

---

# 24. EXPECTED OUTPUT

Generate:

* Full UI
* Backend API
* Database schema
* Authentication system
* File handling system

---

If you want next step, I can:

* Convert this into **Lovable AI prompt**
* Generate **React + Supabase code**
* Create **Figma UI screens**
* Build **SQL schema**

Just tell me what you need next.
