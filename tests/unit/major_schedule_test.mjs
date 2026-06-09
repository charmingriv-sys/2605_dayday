// tests/unit/major_schedule_test.mjs - Verify Major Schedule Store CRUD API
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

// Dynamically import stateStore
const { stateStore } = await import('../../src/js/state.js');

let hasError = false;

console.log('--- Starting Major Schedule Store CRUD API Verification ---');

try {
    // Isolated database setup for test
    stateStore.db.majorSchedules = [];

    // 1. Verify addMajorSchedule 필수값 검증 (Validation)
    console.log('1. Verifying mandatory field validations...');
    
    // Missing name
    assert.throws(() => {
        stateStore.addMajorSchedule({
            type: 'concours',
            eventDate: '2026-06-15',
            ownerId: 'T8'
        });
    }, /Required field/, 'Should throw if name is missing');

    // Missing type
    assert.throws(() => {
        stateStore.addMajorSchedule({
            name: '테스트 일정',
            eventDate: '2026-06-15',
            ownerId: 'T8'
        });
    }, /Required field/, 'Should throw if type is missing');

    // Missing eventDate
    assert.throws(() => {
        stateStore.addMajorSchedule({
            name: '테스트 일정',
            type: 'concours',
            ownerId: 'T8'
        });
    }, /Required field/, 'Should throw if eventDate is missing');

    // Missing ownerId
    assert.throws(() => {
        stateStore.addMajorSchedule({
            name: '테스트 일정',
            type: 'concours',
            eventDate: '2026-06-15'
        });
    }, /Required field/, 'Should throw if ownerId is missing');

    console.log('✓ Validation checks passed.');

    // 2. Verify adding a valid schedule with 0 participants
    console.log('2. Verifying adding schedule with 0 participants...');
    const payload1 = {
        name: '한국청소년 피아노 콩쿠르',
        type: 'concours',
        eventDate: '2026-06-14',
        dueDate: '2026-06-07',
        ownerId: '정은비',
        place: '예술의전당',
        memo: '접수 마감 전 보호자 확인 필요',
        participantStudentIds: [] // 0 participants
    };

    const newEvent1 = stateStore.addMajorSchedule(payload1);
    assert.ok(newEvent1.id, 'Should generate a unique ID');
    assert.strictEqual(newEvent1.name, '한국청소년 피아노 콩쿠르');
    assert.strictEqual(newEvent1.type, 'concours');
    assert.strictEqual(newEvent1.eventDate, '2026-06-14');
    assert.strictEqual(newEvent1.dueDate, '2026-06-07');
    assert.strictEqual(newEvent1.ownerId, '정은비');
    assert.strictEqual(newEvent1.place, '예술의전당');
    assert.strictEqual(newEvent1.memo, '접수 마감 전 보호자 확인 필요');
    assert.deepStrictEqual(newEvent1.participantStudentIds, [], 'Should support empty participant list');
    
    // 3. Verify visible 기본값 false
    console.log('3. Verifying visible default value is false...');
    assert.strictEqual(newEvent1.visible, false, 'visible should default to false');
    console.log('✓ Visible default value check passed.');

    // 4. Verify 상태 필드(status) 및 미처리(openCount) 저장되지 않음
    console.log('4. Verifying status/openCount fields are omitted...');
    const payloadWithStatus = {
        name: '임시 보강 일정',
        type: 'makeup',
        eventDate: '2026-06-12',
        ownerId: '운영실',
        status: '확인필요', // status supplied
        openCount: 2 // openCount supplied
    };
    const newEvent2 = stateStore.addMajorSchedule(payloadWithStatus);
    assert.strictEqual(newEvent2.status, undefined, 'status field should not be saved');
    assert.strictEqual(newEvent2.openCount, undefined, 'openCount field should not be saved');
    console.log('✓ status and openCount omission check passed.');

    // 5. Verify updateMajorSchedule로 이름/구분/진행일/공개여부 수정 가능
    console.log('5. Verifying updateMajorSchedule works...');
    const patch = {
        name: '수정된 콩쿠르 명칭',
        type: 'etc',
        eventDate: '2026-06-25',
        visible: true
    };
    const updatedEvent1 = stateStore.updateMajorSchedule(newEvent1.id, patch);
    assert.strictEqual(updatedEvent1.name, '수정된 콩쿠르 명칭');
    assert.strictEqual(updatedEvent1.type, 'etc');
    assert.strictEqual(updatedEvent1.eventDate, '2026-06-25');
    assert.strictEqual(updatedEvent1.visible, true);
    // Unchanged values should persist
    assert.strictEqual(updatedEvent1.ownerId, '정은비');
    console.log('✓ Update check passed.');

    // 6. Verify deleteMajorSchedule로 삭제 가능
    console.log('6. Verifying deleteMajorSchedule works...');
    const idToDelete = newEvent2.id;
    const initialCount = stateStore.getMajorSchedules().length;
    const deleted = stateStore.deleteMajorSchedule(idToDelete);
    assert.strictEqual(deleted, true, 'Should return true on successful deletion');
    const postDeleteCount = stateStore.getMajorSchedules().length;
    assert.strictEqual(postDeleteCount, initialCount - 1, 'Schedule list count should decrease by 1');
    assert.ok(!stateStore.getMajorSchedules().some(e => e.id === idToDelete), 'Deleted schedule should not exist');
    console.log('✓ Deletion check passed.');

} catch (err) {
    console.error('❌ Major Schedule Store CRUD API Verification FAILED:', err.stack);
    hasError = true;
}

if (hasError) {
    process.exit(1);
} else {
    console.log('--- Major Schedule Store CRUD API Verification PASSED successfully ---');
    process.exit(0);
}
