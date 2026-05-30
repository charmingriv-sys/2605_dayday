import { test, expect } from '@playwright/test';

test.describe('Director Dashboard Flow Checks', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate and enter as director
    await page.goto('/');
    await page.locator('.role-btn.director').click();
  });

  test('should load dashboard metrics and display main features', async ({ page }) => {
    // Assert dashboard active tab content exists
    await expect(page.locator('#dashboard-content')).toBeVisible();
    
    // Wait for the loading state to disappear
    await expect(page.locator('text=화면을 구성 중입니다...')).toBeHidden({ timeout: 5000 });
    
    // Assert dashboard metrics displays cards like "총 원생" or "강사 수"
    const contentText = await page.locator('#dashboard-content').innerText();
    expect(contentText).toMatch(/(원생|강사|수납|출결)/i);
  });

  test('should load members tab and open register student modal on click', async ({ page }) => {
    // Click members management tab: data-view="dir-students"
    await page.locator('.menu-item[data-view="dir-students"]').click();
    
    // Verify list structure or title exists
    await expect(page.locator('#page-title')).toBeVisible();
    await expect(page.locator('#page-title')).toContainText('원생 명부 관리');
    
    // Assert student registration button exists and click it
    const registerBtn = page.locator('#btn-add-student');
    await expect(registerBtn).toBeVisible();
    await registerBtn.click();
    
    // Assert standard common modal opens
    await expect(page.locator('#common-modal')).toBeVisible();
    
    // Assert modal form elements are loaded (e.g. modal content area is visible and has class/id)
    await expect(page.locator('#modal-content-area')).toBeVisible();
    const modalText = await page.locator('#modal-content-area').innerText();
    expect(modalText).toMatch(/(등록|추가|원생)/i);
  });
});
