let storageMockData = {};
global.localStorage = {
    getItem: (key) => storageMockData[key] || null,
    setItem: (key, val) => { storageMockData[key] = val; }
};
global.window = {
    dispatchEvent: () => {},
    localStorage: global.localStorage
};

console.log('--- Unit Test: Starting TodayTask System Recommendations Verification ---');

const { stateStore } = await import('../../src/js/state.js');

let hasError = false;

// Helper assertion function
function assert(condition, message) {
    if (condition) {
        console.log(`[OK] ${message}`);
    } else {
        console.error(`[FAIL] ${message}`);
        hasError = true;
    }
}

// Reset store data
stateStore.db.todayTasks = [];
stateStore.db.students = [
    { id: 'S_TEST1', name: '홍길동', dueDay: 10, fee: 100000, academyId: 'AC1' },
    { id: 'S_TEST2', name: '이순신', dueDay: 15, fee: 120000, academyId: 'AC1' }
];
stateStore.db.classes = [
    { id: 'C_TEST1', studentId: 'S_TEST1', dayOfWeek: '수', time: '14:00' },
    { id: 'C_TEST2', studentId: 'S_TEST1', dayOfWeek: '목', time: '14:00' }
];
stateStore.db.payments = [
    { id: 'P_TEST1', studentId: 'S_TEST1', amount: 100000, month: '2026-06', type: 'education', status: 'unpaid', invoiceDate: '2026-06-01' }
];
stateStore.db.attendance = [];

// 1. Verify Billing Recommendation Generation
// Set mock time: 2026-06-11 10:00:00 (Wednesday, '수'). 
// Hong Gil-dong has dueDay = 10, billing is unpaid. Since 11 >= 10, billing recommendation should be generated.
// Class is scheduled at 14:00. At 10:00, class has not started yet. No attendance recommendation should be generated.
const mockNow = new Date(2026, 5, 11, 10, 0, 0); // 2026-06-11 (Month is 0-indexed: 5 = June)

let tasks = stateStore.syncSystemRecommendations(mockNow);
assert(tasks.length === 1, `One recommendation generated initially (unpaid billing). Found: ${tasks.length}`);
const billingTask = tasks[0];
assert(billingTask.source === 'system', 'Source is system');
assert(billingTask.category === 'system_check', 'Category is system_check');
assert(billingTask.type === 'billing', 'Type is billing');
assert(billingTask.status === 'open', 'Status is open');
assert(billingTask.dedupeKey === 'SYSTEM_RECOMMEND_BILLING_UNPAID_P_TEST1_2026-06', `dedupeKey is correct: ${billingTask.dedupeKey}`);
assert(billingTask.actionType === 'NAVIGATE', 'ActionType is NAVIGATE');
assert(billingTask.actionPayload.studentId === 'S_TEST1', 'ActionPayload contains correct studentId');

// 2. Verify Deduplication
// Running sync again at same/later time should not duplicate the task.
tasks = stateStore.syncSystemRecommendations(mockNow);
assert(tasks.length === 1, 'Syncing again does not generate duplicate tasks');

// 3. Verify Attendance Delay Recommendation Generation
// Set mock time to 2026-06-11 14:20:00 (Wednesday, '수').
// Class starts at 14:00. Current time is 14:20, which is > 15 minutes past start time.
// Attendance is not marked. An attendance delay recommendation should be generated.
const mockLateNow = new Date(2026, 5, 11, 14, 20, 0);
tasks = stateStore.syncSystemRecommendations(mockLateNow);
// Total tasks should be 2 (Billing + Attendance Delay)
assert(tasks.length === 2, `Two recommendations generated (billing + attendance delay). Found: ${tasks.length}`);
const attendanceTask = tasks.find(t => t.type === 'attendance');
assert(attendanceTask !== undefined, 'Attendance delay recommendation found');
assert(attendanceTask.source === 'system', 'Attendance task source is system');
assert(attendanceTask.status === 'open', 'Attendance task status is open');
assert(attendanceTask.dedupeKey === 'SYSTEM_RECOMMEND_ATTENDANCE_LATE_S_TEST1_2026-06-11', `Attendance dedupeKey is correct: ${attendanceTask.dedupeKey}`);

// 4. Verify Auto-Resolve for Billing
// Set payment status to paid. Call sync again. The billing task status should change to 'done'.
stateStore.db.payments[0].status = 'paid';
tasks = stateStore.syncSystemRecommendations(mockLateNow);
const updatedBillingTask = stateStore.getTodayTasks().find(t => t.type === 'billing');
assert(updatedBillingTask.status === 'done', `Billing recommendation auto-resolved. Status: ${updatedBillingTask.status}`);
assert(typeof updatedBillingTask.completedAt === 'string', 'completedAt populated for resolved billing task');

// 5. Verify Auto-Resolve for Attendance
// Mark attendance. Call sync again. The attendance task status should change to 'done'.
stateStore.markAttendance('S_TEST1', '2026-06-11', 'present', '14:05');
tasks = stateStore.syncSystemRecommendations(mockLateNow);
const updatedAttendanceTask = stateStore.getTodayTasks().find(t => t.type === 'attendance');
assert(updatedAttendanceTask.status === 'done', `Attendance recommendation auto-resolved. Status: ${updatedAttendanceTask.status}`);
assert(typeof updatedAttendanceTask.completedAt === 'string', 'completedAt populated for resolved attendance task');

// 6. Verify getActiveTodayTasks excludes resolved tasks unless completedAt is checked in getDoneTodayTasks
const activeTasks = stateStore.getActiveTodayTasks(mockLateNow);
assert(activeTasks.length === 0, 'Active tasks is 0 since both recommendations are auto-resolved');

if (hasError) {
    console.error('--- Unit Test: TodayTask System Recommendations FAILED ---');
    process.exit(1);
} else {
    console.log('--- Unit Test: TodayTask System Recommendations PASSED successfully ---');
    process.exit(0);
}
