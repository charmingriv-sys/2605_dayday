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


// ==========================================
// ADDITIONAL SELECTOR TEST CASES (Phase 8B-3)
// ==========================================

console.log('--- Unit Test: Starting TodayTask API Selector Verification ---');

// Reset store again for selector tests
stateStore.db.todayTasks = [];

const testTime = new Date('2026-06-02T12:00:00.000Z');

// 1. Seed tasks with various statuses to check visibility
stateStore.addTodayTask({ id: 'task-open', title: 'Open Task', status: 'open', dueAt: '2026-06-02T15:00:00.000Z', priority: 'today' });
stateStore.addTodayTask({ id: 'task-done', title: 'Done Task', status: 'done', dueAt: '2026-06-02T15:00:00.000Z', priority: 'today' });
stateStore.addTodayTask({ id: 'task-dismissed', title: 'Dismissed Task', status: 'dismissed', dueAt: '2026-06-02T15:00:00.000Z', priority: 'today' });

// Snoozed - future (snoozedUntil > now) -> Should be hidden
stateStore.addTodayTask({ id: 'task-snoozed-future', title: 'Snoozed Future Task', status: 'snoozed', snoozedUntil: '2026-06-02T13:00:00.000Z', dueAt: '2026-06-02T15:00:00.000Z', priority: 'today' });

// Snoozed - expired (snoozedUntil <= now) -> Should be visible
stateStore.addTodayTask({ id: 'task-snoozed-expired', title: 'Snoozed Expired Task', status: 'snoozed', snoozedUntil: '2026-06-02T11:00:00.000Z', dueAt: '2026-06-02T15:00:00.000Z', priority: 'today' });

const visibleTasks = stateStore.getActiveTodayTasks(testTime);
const visibleIds = visibleTasks.map(t => t.id);

assert(visibleIds.includes('task-open'), 'getActiveTodayTasks exposes open task');
assert(visibleIds.includes('task-snoozed-expired'), 'getActiveTodayTasks exposes expired snoozed task');
assert(!visibleIds.includes('task-done'), 'getActiveTodayTasks hides done task');
assert(!visibleIds.includes('task-dismissed'), 'getActiveTodayTasks hides dismissed task');
assert(!visibleIds.includes('task-snoozed-future'), 'getActiveTodayTasks hides future snoozed task');

// 2. Verify sorting logic (priority -> dueAt -> createdAt)
stateStore.db.todayTasks = [];

// Seed sorting test tasks
// T1: urgent, due: 15:00, created: 10:00
stateStore.addTodayTask({ id: 'T1', priority: 'urgent', dueAt: '2026-06-02T15:00:00.000Z', createdAt: '2026-06-02T10:00:00.000Z' });
// T2: today, due: 14:00, created: 10:00
stateStore.addTodayTask({ id: 'T2', priority: 'today', dueAt: '2026-06-02T14:00:00.000Z', createdAt: '2026-06-02T10:00:00.000Z' });
// T3: closing, due: 14:00, created: 10:00
stateStore.addTodayTask({ id: 'T3', priority: 'closing', dueAt: '2026-06-02T14:00:00.000Z', createdAt: '2026-06-02T10:00:00.000Z' });
// T4: info, due: 14:00, created: 10:00
stateStore.addTodayTask({ id: 'T4', priority: 'info', dueAt: '2026-06-02T14:00:00.000Z', createdAt: '2026-06-02T10:00:00.000Z' });
// T5: unknown/none, due: 14:00, created: 10:00
stateStore.addTodayTask({ id: 'T5', priority: 'unknown', dueAt: '2026-06-02T14:00:00.000Z', createdAt: '2026-06-02T10:00:00.000Z' });

// T6: urgent, due: 16:00, created: 10:00 (urgent but later than T1)
stateStore.addTodayTask({ id: 'T6', priority: 'urgent', dueAt: '2026-06-02T16:00:00.000Z', createdAt: '2026-06-02T10:00:00.000Z' });
// T7: urgent, due: 15:00, created: 11:00 (urgent, same due as T1, but created later)
stateStore.addTodayTask({ id: 'T7', priority: 'urgent', dueAt: '2026-06-02T15:00:00.000Z', createdAt: '2026-06-02T11:00:00.000Z' });

const sortedTasks = stateStore.getActiveTodayTasks(testTime);
const sortedIds = sortedTasks.map(t => t.id);

// Expected Order: 
// 1. T1 (urgent, due 15:00, created 10:00)
// 2. T7 (urgent, due 15:00, created 11:00)
// 3. T6 (urgent, due 16:00, created 10:00)
// 4. T2 (today, due 14:00)
// 5. T3 (closing, due 14:00)
// 6. T4 (info, due 14:00)
// 7. T5 (unknown/99, due 14:00)

assert(sortedIds[0] === 'T1', `First: T1 (${sortedIds[0]})`);
assert(sortedIds[1] === 'T7', `Second: T7 (${sortedIds[1]})`);
assert(sortedIds[2] === 'T6', `Third: T6 (${sortedIds[2]})`);
assert(sortedIds[3] === 'T2', `Fourth: T2 (${sortedIds[3]})`);
assert(sortedIds[4] === 'T3', `Fifth: T3 (${sortedIds[4]})`);
assert(sortedIds[5] === 'T4', `Sixth: T4 (${sortedIds[5]})`);
assert(sortedIds[6] === 'T5', `Seventh: T5 (${sortedIds[6]})`);

// 3. Verify getActiveTodayTasks invalid/missing date sorting fallbacks
stateStore.db.todayTasks = [];

// Seed tasks directly with push to bypass default auto-population of missing dates
stateStore.db.todayTasks.push({ id: 'T_valid_due', status: 'open', priority: 'urgent', dueAt: '2026-06-02T14:00:00.000Z', createdAt: '2026-06-02T10:00:00.000Z' });
stateStore.db.todayTasks.push({ id: 'T_missing_due', status: 'open', priority: 'urgent', createdAt: '2026-06-02T10:00:00.000Z' }); // dueAt is missing
stateStore.db.todayTasks.push({ id: 'T_invalid_due', status: 'open', priority: 'urgent', dueAt: 'invalid-date-string', createdAt: '2026-06-02T10:00:00.000Z' }); // dueAt is invalid

stateStore.db.todayTasks.push({ id: 'T_missing_created', status: 'open', priority: 'urgent', dueAt: '2026-06-02T14:00:00.000Z' }); // createdAt is missing
stateStore.db.todayTasks.push({ id: 'T_invalid_created', status: 'open', priority: 'urgent', dueAt: '2026-06-02T14:00:00.000Z', createdAt: 'invalid-date-string' }); // createdAt is invalid

const fallbackSortedTasks = stateStore.getActiveTodayTasks(testTime);
const fallbackSortedIds = fallbackSortedTasks.map(t => t.id);

assert(fallbackSortedIds.indexOf('T_valid_due') < fallbackSortedIds.indexOf('T_missing_due'), 'Valid dueAt task is sorted before missing dueAt task');
assert(fallbackSortedIds.indexOf('T_valid_due') < fallbackSortedIds.indexOf('T_invalid_due'), 'Valid dueAt task is sorted before invalid dueAt task');
assert(fallbackSortedIds.indexOf('T_valid_due') < fallbackSortedIds.indexOf('T_missing_created'), 'Valid createdAt task is sorted before missing createdAt task');
assert(fallbackSortedIds.indexOf('T_valid_due') < fallbackSortedIds.indexOf('T_invalid_created'), 'Valid createdAt task is sorted before invalid createdAt task');
assert(fallbackSortedIds.indexOf('T_missing_created') < fallbackSortedIds.indexOf('T_missing_due'), 'Valid dueAt (but missing createdAt) is sorted before missing dueAt task');

// 4. Verify getActiveTodayTasks return array copy safety
const activeList = stateStore.getActiveTodayTasks(testTime);
const countBeforeMutation = activeList.length;
activeList.push({ id: 'temp-task-mutate', priority: 'urgent' });
const activeListAgain = stateStore.getActiveTodayTasks(testTime);
assert(activeListAgain.length === countBeforeMutation, 'getActiveTodayTasks() returns a shallow copy and prevents mutation of internal list');


// 5. Verify getDoneTodayTasks selector (Phase 8C-3B)
console.log('--- Unit Test: Starting TodayTask API Done Selector Verification ---');
stateStore.db.todayTasks = [];

// Seed tasks
// Task A: Done today (completedAt is today)
stateStore.addTodayTask({ id: 'done-A', title: 'Done A', status: 'done', completedAt: '2026-06-02T10:00:00.000Z', priority: 'today' });
// Task B: Done today (completedAt is empty, but dueAt is today)
stateStore.addTodayTask({ id: 'done-B', title: 'Done B', status: 'done', completedAt: undefined, dueAt: '2026-06-02T15:00:00.000Z', priority: 'today' });
// Task C: Done today (completedAt/dueAt empty, but startAt is today)
stateStore.addTodayTask({ id: 'done-C', title: 'Done C', status: 'done', completedAt: undefined, dueAt: undefined, startAt: '2026-06-02T08:00:00.000Z', priority: 'today' });
// Task D: Done yesterday (completedAt/dueAt/startAt are yesterday relative to testTime)
stateStore.addTodayTask({
  id: 'done-D',
  title: 'Done D',
  status: 'done',
  completedAt: new Date(testTime.getTime() - 36 * 60 * 60 * 1000).toISOString(),
  dueAt: new Date(testTime.getTime() - 36 * 60 * 60 * 1000).toISOString(),
  startAt: new Date(testTime.getTime() - 36 * 60 * 60 * 1000).toISOString(),
  priority: 'today'
});
// Task E: Dismissed today (should NOT match done tasks)
stateStore.addTodayTask({ id: 'dismissed-E', title: 'Dismissed E', status: 'dismissed', completedAt: '2026-06-02T10:00:00.000Z', priority: 'today' });
// Task F: Open today (should NOT match done tasks)
stateStore.addTodayTask({ id: 'open-F', title: 'Open F', status: 'open', dueAt: '2026-06-02T10:00:00.000Z', priority: 'today' });

const doneTodayList = stateStore.getDoneTodayTasks(testTime);
const doneTodayIds = doneTodayList.map(t => t.id);

assert(doneTodayIds.includes('done-A'), 'getDoneTodayTasks includes task with completedAt today');
assert(doneTodayIds.includes('done-B'), 'getDoneTodayTasks includes task with dueAt today when completedAt is missing');
assert(doneTodayIds.includes('done-C'), 'getDoneTodayTasks includes task with startAt today when others are missing');
assert(!doneTodayIds.includes('done-D'), 'getDoneTodayTasks excludes task completed yesterday');
assert(!doneTodayIds.includes('dismissed-E'), 'getDoneTodayTasks excludes dismissed task');
assert(!doneTodayIds.includes('open-F'), 'getDoneTodayTasks excludes open task');


if (hasError) {
    console.error('--- Unit Test: TodayTask API Verification FAILED ---');
    process.exit(1);
} else {
    console.log('--- Unit Test: TodayTask API Verification PASSED successfully ---');
    process.exit(0);
}
