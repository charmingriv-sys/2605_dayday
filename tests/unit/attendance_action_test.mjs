// tests/unit/attendance_action_test.mjs - Verify markAttendanceStatus API

import assert from 'assert';

// Mock global window and localStorage for node environment
global.localStorage = {
    getItem: (key) => null,
    setItem: (key, val) => {}
};
global.window = {
    dispatchEvent: () => {},
    localStorage: global.localStorage
};

console.log('--- Mocking environment completed ---');

// Dynamically import to ensure mocks are instantiated first
const { stateStore } = await import('../../src/js/state.js');

let hasError = false;

console.log('--- Starting Attendance Quick Action API Verification ---');

try {
    // Isolated database setup for test
    stateStore.db.attendance = [];
    stateStore.db.settings = { sendKakaoAlert: false };

    // Helper to extract HH:MM dynamically based on timezone of test runner
    const getExpectedHHMM = (isoString) => {
        const d = new Date(isoString);
        const hrs = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        return `${hrs}:${mins}`;
    };

    // 1. Verify new registration
    const payload1 = {
        studentId: 'S1',
        date: '2026-06-08',
        classTime: '14:00',
        status: 'present',
        checkedAt: '2026-06-08T14:02:00.000Z',
        source: 'director_manual'
    };
    stateStore.markAttendanceStatus(payload1);
    
    assert.strictEqual(stateStore.db.attendance.length, 1, 'Attendance record count should be 1');
    const record = stateStore.db.attendance[0];
    assert.strictEqual(record.studentId, 'S1');
    assert.strictEqual(record.date, '2026-06-08');
    assert.strictEqual(record.status, 'present');
    assert.strictEqual(record.time, getExpectedHHMM(payload1.checkedAt));
    assert.strictEqual(record.classTime, '14:00');
    assert.strictEqual(record.source, 'director_manual');
    console.log('✓ New registration check passed.');

    // 2. Verify overwriting (upsert) behavior
    const payload2 = {
        studentId: 'S1',
        date: '2026-06-08',
        classTime: '14:00',
        status: 'late',
        checkedAt: '2026-06-08T14:15:00.000Z',
        source: 'director_manual',
        note: '지각 훈련'
    };
    stateStore.markAttendanceStatus(payload2);

    assert.strictEqual(stateStore.db.attendance.length, 1, 'Attendance record count should still be 1 (upsert)');
    const record2 = stateStore.db.attendance[0];
    assert.strictEqual(record2.status, 'late');
    assert.strictEqual(record2.time, getExpectedHHMM(payload2.checkedAt));
    assert.strictEqual(record2.note, '지각 훈련');
    console.log('✓ Overwriting (present -> late) check passed.');

    // 3. Verify status sequence transition (late -> absent)
    const payload3 = {
        studentId: 'S1',
        date: '2026-06-08',
        classTime: '14:00',
        status: 'absent',
        checkedAt: null,
        source: 'director_manual'
    };
    stateStore.markAttendanceStatus(payload3);

    assert.strictEqual(stateStore.db.attendance.length, 1, 'Attendance record count should still be 1');
    const record3 = stateStore.db.attendance[0];
    assert.strictEqual(record3.status, 'absent');
    assert.strictEqual(record3.time, '', 'Absent record should have empty time');
    assert.strictEqual(record3.checkedAt, null);
    console.log('✓ Status sequence transition (late -> absent) check passed.');

    // 4. Verify back to present (absent -> present)
    const payload4 = {
        studentId: 'S1',
        date: '2026-06-08',
        classTime: '14:00',
        status: 'present',
        checkedAt: '2026-06-08T14:05:00.000Z',
        source: 'director_manual'
    };
    stateStore.markAttendanceStatus(payload4);

    assert.strictEqual(stateStore.db.attendance.length, 1, 'Attendance record count should still be 1');
    const record4 = stateStore.db.attendance[0];
    assert.strictEqual(record4.status, 'present');
    assert.strictEqual(record4.time, getExpectedHHMM(payload4.checkedAt));
    console.log('✓ Status sequence transition (absent -> present) check passed.');

    // 5. Verify duplication prevention for different classTime
    // (If the same student has another class time on the same date)
    const payload5 = {
        studentId: 'S1',
        date: '2026-06-08',
        classTime: '15:30',
        status: 'present',
        checkedAt: '2026-06-08T15:32:00.000Z',
        source: 'director_manual'
    };
    stateStore.markAttendanceStatus(payload5);

    assert.strictEqual(stateStore.db.attendance.length, 2, 'Should create new record for different classTime');
    console.log('✓ Duplication prevention for different classTime check passed.');

    // 6. Verify classTime absent legacy record matching/compatibility
    // Inject a legacy record for S2 without classTime on date 2026-06-08
    stateStore.db.attendance.push({
        id: 'A_LEGACY',
        studentId: 'S2',
        date: '2026-06-08',
        status: 'present',
        time: '14:00',
        note: '이전 기록'
    });
    
    // Now call markAttendanceStatus for S2 with classTime '14:00' and status 'late'
    const payload6 = {
        studentId: 'S2',
        date: '2026-06-08',
        classTime: '14:00',
        status: 'late',
        checkedAt: '2026-06-08T14:10:00.000Z',
        source: 'director_manual'
    };
    stateStore.markAttendanceStatus(payload6);
    
    // It should overwrite the legacy record instead of creating a new one
    const s2Records = stateStore.db.attendance.filter(a => a.studentId === 'S2' && a.date === '2026-06-08');
    assert.strictEqual(s2Records.length, 1, 'Should overwrite the legacy record without creating duplicates');
    assert.strictEqual(s2Records[0].status, 'late');
    assert.strictEqual(s2Records[0].classTime, '14:00');
    console.log('✓ Legacy record matching/compatibility check passed.');

    // 7. Verify no side-effect on message log or notifications (No increase in messages list)
    stateStore.db.messages = [
        { id: 'MSG1', studentId: 'S1', title: '연습 안내', content: '연습 완료', date: '2026-06-08' }
    ];
    const initialMsgCount = stateStore.db.messages.length;
    
    const payload7 = {
        studentId: 'S1',
        date: '2026-06-08',
        classTime: '14:00',
        status: 'late',
        checkedAt: '2026-06-08T14:20:00.000Z',
        source: 'director_manual'
    };
    stateStore.markAttendanceStatus(payload7);
    
    assert.strictEqual(stateStore.db.messages.length, initialMsgCount, 'Message list count should not change');
    console.log('✓ Message log/notification side-effect prevention check passed.');

} catch (err) {
    console.error('❌ Attendance Quick Action API Verification FAILED:', err.message);
    hasError = true;
}

if (hasError) {
    process.exit(1);
} else {
    console.log('--- Attendance Quick Action API Verification PASSED successfully ---');
    process.exit(0);
}
