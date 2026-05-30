import { test, expect } from '@playwright/test';

test.describe('Application Load Verification', () => {
  let consoleErrors = [];

  test.beforeEach(({ page }) => {
    consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      consoleErrors.push(err.message);
    });
  });

  test('should load home page successfully without console errors', async ({ page }) => {
    await page.goto('/');
    
    // Asserts page title contains DayDay or 튜링
    const title = await page.title();
    console.log('Page title loaded:', title);
    expect(title).toMatch(/(DayDay|튜링|Turing)/i);

    // Verify main app branding or landing text exists
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toMatch(/(로그인|원장|강사|학부모|출결)/i);

    // Verify no console errors occurred during page load
    if (consoleErrors.length > 0) {
      console.error('Console errors detected during page load:', consoleErrors);
    }
    expect(consoleErrors.length).toBe(0);
  });
});
