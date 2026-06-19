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

    // Address
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

    // Verify "원생 상태" select is present in default "attending" state
    const statusSelect = page.locator('#modal-student-status');
    await expect(statusSelect).toBeVisible();
    await expect(statusSelect).toHaveValue('attending');

    // Submit form (registers as attending by default)
    await page.locator('#btn-student-submit').click();
    await expect(page.locator('#common-modal')).not.toHaveClass(/show/);
    await page.waitForTimeout(400);

    // 5. Verify registered student is in list with NO status badges
    const row = page.locator('tr', { has: page.locator(`.student-name-link:has-text("${testStudentName}")`) });
    await expect(row).toBeVisible();
    await expect(row.locator('.badge-danger:has-text("퇴원")')).not.toBeVisible();
    await expect(row.locator('.badge-warning:has-text("휴원")')).not.toBeVisible();

    // 6. Click Edit button
    await row.locator('.edit-student-btn').click();
    await expect(page.locator('#common-modal')).toBeVisible();

    // Change status to "on_leave" (휴원)
    await statusSelect.selectOption('on_leave');

    // Handle confirm dialog for on_leave transition
    let dialogMessage = '';
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      console.log('Dialog popped:', dialogMessage);
      await dialog.accept();
    });

    await page.locator('#btn-student-submit').click();
    await expect(page.locator('#common-modal')).not.toHaveClass(/show/);
    await page.waitForTimeout(400);

    // Verify dialog was accepted
    expect(dialogMessage).toContain('휴원');

    // 7. Verify student list row shows [휴원] badge
    await expect(row.locator('.badge-warning:has-text("휴원")')).toBeVisible();

    // 8. Click student name to open detail modal
    await row.locator('.student-name-link').click();
    await expect(page.locator('#common-modal')).toBeVisible();

    // Verify "원생 상태" shows "휴원" in detail modal
    await expect(page.locator('#common-modal')).toContainText('원생 상태');
    await expect(page.locator('#common-modal')).toContainText('휴원');

    // Click "정보 수정하기" from details modal
    await page.locator('#btn-edit-student-from-detail').click();
    await expect(statusSelect).toBeVisible();
    await expect(statusSelect).toHaveValue('on_leave');

    // Change status back to "attending" (재원)
    await statusSelect.selectOption('attending');
    // Transition from on_leave to attending does NOT trigger confirm
    await page.locator('#btn-student-submit').click();
    await expect(page.locator('#common-modal')).not.toHaveClass(/show/);
    await page.waitForTimeout(400);

    // Verify [휴원] badge is gone
    await expect(row.locator('.badge-warning:has-text("휴원")')).not.toBeVisible();

    // 9. Now change status from attending to withdrawn (퇴원) via Edit form
    await row.locator('.edit-student-btn').click();
    await expect(page.locator('#common-modal')).toBeVisible();
    await statusSelect.selectOption('withdrawn');

    // Listen for the withdrawn confirm dialog
    let withdrawnDialogMsg = '';
    page.once('dialog', async dialog => {
      withdrawnDialogMsg = dialog.message();
      console.log('Dialog popped for withdrawn:', withdrawnDialogMsg);
      await dialog.accept();
    });

    await page.locator('#btn-student-submit').click();
    await expect(page.locator('#common-modal')).not.toHaveClass(/show/);
    await page.waitForTimeout(400);

    // Verify dialog message contained the required text
    expect(withdrawnDialogMsg).toContain('퇴원은 삭제가 아니며 기존 이력은 보존됩니다.');

    // 10. Verify that withdrawn student is not shown by default (due to 'active' filter status)
    await expect(row).not.toBeVisible();

    // Change filter status to "all" to see the withdrawn student
    await page.locator('#student-status-filter').selectOption('all');

    // Verify student is now visible and has the [퇴원] badge
    await expect(row).toBeVisible();
    await expect(row.locator('.badge-danger:has-text("퇴원")')).toBeVisible();

    // 11. Reload page to verify persistence
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Log back in if necessary
    const isAppVisible = await page.locator('#app-root').isVisible();
    if (!isAppVisible) {
      const reloadDirectorBtn = page.locator('.role-btn.director');
      await expect(reloadDirectorBtn).toBeVisible({ timeout: 5000 });
      await reloadDirectorBtn.click();
    }
    await page.locator('.menu-item[data-view="dir-students"]').click();
    
    // Change filter status to "all"
    await page.locator('#student-status-filter').selectOption('all');

    // Verify student is still visible and has the [퇴원] badge
    await expect(row).toBeVisible();
    await expect(row.locator('.badge-danger:has-text("퇴원")')).toBeVisible();

    // 12. Navigate to Dashboard View and Verify new KPI metrics
    await page.locator('.menu-item[data-view="dir-dashboard"]').click();
    await expect(page.locator('.metric-card').first()).toBeVisible();

    // Verify "재원생 수" KPI card label, values and sublabel
    const attendingCard = page.locator('.metric-card', { hasText: '재원생 수' });
    await expect(attendingCard).toBeVisible();
    await expect(attendingCard.locator('.metric-sublabel')).toContainText('휴원');
    await expect(attendingCard.locator('.metric-sublabel')).toContainText('퇴원');

    // Verify "이번 달 미납 수강료" KPI card label, values and sublabel (separated withdrawn unpaid)
    const unpaidCard = page.locator('.metric-card', { hasText: '이번 달 미납 수강료' });
    await expect(unpaidCard).toBeVisible();
    await expect(unpaidCard.locator('.metric-sublabel')).toContainText('퇴원생 미수금');

    // Verify "이번 달 납부 완료" KPI card label and sublabel (static ledger info)
    const paidCard = page.locator('.metric-card', { hasText: '이번 달 납부 완료' });
    await expect(paidCard).toBeVisible();
    await expect(paidCard.locator('.metric-sublabel')).toContainText('결제 이력 기준');

    expect(consoleErrors.length).toBe(0);
  });
});
