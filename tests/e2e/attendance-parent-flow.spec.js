import { test, expect } from '@playwright/test';

test.describe('Kiosk Attendance and Parent Portal Synchronization Flow', () => {
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
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Dynamically insert class for student S1 on today's day of week to ensure attendance displays in scheduled lists
    await page.evaluate(() => {
      const daysKo = ['일', '월', '화', '수', '목', '금', '토'];
      const todayDayKo = daysKo[new Date().getDay()];
      const DB_KEY = 'turing_academy_db_v3';
      const dbStr = localStorage.getItem(DB_KEY);
      if (dbStr) {
        const db = JSON.parse(dbStr);
        const exists = db.classes.some(c => c.studentId === 'S1' && c.dayOfWeek === todayDayKo);
        if (!exists) {
          db.classes.push({
            id: 'C_E2E_TEMP',
            studentId: 'S1',
            dayOfWeek: todayDayKo,
            time: '14:00'
          });
          localStorage.setItem(DB_KEY, JSON.stringify(db));
        }
      }
    });

    // Reload page to apply the injected class change
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('should record attendance on Kiosk, verify in Director view, and sync to Parent Portal', async ({ page }) => {
    // 1. Log in as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // 2. Navigate to Tablet Kiosk View
    await page.locator('.menu-item[data-view="dir-kiosk-attendance"]').click({ force: true });
    await expect(page.locator('.menu-item[data-view="dir-kiosk-attendance"]')).toHaveClass(/active/);

    // 3. Type '1111' on the keypad (matching last 4 digits of 최다은's phone: 010-9999-1111)
    const key1 = page.locator('.kiosk-key[data-key="1"]');
    await expect(key1).toBeVisible();
    await key1.click();
    await key1.click();
    await key1.click();
    await key1.click();

    // 4. Select student 최다은 (S1)
    const studentCard = page.locator('[data-testid="kiosk-student-card-S1"]');
    await expect(studentCard).toBeVisible({ timeout: 5000 });
    await studentCard.click();

    // 5. Select 등원 (Check-in)
    const checkinBtn = page.locator('[data-testid="kiosk-checkin-btn"]');
    await expect(checkinBtn).toBeVisible({ timeout: 5000 });
    await checkinBtn.click();

    // 6. Kiosk completes and resets (Wait for complete screen to show, then manually reset to bypass timeout)
    const completeResetBtn = page.locator('#kiosk-complete-reset');
    await expect(completeResetBtn).toBeVisible({ timeout: 5000 });
    await completeResetBtn.click();

    // 7. Return to Admin/Director View (Click Admin Return, Enter PIN 6990)
    const returnAdminBtn = page.locator('#kiosk-return-to-admin');
    await expect(returnAdminBtn).toBeVisible();
    await returnAdminBtn.click();

    const key0 = page.locator('.kiosk-key[data-key="0"]');

    await key0.click();
    await key0.click();
    await key0.click();
    await key0.click();

    // Wait for kiosk-mode to exit and sidebar/normal dashboard to become visible
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 5000 });

    // 8. Go to "원생 출결 종합 관리" View and Verify check-in row status
    await page.locator('.menu-item[data-view="dir-attendance"]').click({ force: true });
    await expect(page.locator('.menu-item[data-view="dir-attendance"]')).toHaveClass(/active/);

    // Get today's ISO date string
    const todayStr = new Date().toISOString().slice(0, 10);
    // Since c.time is matched and today's day of week must match the schedule:
    // S1 has classes on Mon/Wed. If today is not Mon/Wed, the Daily tab might show "no classes scheduled".
    // Therefore, let's switch to the "원생별 출결 조회" (Student Attendance) tab to find the specific student S1's attendance history.
    await page.locator('#tab-btn-student').click();
    
    // Select student S1 (최다은) from dropdown trigger
    const dropdownTrigger = page.locator('#student-selector-dropdown .custom-dropdown-trigger');
    await expect(dropdownTrigger).toBeVisible();
    await dropdownTrigger.click();

    const studentOption = page.locator('#student-options-list .student-option-item[data-id="S1"]');
    await expect(studentOption).toBeVisible();
    await studentOption.click();

    // Verify today's date row has state present (등원)
    // The student history table should contain a row for todayStr with state '등원' or present
    const attendanceRow = page.locator(`tr:has-text("${todayStr}")`);
    await expect(attendanceRow).toBeVisible();
    await expect(attendanceRow).toContainText('등원');

    // 9. Logout and Login as Parent (USR_PAR_DEMO)
    const logoutBtn = page.locator('#btn-logout');
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.evaluate(el => {
      el.scrollIntoView({ block: 'center' });
      el.click();
    });

    const parentBtn = page.locator('.role-btn.student');
    await expect(parentBtn).toBeVisible();
    await parentBtn.click({ force: true });

    // 10. Switch to Attendance Tab on Parent Portal
    // Active student is 최다은 by default (S1)
    const parentAttendanceTab = page.locator('.parent-tab-link[data-tab="attendance"]');
    await expect(parentAttendanceTab).toBeVisible();
    await parentAttendanceTab.click({ force: true });

    // Verify today's check-in records are displayed in the Parent Portal attendance history
    const parentRow = page.locator(`[data-testid="parent-attendance-row"][data-date="${todayStr}"]`);
    await expect(parentRow).toBeVisible();
    await expect(parentRow).toHaveAttribute('data-status', 'present');

    // 11. Reload page to verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Re-login as parent if needed (usually restored automatically)
    const isAppVisible = await page.locator('.parent-portal-mobile-wrapper').isVisible();
    if (!isAppVisible) {
      const reloadParentBtn = page.locator('.role-btn.student');
      await expect(reloadParentBtn).toBeVisible({ timeout: 5000 });
      await reloadParentBtn.click({ force: true });
    }

    // Navigate back to parent attendance tab
    const reloadAttendanceTab = page.locator('.parent-tab-link[data-tab="attendance"]');
    await expect(reloadAttendanceTab).toBeVisible();
    await reloadAttendanceTab.click({ force: true });

    // Assert today's check-in status still persists as present
    const persistedParentRow = page.locator(`[data-testid="parent-attendance-row"][data-date="${todayStr}"]`);
    await expect(persistedParentRow).toBeVisible();
    await expect(persistedParentRow).toHaveAttribute('data-status', 'present');

    expect(consoleErrors.length).toBe(0);
  });
});
