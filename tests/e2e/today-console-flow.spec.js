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
    
    await page.fill('#task-title-input', taskTitle);
    await page.fill('#task-desc-input', taskDesc);
    await page.selectOption('#task-priority-input', 'urgent');
    
    // Submit the form
    await page.click('#form-add-task button[type="submit"]');

    // Assert task title and description appear in the active queue
    await expect(page.locator(`text=${taskTitle}`)).toBeVisible();
    await expect(page.locator(`text=${taskDesc}`)).toBeVisible();

    // Assert inputs are cleared/reset
    await expect(page.locator('#task-title-input')).toHaveValue('');
    await expect(page.locator('#task-desc-input')).toHaveValue('');
    await expect(page.locator('#task-priority-input')).toHaveValue('today'); // resets to today

    // 2. Done Action
    // Find the card containing our task title and click its 'done' button
    const doneButton = page.locator(`.glass-card:has-text("${taskTitle}") button[data-action="done"]`);
    await doneButton.click();

    // Assert task is removed from active queue
    await expect(page.locator(`text=${taskTitle}`)).toBeHidden();

    // 3. Snooze Action
    const snoozeTitle = `Snooze 테스트 ${Date.now()}`;
    await page.fill('#task-title-input', snoozeTitle);
    await page.click('#form-add-task button[type="submit"]');
    await expect(page.locator(`text=${snoozeTitle}`)).toBeVisible();

    const snoozeButton = page.locator(`.glass-card:has-text("${snoozeTitle}") button[data-action="snooze"]`);
    await snoozeButton.click();
    await expect(page.locator(`text=${snoozeTitle}`)).toBeHidden();

    // 4. Dismiss Action
    const dismissTitle = `Dismiss 테스트 ${Date.now()}`;
    await page.fill('#task-title-input', dismissTitle);
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

    // 2. Add a task with XSS payload in title and description
    const xssTitle = `<script>alert("xss")</script> XSS Title ${Date.now()}`;
    const xssDesc = `<img src=x onerror=alert("xss-desc")> XSS Description`;

    await page.fill('#task-title-input', xssTitle);
    await page.fill('#task-desc-input', xssDesc);
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
