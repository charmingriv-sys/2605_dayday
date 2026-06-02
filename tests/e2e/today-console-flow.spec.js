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
    
    // Check start and end time are pre-populated
    const startInput = page.locator('#task-start-input');
    const endInput = page.locator('#task-end-input');
    await expect(startInput).not.toHaveValue('');
    await expect(endInput).not.toHaveValue('');

    // Change start time explicitly to "2026-06-03T10:00"
    await startInput.fill('2026-06-03T10:00');
    // End time should auto-update to "2026-06-03T11:00" (start + 1 hour)
    await expect(endInput).toHaveValue('2026-06-03T11:00');

    // Manually change end time to "2026-06-03T15:00"
    await endInput.fill('2026-06-03T15:00');

    // Change start time again to "2026-06-03T12:00"
    await startInput.fill('2026-06-03T12:00');
    // End time should NOT be overwritten (remains "2026-06-03T15:00" because it was customized)
    await expect(endInput).toHaveValue('2026-06-03T15:00');

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

    // Assert category badge "확인필요" is visible on the card
    const badgeCheck = page.locator(`.glass-card:has-text("${taskTitle}") .badge`);
    await expect(badgeCheck).toContainText('확인필요');

    // Assert inputs are cleared/reset
    await expect(page.locator('#task-content-input')).toHaveValue('');
    await expect(page.locator('#task-category-input')).toHaveValue('memo'); // resets to memo

    // 2. Done Action
    // Find the card containing our task title and click its 'done' button
    const doneButton = page.locator(`.glass-card:has-text("${taskTitle}") button[data-action="done"]`);
    await doneButton.click();

    // Assert task is removed from active queue
    await expect(page.locator(`text=${taskTitle}`)).toBeHidden();

    // 3. Snooze Action
    const snoozeTitle = `Snooze 테스트 ${Date.now()}`;
    await page.fill('#task-content-input', snoozeTitle);
    await page.selectOption('#task-category-input', 'consult'); // 상담예약
    await page.click('#form-add-task button[type="submit"]');
    await expect(page.locator(`text=${snoozeTitle}`)).toBeVisible();

    // Assert category badge "상담예약" is visible on the card
    const badgeConsult = page.locator(`.glass-card:has-text("${snoozeTitle}") .badge`);
    await expect(badgeConsult).toContainText('상담예약');

    const snoozeButton = page.locator(`.glass-card:has-text("${snoozeTitle}") button[data-action="snooze"]`);
    await snoozeButton.click();
    await expect(page.locator(`text=${snoozeTitle}`)).toBeHidden();

    // 4. Dismiss Action
    const dismissTitle = `Dismiss 테스트 ${Date.now()}`;
    await page.fill('#task-content-input', dismissTitle);
    await page.click('#form-add-task button[type="submit"]');
    await expect(page.locator(`text=${dismissTitle}`)).toBeVisible();

    const dismissButton = page.locator(`.glass-card:has-text("${dismissTitle}") button[data-action="dismiss"]`);
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
});
