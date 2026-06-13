import { test, expect } from '@playwright/test';

test.describe('Academy Warning Policy Settings UI E2E Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.role-grid').waitFor({ state: 'attached', timeout: 5000 });
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.role-grid').waitFor({ state: 'attached', timeout: 5000 });
  });

  test('should customize, save, and reload student and teacher warning configurations', async ({ page }) => {
    // 1. Log in as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // 2. Navigate to Academy Info / Settings View
    const settingsMenu = page.locator('.menu-item[data-view="dir-academy-info"]');
    await expect(settingsMenu).toBeVisible();
    await settingsMenu.click();

    // 3. Authenticate with System Password (0000)
    const pwInput = page.locator('#academy-auth-password');
    await expect(pwInput).toBeVisible();
    await pwInput.fill('0000');
    
    const authBtn = page.locator('#btn-submit-academy-auth');
    await authBtn.click();

    // 4. Verify 6 Warning Policy Inputs are visible
    const lateCheckbox = page.locator('#acad-late-detection-enabled');
    const lateSelect = page.locator('#acad-late-threshold');
    const lateText = page.locator('#acad-late-threshold-text');

    const absenceCheckbox = page.locator('#acad-student-absence-warning-enabled');
    const absenceText = page.locator('#acad-student-absence-warning-text');

    const checkoutCheckbox = page.locator('#acad-student-checkout-missing-warning-enabled');
    const checkoutSelect = page.locator('#acad-student-checkout-missing-grace-minutes');
    const checkoutText = page.locator('#acad-student-checkout-missing-grace-minutes-text');

    const teacherLateCheckbox = page.locator('#acad-teacher-late-warning-enabled');
    const teacherLateSelect = page.locator('#acad-teacher-late-warning-grace-minutes');
    const teacherLateText = page.locator('#acad-teacher-late-warning-grace-minutes-text');

    const teacherNoShowCheckbox = page.locator('#acad-teacher-no-show-warning-enabled');
    const teacherNoShowSelect = page.locator('#acad-teacher-no-show-warning-grace-minutes');
    const teacherNoShowText = page.locator('#acad-teacher-no-show-warning-grace-minutes-text');

    const teacherCheckoutCheckbox = page.locator('#acad-teacher-checkout-missing-warning-enabled');
    const teacherCheckoutSelect = page.locator('#acad-teacher-checkout-missing-grace-minutes');
    const teacherCheckoutText = page.locator('#acad-teacher-checkout-missing-grace-minutes-text');

    // Default values check
    await expect(lateCheckbox).toBeChecked();
    await expect(lateSelect).toBeEnabled();
    await expect(lateSelect).toHaveValue('10');

    await expect(absenceCheckbox).toBeChecked();
    
    await expect(checkoutCheckbox).toBeChecked();
    await expect(checkoutSelect).toBeEnabled();
    await expect(checkoutSelect).toHaveValue('10');

    await expect(teacherLateCheckbox).toBeChecked();
    await expect(teacherLateSelect).toBeEnabled();
    await expect(teacherLateSelect).toHaveValue('5');

    await expect(teacherNoShowCheckbox).toBeChecked();
    await expect(teacherNoShowSelect).toBeEnabled();
    await expect(teacherNoShowSelect).toHaveValue('10');

    await expect(teacherCheckoutCheckbox).toBeChecked();
    await expect(teacherCheckoutSelect).toBeEnabled();
    await expect(teacherCheckoutSelect).toHaveValue('10');

    // 5. Test Checkbox ON/OFF Select Disable/Enable states
    // Toggle Student Late
    await lateCheckbox.uncheck();
    await expect(lateSelect).toBeDisabled();
    await expect(lateText).toContainText('지각판정을 사용하지 않음');
    await lateCheckbox.check();
    await expect(lateSelect).toBeEnabled();

    // Toggle Student Checkout Missing
    await checkoutCheckbox.uncheck();
    await expect(checkoutSelect).toBeDisabled();
    await expect(checkoutText).toContainText('하원누락 워닝을 사용하지 않음');
    await checkoutCheckbox.check();
    await expect(checkoutSelect).toBeEnabled();

    // Toggle Teacher Late
    await teacherLateCheckbox.uncheck();
    await expect(teacherLateSelect).toBeDisabled();
    await expect(teacherLateText).toContainText('강사 지각판정을 사용하지 않음');
    await teacherLateCheckbox.check();
    await expect(teacherLateSelect).toBeEnabled();

    // Toggle Teacher No Show
    await teacherNoShowCheckbox.uncheck();
    await expect(teacherNoShowSelect).toBeDisabled();
    await expect(teacherNoShowText).toContainText('강사 미출근 워닝을 사용하지 않음');
    await teacherNoShowCheckbox.check();
    await expect(teacherNoShowSelect).toBeEnabled();

    // Toggle Teacher Checkout Missing
    await teacherCheckoutCheckbox.uncheck();
    await expect(teacherCheckoutSelect).toBeDisabled();
    await expect(teacherCheckoutText).toContainText('강사 퇴근누락 워닝을 사용하지 않음');
    await teacherCheckoutCheckbox.check();
    await expect(teacherCheckoutSelect).toBeEnabled();

    // 6. Change values to various bounds (0m, 5m, 90m) and toggle some to OFF
    await lateSelect.selectOption('90'); // 90 min
    await absenceCheckbox.uncheck(); // OFF
    await checkoutSelect.selectOption('0'); // 0 min
    await teacherLateSelect.selectOption('90'); // 90 min
    await teacherNoShowCheckbox.uncheck(); // OFF
    await teacherCheckoutSelect.selectOption('0'); // 0 min

    // Save settings
    const saveAcademyBtn = page.locator('#academy-info-form button[type="submit"]');
    await saveAcademyBtn.click();

    // Verify toast or confirmation logic
    await page.waitForTimeout(500);

    // 7. Reload and verify settings persist in UI and stateStore database
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // Go to settings (session persists)
    await settingsMenu.click();
    await pwInput.fill('0000');
    await authBtn.click();

    // Verify UI values persisted
    await expect(lateCheckbox).toBeChecked();
    await expect(lateSelect).toHaveValue('90');

    await expect(absenceCheckbox).not.toBeChecked();

    await expect(checkoutCheckbox).toBeChecked();
    await expect(checkoutSelect).toHaveValue('0');

    await expect(teacherLateCheckbox).toBeChecked();
    await expect(teacherLateSelect).toHaveValue('90');

    await expect(teacherNoShowCheckbox).not.toBeChecked();

    await expect(teacherCheckoutCheckbox).toBeChecked();
    await expect(teacherCheckoutSelect).toHaveValue('0');

    // 8. Directly evaluate stateStore DB settings values
    const dbSettings = await page.evaluate(() => window.stateStore.db.settings);
    expect(dbSettings.lateDetectionEnabled).toBe(true);
    expect(dbSettings.lateThresholdMinutes).toBe(90);
    expect(dbSettings.studentAbsenceWarningEnabled).toBe(false);
    expect(dbSettings.studentCheckoutMissingWarningEnabled).toBe(true);
    expect(dbSettings.studentCheckoutMissingGraceMinutes).toBe(0);
    expect(dbSettings.teacherLateWarningEnabled).toBe(true);
    expect(dbSettings.teacherLateWarningGraceMinutes).toBe(90);
    expect(dbSettings.teacherNoShowWarningEnabled).toBe(false);
    expect(dbSettings.teacherNoShowWarningGraceMinutes).toBe(10); // preserved old val but disabled
    expect(dbSettings.teacherCheckoutMissingWarningEnabled).toBe(true);
    expect(dbSettings.teacherCheckoutMissingGraceMinutes).toBe(0);
  });
});
