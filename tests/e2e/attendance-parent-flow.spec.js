import { test, expect } from '@playwright/test';

// NodeJS runner Date mocking to match browser mockTime
const mockTime = new Date('2026-06-03T09:00:00+09:00').getTime();
const OriginalDate = Date;
class MockDate extends OriginalDate {
  constructor(...args) {
    if (args.length === 0) {
      super(mockTime);
    } else {
      super(...args);
    }
  }
  static now() {
    return mockTime;
  }
}
global.Date = MockDate;

test.describe('Kiosk Attendance and Parent Portal Synchronization Flow', () => {
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    // Mock the date to 2026-06-03 09:00:00 KST
    await page.addInitScript(() => {
      const mockTime = new Date('2026-06-03T09:00:00+09:00').getTime();
      const OriginalDate = Date;
      class MockDate extends OriginalDate {
        constructor(...args) {
          if (args.length === 0) {
            super(mockTime);
          } else {
            super(...args);
          }
        }
        static now() {
          return mockTime;
        }
      }
      window.Date = MockDate;
      window.__DAYDAY_E2E__ = true;
    });

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
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.role-grid').waitFor({ state: 'attached', timeout: 5000 });

    // Dynamically insert class for student S1 on today's day of week to ensure attendance displays in scheduled lists
    await page.evaluate(() => {
      const daysKo = ['일', '월', '화', '수', '목', '금', '토'];
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayDayKo = daysKo[new Date(todayStr).getDay()];
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
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.role-grid').waitFor({ state: 'attached', timeout: 5000 });
  });

  test('should record attendance on Kiosk, verify in Director view, and sync to Parent Portal', async ({ page }) => {
    // 1. Log in as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });
    // Ensure the login overlay has fully disappeared before clicking menu items
    await expect(page.locator('#login-overlay')).toBeHidden({ timeout: 5000 });
 
    // 2. Navigate to Tablet Kiosk View
    const kioskMenu = page.locator('.menu-item[data-view="dir-kiosk-attendance"]');
    await expect(kioskMenu).toBeVisible();
    await kioskMenu.scrollIntoViewIfNeeded();
    await kioskMenu.evaluate(el => el.click());

    // Verify kiosk mode is active on body element
    await expect(page.locator('body')).toHaveClass(/kiosk-mode/);
    
    // Verify successful kiosk screen navigation by checking if the kiosk keypad is visible
    await expect(page.locator('.kiosk-key[data-key="1"]')).toBeVisible({ timeout: 5000 });

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

    // 8. Go to "출결 관제" View and Verify check-in row status
    const dirAttendanceMenu = page.locator('.menu-item[data-view="dir-attendance-control"]');
    await expect(dirAttendanceMenu).toBeVisible();
    await dirAttendanceMenu.scrollIntoViewIfNeeded();
    await dirAttendanceMenu.evaluate(el => el.click());
    await expect(dirAttendanceMenu).toHaveClass(/active/);

    // Get today's ISO date string
    const todayStr = new Date().toISOString().slice(0, 10);
    
    // Switch to the student-wise inquiry tab
    await page.locator('.ac-tab[data-tab="student"]').click();
    await page.waitForTimeout(450);

    // Open student inspector by clicking table row of S1 (최다은)
    await page.locator('tr[data-student-id="S1"] .student-name-text').first().click();
    const inspectorPanel = page.locator('#ac-inspector-panel');
    await expect(inspectorPanel).toHaveClass(/open/);

    // Verify today's date in mini-calendar is marked 'present'
    const todayCell = page.locator('#ac-inspector-calendar-mini .cal-cell.today');
    await expect(todayCell).toHaveClass(/present/);

    // Close inspector
    await page.locator('#ac-drawer-backdrop').click();
    await expect(inspectorPanel).not.toHaveClass(/open/);

    // 9. Logout and Login as Parent (USR_PAR_DEMO)
    const logoutBtn = page.locator('#btn-logout');
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.evaluate(el => {
      el.scrollIntoView({ block: 'center' });
      el.click();
    });

    // Wait for the login overlay to appear after logout
    const loginOverlay = page.locator('#login-overlay');
    await expect(loginOverlay).toBeVisible({ timeout: 5000 });

    const parentBtn = page.locator('#login-overlay .role-btn.student');
    await parentBtn.waitFor({ state: 'attached', timeout: 5000 });
    await expect(parentBtn).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);
    await parentBtn.evaluate(el => el.click());

    // 10. Switch to Attendance/Calendar View on Student/Parent Sidebar Menu
    const parentAttendanceTab = page.locator('.menu-item[data-view="stu-calendar"]');
    await expect(parentAttendanceTab).toBeVisible({ timeout: 10000 });
    await parentAttendanceTab.click();

    // Verify today's check-in cell on the Calendar is marked with 'present' (등원) status dot
    const calendarCell = page.locator(`.calendar-day-cell[data-date="${todayStr}"]`);
    await expect(calendarCell).toBeVisible();
    const statusDot = calendarCell.locator('.calendar-day-status');
    await expect(statusDot).toHaveClass(/present/);

    // 11. Reload page to verify persistence
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Re-login as parent if needed (usually restored automatically)
    const isAppVisible = await page.locator('.menu-item[data-view="stu-calendar"]').isVisible();
    if (!isAppVisible) {
      const reloadParentBtn = page.locator('.role-btn.student');
      await expect(reloadParentBtn).toBeVisible({ timeout: 5000 });
      await reloadParentBtn.click({ force: true });
    }

    // Navigate back to parent attendance tab
    const reloadAttendanceTab = page.locator('.menu-item[data-view="stu-calendar"]');
    await expect(reloadAttendanceTab).toBeVisible();
    await reloadAttendanceTab.click();

    // Assert today's check-in status still persists as present (등원)
    const persistedCalendarCell = page.locator(`.calendar-day-cell[data-date="${todayStr}"]`);
    await expect(persistedCalendarCell).toBeVisible();
    const persistedStatusDot = persistedCalendarCell.locator('.calendar-day-status');
    await expect(persistedStatusDot).toHaveClass(/present/);

    expect(consoleErrors.length).toBe(0);
  });
});
