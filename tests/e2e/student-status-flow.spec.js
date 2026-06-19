import { test, expect } from '@playwright/test';

test.describe('Student Status Management Flow', () => {
  const testStudentName = `E2E_Status_Student_${Date.now()}`;
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.error('Browser console.error:', msg.text());
      }
    });
    page.on('pageerror', err => {
      consoleErrors.push(err.message);
      console.error('Browser pageerror:', err.message);
    });

    // Clear localStorage to ensure a clean default state
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.role-grid').waitFor({ state: 'attached', timeout: 5000 });
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.role-grid').waitFor({ state: 'attached', timeout: 5000 });
  });

  test('should manage student status from attending to on_leave and withdrawn', async ({ page }) => {
    // 1. Log in as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // 2. Navigate to Student Management Tab
    await page.locator('.menu-item[data-view="dir-students"]').click();
    await expect(page.locator('#page-title')).toContainText('원생 명부 관리');

    // 3. Click Add Student Button
    await page.locator('#btn-add-student').click();
    await expect(page.locator('#common-modal')).toBeVisible();

    // 4. Fill in basic details
    await page.locator('#modal-student-name').fill(testStudentName);
    await page.locator('#modal-student-phone-status').selectOption('none');
    await page.locator('#modal-student-parent-phone').fill('010-1234-5678');

    // Address Kakao Mocking
    await page.evaluate(() => {
      window.kakao = {
        Postcode: function(options) {
          return {
            open: () => {
              if (options && options.oncomplete) {
                options.oncomplete({
                  zonecode: '06543',
                  roadAddress: '서울시 서초구 반포동 123-4'
                });
              }
            }
          };
        }
      };
    });
    await page.locator('#btn-modal-student-address-search').click();
    await page.locator('#modal-student-address-detail').fill('101동 202호');
    await page.locator('#modal-student-address-detail').evaluate(el => {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await page.locator('#modal-student-instrument').selectOption({ index: 1 });
    await page.locator('#modal-student-teacher').selectOption({ index: 1 });
    await page.locator('#modal-student-due-day').fill('10');
    await page.locator('#modal-student-fee').fill('150000');

    // Submit form (registers as attending by default)
    await page.locator('#btn-student-submit').click();
    await expect(page.locator('#common-modal')).not.toHaveClass(/show/);
    await page.waitForTimeout(400);

    // 5. Verify registered student is in list with NO status badges
    const row = page.locator('tr', { has: page.locator(`.student-name-link:has-text("${testStudentName}")`) });
    await expect(row).toBeVisible();
    await expect(row.locator('.badge-danger:has-text("퇴원")')).not.toBeVisible();
    await expect(row.locator('.badge-warning:has-text("휴원")')).not.toBeVisible();

    // 6. Click student name link to open detail modal
    await row.locator('.student-name-link').click();
    await expect(page.locator('#common-modal')).toBeVisible();

    // 7. Click Status Change button in detail modal
    const changeStatusBtn = page.locator('#btn-change-status-from-detail');
    await expect(changeStatusBtn).toBeVisible();
    await changeStatusBtn.click();

    // Verify status change modal elements
    const statusSelect = page.locator('#modal-student-status');
    await expect(statusSelect).toBeVisible();
    await expect(statusSelect).toHaveValue('attending');

    // Change status to "on_leave" (휴원)
    await statusSelect.selectOption('on_leave');

    const leaveStartDateInput = page.locator('#modal-student-leave-start-date');
    const leaveEndDateInput = page.locator('#modal-student-leave-end-date');
    await expect(leaveStartDateInput).toBeVisible();
    await expect(leaveEndDateInput).toBeVisible();

    // 7.1. Validation test: Set end date earlier than start date
    await leaveStartDateInput.fill('2026-06-10');
    await leaveEndDateInput.fill('2026-06-05');

    let validationAlertMsg = '';
    const dateValidationDialogPromise = new Promise(resolve => {
      page.once('dialog', async dialog => {
        validationAlertMsg = dialog.message();
        await dialog.accept();
        resolve();
      });
    });

    await page.locator('#btn-status-submit').click();
    await dateValidationDialogPromise;
    expect(validationAlertMsg).toContain('휴원 종료일은 휴원 시작일보다 빠를 수 없습니다.');

    // 7.2. Set PAST dates: 2026-06-02 to 2026-06-10 (9 days)
    // (Relative to today 2026-06-19, this is in the past and should not show under "현재 휴원 기간")
    await leaveStartDateInput.fill('2026-06-02');
    await leaveEndDateInput.fill('2026-06-10');

    // Handle confirm dialog for on_leave transition
    let dialogMessage = '';
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      console.log('Dialog popped:', dialogMessage);
      await dialog.accept();
    });

    await page.locator('#btn-status-submit').click();
    await page.waitForTimeout(400);
    expect(dialogMessage).toContain('휴원');

    // Verify detail modal re-opened, and since the period is in the past,
    // "현재 휴원 기간" is NOT displayed, but "휴원 이력" IS displayed.
    const detailModal = page.locator('#common-modal');
    await expect(detailModal).toContainText('원생 상태');
    await expect(detailModal).toContainText('휴원');
    await expect(detailModal).not.toContainText('현재 휴원 기간');
    await expect(detailModal).toContainText('휴원 이력');
    await expect(detailModal).toContainText('휴원 2026-06-02 ~ 2026-06-10 (9일)');

    // 8. Register an ACTIVE leave period: 2026-06-01 to 2026-06-30 (30 days, contains today 2026-06-19)
    await changeStatusBtn.click();
    await statusSelect.selectOption('on_leave');
    await leaveStartDateInput.fill('2026-06-01');
    await leaveEndDateInput.fill('2026-06-30');

    await page.locator('#btn-status-submit').click();
    await page.waitForTimeout(400);

    // Verify detail modal now shows "현재 휴원 기간" for the active range
    await expect(detailModal).toContainText('현재 휴원 기간');
    await expect(detailModal).toContainText('휴원 2026-06-01 ~ 2026-06-30 (30일)');
    await expect(detailModal).toContainText('휴원 이력');
    await expect(detailModal).toContainText('휴원 2026-06-01 ~ 2026-06-30 (30일)');
    await expect(detailModal).toContainText('휴원 2026-06-02 ~ 2026-06-10 (9일)');

    // 9. Change status back to "attending" (재원)
    await changeStatusBtn.click();
    await statusSelect.selectOption('attending');
    await page.locator('#btn-status-submit').click();
    await page.waitForTimeout(400);

    // Verify detail modal displays both leave periods in history and no active period
    await expect(detailModal).not.toContainText('현재 휴원 기간');
    await expect(detailModal).toContainText('휴원 이력');
    await expect(detailModal).toContainText('휴원 2026-06-01 ~ 2026-06-30 (30일)');
    await expect(detailModal).toContainText('휴원 2026-06-02 ~ 2026-06-10 (9일)');

    // 10. Register a FUTURE period: 2026-07-15 to 2026-07-25 (11 days)
    await changeStatusBtn.click();
    await statusSelect.selectOption('on_leave');
    await leaveStartDateInput.fill('2026-07-15');
    await leaveEndDateInput.fill('2026-07-25');

    let dialogMessageFuture = '';
    page.once('dialog', async dialog => {
      dialogMessageFuture = dialog.message();
      await dialog.accept();
    });

    await page.locator('#btn-status-submit').click();
    await page.waitForTimeout(400);
    expect(dialogMessageFuture).toContain('휴원');

    // Verify detail modal:
    // Today is 2026-06-19. This matches the 2026-06-01 ~ 2026-06-30 period, so "현재 휴원 기간" is shown for that period.
    // The future period is only listed in the history list.
    await expect(detailModal).toContainText('현재 휴원 기간');
    await expect(detailModal).toContainText('휴원 2026-06-01 ~ 2026-06-30 (30일)');
    await expect(detailModal).toContainText('휴원 이력');
    await expect(detailModal).toContainText('휴원 2026-07-15 ~ 2026-07-25 (11일)');
    await expect(detailModal).toContainText('휴원 2026-06-02 ~ 2026-06-10 (9일)');
    await expect(detailModal).toContainText('휴원 2026-06-01 ~ 2026-06-30 (30일)');

    // 11. Change status to "withdrawn" (퇴원)
    await changeStatusBtn.click();
    await statusSelect.selectOption('withdrawn');

    const withdrawalDateInput = page.locator('#modal-student-withdrawal-date');
    await expect(withdrawalDateInput).toBeVisible();
    await withdrawalDateInput.fill('2026-08-01');

    let withdrawnDialogMsg = '';
    page.once('dialog', async dialog => {
      withdrawnDialogMsg = dialog.message();
      await dialog.accept();
    });

    await page.locator('#btn-status-submit').click();
    await page.waitForTimeout(400);
    expect(withdrawnDialogMsg).toContain('퇴원은 삭제가 아니며 기존 이력은 보존됩니다.');

    // Detail modal re-opened, verify withdrawal date AND all leave history list is fully preserved!
    await expect(detailModal).toContainText('퇴원일');
    await expect(detailModal).toContainText('2026-08-01');
    await expect(detailModal).toContainText('휴원 이력');
    await expect(detailModal).toContainText('휴원 2026-07-15 ~ 2026-07-25 (11일)');
    await expect(detailModal).toContainText('휴원 2026-06-02 ~ 2026-06-10 (9일)');
    await expect(detailModal).toContainText('휴원 2026-06-01 ~ 2026-06-30 (30일)');

    // Close detail modal
    await page.locator('.modal-close').first().click();
    await expect(detailModal).not.toHaveClass(/show/);
    await page.waitForTimeout(400);

    // 12. Verify student list row status badge
    // By default (active filter), the student is not shown
    await expect(row).not.toBeVisible();

    // Change filter status to "all"
    await page.locator('#student-status-filter').selectOption('all');
    await expect(row).toBeVisible();
    await expect(row.locator('.badge-danger:has-text("퇴원")')).toBeVisible();

    // 13. Reload page to verify persistence
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const isAppVisible = await page.locator('#app-root').isVisible();
    if (!isAppVisible) {
      const reloadDirectorBtn = page.locator('.role-btn.director');
      await expect(reloadDirectorBtn).toBeVisible({ timeout: 5000 });
      await reloadDirectorBtn.click();
    }
    await page.locator('.menu-item[data-view="dir-students"]').click();
    await page.locator('#student-status-filter').selectOption('all');

    await expect(row).toBeVisible();
    await expect(row.locator('.badge-danger:has-text("퇴원")')).toBeVisible();

    // Re-verify detail modal
    await row.locator('.student-name-link').click();
    await expect(detailModal).toBeVisible();
    await expect(detailModal).toContainText('퇴원일');
    await expect(detailModal).toContainText('2026-08-01');
    await expect(detailModal).toContainText('휴원 이력');
    await expect(detailModal).toContainText('휴원 2026-07-15 ~ 2026-07-25 (11일)');
    await expect(detailModal).toContainText('휴원 2026-06-02 ~ 2026-06-10 (9일)');
    await expect(detailModal).toContainText('휴원 2026-06-01 ~ 2026-06-30 (30일)');

    // Close detail modal
    await page.locator('.modal-close').first().click();

    // 14. Navigate to Dashboard and Verify KPI metrics
    await page.locator('.menu-item[data-view="dir-dashboard"]').click();
    await page.locator('.metric-card').first().waitFor({ state: 'visible', timeout: 5000 });

    const attendingCard = page.locator('.metric-card', { hasText: '재원생 수' });
    await expect(attendingCard).toBeVisible();
    await expect(attendingCard.locator('.metric-sublabel')).toContainText('휴원');
    await expect(attendingCard.locator('.metric-sublabel')).toContainText('퇴원');

    const unpaidCard = page.locator('.metric-card', { hasText: '이번 달 미납 수강료' });
    await expect(unpaidCard).toBeVisible();
    await expect(unpaidCard.locator('.metric-sublabel')).toContainText('퇴원생 미수금');

    expect(consoleErrors.length).toBe(0);
  });
});
