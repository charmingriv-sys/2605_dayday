// student_status_test.mjs - Verify Student Status normalization and defaults

// Mock global window and localStorage for node environment with functional in-memory store
let storageMock = {};
global.localStorage = {
    getItem: (key) => storageMock[key] || null,
    setItem: (key, val) => { storageMock[key] = String(val); },
    clear: () => { storageMock = {}; }
};
global.window = {
    dispatchEvent: () => {},
    localStorage: global.localStorage
};

console.log('--- Mocking environment completed ---');

// Dynamically import StateStore
const { stateStore } = await import('../../src/js/state.js');

let hasError = false;

console.log('--- Starting Student Status Verification Tests ---');

// 1. Verify existing seed students have status 'attending'
const students = stateStore.getStudents();
const s1 = students.find(s => s.id === 'S1');
if (s1 && s1.status === 'attending') {
    console.log('✓ Seed student S1 has status attending.');
} else {
    console.error(`❌ Expected S1 status 'attending', got '${s1 ? s1.status : 'undefined'}'`);
    hasError = true;
}

// Check other fields of S1 are preserved
if (s1 && s1.name === '최다은' && s1.phone === '010-9999-1111' && s1.parentPhone === '010-8888-2222') {
    console.log('✓ Seed student S1 other fields are completely preserved.');
} else {
    console.error('❌ S1 other fields were corrupted!', s1);
    hasError = true;
}

// 2. Test normalizeStudentStatus helper directly
if (typeof stateStore.normalizeStudentStatus === 'function') {
    console.log('✓ normalizeStudentStatus helper exists.');
    
    // valid cases
    const normAttending = stateStore.normalizeStudentStatus('attending');
    const normOnLeave = stateStore.normalizeStudentStatus('on_leave');
    const normWithdrawn = stateStore.normalizeStudentStatus('withdrawn');
    
    if (normAttending === 'attending' && normOnLeave === 'on_leave' && normWithdrawn === 'withdrawn') {
        console.log('✓ normalizeStudentStatus preserves allowed statuses.');
    } else {
        console.error('❌ normalizeStudentStatus failed to preserve allowed statuses:', { normAttending, normOnLeave, normWithdrawn });
        hasError = true;
    }
    
    // fallback cases
    const fallbackInvalid = stateStore.normalizeStudentStatus('invalid_status');
    const fallbackEmpty = stateStore.normalizeStudentStatus('');
    const fallbackNull = stateStore.normalizeStudentStatus(null);
    const fallbackUndefined = stateStore.normalizeStudentStatus(undefined);
    
    if (fallbackInvalid === 'attending' && fallbackEmpty === 'attending' && fallbackNull === 'attending' && fallbackUndefined === 'attending') {
        console.log('✓ normalizeStudentStatus correctly falls back invalid/missing statuses to attending.');
    } else {
        console.error('❌ normalizeStudentStatus fallback failed:', { fallbackInvalid, fallbackEmpty, fallbackNull, fallbackUndefined });
        hasError = true;
    }
} else {
    console.error('❌ normalizeStudentStatus is not a function!');
    hasError = true;
}

// 3. Test normalizeStudentRecord helper
if (typeof stateStore.normalizeStudentRecord === 'function') {
    console.log('✓ normalizeStudentRecord helper exists.');
    
    const record = { id: 'STest', name: 'Test Student', phone: '010-1234-5678', status: 'invalid' };
    const normalized = stateStore.normalizeStudentRecord(record);
    if (normalized.status === 'attending') {
        console.log('✓ normalizeStudentRecord correctly normalizes status field.');
    } else {
        console.error(`❌ Expected normalized status 'attending', got '${normalized.status}'`);
        hasError = true;
    }
    
    if (normalized.id === 'STest' && normalized.name === 'Test Student' && normalized.phone === '010-1234-5678') {
        console.log('✓ normalizeStudentRecord preserves other fields.');
    } else {
        console.error('❌ normalizeStudentRecord modified other fields!', normalized);
        hasError = true;
    }
} else {
    console.error('❌ normalizeStudentRecord is not a function!');
    hasError = true;
}

// 4. Test getStudentStatus helper
if (typeof stateStore.getStudentStatus === 'function') {
    console.log('✓ getStudentStatus helper exists.');
    const sAttending = stateStore.getStudentStatus({ status: 'attending' });
    const sOnLeave = stateStore.getStudentStatus({ status: 'on_leave' });
    const sNull = stateStore.getStudentStatus(null);
    const sNoStatus = stateStore.getStudentStatus({ name: 'No Status' });
    
    if (sAttending === 'attending' && sOnLeave === 'on_leave' && sNull === 'attending' && sNoStatus === 'attending') {
        console.log('✓ getStudentStatus resolved statuses correctly.');
    } else {
        console.error('❌ getStudentStatus resolution failed:', { sAttending, sOnLeave, sNull, sNoStatus });
        hasError = true;
    }
} else {
    console.error('❌ getStudentStatus is not a function!');
    hasError = true;
}

// 5. Test addStudent status defaults & values
const mockStudentAttending = { name: '홍길동', fee: 100000 };
const newAttending = stateStore.addStudent(mockStudentAttending);
if (newAttending.status === 'attending') {
    console.log('✓ addStudent defaults status to attending when missing.');
} else {
    console.error(`❌ Expected new student status 'attending', got '${newAttending.status}'`);
    hasError = true;
}

const mockStudentOnLeave = { name: '이순신', fee: 120000, status: 'on_leave' };
const newOnLeave = stateStore.addStudent(mockStudentOnLeave);
if (newOnLeave.status === 'on_leave') {
    console.log('✓ addStudent preserves status: on_leave when provided.');
} else {
    console.error(`❌ Expected new student status 'on_leave', got '${newOnLeave.status}'`);
    hasError = true;
}

const mockStudentInvalid = { name: '강감찬', fee: 130000, status: 'invalid_status' };
const newInvalid = stateStore.addStudent(mockStudentInvalid);
if (newInvalid.status === 'attending') {
    console.log('✓ addStudent falls back invalid status to attending.');
} else {
    console.error(`❌ Expected fallback status 'attending', got '${newInvalid.status}'`);
    hasError = true;
}

// 6. Test updateStudent status values
const studentToUpdate = stateStore.addStudent({ name: 'update_test', fee: 100000 });
stateStore.updateStudent(studentToUpdate.id, { status: 'on_leave' });
const updated = stateStore.getStudent(studentToUpdate.id);
if (updated.status === 'on_leave') {
    console.log('✓ updateStudent successfully updates status to on_leave.');
} else {
    console.error(`❌ Expected updated status 'on_leave', got '${updated.status}'`);
    hasError = true;
}

stateStore.updateStudent(studentToUpdate.id, { status: 'invalid_status_update' });
const updatedInvalid = stateStore.getStudent(studentToUpdate.id);
if (updatedInvalid.status === 'attending') {
    console.log('✓ updateStudent correctly falls back invalid status to attending.');
} else {
    console.error(`❌ Expected fallback status 'attending' after invalid update, got '${updatedInvalid.status}'`);
    hasError = true;
}

// 7. Test loadDB/migration logic by simulating database load with missing status
stateStore.db.students.push({
    id: 'S_NO_STATUS',
    name: '누락학생',
    phone: '010-0000-0000',
    fee: 100000,
    defaultClassDuration: 50
});
// Also push one with invalid status
stateStore.db.students.push({
    id: 'S_BAD_STATUS',
    name: '오류학생',
    phone: '010-0000-1111',
    fee: 100000,
    status: 'bad_value_here',
    defaultClassDuration: 50
});

// Save to the mocked localStorage so loadDB can reload it
stateStore.saveDB();

// Force loadDB to run (it triggers the migration code)
stateStore.loadDB();

const migratedNoStatus = stateStore.getStudent('S_NO_STATUS');
if (migratedNoStatus && migratedNoStatus.status === 'attending') {
    console.log('✓ loadDB successfully migrated missing status to attending.');
} else {
    console.error('❌ loadDB failed to migrate missing status student:', migratedNoStatus);
    hasError = true;
}

const migratedBadStatus = stateStore.getStudent('S_BAD_STATUS');
if (migratedBadStatus && migratedBadStatus.status === 'attending') {
    console.log('✓ loadDB successfully migrated invalid status to attending.');
} else {
    console.error('❌ loadDB failed to migrate invalid status student:', migratedBadStatus);
    hasError = true;
}

// Cleanup mock added students in db to not persist in simulated runs
stateStore.db.students = stateStore.db.students.filter(s => s.id !== 'S_NO_STATUS' && s.id !== 'S_BAD_STATUS');
stateStore.saveDB();

if (hasError) {
    console.error('Student Status unit tests FAILED.');
    process.exit(1);
} else {
    console.log('All Student Status unit tests PASSED successfully.');
    process.exit(0);
}
