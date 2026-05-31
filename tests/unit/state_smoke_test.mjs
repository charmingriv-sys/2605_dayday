// smoke_test.mjs - Verify StateStore methods are successfully injected

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

const requiredMethods = [
    'getStudents',
    'getTeachers',
    'getPayments',
    'getClasses',
    'getAttendance',
    'getSettings',
    'getCurrentUser',
    'getStudentsForParent',
    'markAttendance',
    'createInvoice',
    'addStudent',
    'updateAcademy'
];

let hasError = false;

console.log('--- Starting StateStore Method Injection Verification ---');

requiredMethods.forEach(method => {
    const fn = stateStore[method];
    if (typeof fn === 'function') {
        console.log(`✓ Method [${method}] exists and is a function.`);
    } else {
        console.error(`❌ Method [${method}] is missing or not a function! Type: ${typeof fn}`);
        hasError = true;
    }
});

console.log('--- Verifying Schedule Settings Defaults ---');
const settings = stateStore.getSettings();
const expectedSettings = {
    scheduleStartTime: "14:00",
    scheduleEndTime: "21:00",
    scheduleSlotMinutes: 30,
    printLayoutDefault: "one-per-page"
};

for (const [key, val] of Object.entries(expectedSettings)) {
    if (settings[key] === val) {
        console.log(`✓ Setting [${key}] matches default value: ${val}`);
    } else {
        console.error(`❌ Setting [${key}] does not match default. Expected: ${val}, Got: ${settings[key]}`);
        hasError = true;
    }
}

if (Array.isArray(settings.scheduleDays) && settings.scheduleDays.length === 6 && settings.scheduleDays[0] === 'mon') {
    console.log(`✓ Setting [scheduleDays] matches default value.`);
} else {
    console.error(`❌ Setting [scheduleDays] does not match default. Got: ${JSON.stringify(settings.scheduleDays)}`);
    hasError = true;
}

console.log('--- Verifying Teachers and Students ScheduleNotes ---');
const teachers = stateStore.getTeachers();
teachers.forEach(t => {
    if (t.scheduleNotes === "") {
        console.log(`✓ Teacher [${t.name}] has scheduleNotes initialized to empty string.`);
    } else {
        console.error(`❌ Teacher [${t.name}] scheduleNotes: expected "", got "${t.scheduleNotes}"`);
        hasError = true;
    }
});

const students = stateStore.getStudents();
students.forEach(s => {
    if (s.scheduleNotes === "") {
        console.log(`✓ Student [${s.name}] has scheduleNotes initialized to empty string.`);
    } else {
        console.error(`❌ Student [${s.name}] scheduleNotes: expected "", got "${s.scheduleNotes}"`);
        hasError = true;
    }
});

if (hasError) {
    console.error('Smoke test FAILED.');
    process.exit(1);
} else {
    console.log('Smoke test PASSED successfully.');
    process.exit(0);
}
