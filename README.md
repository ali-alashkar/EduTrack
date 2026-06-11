# EduTrack - Student Registration System

A desktop application for managing students, groups, sessions, quizzes, attendance, payments, and parent communication at educational centers. Built with Electron, EduTrack stores data locally in JSON files and supports barcode-based check-in for fast session attendance.

## Features

- **Dashboard** - Overview stats plus per-session revenue tracking.
- **Levels** - Define academic levels such as Grade 10 or Grade 11.
- **Centers** - Manage teaching centers and their assigned levels.
- **Students** - Register students with contact info, level, optional discount, parent phone, and unique barcodes.
- **Barcodes** - Generate and print barcode labels for students.
- **Groups** - Organize students into groups for session scheduling.
- **Sessions** - Schedule sessions by date and time, set fees, and attach optional quizzes.
- **Attendance** - Check in students with barcode scans or manual search, and track homework status.
- **Quiz Scores** - Record per-student quiz results for attended students.
- **Reports** - Review student attendance, session attendance, quiz results, and activity summaries.
- **WhatsApp Messaging** - Connect WhatsApp Web, manage message templates, and send parent notifications.
- **User Management** - Admin-only account creation and password management.

## User Roles

| Role | Access |
|------|--------|
| **Admin** | Full access, including user management |
| **Assistant** | All features except user management |

## Requirements

- [Node.js](https://nodejs.org/) 18 or later
- Windows for building distributable installers

## Getting Started

### Install dependencies

```bash
npm install
```

### Run in development

```bash
npm start
```

### Run tests

```bash
npm test
```

Watch mode:

```bash
npm run test:watch
```

### Build for Windows

Full installer and portable build:

```bash
npm run build
```

Portable executable only:

```bash
npm run build:portable
```

Built artifacts are output to the `dist/` folder.

## Default Login

On first launch, the app seeds default accounts:

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Admin |
| `assistant` | `asst123` | Assistant |

Change these passwords after your first login, especially in production.

## Data Storage

All data is stored as JSON files in an `edutrack_data` folder:

| Environment | Location |
|-------------|----------|
| Development | `data/edutrack_data/` |
| Production packaged app | Next to the `.exe` |

| File | Contents |
|------|----------|
| `users.json` | User accounts and roles |
| `levels.json` | Academic levels |
| `centers.json` | Teaching centers |
| `students.json` | Student records and barcodes |
| `groups.json` | Student groups |
| `sessions.json` | Scheduled sessions |
| `attendance.json` | Check-in records and homework status |
| `quiz_scores.json` | Per-student quiz scores linked to sessions |
| `whatsapp_settings.json` | WhatsApp connection and messaging settings |
| `whatsapp_log.json` | WhatsApp message history |

Back up the `edutrack_data` folder regularly to preserve your data.

## Project Structure

```text
student-reg-system/
|-- main.js                    # Electron main process and IPC handlers
|-- preload.js                 # Secure API bridge to the renderer
|-- whatsapp-service.js         # WhatsApp Web client integration
|-- whatsapp-templates.js       # Message template helpers
|-- package.json
|-- data/
|   `-- edutrack_data/          # JSON database in development
|-- renderer/
|   |-- index.html              # App shell and navigation
|   |-- app.js                  # Router, auth, and shared UI utilities
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
    |-- main.test.js            # IPC handler unit tests
    |-- renderer.test.js        # Renderer logic tests
    `-- whatsapp.test.js        # WhatsApp service tests
```

## Tech Stack

- **Electron** - Desktop shell
- **Vanilla JavaScript** - UI and business logic
- **JSON file storage** - Local persistence through Node.js `fs`
- **JsBarcode and QRCode** - Student barcode and QR output
- **whatsapp-web.js** - WhatsApp Web integration
- **Jest** - Unit testing

## Future Work

Planned ideas and larger follow-up items live in [FUTURE_FEATURES.md](./FUTURE_FEATURES.md).

## License

MIT
