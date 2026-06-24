# EduTrack Button Test Checklist

Use this file when testing a new build. For each button, click it once in the listed state and confirm the expected result. Mark Pass, Fail, or Notes.

Recommended test data:
- At least 2 levels.
- At least 2 centers.
- At least 3 students, including one blocked student and one student without a barcode.
- At least 2 groups with students.
- At least 2 sessions, including one quiz session.
- At least one attendance record, one quiz score, one payment, and one backup.

## App Shell

| Area | Button | Expected result | Status |
| --- | --- | --- | --- |
| Login | Eye button | Password visibility toggles. |  |
| Login | Login | Valid user opens dashboard. Invalid user shows error. |  |
| Header | Minimize | Window minimizes. |  |
| Header | Maximize | Window toggles maximize/restore. |  |
| Header | Close | Window closes. |  |
| Sidebar | Each navigation item | Correct page opens and active state changes. |  |
| Header | Logout | User returns to login screen. |  |
| Default credentials warning | Change Password Now | Password change modal opens. |  |
| Modal | X / Cancel / Close | Modal closes without saving. |  |

## Dashboard

| Button | Expected result | Status |
| --- | --- | --- |
| Backup Now | Opens Backup page. |  |
| View All | Opens Sessions page. |  |
| View Payments | Opens Payments page. |  |
| View Sessions | Opens Sessions page. |  |
| Manage | Opens Attendance page. |  |

## Levels

| Button | Expected result | Status |
| --- | --- | --- |
| Add Level | Opens Add Level modal. |  |
| Create | Creates a level or shows validation if name is empty/duplicate. |  |
| Edit | Opens existing level data. |  |
| Update | Saves level changes and syncs students, groups, and center grade lists. |  |
| Delete | Confirmation appears, then level is removed when confirmed. |  |

## Centers

| Button | Expected result | Status |
| --- | --- | --- |
| Add Center | Opens Add Center modal. |  |
| Create | Creates center or shows validation if name is empty. |  |
| Edit | Opens existing center data. |  |
| Update | Saves center changes and syncs students and groups. |  |
| Delete | Confirmation appears, then center is removed when confirmed. |  |

## Students

| Button | Expected result | Status |
| --- | --- | --- |
| Add Student | Opens Register Student modal. |  |
| Register | Creates student or shows required-field / duplicate warnings. |  |
| Edit | Opens student data. |  |
| Update | Saves student changes and group membership. |  |
| Delete | Confirmation appears, then student is removed when confirmed. |  |
| Profile | Opens student profile modal with details/history. |  |
| Generate barcode | Creates barcode for that student. |  |
| Generate Missing Barcodes | Creates barcodes for students missing them. |  |
| Export to Excel | Exports student list. |  |
| Block Student | Opens block modal. |  |
| Save Block | Requires reason, blocks student, and queues WhatsApp notification if configured. |  |
| Remove Block | Unblocks student. |  |
| Bulk Assign Group | Assigns selected students to selected group. |  |
| Bulk Update Level | Updates selected students' level. |  |
| Bulk Update Center | Updates selected students' center. |  |

## Groups

| Button | Expected result | Status |
| --- | --- | --- |
| Add Group | Opens New Group modal. |  |
| Create | Creates group or shows validation if name is empty. |  |
| Members | Opens group members modal. |  |
| Add | Adds selected student to group. |  |
| Remove | Removes student from group. |  |
| Done | Closes members modal. |  |
| Edit | Opens existing group data. |  |
| Update | Saves group changes. |  |
| Delete | Confirmation appears, then group is removed when confirmed. |  |

## Sessions

| Button | Expected result | Status |
| --- | --- | --- |
| Add Session | Opens New Session modal. |  |
| Create | Creates session or shows validation if title/group/date is invalid. |  |
| Recurring Sessions | Opens recurring session generator. |  |
| Generate Sessions | Creates scheduled sessions for selected days/date range. |  |
| Attend | Opens Attendance page and selects session. |  |
| Quiz | Opens Quizzes page and selects session. |  |
| Edit | Opens session data. |  |
| Update | Saves session changes. |  |
| Dup | Opens duplicate modal. |  |
| Duplicate | Creates copied session with chosen date/title. |  |
| Delete | Confirmation appears, then session is removed when confirmed. |  |

## Attendance

| Button | Expected result | Status |
| --- | --- | --- |
| Manual Add | Opens manual add modal. |  |
| Add | Adds selected student to attendance. |  |
| Check In search result | Checks in selected student. |  |
| Correct | Opens correction modal. |  |
| Move | Moves attendance record to selected session. |  |
| Reassign | Reassigns attendance record to selected student. |  |
| Remove | Confirmation appears, then attendance record is removed. |  |
| Send All WhatsApp | Queues/sends attendance messages for checked-in students. |  |
| Send Absence | Queues/sends absence messages for missing group students. |  |
| Export CSV | Exports attendance CSV. |  |
| Leave Block | Closes blocked-student warning. |  |
| Remove Block | Unblocks student from attendance warning. |  |

## Quizzes

| Button | Expected result | Status |
| --- | --- | --- |
| Save / Update score | Saves quiz score for attended student. |  |
| Remove score | Removes quiz score after confirmation. |  |
| Send WhatsApp | Queues/sends quiz message. |  |

## Payments

| Button | Expected result | Status |
| --- | --- | --- |
| Add Payment | Opens payment modal. |  |
| Save Payment | Creates payment or shows validation for bad amount/student. |  |
| Delete | Confirmation appears, then payment is removed. |  |
| View Balance | Shows selected student's balance/details. |  |

## Reports

| Button | Expected result | Status |
| --- | --- | --- |
| Student search suggestion | Loads selected student report. |  |
| Session selector | Loads selected session summary. |  |
| Group level/center filters | Group overview refreshes with matching groups. |  |

## Barcodes

| Button | Expected result | Status |
| --- | --- | --- |
| Generate Random | Adds requested number of random barcode cards. |  |
| Add to Grid | Adds entered barcode, or warns when empty. |  |
| Card X | Removes that barcode card. |  |
| Print Barcodes | Opens print dialog / print flow. |  |

## Import

| Button | Expected result | Status |
| --- | --- | --- |
| Download Template | Downloads/imports student template file. |  |
| Select File | Opens file picker and preview. |  |
| Cancel | Clears import preview and returns to file selection. |  |
| Import Students | Imports valid rows and reports created/skipped rows. |  |

## Backup

| Button | Expected result | Status |
| --- | --- | --- |
| Export Backup | Creates external backup export. |  |
| Import Backup | Opens backup import flow. |  |
| Create Backup | Creates manual backup and refreshes list. |  |
| Save Schedule Settings | Saves automatic backup settings. |  |
| Restore | Confirmation appears, then restore runs and app relaunches if required. |  |
| Delete | Confirmation appears, then backup file is removed. |  |

## WhatsApp

| Button | Expected result | Status |
| --- | --- | --- |
| Connection tab | Shows connection panel. |  |
| Settings tab | Shows settings panel. |  |
| Log tab | Shows message log. |  |
| Templates tab | Shows template editor. |  |
| Connect | Starts WhatsApp connection flow / QR status. |  |
| Disconnect | Disconnects active WhatsApp session. |  |
| Save Settings | Saves WhatsApp settings. |  |
| Refresh | Reloads WhatsApp log. |  |
| Retry | Requeues failed message. |  |
| Resend | Creates a fresh send for sent message. |  |
| View | Opens message text modal. |  |
| Add Template | Opens template modal. |  |
| Edit Template | Opens template text in modal. |  |
| Save Template | Saves new/edited template. |  |
| Delete Template | Deletes template unless it is the last one. |  |
| Reset Templates | Confirmation appears, then templates reset to defaults. |  |
| Variable pill | Inserts selected variable into template text. |  |

## Recovery Screen

| Button | Expected result | Status |
| --- | --- | --- |
| Restore Backup | Runs backup import and relaunches on success. |  |
| Reset Corrupted Files | Confirmation appears, then corrupted files reset and app relaunches. |  |
| Quit App | App quits. |  |

