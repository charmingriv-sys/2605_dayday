import { test, expect } from '@playwright/test';

test.describe('Student Registration and Persistence Flow', () => {
  const testStudentName = `E2E_Student_${Date.now()}`;
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

    // Register dialog listener to print validation errors
    page.on('dialog', async dialog => {
      console.log('--- E2E Alert dialog popped up: ---', dialog.message());
      await dialog.dismiss();
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

  test('should register a new student and persist data after page reload', async ({ page }) => {
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

    // 4. Fill in standard details
    // Basic Details
    await page.locator('#modal-student-name').fill(testStudentName);
    
    // Parent Contact details (Required format verification)
    await page.locator('#modal-student-phone-status').selectOption('none');
    await page.locator('#modal-student-parent-phone').fill('010-1234-5678');
    
    // Mock kakao Postcode to simulate address search flow properly
    await page.evaluate(() => {
      window.kakao = {
        Postcode: function(options) {
          return {
            open: () => {
              // Simulate data completion from kakao postcode service
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

    // Click address search button to populate postcode and address via mock
    await page.locator('#btn-modal-student-address-search').click();
    await page.locator('#modal-student-address-detail').fill('101동 202호');
    await page.locator('#modal-student-address-detail').evaluate(el => {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
    });

    // Select Subject and Teacher
    await page.locator('#modal-student-instrument').selectOption({ index: 1 });
    await page.locator('#modal-student-teacher').selectOption({ index: 1 });

    // Financial details
    await page.locator('#modal-student-due-day').fill('10');
    await page.locator('#modal-student-fee').fill('150000');

    // 5. Submit Form
    await page.locator('#btn-student-submit').click();

    // 6. Verify modal is closed (it takes 300ms transition for modal to hide/remove classes)
    await expect(page.locator('#common-modal')).not.toHaveClass(/show/);
    // Wait for the modal close transition and cleanup setTimeout (300ms) to complete
    await page.waitForTimeout(400);

    // 7. Verify new student is displayed in the list
    const studentCell = page.locator(`.student-name-link:has-text("${testStudentName}")`);
    await expect(studentCell).toBeVisible({ timeout: 5000 });

    // 7-1. Click student name to open detail modal
    await studentCell.click();
    await expect(page.locator('#common-modal')).toBeVisible();

    // 7-2. Verify defaultClassDuration is displayed as 50분 in detail modal
    await expect(page.locator('#common-modal')).toContainText('기본 수업시간');
    await expect(page.locator('#common-modal')).toContainText('50분');

    // 7-3. Click Edit Student button in detail modal
    await page.locator('#btn-edit-student-from-detail').click();
    
    // 7-4. Verify duration select default is 50
    const durationSelect = page.locator('#modal-student-default-class-duration');
    await expect(durationSelect).toBeVisible();
    await expect(durationSelect).toHaveValue('50');

    // 7-5. Change duration to 60
    await durationSelect.selectOption('60');

    // 7-6. Submit the form
    await page.locator('#btn-student-submit').click();
    await expect(page.locator('#common-modal')).not.toHaveClass(/show/);
    // Wait for the modal close transition and cleanup setTimeout to complete
    await page.waitForTimeout(400);

    // 7-7. Re-open detail modal to verify it was updated to 60분
    await studentCell.click();
    await expect(page.locator('#common-modal')).toBeVisible();
    await expect(page.locator('#common-modal')).toContainText('60분');

    // 7-8. Close modal to continue with reload verification
    await page.locator('#common-modal [data-close-modal]').first().click();
    await expect(page.locator('#common-modal')).not.toHaveClass(/show/);
    // Wait for the modal close transition and cleanup setTimeout to complete
    await page.waitForTimeout(400);

    // 8. Reload Page & verify persistence
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    
    // Check if user is already logged in (auto-restored from session)
    const isAppVisible = await page.locator('#app-root').isVisible();
    if (!isAppVisible) {
      // Log back in if session didn't persist automatically (should persist due to localStorage)
      const reloadDirectorBtn = page.locator('.role-btn.director');
      await expect(reloadDirectorBtn).toBeVisible({ timeout: 5000 });
      await reloadDirectorBtn.click();
    }
    await page.locator('.menu-item[data-view="dir-students"]').click();

    // Verify student is still visible in the table after reload
    const persistedStudentCell = page.locator(`.student-name-link:has-text("${testStudentName}")`);
    await expect(persistedStudentCell).toBeVisible({ timeout: 5000 });

    expect(consoleErrors.length).toBe(0);
  });
});
