# EduTrack - Student Registration System

EduTrack is a Windows desktop application for tutoring centers and educational offices. It manages academic levels, centers, students, groups, sessions, attendance, homework follow-up, quiz scores, barcode IDs, reports, user accounts, and WhatsApp parent communication.

The app is built with Electron and stores customer data locally as JSON files. It is designed for fast front-desk operation: register students, print barcodes, schedule sessions, scan attendance, update homework and quiz results, and keep parents informed through WhatsApp.

## Current Feature Set

### Dashboard

- Shows total students, groups, sessions, centers, levels, and attendance records.
- Lists upcoming sessions and recent attendance.
- Shows homework completion rate.
- Shows session attendance insights, including attended count, discounted students, and same-level siblings.

### Academic Setup

- Manage academic levels such as Grade 10, Grade 11, or Secondary 2.
- Manage teaching centers with location, contact info, and assigned levels.
- Use levels and centers as filters throughout students, groups, and reports.

### Student Management

- Register and edit students with name, barcode, student phone, parent phone, email, level, center, notes, and discount settings.
- Detect duplicate phone usage across student and parent phone fields before saving.
- Allow controlled duplicate approval when needed.
- Assign students to groups directly from the student form.
- Filter students by search text, level, center, siblings, same-level siblings, discount status, block status, group status, phone status, email, and notes.
- View student details, attendance history, group membership, block status, and notes.
- Block a student with a required reason.
- Automatically queue a WhatsApp message to the parent when a student is blocked.
- Show blocked-student warnings during attendance check-in.

### Barcode Generator

- Generate printable student barcodes using random IDs or a specific entered ID.
- Supports student ID card, sticker, simple barcode, and custom image background templates.
- Allows custom barcode placement on uploaded background images.
- Prints generated barcode sheets from the app.

### Groups

- Create groups by name, level, center, day, time, capacity, and notes.
- Filter groups by name, level, and center.
- Add or remove group members.
- Group membership is used for sessions, reports, and absence notifications.

### Sessions

- Schedule sessions with title, group, date, time, duration, session fee, topic, homework assignment, quiz flag, and quiz max score.
- Filter sessions by title/topic, group, and date status.
- Open Attendance or Quiz Scores directly from a session row.
- Session fees are used for dashboard revenue and discount calculations.

### Attendance and Homework

- Select a session, then check students in by barcode scan or by searching name/phone/barcode.
- Prevent duplicate attendance for the same student and session.
- Manually add students to attendance.
- Track check-in time, homework status, and homework notes.
- Homework statuses include pending, done, partial, missed, and excused.
- Show recent student history after check-in.
- Search the present list.
- Export attendance as CSV.
- Queue attendance WhatsApp messages automatically when enabled.
- Queue homework WhatsApp messages when homework status is changed from pending.
- Queue absence WhatsApp messages for group students who did not attend.

### Quiz Scores

- Quiz score entry is tied to sessions with quiz enabled.
- Only attended students can receive quiz scores.
- Save individual scores or save all entered scores.
- Supports max score, notes, percentage display, clearing scores, and score search.
- Queue quiz WhatsApp messages automatically when enabled.
- Batch-send quiz results for a session.

### Reports

- Session report shows total attendance, homework done, partial, missed, quiz scored count, and quiz average.
- Student report shows attended sessions, homework rate, quiz average, and recent records.
- Group overview shows members, total sessions, total attendance, and homework done counts.
- Dashboard calculates gross revenue, discounted revenue, discount totals, and per-session attendance insights.

### WhatsApp Integration

- Connects through WhatsApp Web using QR login.
- Stores WhatsApp auth data locally.
- Sends messages through a queue, one by one.
- Formats local phone numbers using a configurable country code.
- Uses randomized delays between queued messages for safer sending.
- Tracks message status: queued, sent, failed, and no phone.
- Supports retrying failed messages and resending sent messages with a fresh template.
- Supports editable template categories for attendance, homework, quiz, attendance plus homework, session summary, absence, and block notifications.
- Template rotation is used to reduce repeated identical messages.
- WhatsApp settings control auto-send for attendance, homework, quiz, country code, and delay range.

### User Management

- Admin and assistant roles are supported.
- Admins can create users, delete users, and change passwords.
- Assistants can use operational features but cannot access user management.

## Core Workflow

1. Create levels and centers.
2. Register students with parent phone numbers and barcodes.
3. Create groups and assign students.
4. Schedule sessions for groups, including homework, fee, and optional quiz.
5. Print barcode cards or stickers.
6. Select a session and scan attendance.
7. Update homework status during check-in.
8. Enter quiz scores for attended students when the session has a quiz.
9. Use reports and dashboard insights to follow performance.
10. Use WhatsApp connection, templates, logs, retries, and batch actions to communicate with parents.

## User Roles

| Role | Access |
|------|--------|
| Admin | Full access, including user management |
| Assistant | Operational features except user management |

## Requirements

- Node.js 18 or later
- Windows for packaged installer/portable builds
- Google Chrome installed for the current WhatsApp Web automation configuration
- A WhatsApp account connected by QR code for parent messaging

## Getting Started

Install dependencies:

```bash
npm install
```

Run in development:

```bash
npm start
```

Run tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Build Windows installer and portable executable:

```bash
npm run build
```

Build portable executable only:

```bash
npm run build:portable
```

Build artifacts are written to `dist/`.

## Default Login

On first launch, the app seeds default accounts:

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Admin |
| `assistant` | `asst123` | Assistant |

Change or replace these credentials before using the app with real customer data.

## Data Storage

EduTrack stores data locally in an `edutrack_data` folder.

| Environment | Location |
|-------------|----------|
| Development | `data/edutrack_data/` |
| Packaged app | Next to the `.exe` |

| File | Contents |
|------|----------|
| `users.json` | User accounts and roles |
| `levels.json` | Academic levels |
| `centers.json` | Teaching centers |
| `students.json` | Student records, discounts, blocks, and barcodes |
| `groups.json` | Groups and member student IDs |
| `sessions.json` | Scheduled sessions, fees, homework, and quiz setup |
| `attendance.json` | Check-in records and homework status |
| `quiz_scores.json` | Quiz scores linked to sessions and students |
| `whatsapp_settings.json` | WhatsApp automation settings |
| `whatsapp_templates.json` | Editable WhatsApp templates |
| `whatsapp_log.json` | Message queue and delivery history |

Back up `edutrack_data` regularly. A commercial release should include built-in backup and restore before being sold broadly.

## Project Structure

```text
student-reg-system/
|-- main.js                    # Electron main process, storage, IPC handlers
|-- preload.js                 # Secure renderer API bridge
|-- whatsapp-service.js         # WhatsApp Web client, queue, phone formatting
|-- whatsapp-templates.js       # Default templates and placeholder replacement
|-- package.json
|-- data/
|   `-- edutrack_data/          # JSON database in development
|-- renderer/
|   |-- index.html              # App shell and navigation
|   |-- app.js                  # Login, routing, shared UI helpers
|   |-- style.css               # Global styles
|   `-- pages/
|       |-- dashboard.js
|       |-- levels-centers.js
|       |-- students.js
|       |-- groups-sessions.js
|       |-- attendance.js
|       |-- quizzes.js
|       |-- users-reports.js
|       |-- whatsapp.js
|       `-- barcodes.js
`-- tests/
    |-- main.test.js            # IPC and business logic tests
    |-- renderer.test.js        # Renderer workflow tests
    `-- whatsapp.test.js        # Template and phone formatting tests
```

## Tech Stack

- Electron
- Vanilla JavaScript
- Local JSON storage through Node.js `fs`
- whatsapp-web.js
- qrcode
- JsBarcode in the renderer
- Jest
- electron-builder

## Commercial Readiness

EduTrack already has a strong local workflow for registration, attendance, quizzes, reporting, barcodes, and WhatsApp messaging. Before selling it as a polished product, prioritize backup/restore, installer branding, first-run setup, default credential removal, data migrations, payment tracking, exports, audit logs, and support tooling. The detailed roadmap is in [FUTURE_FEATURES.md](./FUTURE_FEATURES.md).

## License

MIT
