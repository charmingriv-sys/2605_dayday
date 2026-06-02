let storageMockData = {};
global.localStorage = {
    getItem: (key) => storageMockData[key] || null,
    setItem: (key, val) => { storageMockData[key] = val; }
};
global.window = {
    dispatchEvent: () => {},
    localStorage: global.localStorage
};

console.log('--- Unit Test: Starting TodayTask API Verification ---');

const { stateStore } = await import('../../src/js/state.js');

let hasError = false;

// Helper assertion function
function assert(condition, message) {
    if (condition) {
        console.log(`[OK] ${message}`);
    } else {
        console.error(`[FAIL] ${message}`);
        hasError = true;
    }
}

// Reset store state for testing
stateStore.db.todayTasks = [];

// 1. Verify getTodayTasks
const tasks = stateStore.getTodayTasks();
assert(Array.isArray(tasks) && tasks.length === 0, 'getTodayTasks() returns an empty array initially');

// 2. Verify addTodayTask defaults logic
const task1 = stateStore.addTodayTask({
    title: 'Test Task 1',
    description: 'First test description'
});

assert(task1 !== null, 'addTodayTask returns the created task');
assert(typeof task1.id === 'string' && task1.id.length > 0, `Auto-generated id populated: ${task1.id}`);
assert(task1.status === 'open', 'status defaults to open');
assert(task1.segment === 'academy_director_console', 'segment defaults to academy_director_console');
assert(task1.domain === 'academy', 'domain defaults to academy');
assert(task1.source === 'manual', 'source defaults to manual');
assert(task1.type === 'memo', 'type defaults to memo');
assert(Array.isArray(task1.visibilityRoles) && task1.visibilityRoles[0] === 'director', 'visibilityRoles defaults to ["director"]');
assert(task1.createdAt === task1.updatedAt, 'createdAt and updatedAt are initialized and equal');

// 3. Verify addTodayTask explicitly customized fields
const task2 = stateStore.addTodayTask({
    id: 'custom-id-123',
    segment: 'custom_segment',
    domain: 'general',
    source: 'system',
    type: 'attendance',
    status: 'open',
    visibilityRoles: ['teacher'],
    title: 'Custom Title'
});
assert(task2.id === 'custom-id-123', 'Explicit ID is preserved');
assert(task2.segment === 'custom_segment', 'Explicit segment is preserved');
assert(task2.domain === 'general', 'Explicit domain is preserved');
assert(task2.source === 'system', 'Explicit source is preserved');
assert(task2.type === 'attendance', 'Explicit type is preserved');
assert(task2.visibilityRoles[0] === 'teacher', 'Explicit visibilityRoles is preserved');
assert(stateStore.getTodayTasks().length === 2, 'Two tasks exist in the queue');

// 4. Verify updateTodayTask
const updatedTask2 = stateStore.updateTodayTask('custom-id-123', {
    title: 'Updated Custom Title',
    priority: 'urgent'
});
assert(updatedTask2.title === 'Updated Custom Title', 'Title was updated successfully');
assert(updatedTask2.priority === 'urgent', 'Priority was updated successfully');
assert(new Date(updatedTask2.updatedAt) >= new Date(updatedTask2.createdAt), 'updatedAt timestamp was updated');

// 5. Verify dedupeKey upsert behavior
const dedupeKey = 'ATTENDANCE_LATE_S1_2026-06-02';
const dTask1 = stateStore.addTodayTask({
    title: 'Late Student Warning',
    dedupeKey: dedupeKey,
    description: 'Initial late text'
});
const countBeforeDedupe = stateStore.getTodayTasks().length;

// Insert with same dedupeKey but different content
const dTask2 = stateStore.addTodayTask({
    title: 'Late Student Warning Updated',
    dedupeKey: dedupeKey,
    description: 'Updated late text'
});
const countAfterDedupe = stateStore.getTodayTasks().length;

assert(countBeforeDedupe === countAfterDedupe, 'Upsert logic prevented duplicate task creation on matching dedupeKey');
const fetchedDedupeTask = stateStore.getTodayTasks().find(t => t.dedupeKey === dedupeKey);
assert(fetchedDedupeTask.title === 'Late Student Warning Updated', 'Title was updated via dedupe upsert');
assert(fetchedDedupeTask.description === 'Updated late text', 'Description was updated via dedupe upsert');
assert(fetchedDedupeTask.id === dTask1.id, 'Original task ID was preserved through upsert');

// 6. Verify markTodayTaskDone
const doneTask = stateStore.markTodayTaskDone('custom-id-123');
assert(doneTask.status === 'done', 'Status set to done');
assert(typeof doneTask.completedAt === 'string', `completedAt timestamp populated: ${doneTask.completedAt}`);

// 7. Verify snoozeTodayTask
const snoozedUntil = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
const snoozedTask = stateStore.snoozeTodayTask(dTask1.id, snoozedUntil);
assert(snoozedTask.status === 'snoozed', 'Status set to snoozed');
assert(snoozedTask.snoozedUntil === snoozedUntil, 'snoozedUntil timestamp set correctly');

// 8. Verify dismissTodayTask
const dismissedTask = stateStore.dismissTodayTask(dTask1.id);
assert(dismissedTask.status === 'dismissed', 'Status set to dismissed');
assert(typeof dismissedTask.dismissedAt === 'string', `dismissedAt timestamp populated: ${dismissedTask.dismissedAt}`);

// 9. Verify deleteTodayTask / removeTodayTask
const countBeforeDelete = stateStore.getTodayTasks().length;
const deleteResult = stateStore.deleteTodayTask('custom-id-123');
const countAfterDelete = stateStore.getTodayTasks().length;
assert(deleteResult === true, 'deleteTodayTask returns true on successful deletion');
assert(countBeforeDelete - 1 === countAfterDelete, 'Task was successfully removed from store');

const removeResult = stateStore.removeTodayTask(dTask1.id);
assert(removeResult === true, 'removeTodayTask successfully aliases deleteTodayTask');


// ==========================================
// ADDITIONAL REVIEW-FIX TEST CASES
// ==========================================

console.log('--- Unit Test: Starting TodayTask API Review-Fix Verification ---');

// Reset store again for review-fix test cases
stateStore.db.todayTasks = [];

// A. getTodayTasks return shallow copy verification
const originalList = stateStore.getTodayTasks();
const originalLength = originalList.length;
originalList.push({ id: 'illegal-push-item', title: 'Should not affect store' });
const fetchAgainList = stateStore.getTodayTasks();
assert(fetchAgainList.length === originalLength, 'getTodayTasks() returns a shallow copy and prevents direct mutation of the internal array');

// B. Verify dedupeKey upsert edge-cases and status timestamp preservation/removal
const testDedupeKey = 'ATTENDANCE_LATE_S2_2026-06-02';

// 1. Create a task with status set to done
const initialDoneTask = stateStore.addTodayTask({
    dedupeKey: testDedupeKey,
    title: 'Late Student Warning 2',
    status: 'done'
});
const firstCompletedAt = initialDoneTask.completedAt;
assert(initialDoneTask.status === 'done', 'Initial task is created with status "done"');
assert(typeof firstCompletedAt === 'string', 'completedAt is populated for done task');

// 2. Upsert same dedupeKey with only title (status omitted)
const upsertedTitleTask = stateStore.addTodayTask({
    dedupeKey: testDedupeKey,
    title: 'Late Student Warning 2 Updated'
});
assert(upsertedTitleTask.title === 'Late Student Warning 2 Updated', 'Title was updated successfully via upsert');
assert(upsertedTitleTask.status === 'done', 'Status remains "done" because it was omitted in upsert');
assert(upsertedTitleTask.completedAt === firstCompletedAt, 'completedAt timestamp is preserved when status is omitted');

// 3. Update the same task with status set to open
const revertedTask = stateStore.updateTodayTask(upsertedTitleTask.id, {
    status: 'open'
});
assert(revertedTask.status === 'open', 'Status changed to "open" successfully');
assert(revertedTask.completedAt === undefined, 'completedAt was successfully removed when status changed away from "done"');


// C. Verify snooze/dismiss timestamp cleanup
// 1. Transition a snoozed task to open and verify snoozedUntil is cleared
const snoozedTaskForCleanup = stateStore.addTodayTask({
    title: 'Temporary Snooze Task',
    status: 'snoozed',
    snoozedUntil: new Date(Date.now() + 10000).toISOString()
});
assert(snoozedTaskForCleanup.status === 'snoozed', 'Task initialized as snoozed');
assert(typeof snoozedTaskForCleanup.snoozedUntil === 'string', 'snoozedUntil populated');

const unsnoozedTask = stateStore.updateTodayTask(snoozedTaskForCleanup.id, {
    status: 'open'
});
assert(unsnoozedTask.status === 'open', 'Status set to open from snoozed');
assert(unsnoozedTask.snoozedUntil === undefined, 'snoozedUntil was successfully removed on status transition to open');

// 2. Transition a dismissed task to open and verify dismissedAt is cleared
const dismissedTaskForCleanup = stateStore.addTodayTask({
    title: 'Temporary Dismiss Task',
    status: 'dismissed'
});
assert(dismissedTaskForCleanup.status === 'dismissed', 'Task initialized as dismissed');
assert(typeof dismissedTaskForCleanup.dismissedAt === 'string', 'dismissedAt populated');

const undismissedTask = stateStore.updateTodayTask(dismissedTaskForCleanup.id, {
    status: 'open'
});
assert(undismissedTask.status === 'open', 'Status set to open from dismissed');
assert(undismissedTask.dismissedAt === undefined, 'dismissedAt was successfully removed on status transition to open');


if (hasError) {
    console.error('--- Unit Test: TodayTask API Verification FAILED ---');
    process.exit(1);
} else {
    console.log('--- Unit Test: TodayTask API Verification PASSED successfully ---');
    process.exit(0);
}
