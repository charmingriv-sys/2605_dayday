// schedule_override_test.mjs - Unit tests for schedule override/snapshot behaviors
import assert from 'assert';

// Mock environment for Node.js
global.localStorage = {
    getItem: (key) => null,
    setItem: (key, val) => {}
};
global.window = {
    dispatchEvent: () => {},
    localStorage: global.localStorage
};

console.log('--- Mocking environment completed ---');

// Import stateStore
const { stateStore } = await import('../../src/js/state.js');

// Helper to reset database to default
function resetDB() {
    stateStore.loadDB();
}

console.log('--- Starting Schedule Override/Snapshot Verification Tests ---');

try {
    // ----------------------------------------------------
    // Scenario 1: Snapshot이 없는 미래 날짜 조회 시 기본 시간표 기반 반환
    // ----------------------------------------------------
    console.log('[Scenario 1] Future Date without Snapshot');
    resetDB();
    
    // 2030-05-20 (Monday/월요일)
    const futureDate = '2030-05-20'; 
    const futureSchedule = stateStore.getTeacherStudentScheduleForDate(futureDate);
    
    // Monday default classes in DEFAULT_DB should count 22 entries (C1 to C22)
    const mondayDefaultClassesCount = stateStore.db.classes.filter(c => c.dayOfWeek === '월').length;
    assert.strictEqual(futureSchedule.length, mondayDefaultClassesCount, `Future schedule entries mismatch. Expected: ${mondayDefaultClassesCount}, Got: ${futureSchedule.length}`);
    
    // Future date should not trigger snapshot persistence
    const snapshotExists = stateStore.db.scheduleSnapshots.some(s => s.date === futureDate);
    assert.strictEqual(snapshotExists, false, 'Future schedule query should not persist snapshot.');
    console.log('✓ Scenario 1 PASSED');

    // ----------------------------------------------------
    // Scenario 2: ensureScheduleSnapshotForDate 호출 시 해당 날짜 스냅샷 생성
    // ----------------------------------------------------
    console.log('[Scenario 2] Ensure Snapshot creation for a Date');
    resetDB();
    
    const targetDate = '2026-05-18'; // Monday
    const newSnapshot = stateStore.ensureScheduleSnapshotForDate(targetDate, { academyId: 'AC1' });
    
    assert.ok(newSnapshot, 'Snapshot object should be created.');
    assert.strictEqual(newSnapshot.date, targetDate, `Date mismatch. Expected: ${targetDate}, Got: ${newSnapshot.date}`);
    assert.strictEqual(newSnapshot.academyId, 'AC1', 'AcademyId mismatch.');
    
    // Check if pushed to DB
    const savedSnapshot = stateStore.db.scheduleSnapshots.find(s => s.date === targetDate);
    assert.ok(savedSnapshot, 'Snapshot should be saved in DB.');
    assert.strictEqual(savedSnapshot.entries.length, mondayDefaultClassesCount, 'Snapshot entry count mismatch.');
    console.log('✓ Scenario 2 PASSED');

    // ----------------------------------------------------
    // Scenario 3: Snapshot 생성 후 원생 기본 시간표 변경해도 해당 날짜 스냅샷 유지 (과거 데이터 보호)
    // ----------------------------------------------------
    console.log('[Scenario 3] Snapshot persistence after default classes change');
    resetDB();
    
    const pastDate = '2026-05-18';
    // 1. First trigger snapshot generation (e.g., viewing past/today schedule)
    const initialSchedule = stateStore.getTeacherStudentScheduleForDate(pastDate);
    
    // 2. Modify default class list
    // Remove one class from Mondays
    const mondayClass = stateStore.db.classes.find(c => c.dayOfWeek === '월');
    const originalStudentId = mondayClass.studentId;
    stateStore.db.classes = stateStore.db.classes.filter(c => c.id !== mondayClass.id);
    
    // 3. Re-query past schedule (should match snapshot, not modified defaults)
    const afterChangeSchedule = stateStore.getTeacherStudentScheduleForDate(pastDate);
    assert.strictEqual(afterChangeSchedule.length, initialSchedule.length, 'Past schedule changed after default classes alteration.');
    assert.ok(afterChangeSchedule.some(c => c.studentId === originalStudentId), 'Removed student schedule should still exist in past snapshot schedule.');
    
    // 4. Query future date (which has no snapshot) - should reflect default changes
    const futureDate2 = '2030-05-20';
    const futureScheduleAfterChange = stateStore.getTeacherStudentScheduleForDate(futureDate2);
    assert.strictEqual(futureScheduleAfterChange.length, mondayDefaultClassesCount - 1, 'Future schedule did not reflect default class deletion.');
    assert.ok(!futureScheduleAfterChange.some(c => c.studentId === originalStudentId), 'Deleted student schedule still exists in future schedule.');
    console.log('✓ Scenario 3 PASSED');

    // ----------------------------------------------------
    // Scenario 4: moveStudentScheduleForDate 호출 시 해당 날짜 운영표 변경 및 로그 적재
    // ----------------------------------------------------
    console.log('[Scenario 4] Move student schedule for date and generate logs');
    resetDB();
    
    const moveDate = '2026-05-18'; // Monday
    const movePayload = {
        studentId: 'S1',
        toTeacherId: 'T1', // Original: T8
        toStartTime: '15:30', // Original: 14:00
        academyId: 'AC1',
        reason: 'test-move',
        createdBy: 'USR_DIR_DEMO'
    };
    
    // Perform move
    stateStore.moveStudentScheduleForDate(moveDate, movePayload);
    
    // Verify schedule list change
    const updatedSchedule = stateStore.getTeacherStudentScheduleForDate(moveDate);
    const movedEntry = updatedSchedule.find(e => e.studentId === 'S1');
    assert.ok(movedEntry, 'Moved student entry should exist in schedule.');
    assert.strictEqual(movedEntry.teacherId, 'T1', 'Teacher ID did not update to T1.');
    assert.strictEqual(movedEntry.time, '15:30', 'Start time did not update to 15:30.');
    assert.strictEqual(movedEntry.source, 'override', 'Entry source is not marked as override.');
    
    // Verify override history table
    const overrides = stateStore.getScheduleOverridesForDate(moveDate);
    assert.strictEqual(overrides.length, 1, 'Override record should be created.');
    assert.strictEqual(overrides[0].studentId, 'S1');
    assert.strictEqual(overrides[0].toTeacherId, 'T1');
    assert.strictEqual(overrides[0].toStartTime, '15:30');
    assert.strictEqual(overrides[0].fromStartTime, '14:00'); // Original time
    
    // Verify operation logs
    const logs = stateStore.getScheduleOperationLogs(moveDate);
    assert.strictEqual(logs.length, 1, 'Operation log should be created.');
    assert.strictEqual(logs[0].action, 'move_student_schedule');
    assert.strictEqual(logs[0].studentId, 'S1');
    assert.strictEqual(logs[0].after.teacherId, 'T1');
    assert.strictEqual(logs[0].after.startTime, '15:30');
    console.log('✓ Scenario 4 PASSED');

    // ----------------------------------------------------
    // Scenario 5: 다른 날짜 격리 검증 (이동 전파 차단)
    // ----------------------------------------------------
    console.log('[Scenario 5] Schedule Isolation Verification');
    
    // Query another Monday (e.g. 2026-05-25)
    // S1 should have default teacher (T8) and time (14:00) on other days
    const otherDate = '2026-05-25';
    const otherSchedule = stateStore.getTeacherStudentScheduleForDate(otherDate);
    const otherEntry = otherSchedule.find(e => e.studentId === 'S1');
    
    assert.ok(otherEntry, 'Student S1 should have class on 2026-05-25.');
    assert.strictEqual(otherEntry.teacherId, 'T8', 'Override on 2026-05-18 leaked to other dates (teacherId mismatch).');
    assert.strictEqual(otherEntry.time, '14:00', 'Override on 2026-05-18 leaked to other dates (time mismatch).');
    assert.strictEqual(otherEntry.source, 'default', 'Other date schedule should remain default.');
    console.log('✓ Scenario 5 PASSED');

    console.log('All Schedule Override/Snapshot tests PASSED successfully.');
    process.exit(0);

} catch (err) {
    console.error('❌ Test execution failed with error:');
    console.error(err);
    process.exit(1);
}
