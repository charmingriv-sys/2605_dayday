let storageMockData = {};
global.localStorage = {
    getItem: (key) => storageMockData[key] || null,
    setItem: (key, val) => { storageMockData[key] = val; }
};
global.window = {
    dispatchEvent: () => {},
    localStorage: global.localStorage
};

console.log('--- Unit Test: Starting Attendance Warnings Algorithms Verification ---');

const { stateStore } = await import('../../src/js/state.js');

let hasError = false;

function assert(condition, message) {
    if (condition) {
        console.log(`[OK] ${message}`);
    } else {
        console.error(`[FAIL] ${message}`);
        hasError = true;
    }
}

// Reset store data
stateStore.db.students = [
    { id: 'S_W1', name: '홍길동', isAdult: false, age: 10, teacherId: 'T8', instrument: '피아노' }, // 비성인
    { id: 'S_W2', name: '이순신', isAdult: true, age: 25, teacherId: 'T8', instrument: '피아노' },  // 성인
    { id: 'S_W3', name: '강감찬', isAdult: false, age: 15, teacherId: 'T8', instrument: '첼로' }   // 비성인, 수업 없음 (plannedCount = 0)
];

// Clean schedule config
stateStore.db.classes = [];
stateStore.db.scheduleSnapshots = [];
stateStore.db.scheduleOverrides = [];

// Helper to add schedule snapshot entries
function addSnapshotClass(studentId, date, time) {
    let snapshot = stateStore.db.scheduleSnapshots.find(s => s.date === date);
    if (!snapshot) {
        snapshot = {
            id: `SNAP_${date}_AC1`,
            academyId: 'AC1',
            date: date,
            type: 'teacherStudentSchedule',
            entries: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        stateStore.db.scheduleSnapshots.push(snapshot);
    }
    snapshot.entries.push({
        id: `ENTRY_${date}_${studentId}_${snapshot.entries.length}`,
        studentId: studentId,
        teacherId: 'T8',
        startTime: time,
        endTime: '14:30',
        subjectId: '피아노',
        source: 'default'
    });
}

// S_W1: 11 classes (to avoid math round issues when testing amber low attendance)
const sW1Dates = [
    '2026-06-03', '2026-06-01', '2026-05-29', '2026-05-27', '2026-05-25',
    '2026-05-22', '2026-05-20', '2026-05-18', '2026-05-15', '2026-05-13', '2026-05-11'
];
sW1Dates.forEach(d => addSnapshotClass('S_W1', d, '14:00'));

// S_W2: 12 classes
const sW2Dates = [
    '2026-06-03', '2026-06-01', '2026-05-29', '2026-05-27', '2026-05-25',
    '2026-05-22', '2026-05-20', '2026-05-18', '2026-05-15', '2026-05-13', '2026-05-11', '2026-05-08'
];
sW2Dates.forEach(d => addSnapshotClass('S_W2', d, '14:00'));

// 1. Verify plannedCount = 0 student is excluded
// Date: 2026-06-03 (Wednesday)
// S_W3 has no scheduled classes, plannedCount is 0. S_W3 must be completely excluded from warnings.
stateStore.db.attendance = [];
let warnings = stateStore.getAttendanceWarnings({ endDate: '2026-06-03' });
const sW3Warning = warnings.find(w => w.studentId === 'S_W3');
assert(sW3Warning === undefined, 'Student with plannedCount = 0 (강감찬) is excluded from warnings');

// 2. Verify Critical Warning: consecutive_absences (non-adult recently 2 consecutive absences)
// Mark S_W1's latest two classes (2026-06-03 and 2026-06-01) as absent.
stateStore.db.attendance = [
    { id: 'A_W1_1', studentId: 'S_W1', date: '2026-06-03', status: 'absent', time: '' },
    { id: 'A_W1_2', studentId: 'S_W1', date: '2026-06-01', status: 'absent', time: '' }
];
warnings = stateStore.getAttendanceWarnings({ endDate: '2026-06-03' });
const sW1Warning = warnings.find(w => w.studentId === 'S_W1');
assert(sW1Warning !== undefined, 'Warning generated for S_W1');
assert(sW1Warning.severity === 'critical', `S_W1 severity is critical. Found: ${sW1Warning.severity}`);
assert(sW1Warning.warningType === 'consecutive_absences', `S_W1 warningType is consecutive_absences. Found: ${sW1Warning.warningType}`);

// 3. Verify Critical Warning: today_no_tag_overdue (today class start and no tag past 15 mins)
// Set mock time so that today is 2026-06-03 and current time is 14:20.
// S_W2 has class today (2026-06-03) at 14:00.
const mockTime = new Date('2026-06-03T14:20:00+09:00').getTime();
const OriginalDate = Date;
class MockDate extends OriginalDate {
  constructor(...args) {
    if (args.length === 0) {
      super(mockTime);
    } else {
      super(...args);
    }
  }
  static now() {
    return mockTime;
  }
}
global.Date = MockDate;

// Reset attendance list (no attendance marked for S_W2 on 2026-06-03)
stateStore.db.attendance = [];
warnings = stateStore.getAttendanceWarnings({ endDate: '2026-06-03', lateThresholdMinutes: 15 });
const sW2Warning = warnings.find(w => w.studentId === 'S_W2');
assert(sW2Warning !== undefined, 'Warning generated for S_W2 due to today overdue check');
assert(sW2Warning.severity === 'critical', `S_W2 severity is critical. Found: ${sW2Warning.severity}`);
assert(sW2Warning.warningType === 'today_no_tag_overdue', `S_W2 warningType is today_no_tag_overdue. Found: ${sW2Warning.warningType}`);

// Restore Original Date
global.Date = OriginalDate;

// 4. Verify Red Warning: high_absent_rate (absent rate >= 30%)
// S_W2 (adult) has 12 scheduled classes in 28 days.
// 4 absences / 12 classes = 33% (> 30%). This should trigger RED warnings.
stateStore.db.attendance = [
    { id: 'A_W2_1', studentId: 'S_W2', date: '2026-06-03', status: 'absent', time: '' },
    { id: 'A_W2_2', studentId: 'S_W2', date: '2026-06-01', status: 'absent', time: '' },
    { id: 'A_W2_3', studentId: 'S_W2', date: '2026-05-29', status: 'absent', time: '' },
    { id: 'A_W2_4', studentId: 'S_W2', date: '2026-05-27', status: 'absent', time: '' },
    // 8 presents
    { id: 'A_W2_5', studentId: 'S_W2', date: '2026-05-25', status: 'present', time: '14:00' },
    { id: 'A_W2_6', studentId: 'S_W2', date: '2026-05-22', status: 'present', time: '14:00' },
    { id: 'A_W2_7', studentId: 'S_W2', date: '2026-05-20', status: 'present', time: '14:00' },
    { id: 'A_W2_8', studentId: 'S_W2', date: '2026-05-18', status: 'present', time: '14:00' },
    { id: 'A_W2_9', studentId: 'S_W2', date: '2026-05-15', status: 'present', time: '14:00' },
    { id: 'A_W2_10', studentId: 'S_W2', date: '2026-05-13', status: 'present', time: '14:00' },
    { id: 'A_W2_11', studentId: 'S_W2', date: '2026-05-11', status: 'present', time: '14:00' },
    { id: 'A_W2_12', studentId: 'S_W2', date: '2026-05-08', status: 'present', time: '14:00' }
];
warnings = stateStore.getAttendanceWarnings({ endDate: '2026-06-03' });
const sW2RedWarning = warnings.find(w => w.studentId === 'S_W2');
assert(sW2RedWarning !== undefined, 'Red warning generated for S_W2');
assert(sW2RedWarning.severity === 'red', `S_W2 severity is red. Found: ${sW2RedWarning.severity}`);
assert(sW2RedWarning.warningType === 'high_absent_rate', `S_W2 warningType is high_absent_rate. Found: ${sW2RedWarning.warningType}`);
assert(sW2RedWarning.absentRate === 33, `S_W2 absentRate is 33%. Found: ${sW2RedWarning.absentRate}%`);
assert(sW2RedWarning.evidenceText.includes('최근 4주 예정 12회 중 결석 4회, 결석률 33%'), `evidenceText matches correct pattern: ${sW2RedWarning.evidenceText}`);

// 5. Verify Amber Warning: low_attendance_rate (attendance rate < 75%)
// S_W1 has 11 scheduled classes.
// 3 absences, 1 late, 7 presents -> attendance rate = (7+1)/11 = 73% (< 75%).
// absent rate = 3/11 = 27% (< 30%).
// Also make sure no consecutive absences occur (6/3 absent, 6/1 late, 5/29 absent).
stateStore.db.attendance = [
    { id: 'A_W1_3', studentId: 'S_W1', date: '2026-06-03', status: 'absent', time: '' },
    { id: 'A_W1_4', studentId: 'S_W1', date: '2026-06-01', status: 'late', time: '14:10' },
    { id: 'A_W1_5', studentId: 'S_W1', date: '2026-05-29', status: 'absent', time: '' },
    { id: 'A_W1_6', studentId: 'S_W1', date: '2026-05-27', status: 'absent', time: '' },
    { id: 'A_W1_7', studentId: 'S_W1', date: '2026-05-25', status: 'present', time: '14:00' },
    { id: 'A_W1_8', studentId: 'S_W1', date: '2026-05-22', status: 'present', time: '14:00' },
    { id: 'A_W1_9', studentId: 'S_W1', date: '2026-05-20', status: 'present', time: '14:00' },
    { id: 'A_W1_10', studentId: 'S_W1', date: '2026-05-18', status: 'present', time: '14:00' },
    { id: 'A_W1_11', studentId: 'S_W1', date: '2026-05-15', status: 'present', time: '14:00' },
    { id: 'A_W1_12', studentId: 'S_W1', date: '2026-05-13', status: 'present', time: '14:00' },
    { id: 'A_W1_13', studentId: 'S_W1', date: '2026-05-11', status: 'present', time: '14:00' }
];
warnings = stateStore.getAttendanceWarnings({ endDate: '2026-06-03' });
const sW1AmberWarning = warnings.find(w => w.studentId === 'S_W1');
assert(sW1AmberWarning !== undefined, 'Amber warning generated for S_W1');
assert(sW1AmberWarning.severity === 'amber', `S_W1 severity is amber. Found: ${sW1AmberWarning.severity}`);
assert(sW1AmberWarning.warningType === 'low_attendance_rate', `S_W1 warningType is low_attendance_rate. Found: ${sW1AmberWarning.warningType}`);
assert(sW1AmberWarning.evidenceText.includes('최근 4주 예정 11회 중 출석/지각 8회, 출석률 73%'), `evidenceText matches correct pattern: ${sW1AmberWarning.evidenceText}`);

// 6. Verify Amber Warning: high_late_rate (late rate >= 25%)
// S_W2 has 12 scheduled classes.
// 3 lates, 9 presents -> lateRate = 3 / 12 = 25% (>= 25%).
stateStore.db.attendance = [
    { id: 'A_W2_13', studentId: 'S_W2', date: '2026-06-03', status: 'late', time: '14:10' },
    { id: 'A_W2_14', studentId: 'S_W2', date: '2026-06-01', status: 'late', time: '14:15' },
    { id: 'A_W2_15', studentId: 'S_W2', date: '2026-05-29', status: 'late', time: '14:10' },
    { id: 'A_W2_16', studentId: 'S_W2', date: '2026-05-27', status: 'present', time: '14:00' },
    { id: 'A_W2_17', studentId: 'S_W2', date: '2026-05-25', status: 'present', time: '14:00' },
    { id: 'A_W2_18', studentId: 'S_W2', date: '2026-05-22', status: 'present', time: '14:00' },
    { id: 'A_W2_19', studentId: 'S_W2', date: '2026-05-20', status: 'present', time: '14:00' },
    { id: 'A_W2_20', studentId: 'S_W2', date: '2026-05-18', status: 'present', time: '14:00' },
    { id: 'A_W2_21', studentId: 'S_W2', date: '2026-05-15', status: 'present', time: '14:00' },
    { id: 'A_W2_22', studentId: 'S_W2', date: '2026-05-13', status: 'present', time: '14:00' },
    { id: 'A_W2_23', studentId: 'S_W2', date: '2026-05-11', status: 'present', time: '14:00' },
    { id: 'A_W2_24', studentId: 'S_W2', date: '2026-05-08', status: 'present', time: '14:00' }
];
warnings = stateStore.getAttendanceWarnings({ endDate: '2026-06-03' });
const sW2LateWarning = warnings.find(w => w.studentId === 'S_W2');
assert(sW2LateWarning !== undefined, 'Amber warning generated for S_W2 (late)');
assert(sW2LateWarning.severity === 'amber', `S_W2 severity is amber. Found: ${sW2LateWarning.severity}`);
assert(sW2LateWarning.warningType === 'high_late_rate', `S_W2 warningType is high_late_rate. Found: ${sW2LateWarning.warningType}`);
assert(sW2LateWarning.evidenceText.includes('최근 4주 예정 12회 중 지각 3회, 지각률 25%'), `evidenceText matches correct pattern: ${sW2LateWarning.evidenceText}`);

// 7. Verify Warnings Sorting (critical > red > amber)
// S_W1: Critical (consecutive absences)
stateStore.db.attendance = [
    { id: 'A_W1_10', studentId: 'S_W1', date: '2026-06-03', status: 'absent', time: '' },
    { id: 'A_W1_11', studentId: 'S_W1', date: '2026-06-01', status: 'absent', time: '' }
];
// S_W2: Amber (high late rate)
stateStore.db.attendance.push(
    { id: 'A_W2_25', studentId: 'S_W2', date: '2026-06-03', status: 'late', time: '14:10' },
    { id: 'A_W2_26', studentId: 'S_W2', date: '2026-06-01', status: 'late', time: '14:15' },
    { id: 'A_W2_27', studentId: 'S_W2', date: '2026-05-29', status: 'late', time: '14:10' }
);
warnings = stateStore.getAttendanceWarnings({ endDate: '2026-06-03' });
assert(warnings.length === 2, `Two warnings generated. Found: ${warnings.length}`);
assert(warnings[0].studentId === 'S_W1', `S_W1 (CRITICAL) is sorted first. Found: ${warnings[0].studentName}`);
assert(warnings[1].studentId === 'S_W2', `S_W2 (AMBER) is sorted second. Found: ${warnings[1].studentName}`);

// 8. Verify getAttendanceWarnings lateThresholdMinutes prioritization (Repair-B)
console.log('--- Verifying getAttendanceWarnings lateThresholdMinutes prioritization ---');

// MockDate: today is 2026-06-03, time is 14:12 (12 minutes past 14:00 class)
const testMockTime = new Date('2026-06-03T14:12:00+09:00').getTime();
const TestOriginalDate = Date;
class TestMockDate extends TestOriginalDate {
  constructor(...args) {
    if (args.length === 0) {
      super(testMockTime);
    } else {
      super(...args);
    }
  }
  static now() {
    return testMockTime;
  }
}
global.Date = TestMockDate;

// S_W2 has class today (2026-06-03) at 14:00.
// Attendance list is empty (no tags)
stateStore.db.attendance = [];

// A. Check options.lateThresholdMinutes priority:
// A-1) options.lateThresholdMinutes = 10 -> 12 mins > 10 mins -> triggers critical warning
let prioWarnings = stateStore.getAttendanceWarnings({ endDate: '2026-06-03', lateThresholdMinutes: 10 });
let sW2Prio = prioWarnings.find(w => w.studentId === 'S_W2');
assert(sW2Prio !== undefined && sW2Prio.warningType === 'today_no_tag_overdue', 'Priority 1: options = 10 successfully triggers warning at 12 mins');

// A-2) options.lateThresholdMinutes = 15 -> 12 mins < 15 mins -> no warning
prioWarnings = stateStore.getAttendanceWarnings({ endDate: '2026-06-03', lateThresholdMinutes: 15 });
sW2Prio = prioWarnings.find(w => w.studentId === 'S_W2');
assert(sW2Prio === undefined || sW2Prio.warningType !== 'today_no_tag_overdue', 'Priority 1: options = 15 successfully ignores warning at 12 mins');

// B. Check stateStore.getLateThresholdMinutes() fallback:
// B-1) stateStore.setLateThresholdMinutes(10) -> triggers warning
stateStore.setLateThresholdMinutes(10);
prioWarnings = stateStore.getAttendanceWarnings({ endDate: '2026-06-03' }); // no options.lateThresholdMinutes
sW2Prio = prioWarnings.find(w => w.studentId === 'S_W2');
assert(sW2Prio !== undefined && sW2Prio.warningType === 'today_no_tag_overdue', 'Priority 2: stateStore config = 10 successfully triggers warning at 12 mins');

// B-2) stateStore.setLateThresholdMinutes(15) -> no warning
stateStore.setLateThresholdMinutes(15);
prioWarnings = stateStore.getAttendanceWarnings({ endDate: '2026-06-03' }); // no options.lateThresholdMinutes
sW2Prio = prioWarnings.find(w => w.studentId === 'S_W2');
assert(sW2Prio === undefined || sW2Prio.warningType !== 'today_no_tag_overdue', 'Priority 2: stateStore config = 15 successfully ignores warning at 12 mins');

// C. Check default fallback to 10 when config is absent/invalid:
stateStore.db.settings = { lateThresholdMinutes: 'invalid' }; // invalid config
prioWarnings = stateStore.getAttendanceWarnings({ endDate: '2026-06-03' }); // should fallback to 10 -> triggers warning
sW2Prio = prioWarnings.find(w => w.studentId === 'S_W2');
assert(sW2Prio !== undefined && sW2Prio.warningType === 'today_no_tag_overdue', 'Priority 3: fallback to 10 successfully triggers warning at 12 mins');

// D. Check 0-minute threshold behavior:
// D-1) options.lateThresholdMinutes = 0 -> 12 mins > 0 mins -> triggers warning
prioWarnings = stateStore.getAttendanceWarnings({ endDate: '2026-06-03', lateThresholdMinutes: 0 });
sW2Prio = prioWarnings.find(w => w.studentId === 'S_W2');
assert(sW2Prio !== undefined && sW2Prio.warningType === 'today_no_tag_overdue', '0-minute threshold: options = 0 successfully triggers warning');

// D-2) stateStore.setLateThresholdMinutes(0) -> triggers warning when time is past 14:00
stateStore.setLateThresholdMinutes(0);
prioWarnings = stateStore.getAttendanceWarnings({ endDate: '2026-06-03' });
sW2Prio = prioWarnings.find(w => w.studentId === 'S_W2');
assert(sW2Prio !== undefined && sW2Prio.warningType === 'today_no_tag_overdue', '0-minute threshold: config = 0 successfully triggers warning');

// D-3) verify that when time is exactly 14:00 (0 mins passed), no warning is triggered
const testMockTimeExact = new Date('2026-06-03T14:00:00+09:00').getTime();
class TestMockDateExact extends TestOriginalDate {
  constructor(...args) {
    if (args.length === 0) {
      super(testMockTimeExact);
    } else {
      super(...args);
    }
  }
  static now() {
    return testMockTimeExact;
  }
}
global.Date = TestMockDateExact;
prioWarnings = stateStore.getAttendanceWarnings({ endDate: '2026-06-03' });
sW2Prio = prioWarnings.find(w => w.studentId === 'S_W2');
assert(sW2Prio === undefined || sW2Prio.warningType !== 'today_no_tag_overdue', '0-minute threshold: config = 0 does not trigger warning at exactly class time');

// Restore original Date
global.Date = TestOriginalDate;

// 9. Verify lateDetectionEnabled unit behavior (Phase 9C-5D TDD)
console.log('--- Verifying lateDetectionEnabled unit behavior ---');

// A. Default value check
assert(stateStore.getLateDetectionEnabled() === true, 'lateDetectionEnabled default is true');

// B. Save and restore check
stateStore.setLateDetectionEnabled(false);
assert(stateStore.getLateDetectionEnabled() === false, 'lateDetectionEnabled is successfully set to false');
assert(stateStore.db.settings.lateDetectionEnabled === false, 'lateDetectionEnabled is saved in db.settings');

// C. Verify lateThresholdMinutes value preservation
stateStore.setLateThresholdMinutes(15);
assert(stateStore.getLateThresholdMinutes() === 15, 'lateThresholdMinutes is 15');
stateStore.setLateDetectionEnabled(true);
assert(stateStore.getLateDetectionEnabled() === true, 'lateDetectionEnabled toggle does not corrupt lateThresholdMinutes');
assert(stateStore.getLateThresholdMinutes() === 15, 'lateThresholdMinutes remains 15');

// D. Verify warnings behavior when lateDetectionEnabled is false
stateStore.setLateDetectionEnabled(false);
global.Date = TestMockDate; // today is 2026-06-03, time is 14:12 KST
stateStore.db.attendance = [];
let disabledWarnings = stateStore.getAttendanceWarnings({ endDate: '2026-06-03' });
let sW2Disabled = disabledWarnings.find(w => w.studentId === 'S_W2');
assert(sW2Disabled === undefined || sW2Disabled.warningType !== 'today_no_tag_overdue', 'When lateDetectionEnabled is false, today_no_tag_overdue warning is not generated');

// E. Verify warnings behavior when lateDetectionEnabled is true
stateStore.setLateDetectionEnabled(true);
stateStore.setLateThresholdMinutes(10);
let enabledWarnings = stateStore.getAttendanceWarnings({ endDate: '2026-06-03' });
let sW2Enabled = enabledWarnings.find(w => w.studentId === 'S_W2');
assert(sW2Enabled !== undefined && sW2Enabled.warningType === 'today_no_tag_overdue', 'When lateDetectionEnabled is true, today_no_tag_overdue warning is generated');

// Restore original Date again
global.Date = TestOriginalDate;

if (hasError) {
    console.error('--- Unit Test: Attendance Warnings Algorithms Verification FAILED ---');
    process.exit(1);
} else {
    console.log('--- Unit Test: Attendance Warnings Algorithms Verification PASSED successfully ---');
    process.exit(0);
}

