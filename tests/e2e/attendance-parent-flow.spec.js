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

  test('should support calendar and list view switching and display list details', async ({ page }) => {
    // 1. Log in as Parent
    const parentBtn = page.locator('#login-overlay .role-btn.student');
    await expect(parentBtn).toBeVisible({ timeout: 5000 });
    await parentBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // Inject mock parent message and attendance records for S1
    await page.evaluate(() => {
      const db = window.stateStore.db;
      db.parentMessages = [];
      db.attendance = [];
      db.settings.lateDetectionEnabled = true;

      // Link USR_PAR_DEMO to S1
      const link = db.parentStudentLinks.find(l => l.parentUserId === 'USR_PAR_DEMO' && l.studentId === 'S1');
      if (!link) {
        db.parentStudentLinks.push({ parentUserId: 'USR_PAR_DEMO', studentId: 'S1' });
      }

      // Add check-in attendance record for 2026-05-03 (May 2026 to align with calendar view)
      db.attendance.push({
        id: 'ATT_E2E_LIST_1',
        studentId: 'S1',
        date: '2026-05-03',
        status: 'present',
        time: '09:00',
        leavingTime: '18:00',
        note: '양손 연습 잘함'
      });

      // Add late check-in attendance record for 2026-05-02 (May 2026)
      db.attendance.push({
        id: 'ATT_E2E_LIST_2',
        studentId: 'S1',
        date: '2026-05-02',
        status: 'late',
        time: '14:15',
        leavingTime: '',
        note: '하원 누락됨'
      });

      // Add unread check_in parent message for 2026-05-02
      db.parentMessages.push({
        id: 'pm_unread_attendance_e2e',
        studentId: 'S1',
        parentContactId: null,
        parentSlot: null,
        recipientUserId: 'USR_PAR_DEMO',
        category: 'attendance',
        type: 'check_in',
        title: '지각 등원 안내',
        body: '최다은 원생이 지각 등원했습니다.',
        status: 'unread',
        pushRequired: false,
        pushStatus: 'not_required',
        dedupeKey: 'E2E_MSG_ATT_LIST_UNREAD',
        createdAt: '2026-05-02T14:15:00.000Z'
      });

      window.stateStore.saveDB();
      window.stateStore.notify('PARENT_MESSAGES_CHANGED');
    });

    // Navigate to Attendance View
    const parentAttendanceTab = page.locator('.menu-item[data-view="stu-calendar"]');
    await expect(parentAttendanceTab).toBeVisible();

    // Verify sidebar menu unread badge
    const menuBadge = parentAttendanceTab.locator('.parent-menu-badge');
    await expect(menuBadge).toBeVisible();
    await expect(menuBadge).toHaveText('1');

    await parentAttendanceTab.click();

    // Verify view mode tabs are present
    const btnCal = page.locator('#btn-view-calendar');
    const btnList = page.locator('#btn-view-list');
    await expect(btnCal).toBeVisible();
    await expect(btnList).toBeVisible();

    // Verify Tab is above KPI metrics grid (calendar view)
    const calTabBox = await btnCal.boundingBox();
    const metricsGrid = page.locator('.metrics-grid');
    const metricsGridBox = await metricsGrid.boundingBox();
    expect(calTabBox.y).toBeLessThan(metricsGridBox.y);

    // Verify KPI cards are visible (initially in calendar view)
    await expect(metricsGrid).toBeVisible();
    await expect(metricsGrid).toContainText('등원 완료');
    await expect(metricsGrid).toContainText('지각');
    await expect(metricsGrid).toContainText('결석');

    // [Phase 16T-1D] Verify KPI count when lateDetectionEnabled is true
    await expect(metricsGrid.locator('.metric-card', { hasText: '등원 완료' })).toContainText('1회');
    await expect(metricsGrid.locator('.metric-card', { hasText: '지각' })).toContainText('1회');

    // Verify unread badge count on list tab button is visible
    const tabBadge = btnList.locator('.parent-tab-badge');
    await expect(tabBadge).toBeVisible();
    await expect(tabBadge).toHaveText('1');

    // Toggle to list view
    await btnList.click();
    await expect(btnList).toHaveClass(/btn-primary/);
    await expect(btnCal).toHaveClass(/btn-secondary/);

    // Verify KPI cards remain visible after switching to list view
    await expect(metricsGrid).toBeVisible();

    // Verify Tab is still above KPI metrics grid in list view
    const listTabBox = await btnList.boundingBox();
    const metricsGridBoxList = await metricsGrid.boundingBox();
    expect(listTabBox.y).toBeLessThan(metricsGridBoxList.y);

    // Verify list rows are rendered
    const listTable = page.locator('[data-testid="parent-attendance-list"]');
    await expect(listTable).toBeVisible();

    // Row for 2026-05-03: present + leavingTime -> "등원 완료 / 하원 완료"
    const row1 = listTable.locator('tr.attendance-list-row', { hasText: '2026-05-03' });
    await expect(row1).toBeVisible();
    await expect(row1).toContainText('등원 완료 / 하원 완료');
    await expect(row1).toContainText('09:00');
    await expect(row1).toContainText('18:00');

    // Row for 2026-05-02: late + no leavingTime -> "지각 / 하원 기록 없음"
    const row2 = listTable.locator('tr.attendance-list-row', { hasText: '2026-05-02' });
    await expect(row2).toBeVisible();
    await expect(row2).toContainText('지각 / 하원 기록 없음');
    await expect(row2).toContainText('14:15');
    await expect(row2).toContainText('하원 기록 없음');

    // Verify unread dot next to status badge on row2
    const rowDot = row2.locator('.parent-row-red-dot');
    await expect(rowDot).toBeVisible();

    // Verify unread indicator "알림 확인 전" is NOT visible on row2
    await expect(row2.locator('text=알림 확인 전')).not.toBeVisible();

    // Verify that the message is initially unread in stateStore
    const isUnreadBefore = await page.evaluate(() => {
      const msg = window.stateStore.db.parentMessages.find(m => m.id === 'pm_unread_attendance_e2e');
      return msg ? msg.status : null;
    });
    expect(isUnreadBefore).toBe('unread');

    // Click row2 to view details and trigger read status transition
    await row2.click();
    const commonModal = page.locator('#common-modal');
    await expect(commonModal).toBeVisible();
    await expect(commonModal).toContainText('하원 기록 없음');
    
    // Verify that notes are not shown in details modal (Maintain policy)
    await expect(commonModal).not.toContainText('선생님 수업일지');
    await expect(commonModal).not.toContainText('하원 누락됨');

    // Close modal
    await commonModal.locator('[data-close-modal]').first().click();
    await expect(commonModal).not.toHaveClass(/show/);
    await page.waitForTimeout(500);

    // Verify that the message status in stateStore is updated to read
    const isUnreadAfter = await page.evaluate(() => {
      const msg = window.stateStore.db.parentMessages.find(m => m.id === 'pm_unread_attendance_e2e');
      return msg ? msg.status : null;
    });
    expect(isUnreadAfter).toBe('read');

    // Verify visual badges/dots are removed
    await expect(menuBadge).not.toBeVisible();
    await expect(tabBadge).not.toBeVisible();
    await expect(rowDot).not.toBeVisible();

    // Turn off lateDetectionEnabled and verify "지각" label disappears
    await page.evaluate(() => {
      window.stateStore.setLateDetectionEnabled(false);
    });

    // Check that row2 now shows "등원 완료 / 하원 기록 없음"
    await expect(row2).toContainText('등원 완료 / 하원 기록 없음');
    await expect(row2).not.toContainText('지각 / 하원 기록 없음');

    // Click row2 to verify modal status changes to "등원 완료 / 하원 기록 없음" without "지각"
    await row2.click();
    await expect(commonModal).toBeVisible();
    await expect(commonModal).toContainText('등원 완료 / 하원 기록 없음');
    await expect(commonModal).not.toContainText('지각');

    // Close modal
    await commonModal.locator('[data-close-modal]').first().click();
    await expect(commonModal).not.toHaveClass(/show/);
    await page.waitForTimeout(500);

    // [Phase 16T-1D] Verify KPI count merges and late card disappears when late is OFF
    await expect(metricsGrid.locator('.metric-card', { hasText: '등원 완료' })).toContainText('2회');
    await expect(metricsGrid.locator('.metric-card', { hasText: '지각' })).toBeHidden();

    // Toggle back to calendar
    await btnCal.click();
    await expect(btnCal).toHaveClass(/btn-primary/);
    await expect(page.locator('.attendance-calendar-grid')).toBeVisible();

    // Verify KPI cards are still visible after returning to calendar view
    await expect(metricsGrid).toBeVisible();

    // [Phase 16T-1D] Verify calendar legend has no "지각"
    const legendLate = page.locator('.calendar-day-status.late', { hasText: '지각' });
    await expect(legendLate).toBeHidden();

    // [Phase 16T-1D] Verify calendar cell status dot color is present (green) instead of late (orange) for 2026-05-02
    const cell02 = page.locator('.calendar-day-cell[data-date="2026-05-02"]');
    await expect(cell02.locator('.calendar-day-status')).toHaveClass(/present/);
    await expect(cell02.locator('.calendar-day-status')).not.toHaveClass(/late/);

    // [Phase 16T-1D] Verify calendar container is compact (max-width limit is applied)
    const calendarGrid = page.locator('.attendance-calendar-grid');
    const boundingBox = await calendarGrid.boundingBox();
    expect(boundingBox.width).toBeLessThanOrEqual(760);

    // Verify that "학부모 메시지함" menu is NOT visible in sidebar
    await expect(page.locator('#parent-messages-menu-item')).toBeHidden();
  });
});
