/**
 * ============================================================
 *  EduTrack – Renderer Logic Unit & Scenario Test Suite
 *  Tests the filtration and search suggestions in the UI.
 *  Run: npm test
 * ============================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Mock DOM & Browser Environment ───────────────────────────
const documentMocks = {};

global.document = {
  addEventListener: jest.fn(),
  getElementById: jest.fn((id) => {
    if (!documentMocks[id]) {
      documentMocks[id] = {
        value: '',
        innerHTML: '',
        textContent: '',
        classList: {
          add: jest.fn(function() { this.containsMock.add(arguments[0]); }),
          remove: jest.fn(function() { this.containsMock.delete(arguments[0]); }),
          toggle: jest.fn(function(cls, force) {
            if (force !== undefined) {
              if (force) this.containsMock.add(cls);
              else this.containsMock.delete(cls);
            } else {
              if (this.containsMock.has(cls)) this.containsMock.delete(cls);
              else this.containsMock.add(cls);
            }
          }),
          contains: jest.fn(function(cls) { return this.containsMock.has(cls); }),
          containsMock: new Set(),
        },
        addEventListener: jest.fn(),
        appendChild: jest.fn(),
        style: {},
        contains: jest.fn(() => false),
        focus: jest.fn(),
        blur: jest.fn()
      };
    }
    return documentMocks[id];
  }),
  querySelectorAll: jest.fn(() => []),
  querySelector: jest.fn(() => null),
  createElement: jest.fn((tag) => ({
    className: '',
    innerHTML: '',
    style: {},
    appendChild: jest.fn(),
    remove: jest.fn(),
  })),
};

global.window = {
  confirm: jest.fn(() => true),
  api: {
    students: {
      list: jest.fn(),
      byBarcode: jest.fn(),
      block: jest.fn(),
      unblock: jest.fn(),
      delete: jest.fn(),
    },
    groups: {
      list: jest.fn(),
    },
    levels: {
      list: jest.fn(),
    },
    centers: {
      list: jest.fn(),
    },
    sessions: {
      list: jest.fn(),
    },
    attendance: {
      list: jest.fn(),
      bySession: jest.fn(),
      manualAdd: jest.fn(),
      update: jest.fn(),
      scan: jest.fn(),
    },
    reports: {
      studentSummary: jest.fn(),
      sessionSummary: jest.fn(),
      dashboard: jest.fn(),
    },
    whatsapp: {
      getSettings: jest.fn().mockResolvedValue({ autoSendAttendance: false, autoSendHomework: false, autoSendQuiz: false }),
      status: jest.fn().mockResolvedValue({ status: 'disconnected', queueLength: 0 }),
      sendAttendance: jest.fn().mockResolvedValue({ success: false }),
      sendHomework: jest.fn().mockResolvedValue({ success: false }),
      sendQuiz: jest.fn().mockResolvedValue({ success: false }),
      getSessionStatus: jest.fn().mockResolvedValue({ statusMap: {}, log: [] }),
      onMessageSent: jest.fn(),
    },
    backup: {
      checkReminder: jest.fn().mockResolvedValue({ showReminder: false, daysSince: 0 }),
      import: jest.fn().mockResolvedValue({ success: true }),
    },
    system: {
      getCorruptedFiles: jest.fn().mockResolvedValue([]),
      resetCorruptedFiles: jest.fn().mockResolvedValue({ success: true }),
      relaunch: jest.fn(),
      quit: jest.fn(),
    }
  }
};

global.el = (id) => global.document.getElementById(id);
global.toast = jest.fn();
global.openModal = jest.fn();
global.closeModal = jest.fn();
global.confirmAction = jest.fn((msg) => window.confirm(msg));
global.formatDate = jest.fn((d) => d);
global.formatTime = jest.fn((t) => t);
global.hwBadge = jest.fn((s) => s);
global.State = { user: { role: 'admin' } };

const vm = require('vm');
const loadPageScript = (filename) => {
  const filePath = path.join(__dirname, '..', 'renderer', 'pages', filename);
  let code = fs.readFileSync(filePath, 'utf8');
  // Rewrite top-level let and const to var so they attach to JSDOM/Jest global scope
  code = code.replace(/^let\s+/gm, 'var ');
  code = code.replace(/^const\s+/gm, 'var ');
  const context = vm.isContext(global) ? global : vm.createContext(global);
  vm.runInContext(code, context);
};

// Load scripts
loadPageScript('students.js');
loadPageScript('groups-sessions.js');
loadPageScript('users-reports.js');
loadPageScript('attendance.js');
loadPageScript('dashboard.js');

describe('EduTrack Renderer – Search & Filtration Scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set default resolved values to prevent undefined errors in pages
    window.api.students.list.mockResolvedValue([]);
    window.api.groups.list.mockResolvedValue([]);
    window.api.levels.list.mockResolvedValue([]);
    window.api.centers.list.mockResolvedValue([]);
    window.api.sessions.list.mockResolvedValue([]);
    window.api.attendance.list.mockResolvedValue([]);
    window.api.attendance.bySession.mockResolvedValue([]);
    
    // Clear the documentMocks values
    for (const key in documentMocks) {
      documentMocks[key].value = '';
      documentMocks[key].innerHTML = '';
      documentMocks[key].textContent = '';
      documentMocks[key].classList.containsMock.clear();
    }
  });

  // ── Scenario 1: Students Page Filtration ───────────────────
  describe('Students Page Filtration', () => {
    test('✓ Filters students by search query, level, and center', async () => {
      const mockStudents = [
        { id: 's1', name: 'Alice Smith', barcode: 'BC001', phone: '123', level: 'Grade 10', center: 'Center A', createdAt: '2024-01-01' },
        { id: 's2', name: 'Bob Jones', barcode: 'BC002', phone: '456', level: 'Grade 11', center: 'Center B', createdAt: '2024-01-02' },
        { id: 's3', name: 'Charlie Brown', barcode: 'BC003', phone: '789', level: 'Grade 10', center: 'Center B', createdAt: '2024-01-03' },
      ];
      window.api.students.list.mockResolvedValue(mockStudents);
      window.api.levels.list.mockResolvedValue([]);
      window.api.centers.list.mockResolvedValue([]);
      window.api.groups.list.mockResolvedValue([]);

      await renderStudents();

      // Test filtration with no filters (should show all)
      await filterStudents([]);
      let html = el('students-tbody').innerHTML;
      expect(html).toContain('Alice Smith');
      expect(html).toContain('Bob Jones');
      expect(html).toContain('Charlie Brown');

      // Filter by level (Grade 10) -> Alice and Charlie
      el('student-level-filter').value = 'Grade 10';
      await filterStudents([]);
      html = el('students-tbody').innerHTML;
      expect(html).toContain('Alice Smith');
      expect(html).not.toContain('Bob Jones');
      expect(html).toContain('Charlie Brown');

      // Filter by center (Center B) alongside Grade 10 -> only Charlie
      el('student-center-filter').value = 'Center B';
      await filterStudents([]);
      html = el('students-tbody').innerHTML;
      expect(html).not.toContain('Alice Smith');
      expect(html).not.toContain('Bob Jones');
      expect(html).toContain('Charlie Brown');

      // Filter by name search query "Alice" -> no one matches (since level is Grade 10 & center is Center B)
      el('student-search').value = 'Alice';
      await filterStudents([]);
      expect(el('students-tbody').innerHTML).toContain('No students found.');

      // Reset level & center filters, search for "Bob" -> only Bob matches
      el('student-level-filter').value = '';
      el('student-center-filter').value = '';
      el('student-search').value = 'Bob';
      await filterStudents([]);
      html = el('students-tbody').innerHTML;
      expect(html).not.toContain('Alice');
      expect(html).toContain('Bob Jones');
      expect(html).not.toContain('Charlie');
    });

    test('filters students by property: siblings, twins, discount, and blocked', async () => {
      const mockStudents = [
        { id: 's1', name: 'Ali One', barcode: 'BC001', parentPhone: '01000000000', level: 'Grade 10', center: 'Center A', hasDiscount: true, createdAt: '2024-01-01' },
        { id: 's2', name: 'Omar One', barcode: 'BC002', parentPhone: '01000000000', level: 'Grade 10', center: 'Center A', createdAt: '2024-01-02' },
        { id: 's3', name: 'Sara One', barcode: 'BC003', parentPhone: '01000000000', level: 'Grade 11', center: 'Center A', createdAt: '2024-01-03' },
        { id: 's4', name: 'Mona Solo', barcode: 'BC004', parentPhone: '01099999999', level: 'Grade 10', center: 'Center B', isBlocked: true, createdAt: '2024-01-04' },
      ];
      window.api.students.list.mockResolvedValue(mockStudents);
      window.api.levels.list.mockResolvedValue([]);
      window.api.centers.list.mockResolvedValue([]);
      window.api.groups.list.mockResolvedValue([]);

      await renderStudents();

      el('student-property-filter').value = 'siblings';
      await filterStudents([]);
      let html = el('students-tbody').innerHTML;
      expect(html).toContain('Ali One');
      expect(html).toContain('Omar One');
      expect(html).toContain('Sara One');
      expect(html).not.toContain('Mona Solo');

      el('student-property-filter').value = 'twins';
      await filterStudents([]);
      html = el('students-tbody').innerHTML;
      expect(html).toContain('Ali One');
      expect(html).toContain('Omar One');
      expect(html).not.toContain('Sara One');

      el('student-property-filter').value = 'discount';
      await filterStudents([]);
      html = el('students-tbody').innerHTML;
      expect(html).toContain('Ali One');
      expect(html).not.toContain('Omar One');

      el('student-property-filter').value = 'blocked';
      await filterStudents([]);
      html = el('students-tbody').innerHTML;
      expect(html).toContain('Mona Solo');
      expect(html).not.toContain('Ali One');
    });

    test('delete student button handler confirms, deletes, and refreshes the table', async () => {
      const beforeDelete = [
        { id: 's1', name: 'Alice Smith', barcode: 'BC001', phone: '123', level: 'Grade 10', center: 'Center A', createdAt: '2024-01-01' },
      ];
      window.api.students.list
        .mockResolvedValueOnce(beforeDelete)
        .mockResolvedValueOnce([]);
      window.api.students.delete.mockResolvedValue({ success: true });

      await renderStudents();
      await window.deleteStudent('s1');

      expect(confirmAction).toHaveBeenCalledWith('Delete this student?');
      expect(window.api.students.delete).toHaveBeenCalledWith('s1');
      expect(toast).toHaveBeenCalledWith('Student deleted', 'success');
      expect(el('students-tbody').innerHTML).toContain('No students found.');
    });
  });

  // ── Scenario 2: Groups Page Filtration ─────────────────────
  describe('Groups Page Filtration', () => {
    test('✓ Filters groups by search query, level, and center', async () => {
      const mockGroups = [
        { id: 'g1', name: 'Group Alpha', level: 'Grade 10', center: 'Center A', studentIds: [] },
        { id: 'g2', name: 'Group Beta', level: 'Grade 11', center: 'Center B', studentIds: ['s1'] },
        { id: 'g3', name: 'Math Advanced', level: 'Grade 10', center: 'Center B', studentIds: [] },
      ];
      window.api.groups.list.mockResolvedValue(mockGroups);
      window.api.students.list.mockResolvedValue([]);
      window.api.levels.list.mockResolvedValue([]);
      window.api.centers.list.mockResolvedValue([]);

      await renderGroups();

      // Filter by level (Grade 10) -> Group Alpha and Math Advanced
      el('group-level-filter').value = 'Grade 10';
      filterGroups();
      let html = el('groups-tbody').innerHTML;
      expect(html).toContain('Group Alpha');
      expect(html).not.toContain('Group Beta');
      expect(html).toContain('Math Advanced');

      // Filter by center (Center B) -> Math Advanced
      el('group-center-filter').value = 'Center B';
      filterGroups();
      html = el('groups-tbody').innerHTML;
      expect(html).not.toContain('Group Alpha');
      expect(html).toContain('Math Advanced');

      // Filter by search query "Group" -> empty (Math Advanced doesn't contain "Group")
      el('group-search').value = 'Group';
      filterGroups();
      expect(el('groups-tbody').innerHTML).toContain('No groups yet.');
    });
  });

  // ── Scenario 3: Sessions Page Filtration ───────────────────
  describe('Sessions Page Filtration', () => {
    test('✓ Filters sessions by search, group, and date status', async () => {
      const mockSessions = [
        { id: 'ss1', title: 'Algebra basics', groupId: 'g1', date: '2026-06-05', topic: 'Intro' }, // Today (2026-06-05)
        { id: 'ss2', title: 'Calculus derivatives', groupId: 'g2', date: '2026-06-10', topic: 'Advanced' }, // Upcoming
        { id: 'ss3', title: 'Geometry angles', groupId: 'g1', date: '2026-06-01', topic: 'Shapes' }, // Past
      ];
      window.api.sessions.list.mockResolvedValue(mockSessions);
      window.api.groups.list.mockResolvedValue([
        { id: 'g1', name: 'Group A' },
        { id: 'g2', name: 'Group B' }
      ]);

      await renderSessions();

      // Filter by group g1 -> Algebra basics and Geometry angles
      el('session-group-filter').value = 'g1';
      filterSessions([
        { id: 'g1', name: 'Group A' },
        { id: 'g2', name: 'Group B' }
      ]);
      let html = el('sessions-tbody').innerHTML;
      expect(html).toContain('Algebra basics');
      expect(html).not.toContain('Calculus derivatives');
      expect(html).toContain('Geometry angles');

      // Filter by upcoming status on g1 -> none
      el('session-date-filter').value = 'upcoming';
      filterSessions([
        { id: 'g1', name: 'Group A' },
        { id: 'g2', name: 'Group B' }
      ]);
      expect(el('sessions-tbody').innerHTML).toContain('No sessions found.');

      // Reset date, search for "basics" -> Algebra basics
      el('session-date-filter').value = '';
      el('session-search').value = 'basics';
      filterSessions([
        { id: 'g1', name: 'Group A' },
        { id: 'g2', name: 'Group B' }
      ]);
      html = el('sessions-tbody').innerHTML;
      expect(html).toContain('Algebra basics');
      expect(html).not.toContain('Geometry angles');
    });
  });

  // ── Scenario 4: Student Report Search Suggestions ─────────
  describe('Reports Student Search & suggestions', () => {
    test('✓ Searches students by name/barcode and shows list. Clicking loads student report.', async () => {
      const mockStudents = [
        { id: 's1', name: 'Alice Cooper', barcode: 'BC001', level: 'Grade 10', center: 'Center A' },
        { id: 's2', name: 'Bob Dylan', barcode: 'BC002', level: 'Grade 11', center: 'Center B' },
      ];
      window.api.sessions.list.mockResolvedValue([]);
      window.api.students.list.mockResolvedValue(mockStudents);
      window.api.groups.list.mockResolvedValue([]);
      window.api.attendance.list.mockResolvedValue([]);

      await renderReports();

      // Mock input event on search suggestions
      const searchInput = el('rep-student-search');
      const suggestionsBox = el('rep-student-suggestions');

      // Type "Ali" to match Alice
      searchInput.value = 'Ali';
      // Trigger the input handler
      searchInput.addEventListener.mock.calls.find(c => c[0] === 'input')[1]();

      expect(suggestionsBox.innerHTML).toContain('Alice Cooper');
      expect(suggestionsBox.innerHTML).not.toContain('Bob Dylan');
      expect(suggestionsBox.classList.containsMock.has('hidden')).toBe(false);

      // Mock loadStudentReport call
      window.api.reports.studentSummary.mockResolvedValue([
        { sessionId: 'ss1', sessionTitle: 'Math 1', sessionDate: '2026-06-01', homeworkStatus: 'done' }
      ]);

      await window.loadStudentReport('s1', 'Alice Cooper');

      expect(searchInput.value).toBe('Alice Cooper');
      expect(suggestionsBox.classList.containsMock.has('hidden')).toBe(true);
      expect(window.api.reports.studentSummary).toHaveBeenCalledWith('s1');

      // Verify stats are rendered
      const resultHtml = el('rep-student-result').innerHTML;
      expect(resultHtml).toContain('Sessions');
      expect(resultHtml).toContain('HW Done');
      expect(resultHtml).toContain('Math 1');
    });
  });

  // ── Scenario 5: Manual Attendance Search Suggestions ──────
  describe('Manual Attendance Search Suggestions', () => {
    test('✓ Filters students inside manual attendance modal and registers them', async () => {
      const mockStudents = [
        { id: 's1', name: 'John Doe', barcode: 'BC101', level: 'Grade 10' },
        { id: 's2', name: 'Jane Smith', barcode: 'BC102', level: 'Grade 10' }
      ];
      window.api.students.list.mockResolvedValue(mockStudents);
      window.api.groups.list.mockResolvedValue([]);
      window.api.sessions.list.mockResolvedValue([]);

      global.currentSessionId = 'session_xyz';

      await manualAttAdd();

      const searchInput = el('manual-student-search');
      const listContainer = el('manual-student-list');

      // Default list should show both students
      expect(listContainer.innerHTML).toContain('John Doe');
      expect(listContainer.innerHTML).toContain('Jane Smith');

      // Search Jane
      searchInput.value = 'Jane';
      searchInput.addEventListener.mock.calls.find(c => c[0] === 'input')[1]();

      expect(listContainer.innerHTML).not.toContain('John Doe');
      expect(listContainer.innerHTML).toContain('Jane Smith');

      // Select student and register
      window.api.attendance.manualAdd.mockResolvedValue({
        success: true,
        student: { id: 's2', name: 'Jane Smith', level: 'Grade 10' },
        record: { id: 'att_jane', studentId: 's2', homeworkStatus: 'pending', homeworkNote: '' },
      });

      await window.selectAndAddManualStudent('s2');

      expect(window.api.attendance.manualAdd).toHaveBeenCalledWith({
        sessionId: 'session_xyz',
        studentId: 's2'
      });
      expect(global.closeModal).toHaveBeenCalled();
    });
  });

  // ── Scenario 6: Attendance Checked-In List Search ─────────
  describe('Attendance Checked-In List Search', () => {
    test('✓ Filters checked-in students list by name or barcode', () => {
      global.attendanceRecords = [
        { id: 'att1', studentName: 'Alice Johnson', barcode: 'BC001', checkInTime: '2026-06-05T10:00:00Z', homeworkStatus: 'done' },
        { id: 'att2', studentName: 'Bob Smith', barcode: 'BC002', checkInTime: '2026-06-05T10:05:00Z', homeworkStatus: 'pending' },
      ];

      // Initial filter (empty -> shows all)
      el('att-search').value = '';
      renderAttTableFiltered();

      let html = el('att-tbody').innerHTML;
      expect(html).toContain('Alice Johnson');
      expect(html).toContain('Bob Smith');

      // Search "Alice" -> Alice Johnson
      el('att-search').value = 'Alice';
      renderAttTableFiltered();

      html = el('att-tbody').innerHTML;
      expect(html).toContain('Alice Johnson');
      expect(html).not.toContain('Bob Smith');

      // Search "BC002" -> Bob Smith
      el('att-search').value = 'BC002';
      renderAttTableFiltered();

      html = el('att-tbody').innerHTML;
      expect(html).not.toContain('Alice Johnson');
      expect(html).toContain('Bob Smith');
    });
  });

  // ── Scenario 7: Student Discount Display ─────────────────────
  describe('Student Discount', () => {
    test('✓ Table shows discount badge for discounted students', async () => {
      studentsData = [
        { id: 's1', name: 'Alice', barcode: 'BC001', phone: '111', level: 'Grade 10', center: 'Center A', hasDiscount: true, discountPercent: 25, createdAt: '2024-01-01' },
        { id: 's2', name: 'Bob', barcode: 'BC002', phone: '222', level: 'Grade 10', center: 'Center A', hasDiscount: false, discountPercent: 0, createdAt: '2024-01-02' },
      ];
      window.api.students.list.mockResolvedValue(studentsData);
      window.api.groups.list.mockResolvedValue([]);

      await renderStudents();

      const html = el('students-tbody').innerHTML;
      expect(html).toContain('-25%');
      expect(html).toContain('None');
    });

    test('✓ formatStudentDiscount returns None when no discount', () => {
      expect(formatStudentDiscount({ hasDiscount: false })).toContain('None');
    });
  });

  // ── Scenario 8: Dashboard Display ─────────────────────────────
  describe('Dashboard Display', () => {
    test('✓ Hides revenue totals and keeps operational dashboard widgets', async () => {
      window.api.reports.dashboard.mockResolvedValue({
        students: 2, groups: 1, sessions: 3, centers: 1, levels: 2,
        totalAttendance: 4,
        totalRevenue: 350,
        totalGross: 450,
        totalDiscount: 100,
        sessionRevenue: [
          { sessionId: 'ss1', title: 'Algebra', date: '2026-06-01', attended: 3, twinCount: 2, discountCount: 1 },
        ],
      });
      window.api.sessions.list.mockResolvedValue([]);
      window.api.attendance.list.mockResolvedValue([]);
      global.State = { user: { name: 'Admin' } };

      await renderDashboard();

      const html = el('page-dashboard').innerHTML;
      expect(html).toContain('Students');
      expect(html).toContain('Attendance Records');
      expect(html).toContain('Upcoming Sessions');
      expect(html).toContain('Homework Rate');
      expect(html).toContain('Session Attendance Insights');
      expect(html).toContain('Same-Level Siblings');
      expect(html).toContain('Discounted');
      expect(html).toContain('Algebra');
      expect(html).not.toContain('Total Revenue');
      expect(html).not.toContain('Gross (No Discount)');
      expect(html).not.toContain('Discounts Given');
      expect(html).not.toContain('Revenue by Session');
      expect(html).not.toContain('session\'s fee');
    });
  });

  // ── Scenario 9: Attendance Search Check-In (Name/Phone) ─────
  describe('Attendance Search Check-In (Name/Phone)', () => {
    test('✓ Filters students by name/phone in check-in box and checks them in', async () => {
      const mockStudents = [
        { id: 's1', name: 'Alice Cooper', barcode: 'BC001', phone: '12345', level: 'Grade 10', center: 'Center A' },
        { id: 's2', name: 'Bob Dylan', barcode: 'BC002', phone: '67890', level: 'Grade 11', center: 'Center B' },
      ];
      window.api.sessions.list.mockResolvedValue([
        { id: 'session_123', title: 'Math Intro', date: '2026-06-05', groupId: 'g1' },
        { id: 'session_prev1', title: 'Math Intro Prev 1', date: '2026-06-01', groupId: 'g1' }
      ]);
      window.api.students.list.mockResolvedValue(mockStudents);
      window.api.attendance.list.mockResolvedValue([
        { sessionId: 'session_prev1', studentId: 's2', homeworkStatus: 'done', homeworkNote: 'good job' }
      ]);

      // Ensure barcode-input mock has focus function explicitly defined
      el('barcode-input').focus = jest.fn();

      await selectSessionForAttendance('session_123');

      const searchInput = el('attendance-student-search');
      const suggestionsBox = el('attendance-student-suggestions');

      // Type "Bob"
      searchInput.value = 'Bob';
      searchInput.oninput();

      expect(suggestionsBox.innerHTML).toContain('Bob Dylan');
      expect(suggestionsBox.innerHTML).not.toContain('Alice Cooper');
      expect(suggestionsBox.classList.containsMock.has('hidden')).toBe(false);

      // Select student check-in
      window.api.attendance.manualAdd.mockResolvedValue({
        success: true,
        student: { id: 's2', name: 'Bob Dylan', level: 'Grade 11', center: 'Center B' },
        record: { id: 'att_new', studentId: 's2', homeworkStatus: 'pending', homeworkNote: '' },
      });
      window.api.attendance.bySession.mockResolvedValue([
        { id: 'att_new', studentId: 's2', studentName: 'Bob Dylan', homeworkStatus: 'pending', homeworkNote: '' },
      ]);
      await window.checkInBySearch('s2', 'Bob Dylan', 'BC002');

      expect(el('scan-result-area').innerHTML).toContain('Homework Status');
      expect(el('scan-result-area').innerHTML).toContain('Last 2 Sessions History:');

      expect(window.api.attendance.manualAdd).toHaveBeenCalledWith({
        sessionId: 'session_123',
        studentId: 's2'
      });
      expect(searchInput.value).toBe('');
      expect(suggestionsBox.classList.containsMock.has('hidden')).toBe(true);
    });
  });

  // ── Scenario 10: Backup Reminder Display ──────────────────────
  describe('Backup Reminder Display', () => {
    test('✓ Renders Backup Reminder warning banner when backup is overdue', async () => {
      window.api.reports.dashboard.mockResolvedValue({
        students: 2, groups: 1, sessions: 3, centers: 1, levels: 2,
        totalAttendance: 4,
        sessionRevenue: [],
      });
      window.api.sessions.list.mockResolvedValue([]);
      window.api.attendance.list.mockResolvedValue([]);
      
      // Overdue backup (5 days)
      window.api.backup.checkReminder.mockResolvedValue({ showReminder: true, daysSince: 5 });

      await renderDashboard();

      const html = el('page-dashboard').innerHTML;
      expect(html).toContain('Backup Reminder');
      expect(html).toContain('No backup has been created in the last 5 days.');
      expect(html).toContain('Backup Now');
    });

    test('✓ Renders Backup Reminder warning banner when no backup ever created', async () => {
      window.api.reports.dashboard.mockResolvedValue({
        students: 2, groups: 1, sessions: 3, centers: 1, levels: 2,
        totalAttendance: 4,
        sessionRevenue: [],
      });
      window.api.sessions.list.mockResolvedValue([]);
      window.api.attendance.list.mockResolvedValue([]);
      
      // No backup exists
      window.api.backup.checkReminder.mockResolvedValue({ showReminder: true, daysSince: null });

      await renderDashboard();

      const html = el('page-dashboard').innerHTML;
      expect(html).toContain('Backup Reminder');
      expect(html).toContain('No backups have been created yet.');
    });

    test('✓ Does not render Backup Reminder banner when backup is recent', async () => {
      window.api.reports.dashboard.mockResolvedValue({
        students: 2, groups: 1, sessions: 3, centers: 1, levels: 2,
        totalAttendance: 4,
        sessionRevenue: [],
      });
      window.api.sessions.list.mockResolvedValue([]);
      window.api.attendance.list.mockResolvedValue([]);
      
      // Recent backup
      window.api.backup.checkReminder.mockResolvedValue({ showReminder: false, daysSince: 1 });

      await renderDashboard();

      const html = el('page-dashboard').innerHTML;
      expect(html).not.toContain('Backup Reminder');
    });
  });

  // ── Scenario 11: Data Recovery Overlay & Actions ───────────────
  describe('Data Recovery Overlay & Actions', () => {
    let domContentLoadedCallback = null;

    beforeAll(() => {
      jest.useFakeTimers();
      // Mock document.addEventListener to capture DOMContentLoaded
      document.addEventListener = jest.fn((event, callback) => {
        if (event === 'DOMContentLoaded') {
          domContentLoadedCallback = callback;
        }
      });

      // Load app.js dynamically
      const appPath = path.join(__dirname, '..', 'renderer', 'app.js');
      let code = fs.readFileSync(appPath, 'utf8');
      code = code.replace(/^let\s+/gm, 'var ');
      code = code.replace(/^const\s+/gm, 'var ');
      const context = vm.isContext(global) ? global : vm.createContext(global);
      vm.runInContext(code, context);
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    beforeEach(() => {
      jest.clearAllMocks();
      // Reset button click maps and elements
      for (const key in documentMocks) {
        documentMocks[key].addEventListener = jest.fn();
        documentMocks[key].classList.containsMock.clear();
      }
    });

    test('✓ Displays fullscreen Recovery screen and lists files when database is corrupted', async () => {
      window.api.system.getCorruptedFiles.mockResolvedValue(['students.json', 'users.json']);

      // Trigger the startup listener
      await domContentLoadedCallback();

      // Check standard screens are hidden
      expect(el('login-screen').classList.containsMock.has('hidden')).toBe(true);
      expect(el('app-screen').classList.containsMock.has('hidden')).toBe(true);

      // Check recovery screen is visible
      expect(el('recovery-screen').classList.containsMock.has('hidden')).toBe(false);

      // Check corrupted files list contains the names
      const listHtml = el('corrupted-files-list').innerHTML;
      expect(listHtml).toContain('students.json');
      expect(listHtml).toContain('users.json');
    });

    test('✓ Restore Backup button triggers backup import and relaunch', async () => {
      window.api.system.getCorruptedFiles.mockResolvedValue(['students.json']);
      window.api.backup.import.mockResolvedValue({ success: true });

      // Trigger startup
      await domContentLoadedCallback();

      // Retrieve registered handler for Restore button
      const restoreBtn = el('recovery-btn-restore');
      expect(restoreBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      
      const clickHandler = restoreBtn.addEventListener.mock.calls[0][1];
      
      // Trigger click
      await clickHandler();

      expect(window.api.backup.import).toHaveBeenCalled();
      
      // Wait for relaunch timeout
      jest.advanceTimersByTime(1600);
      expect(window.api.system.relaunch).toHaveBeenCalled();
    });

    test('✓ Reset Corrupted Files button asks for confirmation, triggers reset and relaunch', async () => {
      window.api.system.getCorruptedFiles.mockResolvedValue(['students.json']);
      window.api.system.resetCorruptedFiles.mockResolvedValue({ success: true });
      window.confirm = jest.fn(() => true); // Confirm yes

      await domContentLoadedCallback();

      const resetBtn = el('recovery-btn-reset');
      expect(resetBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      
      const clickHandler = resetBtn.addEventListener.mock.calls[0][1];
      
      await clickHandler();

      expect(window.confirm).toHaveBeenCalled();
      expect(window.api.system.resetCorruptedFiles).toHaveBeenCalled();
      
      jest.advanceTimersByTime(1600);
      expect(window.api.system.relaunch).toHaveBeenCalled();
    });

    test('✓ Quit App button triggers quit', async () => {
      window.api.system.getCorruptedFiles.mockResolvedValue(['students.json']);

      await domContentLoadedCallback();

      const quitBtn = el('recovery-btn-quit');
      const clickHandler = quitBtn.addEventListener.mock.calls[0][1];
      
      await clickHandler();

      expect(window.api.system.quit).toHaveBeenCalled();
    });
  });
});
