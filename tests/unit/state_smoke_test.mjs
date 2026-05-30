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

if (hasError) {
    console.error('Smoke test FAILED.');
    process.exit(1);
} else {
    console.log('Smoke test PASSED successfully.');
    process.exit(0);
}
