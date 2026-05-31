import { test, expect } from '@playwright/test';

test.describe('Director Tuition Billing and Payment Flow', () => {
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.error('Browser console.error:', msg.text());
      } else {
        console.log('Browser console.log:', msg.text());
      }
    });
    page.on('pageerror', err => {
      consoleErrors.push(err.message);
      console.error('Browser pageerror:', err.message);
    });

    // Dismiss alert dialogs gracefully
    page.on('dialog', async dialog => {
      console.log('--- E2E Alert dialog popped up: ---', dialog.message());
      await dialog.dismiss();
    });

    // Clear local storage for clean default state
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.role-grid').waitFor({ state: 'attached', timeout: 5000 });
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.role-grid').waitFor({ state: 'attached', timeout: 5000 });
  });

  test('should process an unpaid tuition payment and persist status after reload', async ({ page }) => {
    // 1. Log in as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // 2. Navigate to Billing Management Tab
    await page.locator('.menu-item[data-view="dir-payments"]').click();
    await expect(page.locator('.menu-item[data-view="dir-payments"]')).toHaveClass(/active/);

    // 3. Select Target Month '2026-05'
    const monthSelect = page.locator('#payment-month-select');
    await expect(monthSelect).toBeVisible();
    await monthSelect.selectOption('2026-05');

    // 4. Find unpaid record for '윤하은' (Payment P7, Student S22)
    const paymentRow = page.locator('[data-testid="payment-row-P7"]');
    await expect(paymentRow).toBeVisible();
    
    // Status cell should indicate unpaid status
    const statusCell = paymentRow.locator('[data-testid="payment-status-P7"]');
    await expect(statusCell).toHaveAttribute('data-status', 'unpaid');

    // 5. Trigger payment processing
    const payBtn = paymentRow.locator('.btn-pay-action[data-id="P7"]');
    await expect(payBtn).toBeVisible();
    await payBtn.click();

    // Verify modal is open
    await expect(page.locator('#common-modal')).toBeVisible();

    // 6. Perform Cash Payment simulation
    const cashPayBtn = page.locator('#modal-pay-cash');
    await expect(cashPayBtn).toBeVisible();
    await cashPayBtn.click();

    // 7. Verify status updates to paid (완납)
    await expect(page.locator('#common-modal')).not.toHaveClass(/show/);
    await expect(statusCell).toHaveAttribute('data-status', 'paid');

    // 8. Reload page to verify persistence
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Restore session if needed
    const isAppVisible = await page.locator('#app-root').isVisible();
    if (!isAppVisible) {
      const reloadDirectorBtn = page.locator('.role-btn.director');
      await expect(reloadDirectorBtn).toBeVisible({ timeout: 5000 });
      await reloadDirectorBtn.click();
    }

    // Go back to billing view
    await page.locator('.menu-item[data-view="dir-payments"]').click();
    await expect(page.locator('.menu-item[data-view="dir-payments"]')).toHaveClass(/active/);

    // Set month to 2026-05 again
    await page.locator('#payment-month-select').selectOption('2026-05');

    // Assert student '윤하은''s record persists as '완납' (status: paid)
    const persistedRow = page.locator('[data-testid="payment-row-P7"]');
    await expect(persistedRow).toBeVisible();
    const persistedStatusCell = persistedRow.locator('[data-testid="payment-status-P7"]');
    await expect(persistedStatusCell).toHaveAttribute('data-status', 'paid');

    expect(consoleErrors.length).toBe(0);
  });
});
