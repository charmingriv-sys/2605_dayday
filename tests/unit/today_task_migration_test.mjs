// today_task_migration_test.mjs - Verify that normalizeSnapshot safely populates TodayTask collections without breaking existing DB.

import { LocalStorageAdapter } from '../../src/js/state/adapters/localStorageAdapter.js';

let storageMockData = {};
global.localStorage = {
    getItem: (key) => storageMockData[key] || null,
    setItem: (key, val) => { storageMockData[key] = val; }
};
global.window = {
    dispatchEvent: () => {},
    localStorage: global.localStorage
};

console.log('--- Unit Test: Starting TodayTask Migration Normalization Verification ---');

const DEFAULT_DB = {
    settings: { academyName: 'Test Academy Default' },
    users: [],
    academies: [],
    academyInviteCodes: [],
    academyJoinRequests: [],
    parentStudentLinks: [],
    teachers: [],
    students: [],
    books: [],
    studentBooks: [],
    announcements: [],
    messages: [],
    surveys: [],
    surveyResponses: []
};

// Seed an existing database without todayTasks, routines, or mockCalendarEvents
storageMockData['turing_academy_db_v3'] = JSON.stringify({
    settings: { academyName: 'Existing Test Academy' },
    users: [],
    academies: [],
    academyInviteCodes: [],
    academyJoinRequests: [],
    parentStudentLinks: [],
    teachers: [],
    students: [],
    books: [],
    studentBooks: [],
    announcements: [],
    messages: [],
    surveys: [],
    surveyResponses: []
});

const adapter = new LocalStorageAdapter({
    storageKey: 'turing_academy_db_v3',
    defaultDB: DEFAULT_DB
});

// Run loadSnapshotSync which calls normalizeSnapshot
const loadedDB = adapter.loadSnapshotSync();

let hasError = false;

// Verify existing data was preserved
if (loadedDB.settings.academyName === 'Existing Test Academy') {
    console.log('[OK] Existing database settings.academyName was correctly preserved.');
} else {
    console.error('[FAIL] Failed: Existing database settings.academyName was modified or lost!', loadedDB.settings.academyName);
    hasError = true;
}

// Verify that todayTasks, todayTaskRoutines, and mockCalendarEvents were created as empty arrays
const requiredCollections = ['todayTasks', 'todayTaskRoutines', 'mockCalendarEvents'];
requiredCollections.forEach(col => {
    if (Array.isArray(loadedDB[col])) {
        console.log(`[OK] Collection [${col}] was successfully initialized as an array.`);
    } else {
        console.error(`[FAIL] Failed: Collection [${col}] is missing or is not an array! Type: ${typeof loadedDB[col]}`);
        hasError = true;
    }
});

if (hasError) {
    console.error('--- Unit Test: TodayTask Migration Normalization FAILED ---');
    process.exit(1);
} else {
    console.log('--- Unit Test: TodayTask Migration Normalization PASSED successfully ---');
    process.exit(0);
}

