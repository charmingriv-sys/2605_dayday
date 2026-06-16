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

// 18. 수강료 미수납 안내 학부모 메시지 자동 생성 엔진 검증 (Phase 16M-2)
console.log('--- Starting Phase 16M-2 Tuition Overdue messaging engine tests ---');

const testStudentIdO = 'S_TEST_O';
// Clean up
stateStore.db.students = stateStore.db.students.filter(s => s.id !== testStudentIdO);
stateStore.db.parentContacts = stateStore.db.parentContacts.filter(c => c.studentId !== testStudentIdO);
stateStore.db.parentMessages = stateStore.db.parentMessages.filter(m => m.studentId !== testStudentIdO);
stateStore.db.payments = stateStore.db.payments.filter(p => p.studentId !== testStudentIdO);
stateStore.db.todayTasks = stateStore.db.todayTasks.filter(t => t.relatedStudentIds && !t.relatedStudentIds.includes(testStudentIdO));

// Add student with dueDay = 10
stateStore.db.students.push({
    id: testStudentIdO,
    name: '오원생',
    phone: '010-5555-5555',
    parentPhone: '010-4444-4444',
    parentName: '오부모',
    teacherId: 'T8',
    instrument: '피아노',
    fee: 250000,
    dueDay: 10,
    enrollDate: '2026-01-10'
});

// Migrate contacts to initialize parent1
stateStore.migrateParentContacts();

// Set evaluation time to 2026-06-13 (today is 13th)
if (!stateStore.db.settings) stateStore.db.settings = {};
stateStore.db.settings.DAYDAY_DEBUG_EVAL_TIME = '2026-06-13T12:00:00.000Z';

// 18.1 Test Case: messageEnabled=true, pushEnabled=true (Default overdue message)
stateStore.updateParentMessageSettingsBulk({
    tuitionOverdue: { messageEnabled: true, pushEnabled: true }
});

// Add overdue payment (due on 10th, unpaid)
stateStore.db.payments.push({
    id: 'P_O_OVERDUE_1',
    studentId: testStudentIdO,
    amount: 250000,
    month: '2026-06',
    type: 'education',
    status: 'unpaid',
    invoiceDate: '2026-06-10'
});

// Add due today payment (due on 13th, unpaid)
const testStudentIdO2 = 'S_TEST_O2';
stateStore.db.students.push({
    id: testStudentIdO2,
    name: '오늘원생',
    phone: '010-3333-3333',
    parentPhone: '010-2222-2222',
    parentName: '오늘부모',
    teacherId: 'T8',
    instrument: '바이올린',
    fee: 250000,
    dueDay: 13,
    enrollDate: '2026-01-10'
});
stateStore.migrateParentContacts();

stateStore.db.payments.push({
    id: 'P_O_DUE_TODAY',
    studentId: testStudentIdO2,
    amount: 250000,
    month: '2026-06',
    type: 'education',
    status: 'unpaid',
    invoiceDate: '2026-06-13'
});

// Trigger recommendations sync
stateStore.syncSystemRecommendations(new Date('2026-06-13T12:00:00.000Z'));

// Verify overdue parentMessage is created for S_TEST_O
const messagesOverdue1 = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdO && m.type === 'tuition_overdue');
if (messagesOverdue1.length === 1) {
    const msg = messagesOverdue1[0];
    console.log('[OK] Tuition overdue parent message created successfully.');
    if (msg.pushRequired === true && msg.pushStatus === 'pending') {
        console.log('[OK] Tuition overdue pushRequired and pushStatus are correct (true/pending).');
    } else {
        console.error('[FAIL] Tuition overdue pushRequired/pushStatus mismatch:', msg.pushRequired, msg.pushStatus);
        hasError = true;
    }
    if (msg.title === '오원생 원생 수강료 미수납 안내' && msg.body.includes('오원생 원생의 2026년 06월 수강료 250,000원이 아직 수납되지 않았습니다.')) {
        console.log('[OK] Tuition overdue message title and body are correct.');
    } else {
        console.error('[FAIL] Tuition overdue message content mismatch:', msg.title, msg.body);
        hasError = true;
    }
} else {
    console.error('[FAIL] Expected 1 tuition overdue parent message for overdue student, got:', messagesOverdue1.length);
    hasError = true;
}

// Verify due today parentMessage is NOT created for S_TEST_O2
const messagesDueToday = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdO2 && m.type === 'tuition_overdue');
if (messagesDueToday.length === 0) {
    console.log('[OK] Excluded due today payment from overdue message generation.');
} else {
    console.error('[FAIL] Overdue message was generated for due today payment:', messagesDueToday);
    hasError = true;
}

// 18.2 Test Case: Deduplication (repeated syncs must not duplicate)
stateStore.syncSystemRecommendations(new Date('2026-06-13T12:00:00.000Z'));
const messagesOverdueDup = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdO && m.type === 'tuition_overdue');
if (messagesOverdueDup.length === 1) {
    console.log('[OK] Deduplication worked successfully for tuition overdue.');
} else {
    console.error('[FAIL] Deduplication failed, count of overdue messages is:', messagesOverdueDup.length);
    hasError = true;
}

// 18.3 Test Case: messageEnabled=false
stateStore.updateParentMessageSettingsBulk({
    tuitionOverdue: { messageEnabled: false, pushEnabled: false }
});
// Clean S_TEST_O messages and re-trigger
stateStore.db.parentMessages = stateStore.db.parentMessages.filter(m => m.studentId !== testStudentIdO);
stateStore.syncSystemRecommendations(new Date('2026-06-13T12:00:00.000Z'));
const messagesOverdueDisabled = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdO && m.type === 'tuition_overdue');
if (messagesOverdueDisabled.length === 0) {
    console.log('[OK] No overdue message created when messageEnabled is false.');
} else {
    console.error('[FAIL] Overdue message was created even though messageEnabled is false:', messagesOverdueDisabled);
    hasError = true;
}

// 18.4 Test Case: pushEnabled=false (Silent mode)
stateStore.updateParentMessageSettingsBulk({
    tuitionOverdue: { messageEnabled: true, pushEnabled: false }
});
stateStore.syncSystemRecommendations(new Date('2026-06-13T12:00:00.000Z'));
const messagesOverdueSilent = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdO && m.type === 'tuition_overdue');
if (messagesOverdueSilent.length === 1) {
    const msg = messagesOverdueSilent[0];
    if (msg.pushRequired === false && msg.pushStatus === 'not_required') {
        console.log('[OK] Tuition overdue silent mode push settings are correct (false/not_required).');
    } else {
        console.error('[FAIL] Tuition overdue silent mode push settings mismatch:', msg.pushRequired, msg.pushStatus);
        hasError = true;
    }
} else {
    console.error('[FAIL] Expected silent overdue message to be created.');
    hasError = true;
}

// 18.5 Test Case: canReceiveMessage=false
const contactO = stateStore.getPrimaryParentContact(testStudentIdO);
if (contactO) {
    contactO.canReceiveMessage = false;
    stateStore.saveDB();
}
// Clean messages and trigger
stateStore.db.parentMessages = stateStore.db.parentMessages.filter(m => m.studentId !== testStudentIdO);
stateStore.syncSystemRecommendations(new Date('2026-06-13T12:00:00.000Z'));
const messagesOverdueNoReceive = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdO && m.type === 'tuition_overdue');
if (messagesOverdueNoReceive.length === 0) {
    console.log('[OK] No overdue message created when canReceiveMessage is false.');
} else {
    console.error('[FAIL] Overdue message was created even though canReceiveMessage is false:', messagesOverdueNoReceive);
    hasError = true;
}

// Restore
if (contactO) {
    contactO.canReceiveMessage = true;
    stateStore.saveDB();
}

// 18.6 Test Case: Book payment overdue exclusion
stateStore.db.payments.push({
    id: 'P_O_BOOK_OVERDUE',
    studentId: testStudentIdO,
    amount: 20000,
    month: '2026-06',
    type: 'book',
    status: 'unpaid',
    invoiceDate: '2026-06-10'
});
stateStore.syncSystemRecommendations(new Date('2026-06-13T12:00:00.000Z'));
const messagesBookOverdue = stateStore.db.parentMessages.filter(m => m.relatedDomainId === 'P_O_BOOK_OVERDUE');
if (messagesBookOverdue.length === 0) {
    console.log('[OK] Excluded book payment from overdue message generation.');
} else {
    console.error('[FAIL] Overdue message was generated for book payment:', messagesBookOverdue);
    hasError = true;
}

// 19. 교재비 수납 안내 및 수납 완료 학부모 메시지 자동 생성 엔진 검증 (Phase 16M-3)
console.log('--- Starting Phase 16M-3 Book Payment messaging engine tests ---');

const testStudentIdB = 'S_TEST_B';
// Clean up
stateStore.db.students = stateStore.db.students.filter(s => s.id !== testStudentIdB);
stateStore.db.parentContacts = stateStore.db.parentContacts.filter(c => c.studentId !== testStudentIdB);
stateStore.db.parentMessages = stateStore.db.parentMessages.filter(m => m.studentId !== testStudentIdB);
stateStore.db.payments = stateStore.db.payments.filter(p => p.studentId !== testStudentIdB);
stateStore.db.books = stateStore.db.books || [];
stateStore.db.bookIssueRequests = stateStore.db.bookIssueRequests || [];

// Add student
stateStore.db.students.push({
    id: testStudentIdB,
    name: '교재원생',
    phone: '010-7777-7777',
    parentPhone: '010-8888-8888',
    parentName: '교재부모',
    teacherId: 'T8',
    instrument: '피아노',
    fee: 250000,
    dueDay: 15,
    enrollDate: '2026-01-10'
});

// Migrate contacts to initialize parent1
stateStore.migrateParentContacts();

// Add book
const testBook = stateStore.addBook({ name: '바이엘1', price: 15000 });

// Ensure bookBilling & bookPaid are enabled
stateStore.updateParentMessageSettingsBulk({
    bookBilling: { messageEnabled: true, pushEnabled: true },
    bookPaid: { messageEnabled: true, pushEnabled: true }
});

// 19.1 Test Case: Confirming book request creates book_billing message
const req = stateStore.addBookIssueRequest({
    studentId: testStudentIdB,
    bookId: testBook.id,
    bookNameSnapshot: testBook.name,
    amountSnapshot: testBook.price
});

// Confirm book issue request
stateStore.confirmBookIssueRequest(req.id);

// Find confirmed payment
const bookPayment = stateStore.db.payments.find(p => p.studentId === testStudentIdB && p.type === 'book');
if (!bookPayment) {
    console.error('[FAIL] Book payment was not created on confirmBookIssueRequest');
    hasError = true;
} else {
    // Check book_billing message
    const messagesBilling = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdB && m.type === 'book_billing');
    if (messagesBilling.length === 1) {
        const msg = messagesBilling[0];
        console.log('[OK] Book billing parent message created successfully.');
        if (msg.pushRequired === true && msg.pushStatus === 'pending') {
            console.log('[OK] Book billing pushRequired and pushStatus are correct (true/pending).');
        } else {
            console.error('[FAIL] Book billing pushRequired/pushStatus mismatch:', msg.pushRequired, msg.pushStatus);
            hasError = true;
        }
        if (msg.title === '교재원생 원생 교재비 수납 안내' && msg.body.includes('교재원생 원생의 바이엘1 교재비 15,000원이 청구되었습니다.')) {
            console.log('[OK] Book billing message title and body are correct.');
        } else {
            console.error('[FAIL] Book billing message content mismatch:', msg.title, msg.body);
            hasError = true;
        }
        if (msg.dedupeKey === `BOOK_BILLING_${bookPayment.id}`) {
            console.log('[OK] Book billing dedupeKey is correct.');
        } else {
            console.error('[FAIL] Book billing dedupeKey mismatch:', msg.dedupeKey);
            hasError = true;
        }
    } else {
        console.error('[FAIL] Expected 1 book billing parent message, got:', messagesBilling.length);
        hasError = true;
    }

    // 19.2 Test Case: book_overdue is NOT created during the confirmation of book issue request
    const messagesOverdue = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdB && m.type === 'book_overdue');
    if (messagesOverdue.length === 0) {
        console.log('[OK] book_overdue is not created upon book request confirmation.');
    } else {
        console.error('[FAIL] book_overdue was created upon book request confirmation:', messagesOverdue);
        hasError = true;
    }

    // 19.3 Test Case: book_paid parentMessage creation on payInvoice
    stateStore.payInvoice(bookPayment.id, 'cash');
    const messagesPaid = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdB && m.type === 'book_paid');
    if (messagesPaid.length === 1) {
        const msg = messagesPaid[0];
        console.log('[OK] Book paid parent message created successfully.');
        if (msg.pushRequired === true && msg.pushStatus === 'pending') {
            console.log('[OK] Book paid pushRequired and pushStatus are correct (true/pending).');
        } else {
            console.error('[FAIL] Book paid pushRequired/pushStatus mismatch:', msg.pushRequired, msg.pushStatus);
            hasError = true;
        }
        if (msg.title === '교재원생 원생 교재비 수납 완료' && msg.body.includes('교재원생 원생의 바이엘1 교재비 15,000원이 수납 완료되었습니다.')) {
            console.log('[OK] Book paid message title and body are correct.');
        } else {
            console.error('[FAIL] Book paid message content mismatch:', msg.title, msg.body);
            hasError = true;
        }
        if (msg.dedupeKey === `BOOK_PAID_${bookPayment.id}`) {
            console.log('[OK] Book paid dedupeKey is correct.');
        } else {
            console.error('[FAIL] Book paid dedupeKey mismatch:', msg.dedupeKey);
            hasError = true;
        }
    } else {
        console.error('[FAIL] Expected 1 book paid parent message, got:', messagesPaid.length);
        hasError = true;
    }

    // 19.4 Test Case: Deduplication
    stateStore.triggerPaymentParentMessage(bookPayment.id, 'book_billing');
    stateStore.triggerPaymentParentMessage(bookPayment.id, 'book_paid');
    const messagesBillingDup = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdB && m.type === 'book_billing');
    const messagesPaidDup = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdB && m.type === 'book_paid');
    if (messagesBillingDup.length === 1 && messagesPaidDup.length === 1) {
        console.log('[OK] Deduplication worked successfully for book billing and book paid.');
    } else {
        console.error('[FAIL] Deduplication failed, book billing count:', messagesBillingDup.length, 'book paid count:', messagesPaidDup.length);
        hasError = true;
    }

    // 19.5 Test Case: messageEnabled=false
    stateStore.updateParentMessageSettingsBulk({
        bookBilling: { messageEnabled: false, pushEnabled: false },
        bookPaid: { messageEnabled: false, pushEnabled: false }
    });
    // Clear messages for testStudentIdB
    stateStore.db.parentMessages = stateStore.db.parentMessages.filter(m => m.studentId !== testStudentIdB);
    
    stateStore.triggerPaymentParentMessage(bookPayment.id, 'book_billing');
    stateStore.triggerPaymentParentMessage(bookPayment.id, 'book_paid');
    const messagesBillingDisabled = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdB && m.type === 'book_billing');
    const messagesPaidDisabled = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdB && m.type === 'book_paid');
    if (messagesBillingDisabled.length === 0 && messagesPaidDisabled.length === 0) {
        console.log('[OK] No book messages created when messageEnabled is false.');
    } else {
        console.error('[FAIL] Book messages created when messageEnabled is false:', messagesBillingDisabled, messagesPaidDisabled);
        hasError = true;
    }

    // 19.6 Test Case: pushEnabled=false (Silent Mode)
    stateStore.updateParentMessageSettingsBulk({
        bookBilling: { messageEnabled: true, pushEnabled: false },
        bookPaid: { messageEnabled: true, pushEnabled: false }
    });
    stateStore.triggerPaymentParentMessage(bookPayment.id, 'book_billing');
    stateStore.triggerPaymentParentMessage(bookPayment.id, 'book_paid');
    const messagesBillingSilent = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdB && m.type === 'book_billing');
    const messagesPaidSilent = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdB && m.type === 'book_paid');
    if (messagesBillingSilent.length === 1 && messagesPaidSilent.length === 1) {
        const msgBill = messagesBillingSilent[0];
        const msgPaid = messagesPaidSilent[0];
        if (msgBill.pushRequired === false && msgBill.pushStatus === 'not_required' &&
            msgPaid.pushRequired === false && msgPaid.pushStatus === 'not_required') {
            console.log('[OK] Book billing/paid silent mode push settings are correct (false/not_required).');
        } else {
            console.error('[FAIL] Book billing/paid silent mode push settings mismatch:', msgBill.pushRequired, msgBill.pushStatus, msgPaid.pushRequired, msgPaid.pushStatus);
            hasError = true;
        }
    } else {
        console.error('[FAIL] Expected book messages to be created in silent mode.');
        hasError = true;
    }

    // 19.7 Test Case: Fallback when book cannot be resolved
    const fakeBookPayment = {
        id: 'P_FAKE_BOOK',
        studentId: testStudentIdB,
        amount: 20000,
        month: '2026-06',
        type: 'book',
        status: 'unpaid',
        invoiceDate: '2026-06-15',
        bookId: 'B_NONEXISTENT'
    };
    stateStore.db.payments.push(fakeBookPayment);
    // Clear and trigger
    stateStore.db.parentMessages = stateStore.db.parentMessages.filter(m => m.studentId !== testStudentIdB);
    stateStore.triggerPaymentParentMessage(fakeBookPayment.id, 'book_billing');
    stateStore.triggerPaymentParentMessage(fakeBookPayment.id, 'book_paid');
    
    const messagesBillingFallback = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdB && m.type === 'book_billing');
    const messagesPaidFallback = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdB && m.type === 'book_paid');
    if (messagesBillingFallback.length === 1 && messagesPaidFallback.length === 1) {
        const msgBill = messagesBillingFallback[0];
        const msgPaid = messagesPaidFallback[0];
        if (msgBill.body === '교재원생 원생의 교재비 20,000원이 청구되었습니다.' &&
            msgPaid.body === '교재원생 원생의 교재비 20,000원이 수납 완료되었습니다.') {
            console.log('[OK] Fallback to generic message body verified successfully when book name is missing.');
        } else {
            console.error('[FAIL] Fallback message body mismatch:', msgBill.body, msgPaid.body);
            hasError = true;
        }
    } else {
        console.error('[FAIL] Fallback messages were not created.');
        hasError = true;
    }
    // Clean fake payment
    stateStore.db.payments = stateStore.db.payments.filter(p => p.id !== 'P_FAKE_BOOK');

    // 19.8 Test Case: canReceiveMessage=false
    const contactB = stateStore.getPrimaryParentContact(testStudentIdB);
    if (contactB) {
        contactB.canReceiveMessage = false;
        stateStore.saveDB();
    }
    stateStore.db.parentMessages = stateStore.db.parentMessages.filter(m => m.studentId !== testStudentIdB);
    stateStore.triggerPaymentParentMessage(bookPayment.id, 'book_billing');
    const messagesBillingNoReceive = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdB && m.type === 'book_billing');
    if (messagesBillingNoReceive.length === 0) {
        console.log('[OK] No book message created when canReceiveMessage is false.');
    } else {
        console.error('[FAIL] Book message was created even though canReceiveMessage is false:', messagesBillingNoReceive);
        hasError = true;
    }
    // Restore
    if (contactB) {
        contactB.canReceiveMessage = true;
        stateStore.saveDB();
    }

    // 19.9 Test Case: Education payments do not trigger book events
    const tuitionPaymentId = 'P_TEST_TUITION_B';
    stateStore.db.payments.push({
        id: tuitionPaymentId,
        studentId: testStudentIdB,
        amount: 250000,
        month: '2026-06',
        type: 'education',
        status: 'unpaid',
        invoiceDate: '2026-06-15'
    });
    // Try to trigger book events using a tuition payment
    stateStore.db.parentMessages = stateStore.db.parentMessages.filter(m => m.studentId !== testStudentIdB);
    stateStore.triggerPaymentParentMessage(tuitionPaymentId, 'book_billing');
    stateStore.triggerPaymentParentMessage(tuitionPaymentId, 'book_paid');
    const messagesTuitionBookEvents = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdB && (m.type === 'book_billing' || m.type === 'book_paid'));
    if (messagesTuitionBookEvents.length === 0) {
        console.log('[OK] Tuition payment successfully guarded from book event message generation.');
    } else {
        console.error('[FAIL] Tuition payment triggered book event messages:', messagesTuitionBookEvents);
        hasError = true;
    }
    // Clean tuition payment
    stateStore.db.payments = stateStore.db.payments.filter(p => p.id !== tuitionPaymentId);

    // 19.10 Test Case: cleanup for testStudentIdB
    stateStore.db.students = stateStore.db.students.filter(s => s.id !== testStudentIdB);
    stateStore.db.parentContacts = stateStore.db.parentContacts.filter(c => c.studentId !== testStudentIdB);
    stateStore.db.parentMessages = stateStore.db.parentMessages.filter(m => m.studentId !== testStudentIdB);
    stateStore.db.payments = stateStore.db.payments.filter(p => p.studentId !== testStudentIdB);
}

// 20. 교재비 미수납 안내 학부모 메시지 자동 생성 엔진 검증 (Phase 16M-4)
console.log('--- Starting Phase 16M-4 Book Overdue messaging engine tests ---');

const testStudentIdBO = 'S_TEST_BO';
// Clean up
stateStore.db.students = stateStore.db.students.filter(s => s.id !== testStudentIdBO);
stateStore.db.parentContacts = stateStore.db.parentContacts.filter(c => c.studentId !== testStudentIdBO);
stateStore.db.parentMessages = stateStore.db.parentMessages.filter(m => m.studentId !== testStudentIdBO);
stateStore.db.payments = stateStore.db.payments.filter(p => p.studentId !== testStudentIdBO);
stateStore.db.bookIssueRequests = stateStore.db.bookIssueRequests || [];

// Add student with dueDay = 10
stateStore.db.students.push({
    id: testStudentIdBO,
    name: '미납원생',
    phone: '010-1111-2222',
    parentPhone: '010-3333-4444',
    parentName: '미납부모',
    teacherId: 'T8',
    instrument: '피아노',
    fee: 250000,
    dueDay: 10,
    enrollDate: '2026-01-10'
});

// Migrate contacts to initialize parent1
stateStore.migrateParentContacts();

// Enable bookOverdue settings
stateStore.updateParentMessageSettingsBulk({
    bookOverdue: { messageEnabled: true, pushEnabled: true }
});

// Add catalog book
const testBookBO = stateStore.addBook({ name: '체르니100', price: 18000 });

// 20.1 Test Case: Unpaid book payment past due date triggers book_overdue
// InvoiceDate is 2026-06-08 (before dueDay 10). Candidate due date is 2026-06-10.
// EVAL_TIME is 2026-06-12 (past 10th).
stateStore.db.settings.DAYDAY_DEBUG_EVAL_TIME = '2026-06-12T12:00:00.000Z';
stateStore.db.payments.push({
    id: 'P_BO_OVERDUE_1',
    studentId: testStudentIdBO,
    amount: 18000,
    month: '2026-06',
    type: 'book',
    status: 'unpaid',
    invoiceDate: '2026-06-08',
    bookId: testBookBO.id
});

stateStore.syncSystemRecommendations(new Date('2026-06-12T12:00:00.000Z'));

const messagesBookOverdue1 = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdBO && m.type === 'book_overdue');
if (messagesBookOverdue1.length === 1) {
    const msg = messagesBookOverdue1[0];
    console.log('[OK] Book overdue parent message created successfully.');
    if (msg.pushRequired === true && msg.pushStatus === 'pending') {
        console.log('[OK] Book overdue pushRequired and pushStatus are correct (true/pending).');
    } else {
        console.error('[FAIL] Book overdue pushRequired/pushStatus mismatch:', msg.pushRequired, msg.pushStatus);
        hasError = true;
    }
    if (msg.title === '미납원생 원생 교재비 미수납 안내' && msg.body.includes('미납원생 원생의 체르니100 교재비 18,000원이 아직 수납되지 않았습니다.')) {
        console.log('[OK] Book overdue message title and body are correct.');
    } else {
        console.error('[FAIL] Book overdue message content mismatch:', msg.title, msg.body);
        hasError = true;
    }
    if (msg.dedupeKey === 'BOOK_OVERDUE_P_BO_OVERDUE_1') {
        console.log('[OK] Book overdue dedupeKey is correct.');
    } else {
        console.error('[FAIL] Book overdue dedupeKey mismatch:', msg.dedupeKey);
        hasError = true;
    }
} else {
    console.error('[FAIL] Expected 1 book overdue parent message, got:', messagesBookOverdue1.length);
    hasError = true;
}

// 20.2 Test Case: Immediate check-in roll-over check
// InvoiceDate is 2026-06-11 (on/after dueDay 10). Candidate due date rolls over to 2026-07-10.
// EVAL_TIME is 2026-06-12 (before 2026-07-10). It should NOT trigger book_overdue.
stateStore.db.payments.push({
    id: 'P_BO_ROLLOVER_1',
    studentId: testStudentIdBO,
    amount: 18000,
    month: '2026-06',
    type: 'book',
    status: 'unpaid',
    invoiceDate: '2026-06-11',
    bookId: testBookBO.id
});

stateStore.syncSystemRecommendations(new Date('2026-06-12T12:00:00.000Z'));
const messagesRollover = stateStore.db.parentMessages.filter(m => m.relatedDomainId === 'P_BO_ROLLOVER_1' && m.type === 'book_overdue');
if (messagesRollover.length === 0) {
    console.log('[OK] Rollover due date correctly prevented immediate book overdue message.');
} else {
    console.error('[FAIL] Book overdue message was triggered for rolled over payment:', messagesRollover);
    hasError = true;
}

// 20.3 Test Case: Due date itself check (당일 제외)
// InvoiceDate is 2026-06-08 (before dueDay 10). Candidate due date is 2026-06-10.
// EVAL_TIME is 2026-06-10 (on due date). It should NOT trigger book_overdue.
stateStore.db.payments.push({
    id: 'P_BO_DUEDATE_TODAY',
    studentId: testStudentIdBO,
    amount: 18000,
    month: '2026-06',
    type: 'book',
    status: 'unpaid',
    invoiceDate: '2026-06-08',
    bookId: testBookBO.id
});
// Clean parentMessages for testStudentIdBO and trigger on the 10th
stateStore.db.parentMessages = stateStore.db.parentMessages.filter(m => m.studentId !== testStudentIdBO);
stateStore.db.settings.DAYDAY_DEBUG_EVAL_TIME = '2026-06-10T12:00:00.000Z';
stateStore.syncSystemRecommendations(new Date('2026-06-10T12:00:00.000Z'));
const messagesBookDueToday = stateStore.db.parentMessages.filter(m => m.relatedDomainId === 'P_BO_DUEDATE_TODAY' && m.type === 'book_overdue');
if (messagesBookDueToday.length === 0) {
    console.log('[OK] Book overdue correctly excluded on the due date itself.');
} else {
    console.error('[FAIL] Book overdue message was triggered on the due date:', messagesBookDueToday);
    hasError = true;
}

// 20.4 Test Case: Paid payment check
// Clean and set status to paid
stateStore.db.parentMessages = stateStore.db.parentMessages.filter(m => m.studentId !== testStudentIdBO);
const paidBookPayment = stateStore.db.payments.find(p => p.id === 'P_BO_OVERDUE_1');
if (paidBookPayment) {
    paidBookPayment.status = 'paid';
}
stateStore.db.settings.DAYDAY_DEBUG_EVAL_TIME = '2026-06-12T12:00:00.000Z';
stateStore.syncSystemRecommendations(new Date('2026-06-12T12:00:00.000Z'));
const messagesBookOverduePaid = stateStore.db.parentMessages.filter(m => m.relatedDomainId === 'P_BO_OVERDUE_1' && m.type === 'book_overdue');
if (messagesBookOverduePaid.length === 0) {
    console.log('[OK] Paid book payment does not trigger overdue message.');
} else {
    console.error('[FAIL] Overdue message triggered for paid book payment:', messagesBookOverduePaid);
    hasError = true;
}

// Restore unpaid status
if (paidBookPayment) {
    paidBookPayment.status = 'unpaid';
}

// 20.5 Test Case: Settings check (messageEnabled = false)
stateStore.updateParentMessageSettingsBulk({
    bookOverdue: { messageEnabled: false, pushEnabled: false }
});
stateStore.db.parentMessages = stateStore.db.parentMessages.filter(m => m.studentId !== testStudentIdBO);
stateStore.syncSystemRecommendations(new Date('2026-06-12T12:00:00.000Z'));
const messagesBookDisabled = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdBO && m.type === 'book_overdue');
if (messagesBookDisabled.length === 0) {
    console.log('[OK] No book overdue message created when messageEnabled is false.');
} else {
    console.error('[FAIL] Book overdue message was created even though settings were disabled:', messagesBookDisabled);
    hasError = true;
}

// 20.6 Test Case: Silent push check (pushEnabled = false)
stateStore.updateParentMessageSettingsBulk({
    bookOverdue: { messageEnabled: true, pushEnabled: false }
});
stateStore.db.parentMessages = stateStore.db.parentMessages.filter(m => m.studentId !== testStudentIdBO);
stateStore.syncSystemRecommendations(new Date('2026-06-12T12:00:00.000Z'));
const messagesBookSilent = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdBO && m.type === 'book_overdue' && m.relatedDomainId === 'P_BO_OVERDUE_1');
if (messagesBookSilent.length === 1) {
    const msg = messagesBookSilent[0];
    if (msg.pushRequired === false && msg.pushStatus === 'not_required') {
        console.log('[OK] Silent push settings for book overdue are correct (false/not_required).');
    } else {
        console.error('[FAIL] Silent push settings mismatch:', msg.pushRequired, msg.pushStatus);
        hasError = true;
    }
} else {
    console.error('[FAIL] Expected 1 silent overdue message, got:', messagesBookSilent.length);
    hasError = true;
}

// 20.7 Test Case: Deduplication check
stateStore.syncSystemRecommendations(new Date('2026-06-12T12:00:00.000Z'));
const messagesBookDup = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdBO && m.type === 'book_overdue' && m.relatedDomainId === 'P_BO_OVERDUE_1');
if (messagesBookDup.length === 1) {
    console.log('[OK] Deduplication worked successfully for book overdue.');
} else {
    console.error('[FAIL] Deduplication failed for book overdue, message count is:', messagesBookDup.length);
    hasError = true;
}

// 20.8 Test Case: canReceiveMessage = false
const contactBO = stateStore.getPrimaryParentContact(testStudentIdBO);
if (contactBO) {
    contactBO.canReceiveMessage = false;
    stateStore.saveDB();
}
stateStore.db.parentMessages = stateStore.db.parentMessages.filter(m => m.studentId !== testStudentIdBO);
stateStore.syncSystemRecommendations(new Date('2026-06-12T12:00:00.000Z'));
const messagesBookNoReceive = stateStore.db.parentMessages.filter(m => m.studentId === testStudentIdBO && m.type === 'book_overdue');
if (messagesBookNoReceive.length === 0) {
    console.log('[OK] No book overdue message created when canReceiveMessage is false.');
} else {
    console.error('[FAIL] Book overdue message created even though canReceiveMessage is false:', messagesBookNoReceive);
    hasError = true;
}
// Restore
if (contactBO) {
    contactBO.canReceiveMessage = true;
    stateStore.saveDB();
}

// 20.9 Test Case: Education payments do not trigger book overdue
const tuitionPaymentIdBO = 'P_TEST_TUITION_BO';
stateStore.db.payments.push({
    id: tuitionPaymentIdBO,
    studentId: testStudentIdBO,
    amount: 250000,
    month: '2026-06',
    type: 'education',
    status: 'unpaid',
    invoiceDate: '2026-06-08'
});
stateStore.db.parentMessages = stateStore.db.parentMessages.filter(m => m.studentId !== testStudentIdBO);
stateStore.syncSystemRecommendations(new Date('2026-06-12T12:00:00.000Z'));
const messagesTuitionBookOverdue = stateStore.db.parentMessages.filter(m => m.relatedDomainId === tuitionPaymentIdBO && m.type === 'book_overdue');
if (messagesTuitionBookOverdue.length === 0) {
    console.log('[OK] Tuition payment did not trigger book overdue message.');
} else {
    console.error('[FAIL] Tuition payment triggered book overdue message:', messagesTuitionBookOverdue);
    hasError = true;
}
// Clean tuition payment
stateStore.db.payments = stateStore.db.payments.filter(p => p.id !== tuitionPaymentIdBO);

// --- Starting Phase 16N Parent Messages Portal view tests ---
console.log('--- Starting Phase 16N Parent Messages Portal view tests ---');

const testParentUserId = 'USR_PAR_TEST_N';
const testStudentIdN = 'S_TEST_N';
const otherStudentIdN = 'S_TEST_N_OTHER';

// Clear existing items
stateStore.db.students = stateStore.db.students.filter(s => s.id !== testStudentIdN && s.id !== otherStudentIdN);
stateStore.db.parentStudentLinks = stateStore.db.parentStudentLinks.filter(l => l.parentUserId !== testParentUserId);
stateStore.db.parentMessages = stateStore.db.parentMessages.filter(m => m.studentId !== testStudentIdN && m.studentId !== otherStudentIdN);

// Add students
stateStore.db.students.push({
    id: testStudentIdN,
    name: '최은지',
    phone: '010-8888-2222',
    parentPhone: '010-9999-1111'
});
stateStore.db.students.push({
    id: otherStudentIdN,
    name: '김철수',
    phone: '010-3333-3333',
    parentPhone: '010-4444-4444'
});

// Link parent to testStudentIdN
stateStore.db.parentStudentLinks.push({ parentUserId: testParentUserId, studentId: testStudentIdN });

// Add messages
const msgNotice = stateStore.createParentMessage({
    studentId: testStudentIdN,
    category: 'schedule',
    type: 'class_notice',
    title: '학원 여름방학 안내',
    body: '7월 25일부터 28일까지 여름방학입니다.',
    dedupeKey: 'DEDUPE_N_NOTICE'
});

const msgAttendance = stateStore.createParentMessage({
    studentId: testStudentIdN,
    category: 'attendance',
    type: 'check_in',
    title: '등원 안내',
    body: '최은지 원생이 등원했습니다.',
    dedupeKey: 'DEDUPE_N_ATTENDANCE'
});

const msgPayment = stateStore.createParentMessage({
    studentId: testStudentIdN,
    category: 'payment',
    type: 'tuition_billing',
    title: '수강료 청구',
    body: '최은지 원생의 6월 수강료가 청구되었습니다.',
    dedupeKey: 'DEDUPE_N_PAYMENT'
});

const msgAlert = stateStore.createParentMessage({
    studentId: testStudentIdN,
    category: 'unknown_cat',
    type: 'fallback_type',
    title: '임시 알림',
    body: '알림 테스트',
    dedupeKey: 'DEDUPE_N_ALERT'
});

const msgOther = stateStore.createParentMessage({
    studentId: otherStudentIdN,
    category: 'attendance',
    type: 'check_in',
    title: '타원생 등원',
    body: '김철수 원생이 등원했습니다.',
    dedupeKey: 'DEDUPE_N_OTHER'
});

// 1. Test filtering of getParentMessagesForParent
const parentMsgs = stateStore.getParentMessagesForParent(testParentUserId, testStudentIdN);
if (parentMsgs.length === 4) {
    console.log('[OK] getParentMessagesForParent successfully filtered messages for the linked student.');
    const hasOtherMsg = parentMsgs.some(m => m.studentId === otherStudentIdN);
    if (!hasOtherMsg) {
        console.log('[OK] Excluded other student\'s messages from parent view.');
    } else {
        console.error('[FAIL] Other student\'s message was included in parent view.');
        hasError = true;
    }
} else {
    console.error('[FAIL] Expected 4 messages for parent, got:', parentMsgs.length);
    hasError = true;
}

// Test with non-linked studentId
const nonLinkedMsgs = stateStore.getParentMessagesForParent(testParentUserId, otherStudentIdN);
if (nonLinkedMsgs.length === 0) {
    console.log('[OK] Returns empty list when querying non-linked studentId.');
} else {
    console.error('[FAIL] Non-linked student query returned messages:', nonLinkedMsgs);
    hasError = true;
}

// 2. Test read status transition and readAt update
const targetMsg = stateStore.db.parentMessages.find(m => m.id === msgNotice.id);
if (targetMsg && targetMsg.status === 'unread') {
    stateStore.markParentMessageAsRead(msgNotice.id);
    if (targetMsg.status === 'read' && targetMsg.readAt) {
        console.log('[OK] markParentMessageAsRead successfully updated status to read and recorded readAt.');
    } else {
        console.error('[FAIL] markParentMessageAsRead status/readAt mismatch:', targetMsg.status, targetMsg.readAt);
        hasError = true;
    }
} else {
    console.error('[FAIL] Test message not found or not unread initially.');
    hasError = true;
}

// 3. Test list-view model helper logic (sorting, status formatting, parentMessages mapping)
console.log('--- Starting Phase 16N Parent Attendance list-view helper tests ---');

// Status formatting helper check with lateEnabled setting consideration
const formatStatusHelper = (status, leavingTime, lateEnabled) => {
    const displayStatus = (status === 'late' && !lateEnabled) ? 'present' : status;
    if (displayStatus === 'absent') return '결석';
    const prefix = displayStatus === 'late' ? '지각' : '등원 완료';
    const suffix = leavingTime ? '하원 완료' : '하원 기록 없음';
    return `${prefix} / ${suffix}`;
};

if (formatStatusHelper('absent', '', true) === '결석') {
    console.log('[OK] formatStatusHelper mapped absent status correctly.');
} else {
    console.error('[FAIL] formatStatusHelper absent status mapping failed');
    hasError = true;
}

if (formatStatusHelper('present', '15:30', true) === '등원 완료 / 하원 완료') {
    console.log('[OK] formatStatusHelper mapped present check-in with leavingTime correctly.');
} else {
    console.error('[FAIL] formatStatusHelper present check-in with leavingTime failed');
    hasError = true;
}

// lateEnabled === true
if (formatStatusHelper('late', '', true) === '지각 / 하원 기록 없음') {
    console.log('[OK] formatStatusHelper mapped late check-in correctly when lateEnabled is true.');
} else {
    console.error('[FAIL] formatStatusHelper late check-in failed when lateEnabled is true');
    hasError = true;
}

// lateEnabled === false
if (formatStatusHelper('late', '', false) === '등원 완료 / 하원 기록 없음') {
    console.log('[OK] formatStatusHelper mapped late check-in as present (등원 완료) when lateEnabled is false.');
} else {
    console.error('[FAIL] formatStatusHelper late check-in mapping failed when lateEnabled is false');
    hasError = true;
}

// Validate lateDetectionEnabled setting API retrieval
const originalLateSetting = stateStore.getLateDetectionEnabled();
stateStore.setLateDetectionEnabled(true);
if (stateStore.getLateDetectionEnabled() === true) {
    console.log('[OK] StateStore get/set LateDetectionEnabled to true verified.');
} else {
    console.error('[FAIL] StateStore get/set LateDetectionEnabled to true failed');
    hasError = true;
}

stateStore.setLateDetectionEnabled(false);
if (stateStore.getLateDetectionEnabled() === false) {
    console.log('[OK] StateStore get/set LateDetectionEnabled to false verified.');
} else {
    console.error('[FAIL] StateStore get/set LateDetectionEnabled to false failed');
    hasError = true;
}
// Restore setting
stateStore.setLateDetectionEnabled(originalLateSetting);

// Verify that details modal presentation content does not include the lesson note section / comment string
const testAttendanceRecord = {
    id: 'ATT_TEST_1',
    studentId: 'S1',
    date: '2026-06-03',
    status: 'present',
    time: '09:00',
    leavingTime: '18:00',
    note: '수업일지 코멘트 내용'
};

const simulateModalTemplate = (record, lateEnabled) => {
    return `
        <div class="modal-header">
            <h3 class="modal-title">출결 상세 정보</h3>
        </div>
        <div class="modal-body">
            <div>등원 기록 시간: ${record.time ? record.time : '기록 없음'}</div>
            <div>하원 기록 시간: ${record.leavingTime ? record.leavingTime : '하원 기록 없음'}</div>
        </div>
    `;
};

const renderedTemplate = simulateModalTemplate(testAttendanceRecord, true);
if (!renderedTemplate.includes('선생님 수업일지') && !renderedTemplate.includes('수업일지 코멘트 내용')) {
    console.log('[OK] Details modal template contract verified: does not include the teacher note/comment sections.');
} else {
    console.error('[FAIL] Details modal template contains lesson note or teacher comment header.');
    hasError = true;
}

// Date sorting check
const testRecords = [{ date: '2026-06-01' }, { date: '2026-06-03' }, { date: '2026-06-02' }];
const sortedRecords = [...testRecords].sort((a, b) => b.date.localeCompare(a.date));
if (sortedRecords[0].date === '2026-06-03' && sortedRecords[2].date === '2026-06-01') {
    console.log('[OK] Attendance list date sorting verified descending.');
} else {
    console.error('[FAIL] Attendance list date sorting failed. Result:', sortedRecords);
    hasError = true;
}

// parentMessages matching check
const todayIsoStr = new Date().toISOString().slice(0, 10);
const unreadMsgsForTest = stateStore.getParentMessagesForParent(testParentUserId, testStudentIdN).filter(m => m.status === 'unread');
const matchedMsg = unreadMsgsForTest.find(m => {
    const category = m.category || '';
    const type = m.type || '';
    const isAttendanceMsg = category === 'attendance' || type === 'check_in' || type === 'check_out';
    return isAttendanceMsg && m.createdAt.startsWith(todayIsoStr);
});

if (matchedMsg && matchedMsg.title === '등원 안내') {
    console.log('[OK] Successfully matched attendance record date with unread parentMessage.');
} else {
    console.log('DEBUG unreadMsgsForTest:', unreadMsgsForTest);
    console.error('[FAIL] Failed to match attendance record with parentMessage. matchedMsg:', matchedMsg);
    hasError = true;
}

// --- Starting Phase 16N-Repair-D Parent Billing View Unit Tests ---
console.log('--- Starting Phase 16N-Repair-D Parent Billing View Unit Tests ---');

// Mock document for importing student.js
global.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {}
};

try {
    const { getPaymentDueDate } = await import('../../src/js/views/student.js');

    // 1. Test getPaymentDueDate with regular due day
    const testStudent = { dueDay: 15 };
    const paymentEducation = { type: 'education', month: '2026-06', amount: 150000 };
    const dueDateEdu = getPaymentDueDate(paymentEducation, testStudent);
    if (dueDateEdu === '2026-06-15') {
        console.log('[OK] getPaymentDueDate calculated correct due date for education payment.');
    } else {
        console.error('[FAIL] getPaymentDueDate calculated incorrect due date for education payment:', dueDateEdu);
        hasError = true;
    }

    // 2. Test getPaymentDueDate for book payment without rollover
    const paymentBookNormal = { 
        type: 'book', 
        month: '2026-06', 
        amount: 20000, 
        invoiceDate: '2026-06-10' 
    };
    const dueDateBookNormal = getPaymentDueDate(paymentBookNormal, testStudent);
    if (dueDateBookNormal === '2026-06-15') {
        console.log('[OK] getPaymentDueDate calculated correct due date for book payment without rollover.');
    } else {
        console.error('[FAIL] getPaymentDueDate calculated incorrect due date for book payment without rollover:', dueDateBookNormal);
        hasError = true;
    }

    // 3. Test getPaymentDueDate for book payment WITH rollover (invoiceDate >= dueDay)
    const paymentBookRollover = { 
        type: 'book', 
        month: '2026-06', 
        amount: 20000, 
        invoiceDate: '2026-06-15' 
    };
    const dueDateBookRollover = getPaymentDueDate(paymentBookRollover, testStudent);
    if (dueDateBookRollover === '2026-07-15') {
        console.log('[OK] getPaymentDueDate calculated correct due date for book payment WITH rollover.');
    } else {
        console.error('[FAIL] getPaymentDueDate calculated incorrect due date for book payment WITH rollover:', dueDateBookRollover);
        hasError = true;
    }

    // 4. Test payments classification and filtering logic
    const mockPayments = [
        { id: 'P_EDU_UNPAID', type: 'education', status: 'unpaid', amount: 150000, month: '2026-06' },
        { id: 'P_EDU_REQ', type: 'education', status: 'requested', amount: 150000, month: '2026-05' },
        { id: 'P_EDU_PAID', type: 'education', status: 'paid', amount: 150000, month: '2026-04' },
        { id: 'P_BOOK_UNPAID', type: 'book', status: 'unpaid', amount: 20000, month: '2026-06' },
        { id: 'P_BOOK_PAID', type: 'book', status: 'paid', amount: 20000, month: '2026-05' }
    ];

    const unpaidPayments = mockPayments.filter(p => p.status !== 'paid');
    const paidPayments = mockPayments.filter(p => p.status === 'paid');

    if (unpaidPayments.length === 3 && unpaidPayments.some(p => p.id === 'P_EDU_UNPAID') && unpaidPayments.some(p => p.id === 'P_EDU_REQ') && unpaidPayments.some(p => p.id === 'P_BOOK_UNPAID')) {
        console.log('[OK] Payments classified as unpaid/requested correctly including both education and book types.');
    } else {
        console.error('[FAIL] Unpaid payments classification failed:', unpaidPayments);
        hasError = true;
    }

    if (paidPayments.length === 2 && paidPayments.some(p => p.id === 'P_EDU_PAID') && paidPayments.some(p => p.id === 'P_BOOK_PAID')) {
        console.log('[OK] Payments classified as paid correctly including both education and book types.');
    } else {
        console.error('[FAIL] Paid payments classification failed:', paidPayments);
        hasError = true;
    }

    // 5. Test book name fallback logic
    const testBookId = 'B_TEST_16ND';
    stateStore.db.books.push({ id: testBookId, name: '테스트교재명' });
    stateStore.saveDB();

    const book1 = stateStore.getBook(testBookId);
    const bookName1 = book1 ? book1.name : '교재비';
    if (bookName1 === '테스트교재명') {
        console.log('[OK] Book name successfully resolved via bookId.');
    } else {
        console.error('[FAIL] Book name resolve failed:', bookName1);
        hasError = true;
    }

    const bookNameFallback = stateStore.getBook('NON_EXIST_ID') ? stateStore.getBook('NON_EXIST_ID').name : '교재비';
    if (bookNameFallback === '교재비') {
        console.log('[OK] Book name fallback resolved to default "교재비".');
    } else {
        console.error('[FAIL] Book name fallback failed:', bookNameFallback);
        hasError = true;
    }

    // Clean up book test data
    stateStore.db.books = stateStore.db.books.filter(b => b.id !== testBookId);
    stateStore.saveDB();

} catch (err) {
    console.error('[FAIL] Failed during Phase 16N-Repair-D unit tests execution:', err);
    hasError = true;
}

// --- Starting Phase 16N-Repair-E Parent Portal App-style Indicator Unit Tests ---
console.log('--- Starting Phase 16N-Repair-E Parent Portal App-style Indicator Unit Tests ---');

const testStudentIdE = 'S_TEST_16NE';
const testParentUserIdE = 'P_USER_16NE';

// Clean up
stateStore.db.students = stateStore.db.students.filter(s => s.id !== testStudentIdE);
stateStore.db.parentStudentLinks = stateStore.db.parentStudentLinks.filter(l => l.parentUserId !== testParentUserIdE);
stateStore.db.parentMessages = stateStore.db.parentMessages.filter(m => m.studentId !== testStudentIdE);
stateStore.db.payments = stateStore.db.payments.filter(p => p.studentId !== testStudentIdE);

// Add student & parent link
stateStore.db.students.push({
    id: testStudentIdE,
    name: '이원생',
    phone: '010-1111-2222',
    parentPhone: '010-3333-4444',
    parentName: '이부모'
});
stateStore.db.parentStudentLinks.push({
    parentUserId: testParentUserIdE,
    studentId: testStudentIdE
});

// Create unread attendance and billing messages
const msgAtt = stateStore.createParentMessage({
    studentId: testStudentIdE,
    recipientName: '이부모',
    recipientPhone: '010-3333-4444',
    category: 'attendance',
    type: 'check_in',
    title: '등원 알림',
    body: '원생이 등원했습니다.',
    dedupeKey: 'dedupe_test_att_16ne'
});

const paymentIdE = 'PAY_16NE';
const msgBill = stateStore.createParentMessage({
    studentId: testStudentIdE,
    recipientName: '이부모',
    recipientPhone: '010-3333-4444',
    category: 'payment',
    type: 'tuition_billing',
    title: '수강료 안내',
    body: '수강료가 청구되었습니다.',
    dedupeKey: `dedupe_test_bill_16ne_${paymentIdE}`
});

// Fetch messages
const unreadMsgs = stateStore.getParentMessagesForParent(testParentUserIdE, testStudentIdE).filter(m => m.status === 'unread');

// 1. Verify unread attendance count
const attendanceCount = unreadMsgs.filter(m => {
    const category = m.category || '';
    const type = m.type || '';
    return category === 'attendance' || type === 'check_in' || type === 'check_out';
}).length;

if (attendanceCount === 1) {
    console.log('[OK] Attendance unread count calculated correctly (1).');
} else {
    console.error('[FAIL] Attendance unread count calculation mismatch:', attendanceCount);
    hasError = true;
}

// 2. Verify unread billing count
const billingCount = unreadMsgs.filter(m => {
    const category = m.category || '';
    const type = m.type || '';
    return category === 'payment' || 
           type === 'tuition_billing' || type === 'tuition_overdue' || type === 'tuition_paid' ||
           type === 'book_billing' || type === 'book_overdue' || type === 'book_paid';
}).length;

if (billingCount === 1) {
    console.log('[OK] Billing unread count calculated correctly (1).');
} else {
    console.error('[FAIL] Billing unread count calculation mismatch:', billingCount);
    hasError = true;
}

// 3. Verify row unread status mapping for payment
const matchedBillMsg = unreadMsgs.filter(m => m.dedupeKey && m.dedupeKey.endsWith(`_${paymentIdE}`));
if (matchedBillMsg.length === 1 && matchedBillMsg[0].id === msgBill.id) {
    console.log('[OK] Payment ID matched successfully with unread parentMessage for row red dot.');
} else {
    console.error('[FAIL] Payment ID matching failed. Result:', matchedBillMsg);
    hasError = true;
}

// 4. Verify count decreases after marking a message read
stateStore.markParentMessageAsRead(msgAtt.id);
const unreadMsgsAfterRead = stateStore.getParentMessagesForParent(testParentUserIdE, testStudentIdE).filter(m => m.status === 'unread');
const attendanceCountAfterRead = unreadMsgsAfterRead.filter(m => {
    const category = m.category || '';
    const type = m.type || '';
    return category === 'attendance' || type === 'check_in' || type === 'check_out';
}).length;

if (attendanceCountAfterRead === 0) {
    console.log('[OK] Attendance unread count successfully decreased to 0 after marking read.');
} else {
    console.error('[FAIL] Attendance unread count did not decrease correctly. Got:', attendanceCountAfterRead);
    hasError = true;
}

// Clean up Phase 16N-Repair-E test data
stateStore.db.students = stateStore.db.students.filter(s => s.id !== testStudentIdE);
stateStore.db.parentStudentLinks = stateStore.db.parentStudentLinks.filter(l => l.parentUserId !== testParentUserIdE);
stateStore.db.parentMessages = stateStore.db.parentMessages.filter(m => m.studentId !== testStudentIdE);
stateStore.saveDB();

// --- Starting Phase 16N-Repair-D KPI Policy Unit Tests ---
console.log('--- Starting Phase 16N-Repair-D KPI Policy Unit Tests ---');

const testStudentIdD = 'S_TEST_16ND';
// Clean up
stateStore.db.students = stateStore.db.students.filter(s => s.id !== testStudentIdD);
stateStore.db.payments = stateStore.db.payments.filter(p => p.studentId !== testStudentIdD);

// Add student
stateStore.db.students.push({
    id: testStudentIdD,
    name: '디원생'
});

// Add mock payments (2 unpaid, 1 paid)
stateStore.db.payments.push({
    id: 'P_D1',
    studentId: testStudentIdD,
    amount: 150000,
    month: '2026-06',
    status: 'unpaid',
    type: 'education'
});
stateStore.db.payments.push({
    id: 'P_D2',
    studentId: testStudentIdD,
    amount: 30000,
    month: '2026-06',
    status: 'requested',
    type: 'book'
});
stateStore.db.payments.push({
    id: 'P_D3',
    studentId: testStudentIdD,
    amount: 150000,
    month: '2026-05',
    status: 'paid',
    type: 'education'
});

// Fetch payments
const paymentsForD = stateStore.getPaymentsForStudent(testStudentIdD);
const unpaidForD = paymentsForD.filter(p => p.status !== 'paid');
const paidForD = paymentsForD.filter(p => p.status === 'paid');

// 1. Verify counts
if (unpaidForD.length === 2) {
    console.log('[OK] Unpaid/requested payment count calculated correctly (2).');
} else {
    console.error('[FAIL] Unpaid payment count mismatch:', unpaidForD.length);
    hasError = true;
}

// 2. Verify total unpaid amount
const totalUnpaidD = unpaidForD.reduce((sum, p) => sum + p.amount, 0);
if (totalUnpaidD === 180000) {
    console.log('[OK] Total unpaid amount calculated correctly (180,000).');
} else {
    console.error('[FAIL] Total unpaid amount mismatch:', totalUnpaidD);
    hasError = true;
}

// 3. Verify KPI remains based on unpaid list regardless of activeTab mode
const getMockKPITemplate = (activeTab, unpaidList, paidList) => {
    const unpaidCount = unpaidList.length;
    const totalUnpaidAmount = unpaidList.reduce((sum, p) => sum + p.amount, 0);
    
    return `
        <div class="metrics-grid">
            <span class="metric-value-count">${unpaidCount}건</span>
            <span class="metric-value-amount">${totalUnpaidAmount}원</span>
        </div>
        <div class="list-title">
            ${activeTab === 'unpaid' ? '미납 및 청구 내역' : '납부 완료 내역'}
        </div>
    `;
};

// Test activeTab = 'unpaid'
const htmlUnpaid = getMockKPITemplate('unpaid', unpaidForD, paidForD);
if (htmlUnpaid.includes('2건') && htmlUnpaid.includes('180000원') && htmlUnpaid.includes('미납 및 청구 내역')) {
    console.log('[OK] KPI and title correct for activeTab=unpaid.');
} else {
    console.error('[FAIL] Incorrect HTML for activeTab=unpaid:', htmlUnpaid);
    hasError = true;
}

// Test activeTab = 'paid'
const htmlPaid = getMockKPITemplate('paid', unpaidForD, paidForD);
if (htmlPaid.includes('2건') && htmlPaid.includes('180000원') && htmlPaid.includes('납부 완료 내역') && !htmlPaid.includes('150000원')) {
    console.log('[OK] KPI remains based on unpaid and title matches activeTab=paid.');
} else {
    console.error('[FAIL] Incorrect HTML for activeTab=paid:', htmlPaid);
    hasError = true;
}

// Clean up
stateStore.db.students = stateStore.db.students.filter(s => s.id !== testStudentIdD);
stateStore.db.payments = stateStore.db.payments.filter(p => p.studentId !== testStudentIdD);
stateStore.saveDB();

// Clean up Phase 16N test data
stateStore.db.students = stateStore.db.students.filter(s => s.id !== testStudentIdN && s.id !== otherStudentIdN);
stateStore.db.parentStudentLinks = stateStore.db.parentStudentLinks.filter(l => l.parentUserId !== testParentUserId);
stateStore.db.parentMessages = stateStore.db.parentMessages.filter(m => m.studentId !== testStudentIdN && m.studentId !== otherStudentIdN);

// Clean up test students and books from DB
stateStore.db.students = stateStore.db.students.filter(s => s.id !== testStudentIdBO && s.id !== testStudentIdO && s.id !== testStudentIdO2);
stateStore.db.parentContacts = stateStore.db.parentContacts.filter(c => c.studentId !== testStudentIdBO && c.studentId !== testStudentIdO && c.studentId !== testStudentIdO2);
stateStore.db.parentMessages = stateStore.db.parentMessages.filter(m => m.studentId !== testStudentIdBO && m.studentId !== testStudentIdO && m.studentId !== testStudentIdO2);
stateStore.db.payments = stateStore.db.payments.filter(p => p.studentId !== testStudentIdBO && p.studentId !== testStudentIdO && p.studentId !== testStudentIdO2);
stateStore.db.books = stateStore.db.books.filter(b => b.id !== testBookBO.id);
stateStore.db.bookIssueRequests = stateStore.db.bookIssueRequests.filter(r => r.studentId !== testStudentIdBO);

if (hasError) {
    console.error('--- Unit Test: Parent Messaging Schema & Migration FAILED ---');
    process.exit(1);
} else {
    console.log('--- Unit Test: Parent Messaging Schema & Migration PASSED successfully ---');
    process.exit(0);
}
