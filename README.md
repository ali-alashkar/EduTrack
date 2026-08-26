# EduTrack - Professional Student Registration & Tutoring Center Management

EduTrack is a modern, high-performance Windows desktop application designed for tutoring centers, private educators, and educational offices. It streamlines student registration, attendance scanning, quiz tracking, financial management, parent WhatsApp communications, and multi-device **Google Drive Cloud Synchronization**.

The app is built with Electron and stores customer data locally as JSON files with cloud backup capabilities. It is designed for fast front-desk operation with zero latency.

---

## 🌟 Comprehensive Feature Set

### ☁️ Google Drive Cloud Sync
- **Automatic Two-Way Sync**: Syncs local JSON databases with a compressed snapshot stored on Google Drive.
- **Startup Sync Check**: Automatically compares timestamps on startup and downloads newer cloud data before the UI opens.
- **Background Sync**: Continuously checks for local changes every **3 minutes** and uploads new snapshots automatically.
- **Offline Guard & Auto-Retry**: Skips sync quietly when offline without hanging or crashing, marking status as `📶 Offline` or `⏳ Pending Upload`. Automatically retries when internet reconnects.
- **Safety Pre-Sync Backups**: Automatically creates local safety recovery points before overwriting local data with cloud data.
- **Multi-Device Support**: Allows multiple computers and assistants to stay in sync with the same central database.

### 📊 Dashboard & Insights
- Key metric cards: Total Students, Groups, Active Sessions, Centers, Academic Levels, and Attendance Records.
- Attendance completion rate, homework completion rate, and financial summaries.
- Session attendance insights including student attendance status, discounted students, and same-level siblings.
- Quick action shortcuts for check-in, registration, and payments.

### 🏫 Academic Setup & Structure
- Manage academic levels (e.g., Grade 10, Grade 11, Secondary 2).
- Manage teaching centers with location, contact info, and assigned academic levels.
- Level and center filters integrated across all modules and reports.

### 👨‍🎓 Student Management
- Complete profile creation: Student Name, Barcode ID, Student Phone, Parent Phone, Email, Academic Level, Teaching Center, Notes, and Discount settings.
- **Smart Phone Duplication Protection**: Detects duplicate phone numbers across student and parent phone fields before saving, with controlled admin overrides.
- **Group Assignment**: Assign students to single or multiple groups directly from student forms.
- **Advanced Filtering**: Filter by search query, level, center, siblings, discount status, block status, group status, phone status, email, and notes.
- **Student Timeline & History**: Comprehensive history of attendance, payments, quiz scores, and block history.
- **Student Blocking**: Block students with mandatory reason recording, auto-queued WhatsApp notifications to parents, and check-in warning alerts.

### 💵 Payments & Financial Management (Admin)
- Track student fee payments, partial payments, and overdue balances.
- Student balance overview and receipt generation.
- Per-session payment status tracking (Paid, Unpaid, Exempt).
- Queue payment reminder notifications via WhatsApp.

### 💸 Expense Tracking & Profit Summaries (Admin)
- Record center operational expenses categorized by rent, utilities, staff salaries, materials, etc.
- Net profit/loss calculation combining session fees, book sales, and operational expenses over customizable date ranges.

### 📚 Book Sales Management
- Track educational book & material sales to students.
- Record paid/unpaid status for books and generate payment reminders.

### 🏷️ Barcode Card & Sticker Generator
- Generate printable student barcodes using auto-generated IDs or custom barcoding formats.
- Pre-built templates: Student ID Cards, Sticker Labels, Simple Barcodes, and Custom Background Uploads.
- Drag-and-drop barcode placement on custom background templates.
- Direct printing to standard barcode sticker printers or document printers.

### 👥 Group & Session Scheduling
- **Groups**: Organize by Name, Level, Center, Scheduled Day, Time, Capacity, and Notes.
- **Sessions**: Schedule sessions with Title, Group, Date, Duration, Fee, Topic, Homework Assignment, Quiz flag, and Max Score.
- Duplicate sessions or create recurring session schedules in bulk.

### ⏱️ Attendance & Homework Follow-up
- Instant barcode scanner check-in or manual search by Name/Phone/Barcode.
- Duplicate check-in prevention for the same session.
- Track check-in timestamp, homework status (Pending, Done, Partial, Missed, Excused), and homework notes.
- Instant display of student history, block warnings, and sibling notes upon check-in.
- CSV attendance export.

### 📝 Quiz Scores & Academic Performance
- Record quiz scores linked to sessions where quizzes are enabled.
- Only checked-in students can receive scores.
- Score percentage calculation, maximum score settings, and individual notes.
- Batch WhatsApp score dispatch to parents.

### 📈 Reports & Analytics
- **Session Reports**: Total attendance, homework rates, quiz average, fee collections.
- **Student Summary**: Cumulative attendance rate, homework compliance, quiz progression.
- **Group Analytics**: Attendance trends, group member activity.
- **Financial Reports**: Gross revenue, discount totals, net profit breakdown.
- **Excel Import & Export**: Bulk import student lists from Excel spreadsheets and export reports to Excel `.xlsx` format.

### 💬 WhatsApp Integration & Automated Messaging
- Connects directly via WhatsApp Web (QR code scan).
- Queued message sending with configurable random delays to prevent account flagging.
- Automatic phone formatting with configurable country code.
- Detailed delivery logs (Queued, Sent, Failed, No Phone) with retry/resend options.
- Dynamic template placeholders (`{student_name}`, `{session_title}`, `{quiz_score}`, `{homework_status}`, etc.).
- Template rotation to prevent repeating identical messages.

### 🛡️ Backup & System Recovery Center
- Manual recovery point creation.
- Scheduled automatic backups (Daily, Weekly, Monthly) with maximum retention policy.
- Local Database Export (`.json`) and Import with safety pre-restore backup points.

### 🔐 Setup Wizard & User Security
- **Guided Setup Wizard**: First-run configuration for owner name, center name, admin credentials, and default academic setup.
- **Role-Based Access Control**:
  - **Admin**: Complete access to all features, financials, user management, and cloud settings.
  - **Assistant**: Operational access (attendance, registration, quizzes, sessions) with restricted access to financials and user management.

---

## 🛠️ Technology Stack

- **Framework**: Electron 28
- **Frontend Logic**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Local Database**: Synchronous JSON file store via Node.js `fs`
- **Cloud Sync**: `googleapis` (OAuth 2.0 Desktop App Flow + Google Drive API v3)
- **WhatsApp Engine**: `whatsapp-web.js`
- **Barcode & QR**: `JsBarcode`, `qrcode`
- **Excel Utilities**: `xlsx`
- **Testing**: `jest`

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **Windows OS**: Recommended for production builds (Portable & Installer)

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/ali-alashkar/student-reg-system.git
cd student-reg-system
npm install
```

### 3. Development
Start the application in development mode:
```bash
npm start
```

### 4. Running Tests
Run Jest test suite:
```bash
npm test
```

### 5. Packaging & Production Builds
Build Windows Installer (NSIS) and Portable Executable:
```bash
npm run build
```
Build Portable Executable only:
```bash
npm run build:portable
```
Output binaries will be placed in the `dist/` directory.

---

## 📁 Project Structure

```text
student-reg-system/
├── main.js                    # Electron entry point & app lifecycle
├── preload.js                 # ContextBridge IPC bridge
├── main/
│   ├── cloud-sync.js          # Google Drive sync engine & offline guards
│   ├── db.js                  # Local JSON DB helper module
│   ├── backup.js              # Local backup & scheduled task manager
│   ├── integrity.js           # DB schema validation & migrations
│   └── ipc/                   # Modular IPC domain handlers
│       ├── sync.js            # Cloud Sync IPC
│       ├── auth.js            # User authentication IPC
│       ├── students.js        # Student management IPC
│       ├── payments.js        # Financial payments IPC
│       ├── system.js          # Backup & setup wizard IPC
│       └── ...                # Additional IPC modules
├── renderer/
│   ├── index.html             # Single Page Application container
│   ├── app.js                 # SPA routing & global state
│   ├── style.css              # Custom styling & glassmorphism theme
│   └── pages/                 # UI View Controllers
│       ├── backup.js          # Backup & Cloud Sync UI page
│       ├── students.js        # Student list & registration view
│       ├── attendance.js      # Barcode scanning attendance view
│       └── ...
└── whatsapp-service.js        # WhatsApp Web client wrapper
```

---

## 🔒 Default System Credentials

On first run without using the setup wizard, default accounts are seeded:

| Username | Password | Default Role |
|----------|----------|--------------|
| `admin` | `admin123` | Admin |
| `assistant` | `asst123` | Assistant |

*Note: Complete the Setup Wizard or change these credentials in Production.*

---

## 📄 License

MIT License. Copyright (c) EduTrack.

