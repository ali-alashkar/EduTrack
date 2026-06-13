# EduTrack Professional Roadmap

This roadmap is based on the current EduTrack app: local JSON storage, Electron desktop UI, barcode attendance, session-based homework and quiz tracking, dashboard reports, admin/assistant users, and WhatsApp parent messaging.

The goal is to turn the current working system into a professional product that can be installed, trusted, supported, and sold to tutoring centers.

## Current Product Strengths

- Complete local workflow from academic setup to student registration, groups, sessions, attendance, homework, quizzes, reports, and WhatsApp messages.
- Fast barcode-based attendance with manual search fallback.
- Parent communication already tied to real operational events.
- Editable WhatsApp templates and message logs.
- Admin/assistant account separation.
- Local JSON data makes the app simple to install and run without a server.
- Automated tests cover core IPC handlers, renderer workflows, and WhatsApp template behavior.

## Phase 1 - Make It Safe To Sell

These items should come before selling to real customers because they protect data and reduce support problems.

- **Backup and restore center** - Add one-click backup, restore, and automatic scheduled backup for `edutrack_data`.
- **Backup reminders** - Warn the owner if no backup has been created recently.
- **Data integrity checks** - Detect missing, empty, or corrupt JSON files at startup and show clear repair options.
- **Versioned migrations** - Add a migration system so new releases can update existing customer data safely.
- **First-run setup wizard** - Replace seeded production accounts with a setup flow for owner name, center name, first admin, country code, and default levels.
- **Remove default credential risk** - Force changing `admin/admin123` before real use or disable default users in production builds.
- **Installer branding** - Add real app icon, installer icon, product name, publisher name, version metadata, and support link.
- **Clean packaged data location** - Decide and document where production data lives, then make backup/restore use that exact location.
- **Release checklist** - Require tests, clean install test, WhatsApp connection test, barcode print test, and backup/restore test before every release.

## Phase 2 - Complete The Money Workflow

The app already stores session fees and student discounts. To sell to tutoring centers, payment tracking should become a first-class module.

- **Student balance page** - Show total due, paid, remaining, discounts, and last payment for each student.
- **Session payment status** - Mark each attended session as paid, unpaid, partially paid, or waived.
- **Payment entry modal** - Record payment amount, date, method, note, and linked sessions.
- **Receipts** - Generate printable/PDF receipts with center name, student name, amount, date, and remaining balance.
- **Payment reminders** - Queue WhatsApp reminders for unpaid or overdue balances.
- **Monthly financial report** - Show collected money, unpaid balances, discounts, gross amount, and net expected revenue.
- **Expense tracking** - Track rent, assistant salaries, printing, materials, and other expenses.
- **Profit dashboard** - Combine collected revenue and expenses into simple profit reporting.

## Phase 3 - Improve Daily Operations

These features make the app feel faster and more professional for front-desk use.

- **Bulk student import** - Import students from Excel/CSV with validation for names, phones, levels, centers, groups, and barcodes.
- **Excel export** - Export students, attendance, quiz scores, reports, payments, and WhatsApp logs.
- **Advanced barcode assignment** - Generate barcodes directly for selected students and save them back to student records.
- **Student profile timeline** - Combine attendance, homework, quizzes, payments, WhatsApp messages, blocks, and notes in one history view.
- **Block history** - Store every block/unblock event with reason, date, and user instead of only the latest block state.
- **Bulk group actions** - Move selected students between groups, assign level/center, or add notes in one action.
- **Session duplication** - Duplicate previous sessions to create weekly schedules faster.
- **Recurring sessions** - Generate repeated sessions for a group across a date range.
- **Attendance import correction** - Add safe tools to correct wrong check-ins without deleting important history silently.

## Phase 4 - Professional Reports

Current reports are useful, but a sellable system needs exports and parent-facing summaries.

- **Parent monthly report** - Generate a clean report per student with attendance, absence, homework, quiz scores, notes, and payments.
- **Printable session report** - Print session attendance with homework and quiz columns.
- **Group performance report** - Compare attendance rate, homework rate, quiz average, and absence count by group.
- **Student risk report** - Find students with repeated absence, missing homework, low quiz average, unpaid balance, or block status.
- **Center and level reports** - Filter performance and revenue by center and academic level.
- **Dashboard charts** - Add trend charts for attendance, homework completion, quiz averages, and revenue.
- **Custom date ranges** - Let reports run by day, week, month, term, or custom range.

## Phase 5 - WhatsApp Automation Upgrade

WhatsApp is one of the app's strongest selling points. It needs more controls, safety, and visibility.

- **Notification rules page** - Enable/disable automatic messages per event: attendance, homework, quiz, absence, block, payment reminder, monthly report.
- **Template validation** - Warn when a template uses unknown placeholders or misses important placeholders.
- **Template language sets** - Support Arabic, English, or mixed template packs.
- **Scheduled sending** - Send reminders or reports later instead of immediately.
- **Bulk announcements** - Send messages to selected levels, centers, groups, or filtered students.
- **Parent duplicate handling** - When siblings share one parent phone, optionally combine messages into one parent summary.
- **Message preview before batch send** - Show exact recipients and generated text before large sends.
- **Queue pause/resume** - Let the operator pause sending if a mistake is noticed.
- **Better failure recovery** - Show why messages failed and provide bulk retry for selected failures.
- **WhatsApp health checks** - Warn if Chrome path, WhatsApp auth, phone format, or connection status will prevent sending.

## Phase 6 - Security, Accountability, and Permissions

When multiple employees use the app, owners need control and traceability.

- **Granular roles** - Add Owner, Admin, Teacher, Assistant, Accountant, and Read-only roles.
- **Permission matrix** - Control access to payments, deletes, reports, WhatsApp sending, template editing, and user management.
- **Audit log** - Record student edits, deletes, attendance changes, payments, block/unblock actions, template edits, and user changes.
- **App lock** - Auto-lock after inactivity and require password/PIN to continue.
- **Password reset process** - Add a safe local owner reset flow.
- **Protected deletes** - Require stronger confirmation for deleting students, groups, sessions, payments, and backups.
- **Encrypted backups** - Let owners protect backup files with a password.

## Phase 7 - Product Polish

These items improve buyer confidence and reduce friction during demos.

- **Professional branding** - Replace placeholder names, default icons, and generic labels with sellable product branding.
- **Arabic/English interface** - Add a language switch for the UI and printed documents.
- **Print layout polish** - Improve barcode, attendance, receipt, and report print output.
- **Help and onboarding** - Add short in-app guides for setup, attendance, WhatsApp, reports, backup, and restore.
- **Demo mode** - Include sample data for demos without mixing it with real customer data.
- **Support bundle** - Export app version, safe logs, settings summary, and data health results for troubleshooting.
- **About and license screen** - Show version, license status, support contact, update notes, and device/customer ID.
- **Keyboard shortcuts** - Add shortcuts for search, attendance scan focus, save, print, and navigation.

## Phase 8 - Licensing, Updates, and Scale

These features support selling to multiple customers and maintaining the product over time.

- **License activation** - Add customer license key activation with offline grace period.
- **Device binding** - Optionally bind a license to a device or customer account.
- **Auto-update system** - Deliver signed updates without manual reinstall.
- **Release channels** - Support stable and beta builds.
- **Cloud backup option** - Optional remote backup for customers who want extra protection.
- **Multi-device sync** - Future option for owner, teacher, and front desk devices to share data.
- **Hosted owner portal** - Optional web dashboard for owners to view reports outside the desktop app.

## Suggested Build Order

1. Backup/restore, data health checks, and first-run setup.
2. Installer branding and clean production packaging.
3. Payment tracking, receipts, and payment reports.
4. Excel/PDF exports and parent monthly reports.
5. Audit log and role permissions.
6. WhatsApp notification rules, previews, and better queue controls.
7. Licensing, auto-update, and support tooling.

## Pre-Sale Checklist

- Test the installer on a clean Windows machine.
- Confirm data persists after closing and reopening the packaged app.
- Confirm backup and restore work with real-looking data.
- Confirm barcode printing works with the customer's scanner/printer setup.
- Confirm WhatsApp QR connection, queueing, retry, and templates work.
- Replace default credentials and demo data.
- Add product icon, support contact, version number, and update notes.
- Prepare a short user guide and setup video.
- Define pricing, support rules, refund policy, and update policy.
- Keep automated tests passing before every customer release.
