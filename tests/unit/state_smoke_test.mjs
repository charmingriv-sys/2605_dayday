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

console.log('--- Verifying getLateThresholdMinutes and setLateThresholdMinutes API ---');
// 1. Verify default value is 10
stateStore.db.settings = {}; // clear settings for isolated test
const defaultVal = stateStore.getLateThresholdMinutes();
if (defaultVal === 10) {
    console.log('✓ getLateThresholdMinutes returns default 10 when empty.');
} else {
    console.error(`❌ Expected default 10, got ${defaultVal}`);
    hasError = true;
}

// 2. Verify setting 5~60 min (with 5 min step) is saved and read correctly
stateStore.setLateThresholdMinutes(15);
const val15 = stateStore.getLateThresholdMinutes();
if (val15 === 15) {
    console.log('✓ setLateThresholdMinutes(15) successfully saved and retrieved.');
} else {
    console.error(`❌ Expected 15, got ${val15}`);
    hasError = true;
}

stateStore.setLateThresholdMinutes(60);
const val60 = stateStore.getLateThresholdMinutes();
if (val60 === 60) {
    console.log('✓ setLateThresholdMinutes(60) successfully saved and retrieved.');
} else {
    console.error(`❌ Expected 60, got ${val60}`);
    hasError = true;
}

stateStore.setLateThresholdMinutes(0);
const val0 = stateStore.getLateThresholdMinutes();
if (val0 === 0) {
    console.log('✓ setLateThresholdMinutes(0) successfully saved and retrieved.');
} else {
    console.error(`❌ Expected 0, got ${val0}`);
    hasError = true;
}

// 3. Verify invalid values fallback to 10
// Value less than 0
stateStore.setLateThresholdMinutes(-5);
const valNeg5 = stateStore.getLateThresholdMinutes();
if (valNeg5 === 10) {
    console.log('✓ setLateThresholdMinutes(-5) normalized to 10.');
} else {
    console.error(`❌ Expected 10, got ${valNeg5}`);
    hasError = true;
}

// Value not divisible by 5 (e.g. 4)
stateStore.setLateThresholdMinutes(4);
const val4 = stateStore.getLateThresholdMinutes();
if (val4 === 10) {
    console.log('✓ setLateThresholdMinutes(4) normalized to 10.');
} else {
    console.error(`❌ Expected 10, got ${val4}`);
    hasError = true;
}

// Value greater than 90
stateStore.setLateThresholdMinutes(95);
const val95 = stateStore.getLateThresholdMinutes();
if (val95 === 10) {
    console.log('✓ setLateThresholdMinutes(95) normalized to 10.');
} else {
    console.error(`❌ Expected 10, got ${val95}`);
    hasError = true;
}

// Value not divisible by 5
stateStore.setLateThresholdMinutes(12);
const val12 = stateStore.getLateThresholdMinutes();
if (val12 === 10) {
    console.log('✓ setLateThresholdMinutes(12) normalized to 10.');
} else {
    console.error(`❌ Expected 10, got ${val12}`);
    hasError = true;
}

// Value is NaN/string non-number
stateStore.setLateThresholdMinutes('invalid');
const valInvalid = stateStore.getLateThresholdMinutes();
if (valInvalid === 10) {
    console.log('✓ setLateThresholdMinutes("invalid") normalized to 10.');
} else {
    console.error(`❌ Expected 10, got ${valInvalid}`);
    hasError = true;
}

if (hasError) {
    console.error('Smoke test FAILED.');
    process.exit(1);
} else {
    console.log('Smoke test PASSED successfully.');
    process.exit(0);
}
