// parent_messaging_schema_test.mjs - Verify parentContacts & parentMessages schema, migration and helpers.

// Mock global window and localStorage for node environment
let storageMockData = {};
global.localStorage = {
    getItem: (key) => storageMockData[key] || null,
    setItem: (key, val) => { storageMockData[key] = val; }
};
global.window = {
    dispatchEvent: () => {},
    localStorage: global.localStorage
};

console.log('--- Mocking environment completed ---');

// Dynamically import StateStore
const { stateStore } = await import('../../src/js/state.js');

let hasError = false;

console.log('--- Starting Parent Messaging Schema & Migration Verification ---');

// 1. parentContacts / parentMessages 기본 배열이 생성되는지 확인
if (Array.isArray(stateStore.db.parentContacts)) {
    console.log('[OK] parentContacts is initialized as an array.');
} else {
    console.error('[FAIL] parentContacts is missing or not an array!', typeof stateStore.db.parentContacts);
    hasError = true;
}

if (Array.isArray(stateStore.db.parentMessages)) {
    console.log('[OK] parentMessages is initialized as an array.');
} else {
    console.error('[FAIL] parentMessages is missing or not an array!', typeof stateStore.db.parentMessages);
    hasError = true;
}

// 2. 마이그레이션 검증을 위한 테스트 학생 데이터 주입
const testStudentId = 'S_TEST_MIG';
const originalParentPhone = '010-1234-5678';
const originalParentName = '테스트부모';

stateStore.db.students.push({
    id: testStudentId,
    name: '테스트원생',
    phone: '010-9999-9999',
    parentPhone: originalParentPhone,
    parentName: originalParentName,
    teacherId: 'T8',
    instrument: '피아노',
    fee: 150000,
    dueDay: 10,
    enrollDate: '2026-01-10'
});

// migrateParentContacts 수동 호출
stateStore.migrateParentContacts();

// 3. 기존 parentName / parentPhone 기반 parent1 연락처가 생성되었는지 확인
const contacts = stateStore.getParentContactsByStudent(testStudentId);
const primaryContact = stateStore.getPrimaryParentContact(testStudentId);

if (contacts.length === 1) {
    console.log('[OK] parentContacts created exactly 1 record for test student.');
} else {
    console.error('[FAIL] Expected 1 contact record, got:', contacts.length);
    hasError = true;
}

if (primaryContact) {
    console.log('[OK] getPrimaryParentContact successfully returned the contact.');
    if (primaryContact.slot === 'parent1' && primaryContact.isPrimary === true) {
        console.log('[OK] Primary contact slot and isPrimary fields are correct.');
    } else {
        console.error('[FAIL] Invalid primary fields:', primaryContact.slot, primaryContact.isPrimary);
        hasError = true;
    }

    if (primaryContact.phone === originalParentPhone && primaryContact.normalizedPhone === '01012345678') {
        console.log('[OK] Contact phone and normalizedPhone are correct.');
    } else {
        console.error('[FAIL] Phone mismatch. Expected:', originalParentPhone, '01012345678', 'Got:', primaryContact.phone, primaryContact.normalizedPhone);
        hasError = true;
    }

    if (primaryContact.name === originalParentName) {
        console.log('[OK] Contact name matches originalParentName.');
    } else {
        console.error('[FAIL] Name mismatch. Expected:', originalParentName, 'Got:', primaryContact.name);
        hasError = true;
    }

    if (primaryContact.relation === 'guardian') {
        console.log('[OK] Contact relation correctly defaults to guardian.');
    } else {
        console.error('[FAIL] Relation mismatch. Expected: guardian, Got:', primaryContact.relation);
        hasError = true;
    }
} else {
    console.error('[FAIL] Primary contact not found!');
    hasError = true;
}

// 4. 기존 students[].parentName / parentPhone이 그대로 유지되는지 확인
const testStudent = stateStore.db.students.find(s => s.id === testStudentId);
if (testStudent && testStudent.parentPhone === originalParentPhone && testStudent.parentName === originalParentName) {
    console.log('[OK] Original student parent columns are fully preserved.');
} else {
    console.error('[FAIL] Original student parent columns were modified or removed!', testStudent);
    hasError = true;
}

// 5. 마이그레이션 idempotent 검증 (두 번 실행해도 중복 미생성)
stateStore.migrateParentContacts();
const contactsAfterSecondMig = stateStore.getParentContactsByStudent(testStudentId);
if (contactsAfterSecondMig.length === 1) {
    console.log('[OK] Idempotent migration verified: no duplicates created after second run.');
} else {
    console.error('[FAIL] Duplicate contacts created after second migration!', contactsAfterSecondMig.length);
    hasError = true;
}

// 6. createParentMessage가 unread 메시지를 생성하는지 확인
const msgInput = {
    studentId: testStudentId,
    parentContactId: primaryContact ? primaryContact.id : 'pc_dummy',
    parentSlot: 'parent1',
    recipientName: originalParentName,
    recipientPhone: originalParentPhone,
    category: 'attendance',
    type: 'check_in',
    title: '등원 알림',
    body: '원생이 등원했습니다.',
    dedupeKey: 'dedupe_test_key_123'
};

const createdMsg = stateStore.createParentMessage(msgInput);
if (createdMsg && createdMsg.id && createdMsg.status === 'unread') {
    console.log('[OK] createParentMessage successfully created an unread message.');
    if (createdMsg.pushStatus === 'not_required') {
        console.log('[OK] createParentMessage pushStatus correctly defaults to not_required when pushRequired is false.');
    } else {
        console.error('[FAIL] Unexpected pushStatus for non-push message:', createdMsg.pushStatus);
        hasError = true;
    }
} else {
    console.error('[FAIL] Failed to create unread message:', createdMsg);
    hasError = true;
}

// 7. 동일 dedupeKey 메시지가 중복 생성되지 않는지 확인
const initialMsgCount = stateStore.db.parentMessages.length;
const duplicateMsg = stateStore.createParentMessage(msgInput);
const msgCountAfterDup = stateStore.db.parentMessages.length;

if (duplicateMsg && duplicateMsg.id === createdMsg.id) {
    console.log('[OK] createParentMessage duplicate run returned the existing message object.');
} else {
    console.error('[FAIL] Duplicate run returned unexpected message:', duplicateMsg);
    hasError = true;
}

if (msgCountAfterDup === initialMsgCount) {
    console.log('[OK] Duplicate dedupeKey run successfully skipped insertion.');
} else {
    console.error('[FAIL] Duplicate message was inserted! Count mismatch. Expected:', initialMsgCount, 'Got:', msgCountAfterDup);
    hasError = true;
}

// 8. getParentContactsByStudent 헬퍼 동작 확인 (더미 추가 데이터 삽입 후 리스트 길이 검증)
const dummyContactId = 'pc_dummy_2';
stateStore.db.parentContacts.push({
    id: dummyContactId,
    studentId: testStudentId,
    slot: 'parent2',
    name: '테스트부모2',
    phone: '010-0000-0000',
    normalizedPhone: '01000000000',
    isPrimary: false
});

const allContacts = stateStore.getParentContactsByStudent(testStudentId);
if (allContacts.length === 2) {
    console.log('[OK] getParentContactsByStudent successfully returned multiple contacts.');
} else {
    console.error('[FAIL] getParentContactsByStudent length mismatch. Expected 2, Got:', allContacts.length);
    hasError = true;
}

if (hasError) {
    console.error('--- Unit Test: Parent Messaging Schema & Migration FAILED ---');
    process.exit(1);
} else {
    console.log('--- Unit Test: Parent Messaging Schema & Migration PASSED successfully ---');
    process.exit(0);
}
