import { test, expect } from '@playwright/test';

// NodeJS runner Date mocking to match browser mockTime
const mockTime = new Date('2026-06-03T09:00:00+09:00').getTime();
const OriginalDate = Date;
class MockDate extends OriginalDate {
  constructor(...args) {
    if (args.length === 0) {
      super(mockTime);
    } else {
      super(...args);
    }
  }
  static now() {
    return mockTime;
  }
}
global.Date = MockDate;

test.describe('Director Today Console Flow Checks', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the date to 2026-06-03 09:00:00 KST (morning) to avoid automatic recommendation generation
    await page.addInitScript(() => {
      const mockTime = new Date('2026-06-03T09:00:00+09:00').getTime();
      const OriginalDate = Date;
      class MockDate extends OriginalDate {
        constructor(...args) {
          if (args.length === 0) {
            super(mockTime);
          } else {
            super(...args);
          }
        }
        static now() {
          return mockTime;
        }
      }
      window.Date = MockDate;
      window.__DAYDAY_E2E__ = true;
    });

    // Navigate and enter as director
    await page.goto('/');
    await page.locator('.role-btn.director').click();
    
    // Clear payments and bookIssueRequests to prevent warnings from polluting calendar tests
    await page.evaluate(() => {
      if (window.stateStore && window.stateStore.db) {
        window.stateStore.db.payments = [];
        window.stateStore.db.bookIssueRequests = [];
        window.stateStore.db.todayTasks = [];
        window.stateStore.saveDB();
      }
    });

    // Click "오늘 원장 콘솔" menu item
    await page.locator('.menu-item[data-view="dir-today-console"]').click();
  });
  test('should display today console and allow manual task management', async ({ page }) => {
    // Assert today console title exists
    await expect(page.locator('#page-title')).toContainText('오늘 원장 콘솔');

    // 1. Add a manual task
    const taskTitle = `E2E 테스트용 수동 메모 ${Date.now()}`;
    const taskDesc = '이것은 E2E 테스트에서 생성된 업무 설명입니다.';
    const content = `${taskTitle}\n${taskDesc}`;
    
    await page.fill('#task-content-input', content);
    await page.selectOption('#task-category-input', 'check'); // maps to priority 'urgent' (확인필요)
    
    // 2. Verify start minute select only contains 5-minute increments
    const minOptions = await page.locator('#task-start-minute-input option').allTextContents();
    expect(minOptions.length).toBe(12);
    for (let i = 0; i < 12; i++) {
      const valStr = String(i * 5).padStart(2, '0');
      expect(minOptions[i]).toBe(`${valStr}분`);
    }

    // 3. Verify start and end time are pre-populated
    await expect(page.locator('#task-start-date-input')).not.toHaveValue('');
    await expect(page.locator('#task-start-ampm-input')).not.toHaveValue('');
    await expect(page.locator('#task-start-hour-input')).not.toHaveValue('');
    await expect(page.locator('#task-start-minute-input')).not.toHaveValue('');

    // 4. Change start time explicitly to 2026-06-03, AM 10:00
    await page.fill('#task-start-date-input', '2026-06-03');
    await page.selectOption('#task-start-ampm-input', 'AM');
    await page.selectOption('#task-start-hour-input', '10');
    await page.selectOption('#task-start-minute-input', '00');

    // Verify end time auto-updates to 2026-06-03, AM 11:00 (+1 hour)
    await expect(page.locator('#task-end-date-input')).toHaveValue('2026-06-03');
    await expect(page.locator('#task-end-ampm-input')).toHaveValue('AM');
    await expect(page.locator('#task-end-hour-input')).toHaveValue('11');
    await expect(page.locator('#task-end-minute-input')).toHaveValue('00');

    // 5. Manually change end time to 2026-06-03, PM 03:00 (15:00)
    await page.selectOption('#task-end-ampm-input', 'PM');
    await page.selectOption('#task-end-hour-input', '3');
    await page.selectOption('#task-end-minute-input', '00');

    // 6. Change start time hour again to 12
    await page.selectOption('#task-start-hour-input', '12');

    // Verify end time is NOT overwritten (remains PM 03:00)
    await expect(page.locator('#task-end-date-input')).toHaveValue('2026-06-03');
    await expect(page.locator('#task-end-ampm-input')).toHaveValue('PM');
    await expect(page.locator('#task-end-hour-input')).toHaveValue('3');
    await expect(page.locator('#task-end-minute-input')).toHaveValue('00');

    // Submit the form
    await page.click('#form-add-task button[type="submit"]');

    // Assert task title and description appear in the active queue
    await expect(page.locator(`#tasks-list-container :text("${taskTitle}")`)).toBeVisible();
    await expect(page.locator(`#tasks-list-container :text("${taskDesc}")`)).toBeVisible();

    // Verify stored task description preserves the entire raw content (first line + subsequent lines)
    const taskInStore = await page.evaluate((title) => {
      const tasks = window.stateStore.getTodayTasks();
      return tasks.find(t => t.title === title);
    }, taskTitle);
    expect(taskInStore).toBeDefined();
    expect(taskInStore.description).toBe(content);
    expect(taskInStore.startAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(taskInStore.endAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(taskInStore.dueAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    // Assert category badge "확인필요" is visible on the card
    const badgeCheck = page.locator(`#tasks-list-container .glass-card:has-text("${taskTitle}") .badge`);
    await expect(badgeCheck).toContainText('확인필요');

    // Assert inputs are cleared/reset
    await expect(page.locator('#task-content-input')).toHaveValue('');
    await expect(page.locator('#task-category-input')).toHaveValue('memo'); // resets to memo

    // 2. Done Action
    // Find the card containing our task title and click its 'done' button
    const doneButton = page.locator(`#tasks-list-container .glass-card:has-text("${taskTitle}") button[data-action="done"]`);
    await doneButton.click();

    // Assert task disappears from the active queue
    await expect(page.locator(`#tasks-list-container :text("${taskTitle}")`)).toBeHidden();
    
    // Switch to done tab
    await page.locator('.tab-btn:has-text("완료")').click();

    // Assert task is visible in the done queue
    await expect(page.locator(`#tasks-list-container :text("${taskTitle}")`)).toBeVisible();
    
    // Assert it now has the "완료" badge
    const badgeDone = page.locator(`#tasks-list-container .glass-card:has-text("${taskTitle}") .badge`);
    await expect(badgeDone).toContainText('완료');

    // Assert the action buttons (done, snooze, dismiss) are replaced by Reopen button
    const cardReopenButton = page.locator(`#tasks-list-container .glass-card:has-text("${taskTitle}") button[data-action="reopen"]`);
    await expect(cardReopenButton).toBeVisible();

    // Switch back to active tab
    await page.locator('.tab-btn:has-text("대기")').click();

    // 3. Snooze Action
    const snoozeTitle = `Snooze 테스트 ${Date.now()}`;
    await page.fill('#task-content-input', snoozeTitle);
    await page.selectOption('#task-category-input', 'consult'); // 상담예약
    await page.click('#form-add-task button[type="submit"]');
    await expect(page.locator(`#tasks-list-container :text("${snoozeTitle}")`)).toBeVisible();

    // Assert category badge "상담예약" is visible on the card
    const badgeConsult = page.locator(`#tasks-list-container .glass-card:has-text("${snoozeTitle}") .badge`);
    await expect(badgeConsult).toContainText('상담예약');

    const snoozeButton = page.locator(`#tasks-list-container .glass-card:has-text("${snoozeTitle}") button[data-action="snooze"]`);
    await snoozeButton.click();
    await expect(page.locator(`#tasks-list-container :text("${snoozeTitle}")`)).toBeHidden();

    // 4. Dismiss Action
    const dismissTitle = `Dismiss 테스트 ${Date.now()}`;
    await page.fill('#task-content-input', dismissTitle);
    await page.click('#form-add-task button[type="submit"]');
    await expect(page.locator(`#tasks-list-container :text("${dismissTitle}")`)).toBeVisible();

    const dismissButton = page.locator(`#tasks-list-container .glass-card:has-text("${dismissTitle}") button[data-action="dismiss"]`);
    
    // Register dialog handler to verify confirm message and accept it
    let dialogMsg = '';
    page.once('dialog', dialog => {
      dialogMsg = dialog.message();
      dialog.accept();
    });
    
    await dismissButton.click();
    await expect(page.locator(`#tasks-list-container :text("${dismissTitle}")`)).toBeHidden();
    expect(dialogMsg).toContain('이 업무를 오늘 큐에서 제외할까요?');
  });

  test('should escape HTML input fields and prevent XSS execution', async ({ page }) => {
    // Assert today console title exists
    await expect(page.locator('#page-title')).toContainText('오늘 원장 콘솔');

    // 1. Listen for dialog to verify alert is NOT triggered
    let dialogTriggered = false;
    page.on('dialog', dialog => {
      dialogTriggered = true;
      dialog.dismiss();
    });

    // 2. Add a task with XSS payload in content
    const xssTitle = `<script>alert("xss")</script> XSS Title ${Date.now()}`;
    const xssDesc = `<img src=x onerror=alert("xss-desc")> XSS Description`;
    const content = `${xssTitle}\n${xssDesc}`;

    await page.fill('#task-content-input', content);
    await page.click('#form-add-task button[type="submit"]');

    // 3. Assert the task card is visible and outputted as pure text
    await expect(page.locator('#tasks-list-container')).toBeVisible();
    
    // Check if the script tags/onerror attributes are rendered as text in DOM and not executed as HTML elements
    const cardTitle = page.locator('#tasks-list-container').getByText(xssTitle);
    await expect(cardTitle).toBeVisible();
    
    const cardDesc = page.locator('#tasks-list-container').getByText(xssDesc);
    await expect(cardDesc).toBeVisible();

    // Verify no dialog was triggered
    expect(dialogTriggered).toBe(false);
  });

  test('should display parallel layout with tasks queue and calendar skeleton', async ({ page }) => {
    // 1. Assert Manual Task Form is inside the top workspace grid
    const formInWorkspace = page.locator('.today-console-workspace #form-add-task');
    await expect(formInWorkspace).toBeVisible();

    // 2. Assert Calendar Section is inside the top workspace grid
    const calendarSection = page.locator('.today-console-workspace #calendar-timeline-section');
    await expect(calendarSection).toBeVisible();
    await expect(calendarSection.locator('text=오늘 일정')).toBeVisible();

    // 3. Assert weekday headers are visible (일 월 화 수 목 금 토)
    const daysHeader = calendarSection.locator('#calendar-days-header');
    await expect(daysHeader).toBeVisible();
    await expect(daysHeader).toContainText('일');
    await expect(daysHeader).toContainText('토');

    // 4. Assert either 35 or 42 day cells exist in the grid (variable weeks)
    const dayCells = calendarSection.locator('#calendar-days-grid .calendar-day-cell');
    const cellCount = await dayCells.count();
    expect(cellCount === 35 || cellCount === 42).toBe(true);

    // 5. Assert overlay message is visible initially
    await expect(calendarSection.locator('#calendar-skeleton-overlay')).toBeVisible();
    await expect(calendarSection.locator('text=캘린더 일정 연동 대기')).toBeVisible();

    // 6. Assert Tasks Queue Section exists at the bottom (outside workspace, as a full-width container)
    const tasksQueue = page.locator('#tasks-queue-section');
    await expect(tasksQueue).toBeVisible();
    await expect(tasksQueue.locator('text=운영 대기 업무 (Active & Completed Queue)')).toBeVisible();
  });

  test('should display mockCalendarEvents and TodayTasks in the calendar timeline and hide the overlay', async ({ page }) => {
    // 1. Clear any existing mock events and tasks
    await page.evaluate(() => {
      window.stateStore.clearMockCalendarEvents();
      window.stateStore.db.todayTasks = [];
    });

    // 2. Add a TodayTask with start/end time for today
    const taskTitle = '오늘 일정 업무 테스트';
    await page.evaluate((title) => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 30, 0).toISOString();
      window.stateStore.addTodayTask({
        title: title,
        description: '업무 설명',
        status: 'open',
        priority: 'today',
        category: 'consult',
        startAt: start,
        endAt: end,
        dueAt: start,
        source: 'manual',
        type: 'memo',
        segment: 'academy_director_console',
        domain: 'academy',
        visibilityRoles: ['director']
      });
    }, taskTitle);

    // 3. Add a mockCalendarEvent for today
    const eventTitle = '구글 캘린더 연동 회의';
    await page.evaluate((title) => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0, 0).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 0, 0).toISOString();
      window.stateStore.addMockCalendarEvent({
        title: title,
        description: '회의 설명',
        startsAt: start,
        endsAt: end,
        provider: 'google'
      });
    }, eventTitle);

    const calendarSection = page.locator('#calendar-timeline-section');
    
    // 5. Verify the TodayTask appears in the calendar as a chip
    await expect(calendarSection.locator(`.calendar-event-chip:has-text("${taskTitle}")`)).toBeVisible();

    // 6. Verify the mockCalendarEvent appears in the calendar as a chip
    await expect(calendarSection.locator(`.calendar-event-chip:has-text("${eventTitle}")`)).toBeVisible();

    // 7. Verify the overlay is NOT visible (since we have events)
    await expect(calendarSection.locator('#calendar-skeleton-overlay')).toBeHidden();
  });

  test('should update form start and end date inputs when calendar day cell is clicked', async ({ page }) => {
    // 1. Clear tasks and add at least one mock event to hide the overlay
    await page.evaluate(() => {
      window.stateStore.clearMockCalendarEvents();
      window.stateStore.db.todayTasks = [];
      const now = new Date();
      window.stateStore.addMockCalendarEvent({
        title: '일정 활성화용 회의',
        startsAt: now.toISOString(),
        endsAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        provider: 'local'
      });
    });

    const calendarSection = page.locator('#calendar-timeline-section');
    
    // Construct target date (15th of the current month)
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const clickedDateStr = `${y}-${m}-15`;
    
    const cellLocator = calendarSection.locator(`.calendar-day-cell[data-date="${clickedDateStr}"]`);
    await cellLocator.click();

    // Verify inputs update to the clicked date
    await expect(page.locator('#task-start-date-input')).toHaveValue(clickedDateStr);
    await expect(page.locator('#task-end-date-input')).toHaveValue(clickedDateStr);
  });

  test('should synchronize end date when start date is manually changed', async ({ page }) => {
    // 1. Clear tasks and add mock event to hide overlay
    await page.evaluate(() => {
      window.stateStore.clearMockCalendarEvents();
      window.stateStore.db.todayTasks = [];
      const now = new Date();
      window.stateStore.addMockCalendarEvent({
        title: '일정 활성화용 회의',
        startsAt: now.toISOString(),
        endsAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        provider: 'local'
      });
    });

    const calendarSection = page.locator('#calendar-timeline-section');
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const clickedDateStr = `${y}-${m}-15`;

    const cellLocator = calendarSection.locator(`.calendar-day-cell[data-date="${clickedDateStr}"]`);
    await cellLocator.click();
    await page.waitForTimeout(500);

    // 2. Enter start date
    await page.fill('#task-start-date-input', '2026-06-10');
    // Trigger change event explicitly to verify auto sync of end date
    await page.dispatchEvent('#task-start-date-input', 'change');

    // Verify end date is synchronized to the same date
    await expect(page.locator('#task-end-date-input')).toHaveValue('2026-06-10');

    // 2. Override end date manually to 2026-06-12
    await page.fill('#task-end-date-input', '2026-06-12');
    await page.dispatchEvent('#task-end-date-input', 'change');

    // Change start date again
    await page.fill('#task-start-date-input', '2026-06-11');
    await page.dispatchEvent('#task-start-date-input', 'change');

    // Verify end date is NOT overwritten (remains 2026-06-12 due to manual override)
    await expect(page.locator('#task-end-date-input')).toHaveValue('2026-06-12');
  });

  test('should display multi-day event across multiple date cells', async ({ page }) => {
    // 1. Seed a 3-day multi-day event using window.stateStore
    await page.evaluate(() => {
      window.stateStore.clearMockCalendarEvents();
      window.stateStore.db.todayTasks = [];
      const now = new Date();
      // Starts on 12th of this month, ends on 14th of this month
      const y = now.getFullYear();
      const m = now.getMonth();
      const startsAt = new Date(y, m, 12, 10, 0, 0).toISOString();
      const endsAt = new Date(y, m, 14, 18, 0, 0).toISOString();

      window.stateStore.addMockCalendarEvent({
        id: 'multi-day-e2e',
        title: '3일 연속 세미나',
        description: '세미나 상세 설명',
        startsAt,
        endsAt,
        provider: 'local'
      });
    });

    const calendarSection = page.locator('#calendar-timeline-section');
    
    // Construct year and month strings
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    
    // Verify it is rendered on Day 12
    const cell12 = calendarSection.locator(`.calendar-day-cell[data-date="${y}-${m}-12"]`);
    await expect(cell12.locator('.calendar-event-chip:has-text("3일 연속 세미나")')).toBeVisible();

    // Verify it is rendered on Day 13
    const cell13 = calendarSection.locator(`.calendar-day-cell[data-date="${y}-${m}-13"]`);
    await expect(cell13.locator('.calendar-event-chip:has-text("3일 연속 세미나")')).toBeVisible();

    // Verify it is rendered on Day 14
    const cell14 = calendarSection.locator(`.calendar-day-cell[data-date="${y}-${m}-14"]`);
    await expect(cell14.locator('.calendar-event-chip:has-text("3일 연속 세미나")')).toBeVisible();

    // Verify it is NOT rendered on Day 15
    const cell15 = calendarSection.locator(`.calendar-day-cell[data-date="${y}-${m}-15"]`);
    await expect(cell15.locator('.calendar-event-chip:has-text("3일 연속 세미나")')).toBeHidden();
  });

  test('should open popover when calendar event chip is clicked and only load values when popover item is clicked', async ({ page }) => {
    // 1. Seed a specific TodayTask
    const taskTitle = 'E2E 로딩대상 업무';
    const taskDesc = '업무 상세 설명글\n두번째 줄 내용';
    await page.evaluate(({ title, desc }) => {
      window.stateStore.clearMockCalendarEvents();
      window.stateStore.db.todayTasks = [];
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      const startAt = new Date(y, m, 20, 14, 30, 0).toISOString();
      const endAt = new Date(y, m, 20, 16, 0, 0).toISOString();

      window.stateStore.addTodayTask({
        id: 'task-load-e2e',
        title: title,
        description: desc,
        rawContent: `${title}\n${desc}`,
        status: 'open',
        priority: 'today',
        category: 'consult',
        startAt,
        endAt,
        dueAt: startAt,
        source: 'manual',
        type: 'memo',
        segment: 'academy_director_console',
        domain: 'academy',
        visibilityRoles: ['director']
      });
    }, { title: taskTitle, desc: taskDesc });

    const calendarSection = page.locator('#calendar-timeline-section');
    const popover = page.locator('#calendar-popover-container');
    
    // Construct year and month strings
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const date20Str = `${y}-${m}-20`;
    
    // Find the chip on the 20th cell
    const chip = calendarSection.locator(`.calendar-day-cell[data-date="${date20Str}"] .calendar-event-chip:has-text("${taskTitle}")`);
    await expect(chip).toBeVisible();

    // Click the chip
    await chip.click();

    // Verify popover is opened instead of immediately loading the form content
    await expect(popover).toBeVisible();
    await expect(popover.locator('.popover-event-item:has-text("E2E 로딩대상 업무")')).toBeVisible();

    // Form inputs should not have the event description text yet
    await expect(page.locator('#task-content-input')).toHaveValue('');

    // Click the item inside the popover
    const popoverItem = popover.locator(`.popover-event-item:has-text("${taskTitle}")`);
    await popoverItem.click();

    // Verify form input values are populated correctly after clicking popover item
    await expect(page.locator('#task-content-input')).toHaveValue(`${taskTitle}\n${taskDesc}`);
    await expect(page.locator('#task-category-input')).toHaveValue('consult');
    await expect(page.locator('#task-start-date-input')).toHaveValue(date20Str);
    await expect(page.locator('#task-start-ampm-input')).toHaveValue('PM');
    await expect(page.locator('#task-start-hour-input')).toHaveValue('2');
    await expect(page.locator('#task-start-minute-input')).toHaveValue('30');
    await expect(page.locator('#task-end-date-input')).toHaveValue(date20Str);
    await expect(page.locator('#task-end-ampm-input')).toHaveValue('PM');
    await expect(page.locator('#task-end-hour-input')).toHaveValue('4');
    await expect(page.locator('#task-end-minute-input')).toHaveValue('00');
  });

  test('should display +N badge when day has 3 or more events, open popover, select popover item to fill form, and close popover', async ({ page }) => {
    // 1. Seed 3 calendar events for the 25th of the current month
    await page.evaluate(() => {
      window.stateStore.clearMockCalendarEvents();
      window.stateStore.db.todayTasks = [];
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();

      // Event 1
      window.stateStore.addMockCalendarEvent({
        id: 'ev-1',
        title: '학부모 상담',
        startsAt: new Date(y, m, 25, 10, 0, 0).toISOString(),
        endsAt: new Date(y, m, 25, 11, 0, 0).toISOString(),
        provider: 'local'
      });

      // Event 2
      window.stateStore.addMockCalendarEvent({
        id: 'ev-2',
        title: '신규 오리엔테이션',
        startsAt: new Date(y, m, 25, 13, 0, 0).toISOString(),
        endsAt: new Date(y, m, 25, 14, 0, 0).toISOString(),
        provider: 'local'
      });

      // Event 3
      window.stateStore.addMockCalendarEvent({
        id: 'ev-3',
        title: '교재 분배 작업',
        startsAt: new Date(y, m, 25, 16, 0, 0).toISOString(),
        endsAt: new Date(y, m, 25, 17, 0, 0).toISOString(),
        provider: 'local'
      });
    });

    const calendarSection = page.locator('#calendar-timeline-section');
    
    // Construct year and month strings
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const targetDateStr = `${y}-${m}-25`;

    const cell25 = calendarSection.locator(`.calendar-day-cell[data-date="${targetDateStr}"]`);
    
    // Verify +1 badge exists (since limit is 2 visible items)
    const moreBadge = cell25.locator('text=+1개');
    await expect(moreBadge).toBeVisible();

    // Verify popover is hidden initially
    const popover = page.locator('#calendar-popover-container');
    await expect(popover).toBeHidden();

    // 2. Click the +1개 badge to open the popover
    await moreBadge.click();
    await expect(popover).toBeVisible();
    await expect(popover.locator('#calendar-popover-title')).toContainText('25일 일정 목록');

    // Verify all 3 events are displayed in the popover body
    await expect(popover.locator('.popover-event-item:has-text("학부모 상담")')).toBeVisible();
    await expect(popover.locator('.popover-event-item:has-text("신규 오리엔테이션")')).toBeVisible();
    await expect(popover.locator('.popover-event-item:has-text("교재 분배 작업")')).toBeVisible();

    // 3. Click popover item "신규 오리엔테이션" to load its values
    const itemTarget = popover.locator('.popover-event-item:has-text("신규 오리엔테이션")');
    await itemTarget.click();

    // Verify inputs populate
    await expect(page.locator('#task-content-input')).toHaveValue('신규 오리엔테이션');
    await expect(page.locator('#task-start-date-input')).toHaveValue(targetDateStr);
    await expect(page.locator('#task-start-ampm-input')).toHaveValue('PM');
    await expect(page.locator('#task-start-hour-input')).toHaveValue('1');
    await expect(page.locator('#task-start-minute-input')).toHaveValue('00');
    await expect(page.locator('#task-end-date-input')).toHaveValue(targetDateStr);
    await expect(page.locator('#task-end-ampm-input')).toHaveValue('PM');
    await expect(page.locator('#task-end-hour-input')).toHaveValue('2');
    await expect(page.locator('#task-end-minute-input')).toHaveValue('00');

    // 4. Close the popover via close button
    const closeBtn = popover.locator('#calendar-popover-close');
    await closeBtn.click();
    await expect(popover).toBeHidden();

    // 5. Open again by clicking more badge, and close by clicking outside (backdrop)
    await moreBadge.click();
    await expect(popover).toBeVisible();

    // Click backdrop
    await popover.click({ position: { x: 5, y: 5 } }); // click top-left edge of backdrop
    await expect(popover).toBeHidden();
  });

  test('should open popover when clicking a day cell with events, and close/not open when clicking a cell without events', async ({ page }) => {
    // 1. Seed events on the 18th, leave 19th empty
    await page.evaluate(() => {
      window.stateStore.clearMockCalendarEvents();
      window.stateStore.db.todayTasks = [];
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();

      window.stateStore.addMockCalendarEvent({
        id: 'ev-cell-click-test',
        title: '셀클릭 테스트용 회의',
        startsAt: new Date(y, m, 18, 11, 0, 0).toISOString(),
        endsAt: new Date(y, m, 18, 12, 0, 0).toISOString(),
        provider: 'local'
      });
    });

    const calendarSection = page.locator('#calendar-timeline-section');
    const popover = page.locator('#calendar-popover-container');
    const popoverCard = popover.locator('.glass-card');
    
    // Construct year and month strings
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const date18Str = `${y}-${m}-18`;
    const date19Str = `${y}-${m}-19`;

    // 2. Click the day cell itself (the day number span) for 18th (has event)
    const cell18Span = calendarSection.locator(`.calendar-day-cell[data-date="${date18Str}"] span`).first();
    await cell18Span.click();

    // Verify popover is visible and has the event
    await expect(popover).toBeVisible();
    await expect(popover.locator('.popover-event-item:has-text("셀클릭 테스트용 회의")')).toBeVisible();

    // Verify the popover container background style is light-tone adjusted
    const popoverBgStyle = await popover.getAttribute('style');
    expect(popoverBgStyle).toContain('background: rgba(0, 0, 0, 0.2)');

    // Verify the popover card has bright background
    const popoverCardStyle = await popoverCard.getAttribute('style');
    expect(popoverCardStyle).toContain('background: rgba(255, 255, 255, 0.95)');

    // Close the popover first
    const closeBtn = popover.locator('#calendar-popover-close');
    await closeBtn.click();
    await expect(popover).toBeHidden();

    // 3. Click the day cell (day number span) for 19th (no events)
    const cell19Span = calendarSection.locator(`.calendar-day-cell[data-date="${date19Str}"] span`).first();
    await cell19Span.click();

    // Verify popover remains hidden and inputs are updated
    await expect(popover).toBeHidden();
    await expect(page.locator('#task-start-date-input')).toHaveValue(date19Str);
    await expect(page.locator('#task-end-date-input')).toHaveValue(date19Str);

    // 4. Click the chip inside the 18th day cell to test that it opens popover and does not load values directly
    const chip18 = calendarSection.locator(`.calendar-day-cell[data-date="${date18Str}"] .calendar-event-chip`).first();
    await chip18.click();

    // Verify popover is opened and form remains unchanged
    await expect(popover).toBeVisible();
    await expect(page.locator('#task-content-input')).toHaveValue('');
  });

  test('should sort active tasks queue by startAt -> dueAt -> createdAt policy', async ({ page }) => {
    // 1. Clear database tasks
    await page.evaluate(() => {
      window.stateStore.clearMockCalendarEvents();
      window.stateStore.db.todayTasks = [];
      window.stateStore.db.payments = [];
    });

    // 2. Add tasks with specific times to test the sorting order
    await page.evaluate(() => {
      const now = new Date();
      
      // Task 1: startAt at 14:00 today (Should be second)
      window.stateStore.db.todayTasks.push({
        id: 'T_start_14',
        title: '시작 14시 업무',
        priority: 'info',
        category: 'memo',
        status: 'open',
        startAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0, 0).toISOString(),
        endAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 0, 0).toISOString(),
        dueAt: null,
        createdAt: new Date(now.getTime() - 1000).toISOString(),
        source: 'manual',
        type: 'memo',
        segment: 'academy_director_console',
        visibilityRoles: ['director']
      });

      // Task 2: startAt at 10:00 today (Should be first)
      window.stateStore.db.todayTasks.push({
        id: 'T_start_10',
        title: '시작 10시 업무',
        priority: 'urgent', // urgent priority but should be sorted strictly by time first!
        category: 'check',
        status: 'open',
        startAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0).toISOString(),
        endAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 0, 0).toISOString(),
        dueAt: null,
        createdAt: new Date(now.getTime() - 2000).toISOString(),
        source: 'manual',
        type: 'memo',
        segment: 'academy_director_console',
        visibilityRoles: ['director']
      });

      // Task 3: no startAt, dueAt at 16:00 today (Should be third)
      window.stateStore.db.todayTasks.push({
        id: 'T_due_16',
        title: '마감 16시 업무',
        priority: 'today',
        category: 'consult',
        status: 'open',
        startAt: null,
        dueAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 0, 0).toISOString(),
        createdAt: new Date(now.getTime() - 3000).toISOString(),
        source: 'manual',
        type: 'memo',
        segment: 'academy_director_console',
        visibilityRoles: ['director']
      });

      // Task 4: no startAt, no dueAt (Should be last/fifth)
      window.stateStore.db.todayTasks.push({
        id: 'T_no_time',
        title: '시간 없는 업무',
        priority: 'info',
        category: 'memo',
        status: 'open',
        startAt: null,
        dueAt: null,
        createdAt: new Date(now.getTime() - 4000).toISOString(),
        source: 'manual',
        type: 'memo',
        segment: 'academy_director_console',
        visibilityRoles: ['director']
      });

      // Task 5: startAt at 10:00 tomorrow (Should be fourth)
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      window.stateStore.db.todayTasks.push({
        id: 'T_start_tomorrow_10',
        title: '내일 시작 10시 업무',
        priority: 'info',
        category: 'memo',
        status: 'open',
        startAt: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 10, 0, 0).toISOString(),
        endAt: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 11, 0, 0).toISOString(),
        dueAt: null,
        createdAt: new Date(now.getTime() - 500).toISOString(),
        source: 'manual',
        type: 'memo',
        segment: 'academy_director_console',
        visibilityRoles: ['director']
      });

      // Save database changes
      window.stateStore.saveDB();
      window.stateStore.notify('TODAY_TASKS_CHANGED', window.stateStore.db.todayTasks);
    });

    // Wait for the tasks list to be populated and rendered
    await expect(page.locator('#tasks-list-container').getByText('시작 10시 업무', { exact: true })).toBeVisible();

    // 4. Assert the rendered order in #tasks-list-container
    const cardTitles = await page.locator('#tasks-list-container .glass-card').evaluateAll(cards => {
      return cards.map(card => {
        const flexWrapper = card.firstElementChild;
        if (flexWrapper && flexWrapper.children.length > 1) {
          const contentWrapper = flexWrapper.children[1];
          if (contentWrapper && contentWrapper.firstElementChild) {
            return contentWrapper.firstElementChild.textContent.trim();
          }
        }
        return '';
      });
    });

    expect(cardTitles[0]).toBe('시작 10시 업무');
    expect(cardTitles[1]).toBe('시작 14시 업무');
    expect(cardTitles[2]).toBe('마감 16시 업무');
    expect(cardTitles[3]).toBe('내일 시작 10시 업무');
    expect(cardTitles[4]).toBe('시간 없는 업무');

    // 5. Assert that the tomorrow task card shows the date prefix in card metadata
    const tomDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const mm = String(tomDate.getMonth() + 1).padStart(2, '0');
    const dd = String(tomDate.getDate()).padStart(2, '0');
    const expectedTomorrowTimeText = `${mm}-${dd} 10:00 ~ 11:00`;
    const tomorrowCard = page.locator('#tasks-list-container .glass-card:has-text("내일 시작 10시 업무")');
    await expect(tomorrowCard).toContainText(expectedTomorrowTimeText);

    // 6. Assert that the urgent task badge is still displayed correctly
    const urgentBadge = page.locator('#tasks-list-container .glass-card').filter({ hasText: '시작 10시 업무' }).filter({ hasNotText: '내일' }).locator('.badge');
    await expect(urgentBadge).toContainText('확인필요');
  });

  test('should correctly render category and provider badges in calendar chips and popover including done status', async ({ page }) => {
    // 1. Clear database tasks and events
    await page.evaluate(() => {
      window.stateStore.clearMockCalendarEvents();
      window.stateStore.db.todayTasks = [];
    });

    // 2. Add tasks with various categories, done task, system task, and a google calendar event
    await page.evaluate(() => {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      const d = now.getDate();

      const makeIso = (hour) => new Date(y, m, d, hour, 0, 0, 0).toISOString();

      // TodayTask: Memo
      window.stateStore.db.todayTasks.push({
        id: 'E2E_T_memo',
        title: 'E2E 메모 일정',
        priority: 'info',
        category: 'memo',
        status: 'open',
        startAt: makeIso(10),
        endAt: makeIso(11),
        dueAt: null,
        createdAt: new Date().toISOString(),
        source: 'manual',
        type: 'memo',
        segment: 'academy_director_console',
        visibilityRoles: ['director']
      });

      // TodayTask: Consult
      window.stateStore.db.todayTasks.push({
        id: 'E2E_T_consult',
        title: 'E2E 상담 일정',
        priority: 'today',
        category: 'consult',
        status: 'open',
        startAt: makeIso(11),
        endAt: makeIso(12),
        dueAt: null,
        createdAt: new Date().toISOString(),
        source: 'manual',
        type: 'memo',
        segment: 'academy_director_console',
        visibilityRoles: ['director']
      });

      // TodayTask: Check/Urgent (manual check -> 확인필요)
      window.stateStore.db.todayTasks.push({
        id: 'E2E_T_check',
        title: 'E2E 확인 일정',
        priority: 'urgent',
        category: 'check',
        status: 'open',
        startAt: makeIso(12),
        endAt: makeIso(13),
        dueAt: null,
        createdAt: new Date().toISOString(),
        source: 'manual',
        type: 'memo',
        segment: 'academy_director_console',
        visibilityRoles: ['director']
      });

      // TodayTask: Closing (manual closing -> 확인필요 fallback)
      window.stateStore.db.todayTasks.push({
        id: 'E2E_T_closing',
        title: 'E2E 마감 일정',
        priority: 'closing',
        category: 'closing',
        status: 'open',
        startAt: makeIso(13),
        endAt: makeIso(14),
        dueAt: null,
        createdAt: new Date().toISOString(),
        source: 'manual',
        type: 'memo',
        segment: 'academy_director_console',
        visibilityRoles: ['director']
      });

      // TodayTask: Done Consult
      window.stateStore.db.todayTasks.push({
        id: 'E2E_T_done_consult',
        title: '완료 상담 일정',
        priority: 'today',
        category: 'consult',
        status: 'done',
        completedAt: new Date().toISOString(),
        startAt: makeIso(14),
        endAt: makeIso(15),
        dueAt: null,
        createdAt: new Date().toISOString(),
        source: 'manual',
        type: 'memo',
        segment: 'academy_director_console',
        visibilityRoles: ['director']
      });

      // Mock Calendar Event: Google provider
      window.stateStore.db.mockCalendarEvents = [{
        id: 'E2E_E_google',
        externalId: 'ext_g_1',
        provider: 'google',
        calendarId: 'google_primary',
        title: '구글 외부 일정',
        description: 'Google Calendar Event',
        startsAt: makeIso(15),
        endsAt: makeIso(16)
      }];

      // TodayTask: System Check / Auto Recommendation (system source -> 추천확인)
      window.stateStore.db.todayTasks.push({
        id: 'E2E_T_system_check',
        title: 'E2E 시스템 추천 일정',
        priority: 'urgent',
        category: 'check',
        status: 'open',
        startAt: makeIso(16),
        endAt: makeIso(17),
        dueAt: null,
        createdAt: new Date().toISOString(),
        source: 'system',
        type: 'memo',
        segment: 'academy_director_console',
        visibilityRoles: ['director']
      });

      // Save database changes and notify view
      window.stateStore.saveDB();
      window.stateStore.notify('TODAY_TASKS_CHANGED', window.stateStore.db.todayTasks);
    });

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const dayCellSelector = `.calendar-day-cell[data-date="${dateStr}"]`;

    // Wait for the cell and event count indicator
    await expect(page.locator(dayCellSelector)).toBeVisible();

    // The cell should display "+N개" as there are 7 events in total (limit is 2 visible chips)
    await expect(page.locator(`${dayCellSelector} :text("+5개")`)).toBeVisible();

    // Verify the visible event chips labels
    const firstChip = page.locator(`${dayCellSelector} .calendar-event-chip`).nth(0);
    const secondChip = page.locator(`${dayCellSelector} .calendar-event-chip`).nth(1);

    await expect(firstChip).toContainText('메모');
    await expect(firstChip).toContainText('E2E 메모 일정');
    await expect(secondChip).toContainText('상담예약');
    await expect(secondChip).toContainText('E2E 상담 일정');

    // Verify chip style constraints to avoid overflow
    const chipStyle = await firstChip.getAttribute('style');
    expect(chipStyle).toContain('box-sizing: border-box');
    expect(chipStyle).toContain('width: 100%');

    // Click the day cell to open the popover list of all 7 events
    await page.locator(dayCellSelector).click();
    const popover = page.locator('#calendar-popover-container');
    await expect(popover).toBeVisible();

    // Verify popover items titles and category/provider labels
    const popoverItems = page.locator('#calendar-popover-body .popover-event-item');
    await expect(popoverItems).toHaveCount(7);

    // E2E 메모 일정
    const item0 = popoverItems.nth(0);
    await expect(item0).toContainText('메모');
    await expect(item0).toContainText('E2E 메모 일정');

    // E2E 상담 일정
    const item1 = popoverItems.nth(1);
    await expect(item1).toContainText('상담예약');
    await expect(item1).toContainText('E2E 상담 일정');

    // E2E 확인 일정
    const item2 = popoverItems.nth(2);
    await expect(item2).toContainText('확인필요');
    await expect(item2).toContainText('E2E 확인 일정');

    // E2E 마감 일정 (closing maps to 확인필요)
    const item3 = popoverItems.nth(3);
    await expect(item3).toContainText('확인필요');
    await expect(item3).toContainText('E2E 마감 일정');

    // 완료 상담 일정
    const item4 = popoverItems.nth(4);
    await expect(item4).toContainText('상담예약');
    await expect(item4).toContainText('완료 상담 일정');
    await expect(item4.locator('.fa-check')).toBeVisible(); // Done check icon should be present

    // 구글 외부 일정
    const item5 = popoverItems.nth(5);
    await expect(item5).toContainText('Google');
    await expect(item5).toContainText('구글 외부 일정');
    await expect(item5).toContainText('Google 캘린더'); // sourceBadge label

    // E2E 시스템 추천 일정 (system source -> 추천확인)
    const item6 = popoverItems.nth(6);
    await expect(item6).toContainText('추천확인');
    await expect(item6).toContainText('E2E 시스템 추천 일정');
  });

  test('should not overflow calendar event chip on small viewport', async ({ page }) => {
    // 1. Set viewport to small size (e.g. 390x844)
    await page.setViewportSize({ width: 390, height: 844 });

    // 2. Clear and add a single task with an extremely long title for today
    await page.evaluate(() => {
      window.stateStore.clearMockCalendarEvents();
      window.stateStore.db.todayTasks = [];
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 30, 0).toISOString();
      
      window.stateStore.addTodayTask({
        title: '엄청나게매우매우아주긴제목의일정을테스트하여작은화면에서오버플로우가발생하는지강제적으로검증하는더미데이터',
        description: '설명글',
        status: 'open',
        priority: 'today',
        category: 'consult',
        startAt: start,
        endAt: end,
        dueAt: start,
        source: 'manual',
        type: 'memo',
        segment: 'academy_director_console',
        domain: 'academy',
        visibilityRoles: ['director']
      });
    });

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const dayCellSelector = `.calendar-day-cell[data-date="${dateStr}"]`;

    // Wait for the cell and chip to be visible
    const cell = page.locator(dayCellSelector);
    await expect(cell).toBeVisible();
    
    const chip = cell.locator('.calendar-event-chip').first();
    await expect(chip).toBeVisible();

    // 3. Compare bounding boxes to verify chip does not overflow parent cell horizontally
    const cellBox = await cell.boundingBox();
    const chipBox = await chip.boundingBox();

    expect(cellBox).not.toBeNull();
    expect(chipBox).not.toBeNull();

    // The right edge of the chip must be less than or equal to the right edge of the cell.
    const cellRight = cellBox.x + cellBox.width;
    const chipRight = chipBox.x + chipBox.width;

    expect(chipRight).toBeLessThanOrEqual(cellRight + 1);
  });

    // Note: 교재 관련 워닝 및 결제 추천 기능은 Phase 13E 대상이므로 이 테스트에서는 제외됨.
  test('should display system recommendations on console load, prevent duplicate generation, and support auto-resolution', async ({ page }) => {
    // 1. Seed base data to trigger recommendations
    await page.evaluate(() => {
      window.stateStore.clearMockCalendarEvents();
      window.stateStore.db.todayTasks = [];
      window.stateStore.db.scheduleSnapshots = [];
      window.stateStore.db.scheduleOverrides = [];
      
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      const d = now.getDate();
      const currentMonth = `${y}-${String(m + 1).padStart(2, '0')}`;

      // Set test student with dueDay today/past (1st)
      window.stateStore.db.students = [
        { id: 'S_E2E_REC', name: '김추천', dueDay: 1, fee: 150000, academyId: 'AC1', teacherId: 'T8', instrument: '피아노' }
      ];

      // Set classes for all operational days so today matches regardless of actual day
      const days = ['월', '화', '수', '목', '금', '토'];
      const classHour = (now.getHours() - 2 + 24) % 24;
      const classMin = now.getMinutes();
      const classTimeStr = `${String(classHour).padStart(2, '0')}:${String(classMin).padStart(2, '0')}`;

      window.stateStore.db.classes = days.map((day, index) => ({
        id: `C_E2E_REC_${index}`,
        studentId: 'S_E2E_REC',
        dayOfWeek: day,
        time: classTimeStr
      }));

      // Set unpaid billing
      window.stateStore.db.payments = [
        { id: 'P_E2E_REC', studentId: 'S_E2E_REC', amount: 150000, month: currentMonth, type: 'education', status: 'unpaid', invoiceDate: `${currentMonth}-01` }
      ];

      window.stateStore.db.attendance = [];
      window.stateStore.saveDB();
    });

    // 2. Reload console to trigger sync recommendations in view
    await page.reload();
    await page.locator('.menu-item[data-view="dir-today-console"]').click();
    await expect(page.locator('#page-title')).toContainText('오늘 원장 콘솔');

    // 3. Verify recommendations are displayed in tasks list
    const testNow = new Date();
    const billingTitle = `[미수납] 김추천 원생 ${testNow.getFullYear()}년 ${testNow.getMonth() + 1}월 수강료`;
    const attendanceTitle = '김추천 원생 결석 확인 필요';

    await expect(page.locator(`#tasks-list-container :text("${billingTitle}")`)).toBeVisible();
    await expect(page.locator(`#tasks-list-container :text("${attendanceTitle}")`)).toBeVisible();

    // Verify recommendations have "추천확인" badge
    const billingCard = page.locator(`#tasks-list-container .glass-card:has-text("${billingTitle}")`);
    await expect(billingCard.locator('.badge')).toContainText('추천확인');

    const attendanceCard = page.locator(`#tasks-list-container .glass-card:has-text("${attendanceTitle}")`);
    await expect(attendanceCard.locator('.badge')).toContainText('추천확인');

    // 4. Verify no duplicates exist in state store after page reload (re-render)
    const taskCountInStore = await page.evaluate(() => {
      return window.stateStore.getTodayTasks().length;
    });
    expect(taskCountInStore).toBe(2);

    // 5. Verify auto-resolution of billing recommendation when paid
    await page.evaluate(() => {
      // Pay invoice via public API
      window.stateStore.payInvoice('P_E2E_REC', 'card');
    });

    // Reload again to sync status
    await page.reload();
    await page.locator('.menu-item[data-view="dir-today-console"]').click();

    // Verify billing task is now resolved and disappears from active queue
    await expect(page.locator(`#tasks-list-container :text("${billingTitle}")`)).toBeHidden();

    // Switch to done tab
    await page.locator('.tab-btn:has-text("완료")').click();

    // Verify billing task is now resolved and shows "완료" badge on Done tab
    const resolvedBillingCard = page.locator(`#tasks-list-container .glass-card:has-text("${billingTitle}")`);
    await expect(resolvedBillingCard.locator('.badge')).toContainText('완료');
    
    // Verify Reopen action is visible instead of active actions
    await expect(resolvedBillingCard.locator('button[data-action="reopen"]')).toBeVisible();

    // Switch back to active tab
    await page.locator('.tab-btn:has-text("대기")').click();
  });

  test('should support editing and deleting manual tasks but prevent editing system recommendations', async ({ page }) => {
    // 1. Seed one manual task and one system task
    const manualTitle = '수동 메모 수정전 제목';
    const manualDesc = '수동 메모 수정전 설명';
    const systemTitle = '시스템 권장 업무';

    await page.evaluate(({ mTitle, mDesc, sTitle }) => {
      window.stateStore.clearMockCalendarEvents();
      window.stateStore.db.todayTasks = [];
      
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 0, 0).toISOString();

      // Manual Task
      window.stateStore.addTodayTask({
        id: 'task-manual-edit-e2e',
        title: mTitle,
        description: mDesc,
        status: 'open',
        priority: 'today',
        category: 'memo',
        startAt: start,
        endAt: end,
        dueAt: start,
        source: 'manual',
        type: 'memo',
        segment: 'academy_director_console',
        domain: 'academy',
        visibilityRoles: ['director']
      });

      // System Task
      window.stateStore.addTodayTask({
        id: 'task-system-edit-e2e',
        title: sTitle,
        description: '시스템이 생성한 업무 설명',
        status: 'open',
        priority: 'today',
        category: 'system_check',
        startAt: start,
        endAt: end,
        dueAt: start,
        source: 'system',
        type: 'memo',
        segment: 'academy_director_console',
        domain: 'academy',
        visibilityRoles: ['director']
      });
    }, { mTitle: manualTitle, mDesc: manualDesc, sTitle: systemTitle });

    // Reload page to reflect changes
    await page.reload();
    await page.locator('.menu-item[data-view="dir-today-console"]').click();

    const tasksList = page.locator('#tasks-list-container');
    const manualCard = tasksList.locator(`.glass-card:has-text("${manualTitle}")`);
    const systemCard = tasksList.locator(`.glass-card:has-text("${systemTitle}")`);

    // Verify initial layout is "Add Mode"
    const formTitle = page.locator('#form-add-task-title');
    await expect(formTitle).toContainText('새로운 운영 메모 / 할 일 추가');
    const addBtn = page.locator('#form-add-task button[type="submit"]');
    await expect(addBtn).toContainText('추가');
    await expect(page.locator('#btn-save-task')).toBeHidden();
    await expect(page.locator('#btn-cancel-edit')).toBeHidden();
    await expect(page.locator('#btn-delete-task')).toBeHidden();

    // 2. Click manual task card (specifically its title or click zone) to trigger Edit Mode
    await manualCard.locator('.card-title-text').click();

    // Form title switches to Edit Mode
    await expect(formTitle).toContainText('운영 메모 수정');
    await expect(page.locator('.form-edit-indicator')).toBeVisible(); // "수정 중" indicator

    // Form buttons switch
    await expect(addBtn).toBeHidden();
    const saveBtn = page.locator('#btn-save-task');
    const cancelBtn = page.locator('#btn-cancel-edit');
    const deleteBtn = page.locator('#btn-delete-task');
    
    await expect(saveBtn).toBeVisible();
    await expect(cancelBtn).toBeVisible();
    await expect(deleteBtn).toBeVisible();

    // Form inputs should be pre-populated
    await expect(page.locator('#task-content-input')).toHaveValue(`${manualTitle}\n${manualDesc}`);
    await expect(page.locator('#task-category-input')).toHaveValue('memo');

    // 3. Edit input values and submit (Save Edit)
    const updatedTitle = '수동 메모 수정후 제목';
    const updatedDesc = '수동 메모 수정후 설명';
    await page.fill('#task-content-input', `${updatedTitle}\n${updatedDesc}`);
    await page.selectOption('#task-category-input', 'consult'); // 상담예약
    await page.selectOption('#task-start-hour-input', '12'); // Change start hour to 12 (PM)
    await page.selectOption('#task-start-ampm-input', 'PM');

    await saveBtn.click();

    // Form switches back to Add Mode
    await expect(formTitle).toContainText('새로운 운영 메모 / 할 일 추가');
    await expect(addBtn).toBeVisible();
    await expect(saveBtn).toBeHidden();

    // Verify task card reflects modifications
    await expect(tasksList.locator(`.glass-card:has-text("${updatedTitle}")`)).toBeVisible();
    await expect(tasksList.locator(`.glass-card:has-text("${updatedDesc}")`)).toBeVisible();
    await expect(tasksList.locator(`.glass-card:has-text("${updatedTitle}") .badge`)).toContainText('상담예약');

    // Verify calendar event chip is still visible on the calendar
    const calendarSection = page.locator('#calendar-timeline-section');
    await expect(calendarSection.locator(`.calendar-event-chip:has-text("${updatedTitle}")`)).toBeVisible();

    // 4. Click manual card again to enter edit mode, then click Cancel
    await tasksList.locator(`.glass-card:has-text("${updatedTitle}") .card-title-text`).click();
    await expect(formTitle).toContainText('운영 메모 수정');

    // Modify text but cancel it
    await page.fill('#task-content-input', '변경을 취소할 제목\n설명');
    await cancelBtn.click();

    // Verify form resets to Add Mode and values are empty
    await expect(formTitle).toContainText('새로운 운영 메모 / 할 일 추가');
    await expect(page.locator('#task-content-input')).toHaveValue('');
    // Task title remains as updatedTitle
    await expect(tasksList.locator(`.glass-card:has-text("${updatedTitle}")`)).toBeVisible();

    // 5. Click manual card to edit mode, then click Delete (with confirmation)
    await tasksList.locator(`.glass-card:has-text("${updatedTitle}") .card-title-text`).click();
    await expect(formTitle).toContainText('운영 메모 수정');

    let dialogMessage = '';
    page.once('dialog', dialog => {
      dialogMessage = dialog.message();
      dialog.accept(); // confirms the deletion
    });

    await deleteBtn.click();

    // Verify confirm message matches exactly "이 운영 메모를 삭제할까요?"
    expect(dialogMessage).toBe('이 운영 메모를 삭제할까요?');

    // Verify form resets to Add Mode and task is deleted
    await expect(formTitle).toContainText('새로운 운영 메모 / 할 일 추가');
    await expect(tasksList.locator(`.glass-card:has-text("${updatedTitle}")`)).toBeHidden();

    // 6. Click on system check recommendation task card
    // It must NOT enter Edit Mode
    await systemCard.locator('.card-title-text').click();
    await expect(formTitle).toContainText('새로운 운영 메모 / 할 일 추가');
    await expect(addBtn).toBeVisible();
    await expect(saveBtn).toBeHidden();
  });

  test('should support editing manual task by clicking calendar chip and verify it remains on the calendar', async ({ page }) => {
    // 1. Seed a manual task for today (2026-06-03)
    const taskTitle = '캘린더칩 클릭 수정 테스트';
    await page.evaluate((title) => {
      window.stateStore.clearMockCalendarEvents();
      window.stateStore.db.todayTasks = [];
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 0, 0).toISOString();
      
      window.stateStore.addTodayTask({
        id: 'task-calendar-chip-edit-e2e',
        title: title,
        description: '설명',
        status: 'open',
        priority: 'today',
        category: 'memo',
        startAt: start,
        endAt: end,
        dueAt: start,
        source: 'manual',
        type: 'memo',
        segment: 'academy_director_console',
        domain: 'academy',
        visibilityRoles: ['director']
      });
    }, taskTitle);

    await page.reload();
    await page.locator('.menu-item[data-view="dir-today-console"]').click();

    // 2. Click calendar event chip
    const calendarSection = page.locator('#calendar-timeline-section');
    const chip = calendarSection.locator(`.calendar-event-chip:has-text("${taskTitle}")`);
    await expect(chip).toBeVisible();
    await chip.click();

    // Verify popover is visible
    const popover = page.locator('#calendar-popover-container');
    await expect(popover).toBeVisible();

    // 3. Click the popover event item to enter Edit mode
    const popoverItem = popover.locator(`.popover-event-item:has-text("${taskTitle}")`);
    await popoverItem.click();

    // Form title switches to Edit Mode
    const formTitle = page.locator('#form-add-task-title');
    await expect(formTitle).toContainText('운영 메모 수정');

    // 4. Edit title and click 수정 완료
    const updatedTitle = '캘린더칩 클릭 수정 완료제목';
    await page.fill('#task-content-input', `${updatedTitle}\n설명 수정됨`);
    await page.click('#btn-save-task');

    // Form switches back to Add Mode
    await expect(formTitle).toContainText('새로운 운영 메모 / 할 일 추가');

    // 5. Verify the edited task card in queue and chip in calendar are visible
    const tasksList = page.locator('#tasks-list-container');
    await expect(tasksList.locator(`.glass-card:has-text("${updatedTitle}")`)).toBeVisible();
    
    // Log the actual task values from the store
    const debugTask = await page.evaluate((title) => {
      return window.stateStore.getTodayTasks().find(t => t.title === title);
    }, updatedTitle);
    console.log('DEBUG_TASK_AFTER_EDIT:', JSON.stringify(debugTask, null, 2));

    await expect(calendarSection.locator(`.calendar-event-chip:has-text("${updatedTitle}")`)).toBeVisible();
  });

  test('should verify Repair-A requirements: auto-sync in edit mode, today prefix in queue, cell click cancels edit mode, and popover badge wrapping', async ({ page }) => {
    // 1. Seed manual task for today
    const taskTitle = 'Repair-A 수동업무';
    await page.evaluate((title) => {
      window.stateStore.clearMockCalendarEvents();
      window.stateStore.db.todayTasks = [];
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 0, 0).toISOString();
      
      window.stateStore.addTodayTask({
        id: 'task-repair-a-e2e',
        title: title,
        description: '설명',
        status: 'open',
        priority: 'today',
        category: 'memo',
        startAt: start,
        endAt: end,
        dueAt: start,
        source: 'manual',
        type: 'memo',
        segment: 'academy_director_console',
        domain: 'academy',
        visibilityRoles: ['director']
      });
    }, taskTitle);

    await page.reload();
    await page.locator('.menu-item[data-view="dir-today-console"]').click();

    const tasksList = page.locator('#tasks-list-container');
    const manualCard = tasksList.locator(`.glass-card:has-text("${taskTitle}")`);

    // Verification 2. Today's task date prefix should be "오늘" in the list queue
    await expect(manualCard).toContainText('오늘 10:00 ~ 11:00');
    // Verify TODAY badge is visible in the task queue card
    await expect(manualCard.locator('.badge-today:has-text("TODAY")')).toBeVisible();

    // 2. Click manual card to enter Edit Mode
    await manualCard.locator('.card-title-text').click();
    const formTitle = page.locator('#form-add-task-title');
    await expect(formTitle).toContainText('운영 메모 수정');

    // Verification 1. Auto-sync end time works in Edit Mode
    // Change start hour to 12 (PM) and AM/PM to PM
    await page.selectOption('#task-start-hour-input', '12');
    await page.selectOption('#task-start-ampm-input', 'PM');
    await page.dispatchEvent('#task-start-hour-input', 'change');

    // Verify end time is auto-updated to PM 1:00 (+1 hour)
    await expect(page.locator('#task-end-hour-input')).toHaveValue('1');
    await expect(page.locator('#task-end-ampm-input')).toHaveValue('PM');

    // Verification 3. Clicking another calendar cell cancels Edit Mode and switches to Add Mode
    const calendarSection = page.locator('#calendar-timeline-section');
    const now = new Date();
    const clickedDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;
    const cell15 = calendarSection.locator(`.calendar-day-cell[data-date="${clickedDateStr}"]`);
    
    // Click date 15 cell
    await cell15.click();

    // Verify Edit Mode is cancelled, returns to Add Mode
    await expect(formTitle).toContainText('새로운 운영 메모 / 할 일 추가');
    await expect(page.locator('#task-start-date-input')).toHaveValue(clickedDateStr);
    await expect(page.locator('#task-end-date-input')).toHaveValue(clickedDateStr);

    // Verify the original task in the database is NOT modified (retains original title and times)
    const taskInStore = await page.evaluate(() => {
      return window.stateStore.getTodayTasks().find(t => t.id === 'task-repair-a-e2e');
    });
    expect(taskInStore.title).toBe(taskTitle);

    // Verification 4. Popover badge wrapping prevention style check
    // We already have task seeded for today. Let's click the chip for 'Repair-A 수동업무' to open popover.
    const chip = calendarSection.locator(`.calendar-event-chip:has-text("${taskTitle}")`);
    await chip.click();
    const popover = page.locator('#calendar-popover-container');
    await expect(popover).toBeVisible();

    const popoverBadge = popover.locator('.popover-event-item span').first();
    const badgeStyle = await popoverBadge.getAttribute('style');
    expect(badgeStyle).toContain('white-space: nowrap');
    expect(badgeStyle).toContain('flex-shrink: 0');
  });

  test('should support restoring completed task and filtering queue by tabs', async ({ page }) => {
    // 1. Seed 3 tasks
    const mTitle = '복원 테스트용 수동';
    const sTitle = '복원 테스트용 추천';
    const dTitle = '숨김 테스트용 태스크';

    await page.evaluate(([m, s, d]) => {
      window.stateStore.clearMockCalendarEvents();
      window.stateStore.db.todayTasks = [];
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 0, 0).toISOString();
      
      // Manual
      window.stateStore.addTodayTask({
        id: 'task-restore-manual-e2e',
        title: m,
        description: '설명',
        status: 'open',
        priority: 'today',
        category: 'memo',
        startAt: start,
        endAt: end,
        dueAt: start,
        source: 'manual',
        type: 'memo',
        segment: 'academy_director_console',
        domain: 'academy',
        visibilityRoles: ['director']
      });

      // System
      window.stateStore.addTodayTask({
        id: 'task-restore-system-e2e',
        title: s,
        description: '설명',
        status: 'open',
        priority: 'today',
        category: 'system_check',
        startAt: start,
        endAt: end,
        dueAt: start,
        source: 'system',
        type: 'memo',
        segment: 'academy_director_console',
        domain: 'academy',
        visibilityRoles: ['director']
      });

      // Temporary for dismiss
      window.stateStore.addTodayTask({
        id: 'task-restore-dismiss-e2e',
        title: d,
        description: '설명',
        status: 'open',
        priority: 'info',
        category: 'memo',
        startAt: start,
        endAt: end,
        dueAt: start,
        source: 'manual',
        type: 'memo',
        segment: 'academy_director_console',
        domain: 'academy',
        visibilityRoles: ['director']
      });
    }, [mTitle, sTitle, dTitle]);

    await page.reload();
    await page.locator('.menu-item[data-view="dir-today-console"]').click();

    const tasksList = page.locator('#tasks-list-container');
    const tabActive = page.locator('.tab-btn:has-text("대기")');
    const tabDone = page.locator('.tab-btn:has-text("완료")');
    const tabHidden = page.locator('.tab-btn:has-text("제외/보류")');
    const tabAll = page.locator('.tab-btn:has-text("전체")');

    // 2. Verify all are in Active Tab by default
    await expect(tasksList.locator(`.glass-card:has-text("${mTitle}")`)).toBeVisible();
    await expect(tasksList.locator(`.glass-card:has-text("${sTitle}")`)).toBeVisible();
    await expect(tasksList.locator(`.glass-card:has-text("${dTitle}")`)).toBeVisible();

    // 3. Mark manual task done
    await tasksList.locator(`.glass-card:has-text("${mTitle}") [data-action="done"]`).click();

    // Verify it disappears from Active Tab
    await expect(tasksList.locator(`.glass-card:has-text("${mTitle}")`)).toBeHidden();

    // 4. Switch to Done Tab
    await tabDone.click();
    const manualDoneCard = tasksList.locator(`.glass-card:has-text("${mTitle}")`);
    await expect(manualDoneCard).toBeVisible();

    // 5. Click Reopen (restore) on manual Done card
    await manualDoneCard.locator('[data-action="reopen"]').click();

    // Verify it disappears from Done Tab
    await expect(tasksList.locator(`.glass-card:has-text("${mTitle}")`)).toBeHidden();

    // 6. Switch back to Active Tab and verify task is back
    await tabActive.click();
    await expect(tasksList.locator(`.glass-card:has-text("${mTitle}")`)).toBeVisible();

    // Verify calendar chip color/style is restored (no check icon or done styling)
    const calendarSection = page.locator('#calendar-timeline-section');
    const chip = calendarSection.locator(`.calendar-event-chip:has-text("${mTitle}")`);
    await expect(chip).toBeVisible();
    await expect(chip.locator('i.fa-check')).toBeHidden();

    // 7. Dismiss temporary task
    page.once('dialog', dialog => {
      dialog.accept();
    });
    await tasksList.locator(`.glass-card:has-text("${dTitle}") [data-action="dismiss"]`).click();
    await expect(tasksList.locator(`.glass-card:has-text("${dTitle}")`)).toBeHidden();

    // 8. Switch to Hidden/Pending Tab and verify it's visible
    await tabHidden.click();
    const dismissCard = tasksList.locator(`.glass-card:has-text("${dTitle}")`);
    await expect(dismissCard).toBeVisible();

    // 9. Reopen dismissed task
    await dismissCard.locator('[data-action="reopen"]').click();
    await expect(tasksList.locator(`.glass-card:has-text("${dTitle}")`)).toBeHidden();

    // Verify it's back in Active Tab
    await tabActive.click();
    await expect(tasksList.locator(`.glass-card:has-text("${dTitle}")`)).toBeVisible();

    // 10. Complete system task, restore and check system badge retention
    await tasksList.locator(`.glass-card:has-text("${sTitle}") [data-action="done"]`).click();
    await tabDone.click();
    const systemDoneCard = tasksList.locator(`.glass-card:has-text("${sTitle}")`);
    await systemDoneCard.locator('[data-action="reopen"]').click();
    
    await tabActive.click();
    const restoredSystemCard = tasksList.locator(`.glass-card:has-text("${sTitle}")`);
    await expect(restoredSystemCard).toBeVisible();
    await expect(restoredSystemCard.locator('.badge')).toContainText('추천확인');

    // 11. Switch to All Tab and verify counts & multiple states are listed
    await tabAll.click();
    // Complete manual task again to have one active, one done task
    await tabActive.click();
    await tasksList.locator(`.glass-card:has-text("${mTitle}") [data-action="done"]`).click();
    await tabAll.click();
    await expect(tasksList.locator(`.glass-card:has-text("${mTitle}")`)).toBeVisible(); // done
    await expect(tasksList.locator(`.glass-card:has-text("${sTitle}")`)).toBeVisible(); // active

    // 12. Verify scroll position preservation on tab transitions (Phase 8C-5B-Repair-A)
    // Scroll down the page by 100px
    await page.evaluate(() => window.scrollTo(0, 100));
    const initialScroll = await page.evaluate(() => window.scrollY);
    console.log('DEBUG_SCROLL_INITIAL:', initialScroll);
    
    // Switch tab to Active using evaluate to avoid Playwright auto-scroll
    await tabActive.evaluate(el => el.click());
    
    // Switch tab back to Done using evaluate to avoid Playwright auto-scroll
    await tabDone.evaluate(el => el.click());
    
    const finalScroll = await page.evaluate(() => window.scrollY);
    console.log('DEBUG_SCROLL_FINAL:', finalScroll);
    // Ensure final scroll position is close to the initial scroll position (within 2px tolerance)
    expect(Math.abs(finalScroll - initialScroll)).toBeLessThanOrEqual(2);

    // 13. Verify Phase 13H user-friendly tags and button wordings/styles
    // Check if internal values like 'billing', 'attendance', 'memo', 'staff_warning' etc. are NOT visible inside tasks-list-container
    const containerText = await tasksList.innerText();
    expect(containerText).not.toContain('billing');
    expect(containerText).not.toContain('attendance');
    expect(containerText).not.toContain('memo');
    expect(containerText).not.toContain('staff_warning');
    expect(containerText).not.toContain('book_billing');

    // Verify 제외 and text buttons in Active Tab
    await tabActive.click();
    const activeFirstCard = tasksList.locator('.glass-card').first();
    const doneTextBtn = activeFirstCard.locator('[data-action="done"]');
    await expect(doneTextBtn).toContainText('완료');
    const snoozeTextBtn = activeFirstCard.locator('[data-action="snooze"]');
    await expect(snoozeTextBtn).toContainText('보류');
    const dismissTextBtn = activeFirstCard.locator('[data-action="dismiss"]');
    await expect(dismissTextBtn).toContainText('제외');

    // Confirm that manual tasks added are shown as "직접등록 · 메모" or "상담예약 · 상담"
    // Switch to All Tab since manual task (mTitle) has been marked done and is not in Active Tab
    await tabAll.click();
    const manualCard = tasksList.locator(`.glass-card:has-text("${mTitle}")`);
    await expect(manualCard).toBeVisible();
    await expect(manualCard).toContainText('상담예약 · 상담');
  });

  test('should verify Phase 13I KPI cards ordering, labeling and 5/4 responsive layout', async ({ page }) => {
    // 1. Set full viewport size to check initial 9 cards row
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.waitForTimeout(500);

    // Expected KPI Card order and labels
    const expectedCards = [
      { id: 'memo', label: '운영메모' },
      { id: 'absent', label: '결석 확인' },
      { id: 'attendance_warning', label: '특이출결' },
      { id: 'staff_warning', label: '특이근태' },
      { id: 'billing', label: '수납확인' },
      { id: 'overdue', label: '미수납 확인' },
      { id: 'schedule', label: '일정확인' },
      { id: 'book_check', label: '교재 확인' },
      { id: 'book_billing', label: '교재 결제 확인' }
    ];

    const kpiChips = page.locator('#kpi-chips-row-container .kpi-chip-card');
    
    // Check total count (must be exactly 9 cards)
    await expect(kpiChips).toHaveCount(9);

    // Verify order and spelling/spacing of labels
    for (let i = 0; i < expectedCards.length; i++) {
      const card = kpiChips.nth(i);
      await expect(card).toHaveAttribute('data-filter-id', expectedCards[i].id);
      
      const labelText = await card.locator('span').first().innerText();
      expect(labelText.trim()).toBe(expectedCards[i].label);
    }

    // 2. Resize viewport to 1200px to trigger 5 / 4 responsive grid layout
    await page.setViewportSize({ width: 1200, height: 900 });
    
    // Wait for styling or grid rendering stability
    await page.waitForTimeout(500);

    // Get bounding boxes of all 9 KPI cards
    const boundingBoxes = [];
    for (let i = 0; i < 9; i++) {
      const box = await kpiChips.nth(i).boundingBox();
      boundingBoxes.push(box);
    }

    // Ensure all 9 cards are rendered correctly and have bounding box data
    for (const box of boundingBoxes) {
      expect(box).not.toBeNull();
    }

    // In a 5 / 4 grid layout:
    // First 5 cards (index 0~4) should be on Row 1 (same Y coordinate)
    // Next 4 cards (index 5~8) should be on Row 2 (same Y coordinate, larger than Row 1 Y coordinate)
    const row1Y = boundingBoxes[0].y;
    for (let i = 1; i < 5; i++) {
      // Allow minor rendering difference (within 2px)
      expect(Math.abs(boundingBoxes[i].y - row1Y)).toBeLessThanOrEqual(2);
    }

    const row2Y = boundingBoxes[5].y;
    expect(row2Y).toBeGreaterThan(row1Y);

    for (let i = 6; i < 9; i++) {
      expect(Math.abs(boundingBoxes[i].y - row2Y)).toBeLessThanOrEqual(2);
    }

    // Verify no overlaps in coordinate bounding boxes
    // X coordinates should be progressive on the same row
    for (let i = 0; i < 4; i++) {
      expect(boundingBoxes[i+1].x).toBeGreaterThan(boundingBoxes[i].x);
    }
    for (let i = 5; i < 8; i++) {
      expect(boundingBoxes[i+1].x).toBeGreaterThan(boundingBoxes[i].x);
    }
  });
});

