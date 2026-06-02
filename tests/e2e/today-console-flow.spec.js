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
    await expect(page.locator(`text=${taskTitle}`)).toBeVisible();
    await expect(page.locator(`text=${taskDesc}`)).toBeVisible();

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
    await expect(page.locator(`text=${taskTitle}`)).toBeVisible();
    
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
    await expect(page.locator(`text=${snoozeTitle}`)).toBeVisible();

    // Assert category badge "상담예약" is visible on the card
    const badgeConsult = page.locator(`#tasks-list-container .glass-card:has-text("${snoozeTitle}") .badge`);
    await expect(badgeConsult).toContainText('상담예약');

    const snoozeButton = page.locator(`#tasks-list-container .glass-card:has-text("${snoozeTitle}") button[data-action="snooze"]`);
    await snoozeButton.click();
    await expect(page.locator(`text=${snoozeTitle}`)).toBeHidden();

    // 4. Dismiss Action
    const dismissTitle = `Dismiss 테스트 ${Date.now()}`;
    await page.fill('#task-content-input', dismissTitle);
    await page.click('#form-add-task button[type="submit"]');
    await expect(page.locator(`text=${dismissTitle}`)).toBeVisible();

    const dismissButton = page.locator(`#tasks-list-container .glass-card:has-text("${dismissTitle}") button[data-action="dismiss"]`);
    await dismissButton.click();
    await expect(page.locator(`text=${dismissTitle}`)).toBeHidden();
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

    // 2. Assert Calendar Skeleton Section is inside the top workspace grid
    const calendarSection = page.locator('.today-console-workspace #calendar-timeline-section');
    await expect(calendarSection).toBeVisible();
    await expect(calendarSection.locator('text=오늘 일정')).toBeVisible();

    // 3. Assert time labels are visible (e.g. 09:00, 10:00, etc.)
    await expect(calendarSection.locator('text=09:00')).toBeVisible();
    await expect(calendarSection.locator('text=10:00')).toBeVisible();
    await expect(calendarSection.locator('text=14:00')).toBeVisible();

    // 4. Assert overlay message is visible
    await expect(calendarSection.locator('#calendar-skeleton-overlay')).toBeVisible();
    await expect(calendarSection.locator('text=캘린더 일정 연동 대기')).toBeVisible();

    // 5. Assert Tasks Queue Section exists at the bottom (outside workspace, as a full-width container)
    const tasksQueue = page.locator('#tasks-queue-section');
    await expect(tasksQueue).toBeVisible();
    await expect(tasksQueue.locator('text=운영 대기 업무 (Active & Completed Queue)')).toBeVisible();
  });
});
