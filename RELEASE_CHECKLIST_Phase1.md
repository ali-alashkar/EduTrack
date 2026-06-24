# EduTrack — Pre-Release Checklist

This checklist must be completed and signed off before every customer release.

---

## 1. Setup & First Run

- [ ] Delete `data/edutrack_data/` and `data/edutrack_backups/` on a clean machine, then launch — setup wizard should appear
- [ ] Complete wizard with real center name, admin username, strong password, and country code
- [ ] Confirm login works with the new credentials
- [ ] Confirm default `admin / admin123` credentials are rejected
- [ ] Confirm the default credential warning banner does **not** appear after wizard completion

## 2. Core Operations Test

- [ ] Create at least 2 levels, 1 center, 5 students, 2 groups, 1 session
- [ ] Assign 2 students to a group, create a session, scan barcodes for attendance
- [ ] Record homework status and quiz scores for attended students
- [ ] Verify dashboard totals match expected revenue

## 3. Barcode & Printing

- [ ] Print barcode sheet for a group — barcodes are readable by scanner
- [ ] Scan barcodes during attendance — all students check in correctly
- [ ] Test manual search fallback for students without barcodes

## 4. WhatsApp

- [ ] Start WhatsApp, scan QR code — status shows Connected
- [ ] Send an attendance message for one student — confirm received on parent's phone
- [ ] Send a homework status update — confirm message text is correct
- [ ] Test queue retry for a failed message
- [ ] Disconnect and reconnect WhatsApp — confirm QR regenerates correctly

## 5. Backup & Restore

- [ ] Create a manual backup — file appears in backup list with correct timestamp
- [ ] Delete a student, then restore the backup — student reappears correctly
- [ ] Export backup to custom path, then import it from that path
- [ ] Verify pre-restore backup is created automatically before any restore
- [ ] Enable daily auto-backup, wait for the next check, confirm backup is created

## 6. Data Integrity

- [ ] Manually corrupt a JSON file (write `{invalid`), restart app — recovery screen appears
- [ ] Reset corrupted file — app relaunches, data file is recreated as empty array
- [ ] Restore from backup via recovery screen — data is correctly restored

## 7. User Management

- [ ] Create an assistant account — confirm it cannot access Admin/Backup pages
- [ ] Change admin password via Change Password — old password no longer works
- [ ] Delete assistant account — confirm it is removed from the list

## 8. Installer (Packaged Build)

- [ ] Run `npm run build` — installer is generated in `dist/`
- [ ] Install on a **clean Windows machine** with no Node.js
- [ ] Confirm app launches, setup wizard appears, completes correctly
- [ ] Confirm data is stored next to the exe (not in the project folder)
- [ ] Confirm backup and restore work on the installed build
- [ ] Confirm barcode printing and WhatsApp connection work

## 9. Release Artifacts

- [ ] Version number in `package.json` is bumped
- [ ] All automated tests pass (`npm test`)
- [ ] Installer file is renamed with version number before sharing
- [ ] Prepare a short what's-new note for the customer

---

*Sign off: ________________________  Date: ___________*
