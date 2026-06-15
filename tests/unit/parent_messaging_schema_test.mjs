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

// 9. upsertParentContact 신규 생성 및 수정, 멱등성 검증
const studentIdForUpsert = 'S_UPSERT_TEST';
stateStore.upsertParentContact({
    studentId: studentIdForUpsert,
    slot: 'parent1',
    name: '아빠',
    relation: 'father',
    phone: '010-1234-5678'
});

const upsertedContacts1 = stateStore.getParentContactsByStudent(studentIdForUpsert);
if (upsertedContacts1.length === 1 && upsertedContacts1[0].name === '아빠' && upsertedContacts1[0].relation === 'father') {
    console.log('[OK] upsertParentContact successfully created a contact.');
} else {
    console.error('[FAIL] upsertParentContact failed to create contact properly:', upsertedContacts1);
    hasError = true;
}

stateStore.upsertParentContact({
    studentId: studentIdForUpsert,
    slot: 'parent1',
    name: '아빠 수정',
    relation: 'father',
    phone: '010-1234-5678'
});

const upsertedContacts2 = stateStore.getParentContactsByStudent(studentIdForUpsert);
if (upsertedContacts2.length === 1 && upsertedContacts2[0].name === '아빠 수정') {
    console.log('[OK] upsertParentContact successfully updated existing slot without duplicates.');
} else {
    console.error('[FAIL] upsertParentContact failed or created duplicate:', upsertedContacts2);
    hasError = true;
}

// 10. clearParentContact (parent2 비웠을 때 삭제 동작 검증)
stateStore.upsertParentContact({
    studentId: studentIdForUpsert,
    slot: 'parent2',
    name: '엄마',
    relation: 'mother',
    phone: '010-9876-5432'
});

const beforeClear = stateStore.getParentContactsByStudent(studentIdForUpsert);
if (beforeClear.length === 2) {
    console.log('[OK] parent2 successfully created before clear.');
} else {
    console.error('[FAIL] parent2 not created:', beforeClear);
    hasError = true;
}

stateStore.clearParentContact(studentIdForUpsert, 'parent2');
const afterClear = stateStore.getParentContactsByStudent(studentIdForUpsert);
if (afterClear.length === 1 && !afterClear.some(c => c.slot === 'parent2')) {
    console.log('[OK] clearParentContact successfully deleted parent2.');
} else {
    console.error('[FAIL] clearParentContact failed to delete parent2:', afterClear);
    hasError = true;
}

// 11. addStudent / updateStudent 호출 시 parent1 자동 동기화 검증
const syncedStudent = stateStore.addStudent({
    name: '동기화원생',
    parentName: '동기화부모',
    parentPhone: '010-1111-3333',
    instrument: '첼로',
    fee: 100000,
    dueDay: 5
});

const syncedContacts1 = stateStore.getParentContactsByStudent(syncedStudent.id);
const syncedParent1 = syncedContacts1.find(c => c.slot === 'parent1');
if (syncedParent1 && syncedParent1.name === '동기화부모' && syncedParent1.phone === '010-1111-3333') {
    console.log('[OK] addStudent automatically created parent1 contact.');
} else {
    console.error('[FAIL] addStudent parent1 sync failed:', syncedParent1);
    hasError = true;
}

stateStore.updateStudent(syncedStudent.id, {
    parentName: '동기화부모 수정',
    parentPhone: '010-1111-4444'
});

const syncedContacts2 = stateStore.getParentContactsByStudent(syncedStudent.id);
const syncedParent2 = syncedContacts2.find(c => c.slot === 'parent1');
if (syncedParent2 && syncedParent2.name === '동기화부모 수정' && syncedParent2.phone === '010-1111-4444') {
    console.log('[OK] updateStudent automatically updated parent1 contact.');
} else {
    console.error('[FAIL] updateStudent parent1 sync failed:', syncedParent2);
    hasError = true;
}

// 12. parentMessageSettings 기본 초기화 및 멱등성 검증
const parentMsgSettings = stateStore.getParentMessageSettings();
const requiredEvents = [
    'attendanceCheckIn',
    'attendanceCheckOut',
    'tuitionBilling',
    'tuitionOverdue',
    'tuitionPaid',
    'bookBilling',
    'bookOverdue',
    'bookPaid'
];

let allKeysExist = true;
for (const ev of requiredEvents) {
    if (!parentMsgSettings[ev]) {
        console.error(`[FAIL] Missing parentMessageSettings event key: ${ev}`);
        allKeysExist = false;
        hasError = true;
    } else {
        const item = parentMsgSettings[ev];
        if (typeof item.messageEnabled !== 'boolean' || typeof item.pushEnabled !== 'boolean') {
            console.error(`[FAIL] Event key ${ev} does not have boolean fields messageEnabled or pushEnabled.`);
            hasError = true;
        }
    }
}
if (allKeysExist) {
    console.log('[OK] parentMessageSettings has all 8 required event keys.');
}

// 13. normalizeParentMessageSettings 검증 (일부 키 누락 및 모순 상태 보정)
const dirtySettings = {
    attendanceCheckIn: { messageEnabled: false, pushEnabled: true }, // Contradiction: messageEnabled is false but pushEnabled is true
    tuitionBilling: { messageEnabled: true, pushEnabled: false } // Valid silent mode
};
const cleanedSettings = stateStore.normalizeParentMessageSettings(dirtySettings);

if (cleanedSettings.attendanceCheckIn.messageEnabled === false && cleanedSettings.attendanceCheckIn.pushEnabled === false) {
    console.log('[OK] normalizeParentMessageSettings successfully corrected pushEnabled to false when messageEnabled is false.');
} else {
    console.error('[FAIL] normalizeParentMessageSettings failed to correct contradiction state!', cleanedSettings.attendanceCheckIn);
    hasError = true;
}

if (cleanedSettings.tuitionBilling.messageEnabled === true && cleanedSettings.tuitionBilling.pushEnabled === false) {
    console.log('[OK] normalizeParentMessageSettings preserved valid silent mode configuration.');
} else {
    console.error('[FAIL] normalizeParentMessageSettings incorrectly changed valid silent mode configuration!', cleanedSettings.tuitionBilling);
    hasError = true;
}

if (cleanedSettings.attendanceCheckOut && cleanedSettings.attendanceCheckOut.messageEnabled === true && cleanedSettings.attendanceCheckOut.pushEnabled === true) {
    console.log('[OK] normalizeParentMessageSettings successfully populated missing event keys with default values.');
} else {
    console.error('[FAIL] normalizeParentMessageSettings failed to populate missing event keys with defaults!', cleanedSettings.attendanceCheckOut);
    hasError = true;
}

// 14. updateParentMessageSetting 및 종속 차단 강제 연동 검증
stateStore.updateParentMessageSetting('tuitionPaid', { messageEnabled: true, pushEnabled: false });
let tuitionPaidSetting = stateStore.getParentMessageSettings().tuitionPaid;
if (tuitionPaidSetting.messageEnabled === true && tuitionPaidSetting.pushEnabled === false) {
    console.log('[OK] updateParentMessageSetting successfully updated tuitionPaid setting.');
} else {
    console.error('[FAIL] updateParentMessageSetting failed to update tuitionPaid!', tuitionPaidSetting);
    hasError = true;
}

stateStore.updateParentMessageSetting('tuitionPaid', { messageEnabled: false, pushEnabled: true });
tuitionPaidSetting = stateStore.getParentMessageSettings().tuitionPaid;
if (tuitionPaidSetting.messageEnabled === false && tuitionPaidSetting.pushEnabled === false) {
    console.log('[OK] updateParentMessageSetting successfully corrected pushEnabled to false when messageEnabled is updated to false.');
} else {
    console.error('[FAIL] updateParentMessageSetting failed to force pushEnabled to false on contradiction!', tuitionPaidSetting);
    hasError = true;
}

// 15. updateParentMessageSettingsBulk 검증
stateStore.updateParentMessageSettingsBulk({
    attendanceCheckIn: { messageEnabled: true, pushEnabled: true },
    attendanceCheckOut: { messageEnabled: false, pushEnabled: true }, // Contradiction: should be corrected to false
    tuitionBilling: { messageEnabled: false, pushEnabled: false }
});

const bulkCheckIn = stateStore.getParentMessageSettings().attendanceCheckIn;
const bulkCheckOut = stateStore.getParentMessageSettings().attendanceCheckOut;
const bulkBilling = stateStore.getParentMessageSettings().tuitionBilling;

if (bulkCheckIn.messageEnabled === true && bulkCheckIn.pushEnabled === true &&
    bulkCheckOut.messageEnabled === false && bulkCheckOut.pushEnabled === false &&
    bulkBilling.messageEnabled === false && bulkBilling.pushEnabled === false) {
    console.log('[OK] updateParentMessageSettingsBulk successfully updated multiple settings and corrected contradictions.');
} else {
    console.error('[FAIL] updateParentMessageSettingsBulk verification failed:', { bulkCheckIn, bulkCheckOut, bulkBilling });
    hasError = true;
}

// 16. 출결 이벤트 기반 학부모 메시지함 자동 생성 엔진 검증 (Phase 16L)
console.log('--- Starting Phase 16L Attendance Event messaging engine tests ---');

const testStudentIdL = 'S_TEST_L';
// 16.1 Clean up any previous test student and messages
stateStore.db.students = stateStore.db.students.filter(s => s.id !== testStudentIdL);
stateStore.db.parentContacts = stateStore.db.parentContacts.filter(c => c.studentId !== testStudentIdL);
stateStore.db.parentMessages = stateStore.db.parentMessages.filter(m => m.studentId !== testStudentIdL);
stateStore.db.attendance = stateStore.db.attendance.filter(a => a.studentId !== testStudentIdL);

// Add student
stateStore.db.students.push({
    id: testStudentIdL,
    name: '엘원생',
    phone: '010-9999-9999',
    parentPhone: '010-8888-8888',
    parentName: '엘부모',
    teacherId: 'T8',
    instrument: '피아노',
    fee: 150000,
    dueDay: 10,
    enrollDate: '2026-01-10'
});

// Migrate contacts to initialize parent1
stateStore.migrateParentContacts();

// Verify primary contact is set
const contactL = stateStore.getPrimaryParentContact(testStudentIdL);
if (!contactL) {
    console.error('[FAIL] Primary contact for L student not initialized.');
    hasError = true;
}

// 16.2 Test Case: messageEnabled=true, pushEnabled=true (Default check-in)
stateStore.updateParentMessageSettingsBulk({
    attendanceCheckIn: { messageEnabled: true, pushEnabled: true },
    attendanceCheckOut: { messageEnabled: true, pushEnabled: true }
});

// Clear messages first
stateStore.db.parentMessages = stateStore.db.parentMessages.filter(m => m.studentId !== testStudentIdL);

// Trigger check-in
stateStore.markAttendance(testStudentIdL, '2026-06-15', 'present', '14:05', '단위테스트 등원');

const messagesCheckIn1 = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdL && m.type === 'check_in');
if (messagesCheckIn1.length === 1) {
    const msg = messagesCheckIn1[0];
    console.log('[OK] Check-in parent message created successfully.');
    if (msg.pushRequired === true && msg.pushStatus === 'pending') {
        console.log('[OK] Check-in pushRequired and pushStatus are correct (true/pending).');
    } else {
        console.error('[FAIL] Check-in pushRequired/pushStatus mismatch:', msg.pushRequired, msg.pushStatus);
        hasError = true;
    }
    if (msg.title === '엘원생 원생 등원 알림' && msg.body.includes('엘원생 원생이 14:05에 등원했습니다.')) {
        console.log('[OK] Check-in message title and body are correct.');
    } else {
        console.error('[FAIL] Check-in message content mismatch:', msg.title, msg.body);
        hasError = true;
    }
} else {
    console.error('[FAIL] Expected 1 check-in parent message, got:', messagesCheckIn1.length);
    hasError = true;
}

// 16.3 Test Case: Deduplication (Duplicate check-in should not create new message)
stateStore.markAttendance(testStudentIdL, '2026-06-15', 'present', '14:05', '단위테스트 등원 중복');
const messagesCheckInDup = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdL && m.type === 'check_in');
if (messagesCheckInDup.length === 1) {
    console.log('[OK] Deduplication worked successfully for duplicate check-in.');
} else {
    console.error('[FAIL] Deduplication failed, count of check-in messages is:', messagesCheckInDup.length);
    hasError = true;
}

// 16.4 Test Case: messageEnabled=true, pushEnabled=false (Silent mode check-out)
stateStore.updateParentMessageSettingsBulk({
    attendanceCheckOut: { messageEnabled: true, pushEnabled: false }
});

stateStore.leaveAttendance(testStudentIdL, '2026-06-15', '14:55');
const messagesCheckOut1 = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdL && m.type === 'check_out');
if (messagesCheckOut1.length === 1) {
    const msg = messagesCheckOut1[0];
    console.log('[OK] Check-out parent message created successfully.');
    if (msg.pushRequired === false && msg.pushStatus === 'not_required') {
        console.log('[OK] Check-out pushRequired and pushStatus are correct for silent mode (false/not_required).');
    } else {
        console.error('[FAIL] Check-out pushRequired/pushStatus mismatch in silent mode:', msg.pushRequired, msg.pushStatus);
        hasError = true;
    }
    if (msg.title === '엘원생 원생 하원 알림' && msg.body.includes('엘원생 원생이 14:55에 하원했습니다.')) {
        console.log('[OK] Check-out message title and body are correct.');
    } else {
        console.error('[FAIL] Check-out message content mismatch:', msg.title, msg.body);
        hasError = true;
    }
} else {
    console.error('[FAIL] Expected 1 check-out parent message, got:', messagesCheckOut1.length);
    hasError = true;
}

// 16.5 Test Case: messageEnabled=false (No message generated)
stateStore.updateParentMessageSettingsBulk({
    attendanceCheckIn: { messageEnabled: false, pushEnabled: false }
});

// Clear attendance for another date to test
stateStore.markAttendance(testStudentIdL, '2026-06-16', 'present', '14:10', '메시지 비활성화 상태 등원');
const messagesCheckInDisabled = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdL && m.type === 'check_in' && m.body.includes('14:10'));
if (messagesCheckInDisabled.length === 0) {
    console.log('[OK] No message created when messageEnabled is false.');
} else {
    console.error('[FAIL] Message was created even though messageEnabled is false:', messagesCheckInDisabled);
    hasError = true;
}

// 16.6 Test Case: primary contact has canReceiveMessage=false (No message generated)
stateStore.updateParentMessageSettingsBulk({
    attendanceCheckIn: { messageEnabled: true, pushEnabled: true }
});
contactL.canReceiveMessage = false;
stateStore.saveDB();

stateStore.markAttendance(testStudentIdL, '2026-06-17', 'present', '14:20', '수신비동의 등원');
const messagesCheckInNoReceive = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdL && m.type === 'check_in' && m.body.includes('14:20'));
if (messagesCheckInNoReceive.length === 0) {
    console.log('[OK] No message created when canReceiveMessage is false.');
} else {
    console.error('[FAIL] Message was created even though canReceiveMessage is false:', messagesCheckInNoReceive);
    hasError = true;
}

// Restore canReceiveMessage for student
contactL.canReceiveMessage = true;
stateStore.saveDB();

// 16.7 Test Case: check inclusion of late and exclusion of absent events
stateStore.markAttendance(testStudentIdL, '2026-06-18', 'late', '14:40', '지각 이벤트');
const messagesCheckInLate = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdL && m.type === 'check_in' && m.body.includes('14:40'));
if (messagesCheckInLate.length === 1) {
    console.log('[OK] Late status check-in correctly generated parent check_in message.');
} else {
    console.error('[FAIL] Expected parent check_in message for late status, got count:', messagesCheckInLate.length);
    hasError = true;
}

stateStore.markAttendance(testStudentIdL, '2026-06-19', 'absent', '14:50', '결석 이벤트');
const messagesCheckInAbsent = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdL && m.type === 'check_in' && m.body.includes('14:50'));
if (messagesCheckInAbsent.length === 0) {
    console.log('[OK] Excluded absent status from check_in message generation.');
} else {
    console.error('[FAIL] Message was created for absent status check-in!', messagesCheckInAbsent);
    hasError = true;
}

// 17. 수강료 수납 안내 및 수납 완료 학부모 메시지 자동 생성 엔진 검증 (Phase 16M-1)
console.log('--- Starting Phase 16M-1 Tuition Event messaging engine tests ---');

const testStudentIdM = 'S_TEST_M';
// Clean up previous test student, contacts, messages, payments
stateStore.db.students = stateStore.db.students.filter(s => s.id !== testStudentIdM);
stateStore.db.parentContacts = stateStore.db.parentContacts.filter(c => c.studentId !== testStudentIdM);
stateStore.db.parentMessages = stateStore.db.parentMessages.filter(m => m.studentId !== testStudentIdM);
stateStore.db.payments = stateStore.db.payments.filter(p => p.studentId !== testStudentIdM);

// Add student
stateStore.db.students.push({
    id: testStudentIdM,
    name: '엠원생',
    phone: '010-7777-7777',
    parentPhone: '010-6666-6666',
    parentName: '엠부모',
    teacherId: 'T8',
    instrument: '피아노',
    fee: 200000,
    dueDay: 15,
    enrollDate: '2026-01-10'
});

// Migrate contacts to initialize parent1
stateStore.migrateParentContacts();

// Verify primary contact is set
const contactM = stateStore.getPrimaryParentContact(testStudentIdM);
if (!contactM) {
    console.error('[FAIL] Primary contact for M student not initialized.');
    hasError = true;
}

// 17.1 Test Case: messageEnabled=true, pushEnabled=true (Default tuition billing)
stateStore.updateParentMessageSettingsBulk({
    tuitionBilling: { messageEnabled: true, pushEnabled: true },
    tuitionPaid: { messageEnabled: true, pushEnabled: true }
});

// Create education invoice
const invoiceM1 = stateStore.createInvoice(testStudentIdM, 200000, '2026-06');
const messagesBilling1 = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdM && m.type === 'tuition_billing');

if (messagesBilling1.length === 1) {
    const msg = messagesBilling1[0];
    console.log('[OK] Tuition billing parent message created successfully.');
    if (msg.pushRequired === true && msg.pushStatus === 'pending') {
        console.log('[OK] Tuition billing pushRequired and pushStatus are correct (true/pending).');
    } else {
        console.error('[FAIL] Tuition billing pushRequired/pushStatus mismatch:', msg.pushRequired, msg.pushStatus);
        hasError = true;
    }
    if (msg.title === '엠원생 원생 수강료 수납 안내' && msg.body.includes('엠원생 원생의 2026년 06월 수강료 200,000원이 청구되었습니다.')) {
        console.log('[OK] Tuition billing message title and body are correct.');
    } else {
        console.error('[FAIL] Tuition billing message content mismatch:', msg.title, msg.body);
        hasError = true;
    }
} else {
    console.error('[FAIL] Expected 1 tuition billing parent message, got:', messagesBilling1.length);
    hasError = true;
}

// 17.2 Test Case: Deduplication for tuition billing (duplicate invoice or recreate should not duplicate)
stateStore.triggerPaymentParentMessage(invoiceM1.id, 'tuition_billing');
const messagesBillingDup = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdM && m.type === 'tuition_billing');
if (messagesBillingDup.length === 1) {
    console.log('[OK] Deduplication worked successfully for tuition billing.');
} else {
    console.error('[FAIL] Deduplication failed, count of billing messages is:', messagesBillingDup.length);
    hasError = true;
}

// 17.3 Test Case: Tuition Paid transition
stateStore.payInvoice(invoiceM1.id, 'card');
const messagesPaid1 = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdM && m.type === 'tuition_paid');
if (messagesPaid1.length === 1) {
    const msg = messagesPaid1[0];
    console.log('[OK] Tuition paid parent message created successfully.');
    if (msg.pushRequired === true && msg.pushStatus === 'pending') {
        console.log('[OK] Tuition paid pushRequired and pushStatus are correct (true/pending).');
    } else {
        console.error('[FAIL] Tuition paid pushRequired/pushStatus mismatch:', msg.pushRequired, msg.pushStatus);
        hasError = true;
    }
    if (msg.title === '엠원생 원생 수강료 수납 완료' && msg.body.includes('엠원생 원생의 2026년 06월 수강료 200,000원이 수납 완료되었습니다.')) {
        console.log('[OK] Tuition paid message title and body are correct.');
    } else {
        console.error('[FAIL] Tuition paid message content mismatch:', msg.title, msg.body);
        hasError = true;
    }
} else {
    console.error('[FAIL] Expected 1 tuition paid parent message, got:', messagesPaid1.length);
    hasError = true;
}

// 17.4 Test Case: Deduplication for tuition paid
stateStore.triggerPaymentParentMessage(invoiceM1.id, 'tuition_paid');
const messagesPaidDup = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdM && m.type === 'tuition_paid');
if (messagesPaidDup.length === 1) {
    console.log('[OK] Deduplication worked successfully for tuition paid.');
} else {
    console.error('[FAIL] Deduplication failed, count of paid messages is:', messagesPaidDup.length);
    hasError = true;
}

// 17.5 Test Case: Silent mode (messageEnabled=true, pushEnabled=false)
stateStore.updateParentMessageSettingsBulk({
    tuitionBilling: { messageEnabled: true, pushEnabled: false },
    tuitionPaid: { messageEnabled: true, pushEnabled: false }
});

const invoiceM2 = stateStore.createInvoice(testStudentIdM, 200000, '2026-07');
const messagesBilling2 = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdM && m.type === 'tuition_billing' && m.body.includes('2026년 07월'));
if (messagesBilling2.length === 1) {
    const msg = messagesBilling2[0];
    if (msg.pushRequired === false && msg.pushStatus === 'not_required') {
        console.log('[OK] Tuition billing silent mode push settings are correct (false/not_required).');
    } else {
        console.error('[FAIL] Tuition billing silent mode push settings mismatch:', msg.pushRequired, msg.pushStatus);
        hasError = true;
    }
} else {
    console.error('[FAIL] Expected silent billing message to be created.');
    hasError = true;
}

stateStore.payInvoice(invoiceM2.id, 'cash');
const messagesPaid2 = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdM && m.type === 'tuition_paid' && m.body.includes('2026년 07월'));
if (messagesPaid2.length === 1) {
    const msg = messagesPaid2[0];
    if (msg.pushRequired === false && msg.pushStatus === 'not_required') {
        console.log('[OK] Tuition paid silent mode push settings are correct (false/not_required).');
    } else {
        console.error('[FAIL] Tuition paid silent mode push settings mismatch:', msg.pushRequired, msg.pushStatus);
        hasError = true;
    }
} else {
    console.error('[FAIL] Expected silent paid message to be created.');
    hasError = true;
}

// 17.6 Test Case: messageEnabled=false
stateStore.updateParentMessageSettingsBulk({
    tuitionBilling: { messageEnabled: false, pushEnabled: false },
    tuitionPaid: { messageEnabled: false, pushEnabled: false }
});

const invoiceM3 = stateStore.createInvoice(testStudentIdM, 200000, '2026-08');
const messagesBilling3 = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdM && m.type === 'tuition_billing' && m.body.includes('2026년 08월'));
if (messagesBilling3.length === 0) {
    console.log('[OK] No billing message created when messageEnabled is false.');
} else {
    console.error('[FAIL] Billing message was created even though messageEnabled is false:', messagesBilling3);
    hasError = true;
}

stateStore.payInvoice(invoiceM3.id, 'cash');
const messagesPaid3 = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdM && m.type === 'tuition_paid' && m.body.includes('2026년 08월'));
if (messagesPaid3.length === 0) {
    console.log('[OK] No paid message created when messageEnabled is false.');
} else {
    console.error('[FAIL] Paid message was created even though messageEnabled is false:', messagesPaid3);
    hasError = true;
}

// 17.7 Test Case: canReceiveMessage=false
stateStore.updateParentMessageSettingsBulk({
    tuitionBilling: { messageEnabled: true, pushEnabled: true },
    tuitionPaid: { messageEnabled: true, pushEnabled: true }
});
contactM.canReceiveMessage = false;
stateStore.saveDB();

const invoiceM4 = stateStore.createInvoice(testStudentIdM, 200000, '2026-09');
const messagesBilling4 = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdM && m.type === 'tuition_billing' && m.body.includes('2026년 09월'));
if (messagesBilling4.length === 0) {
    console.log('[OK] No billing message created when canReceiveMessage is false.');
} else {
    console.error('[FAIL] Billing message was created even though canReceiveMessage is false:', messagesBilling4);
    hasError = true;
}

stateStore.payInvoice(invoiceM4.id, 'cash');
const messagesPaid4 = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdM && m.type === 'tuition_paid' && m.body.includes('2026년 09월'));
if (messagesPaid4.length === 0) {
    console.log('[OK] No paid message created when canReceiveMessage is false.');
} else {
    console.error('[FAIL] Paid message was created even though canReceiveMessage is false:', messagesPaid4);
    hasError = true;
}

// Restore canReceiveMessage
contactM.canReceiveMessage = true;
stateStore.saveDB();

// 17.8 Test Case: Book payments must be excluded
const bookPaymentId = 'P_TEST_BOOK_M';
stateStore.db.payments.push({
    id: bookPaymentId,
    studentId: testStudentIdM,
    amount: 15000,
    month: '2026-06',
    type: 'book',
    status: 'unpaid',
    invoiceDate: '2026-06-15'
});

stateStore.triggerPaymentParentMessage(bookPaymentId, 'tuition_billing');
const messagesBookBilling = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdM && m.type === 'tuition_billing' && m.relatedDomainId === bookPaymentId);
if (messagesBookBilling.length === 0) {
    console.log('[OK] Excluded book payment from tuition billing message generation.');
} else {
    console.error('[FAIL] Billing message was generated for book payment:', messagesBookBilling);
    hasError = true;
}

stateStore.payInvoice(bookPaymentId, 'cash');
const messagesBookPaid = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdM && m.type === 'tuition_paid' && m.relatedDomainId === bookPaymentId);
if (messagesBookPaid.length === 0) {
    console.log('[OK] Excluded book payment from tuition paid message generation.');
} else {
    console.error('[FAIL] Paid message was generated for book payment:', messagesBookPaid);
    hasError = true;
}

if (hasError) {
    console.error('--- Unit Test: Parent Messaging Schema & Migration FAILED ---');
    process.exit(1);
} else {
    console.log('--- Unit Test: Parent Messaging Schema & Migration PASSED successfully ---');
    process.exit(0);
}
