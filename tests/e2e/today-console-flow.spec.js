import { test, expect } from '@playwright/test';

test.describe('Director Today Console Flow Checks', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate and enter as director
    await page.goto('/');
    await page.locator('.role-btn.director').click();
    
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

    // Assert task remains visible in the queue (as done preservation)
    await expect(page.locator(`#tasks-list-container :text("${taskTitle}")`)).toBeVisible();
    
    // Assert it now has the "완료" badge
    const badgeDone = page.locator(`#tasks-list-container .glass-card:has-text("${taskTitle}") .badge`);
    await expect(badgeDone).toContainText('완료');

    // Assert the action buttons are hidden/disabled on this card
    const cardActions = page.locator(`#tasks-list-container .glass-card:has-text("${taskTitle}") .task-action-wrapper > div`).nth(1);
    await expect(cardActions).toHaveCSS('visibility', 'hidden');

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
    await dismissButton.click();
    await expect(page.locator(`#tasks-list-container :text("${dismissTitle}")`)).toBeHidden();
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
    // 1. Enter start date
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
});

