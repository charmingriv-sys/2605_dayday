import { test, expect } from '@playwright/test';

// Mock time for consistency (2026-06-03 09:00:00 KST)
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

test.describe('Teacher Kiosk Attendance and Director Dashboard Flow', () => {
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    // Mock the date to 2026-06-03 09:00:00 KST inside the browser
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
      }
    });
    page.on('pageerror', err => {
      consoleErrors.push(err.message);
      console.error('Browser pageerror:', err.stack || err.message);
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
  });

  test('should process teacher check-in/out on Kiosk and reflect correctly on Director Dashboard without alerts', async ({ page }) => {
    // 1. Log in as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#login-overlay')).toBeHidden({ timeout: 5000 });

    // Store initial messages length to verify no side-effects
    const initialMessagesCount = await page.evaluate(() => window.stateStore.db.messages ? window.stateStore.db.messages.length : 0);

    // 2. Navigate to Tablet Kiosk View
    const kioskMenu = page.locator('.menu-item[data-view="dir-kiosk-attendance"]');
    await expect(kioskMenu).toBeVisible();
    await kioskMenu.scrollIntoViewIfNeeded();
    await kioskMenu.evaluate(el => el.click());

    // Verify kiosk mode is active on body element
    await expect(page.locator('body')).toHaveClass(/kiosk-mode/);
    await expect(page.locator('.kiosk-key[data-key="1"]')).toBeVisible({ timeout: 5000 });

    // --- STEP 1: CHECK-IN ---
    // Type '1001' (matches 문승현 T1: '010-1111-1001')
    const key1 = page.locator('.kiosk-key[data-key="1"]');
    const key0 = page.locator('.kiosk-key[data-key="0"]');
    await key1.click();
    await key0.click();
    await key0.click();
    await key1.click();

    // Verify 문승현 (강사) card is visible
    const teacherCard = page.locator('[data-testid="kiosk-student-card-T1"]');
    await expect(teacherCard).toBeVisible({ timeout: 5000 });
    await expect(teacherCard.locator('.kiosk-student-name')).toHaveText('문승현 (강사)');
    await expect(teacherCard.locator('.kiosk-student-desc')).toHaveText('피아노 / 강사');

    // Click to check-in
    await teacherCard.click();

    // Verify check-in complete screen
    const wrapper = page.locator('#kiosk-step-wrapper');
    await expect(wrapper).toContainText('문승현 강사님');
    await expect(wrapper).toContainText('출근 확인되었습니다.');
    await expect(wrapper).toContainText('오늘도 좋은 수업 부탁드립니다.');

    // Manually reset kiosk to bypass 5s timeout
    const completeResetBtn = page.locator('#kiosk-complete-reset');
    await expect(completeResetBtn).toBeVisible({ timeout: 5000 });
    await completeResetBtn.click();
    await expect(page.locator('.kiosk-key[data-key="1"]')).toBeVisible({ timeout: 5000 });

    // Verify no toast alerts appeared and db.messages remained unchanged
    const midMessagesCount = await page.evaluate(() => window.stateStore.db.messages ? window.stateStore.db.messages.length : 0);
    expect(midMessagesCount).toBe(initialMessagesCount);
    await expect(page.locator('.kakaotalk-toast')).toHaveCount(0);

    // --- STEP 2: CHECK-OUT ---
    // Type '1001' again
    await key1.click();
    await key0.click();
    await key0.click();
    await key1.click();

    await expect(teacherCard).toBeVisible({ timeout: 5000 });
    await teacherCard.click();

    // Verify check-out complete screen
    await expect(wrapper).toContainText('문승현 강사님');
    await expect(wrapper).toContainText('퇴근 확인되었습니다.');
    await expect(wrapper).toContainText('오늘 근무가 기록되었습니다.');

    // Reset kiosk
    await completeResetBtn.click();
    await expect(page.locator('.kiosk-key[data-key="1"]')).toBeVisible({ timeout: 5000 });

    // --- STEP 3: ALREADY COMPLETED CHECK ---
    // Type '1001' a third time
    await key1.click();
    await key0.click();
    await key0.click();
    await key1.click();

    await expect(teacherCard).toBeVisible({ timeout: 5000 });
    await teacherCard.click();

    // Verify already completed screen
    await expect(wrapper).toContainText('문승현 강사님');
    await expect(wrapper).toContainText('오늘 출근과 퇴근이 이미 기록되었습니다.');

    // Reset kiosk
    await completeResetBtn.click();
    await expect(page.locator('.kiosk-key[data-key="1"]')).toBeVisible({ timeout: 5000 });

    // --- STEP 4: EXIT KIOSK AND VERIFY ON DIRECTOR DASHBOARD ---
    const returnAdminBtn = page.locator('#kiosk-return-to-admin');
    await expect(returnAdminBtn).toBeVisible();
    await returnAdminBtn.click();

    // Enter PIN '0000'
    await key0.click();
    await key0.click();
    await key0.click();
    await key0.click();

    // Wait for exit kiosk-mode
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 5000 });

    // Inject mock logs to test range calculations
    await page.evaluate(() => {
      window.stateStore.db.teacherAttendanceLogs = [
        ...window.stateStore.db.teacherAttendanceLogs,
        {
          id: 'tal_mock_1',
          teacherId: 'T1',
          date: '2026-06-01',
          checkInAt: '2026-06-01T10:00:00+09:00',
          checkOutAt: null,
          source: 'tablet_pin',
          createdAt: '2026-06-01T10:00:00+09:00',
          updatedAt: '2026-06-01T10:00:00+09:00'
        },
        {
          id: 'tal_mock_2',
          teacherId: 'T1',
          date: '2026-06-02',
          checkInAt: '2026-06-02T09:00:00+09:00',
          checkOutAt: '2026-06-02T14:30:00+09:00',
          source: 'tablet_pin',
          createdAt: '2026-06-02T09:00:00+09:00',
          updatedAt: '2026-06-02T14:30:00+09:00'
        }
      ];
      window.stateStore.saveDB();
    });

    // Navigate to "강사 근태관리" View
    const dirTeacherAttendanceMenu = page.locator('.menu-item[data-view="dir-teacher-attendance"]');
    await expect(dirTeacherAttendanceMenu).toBeVisible();
    await dirTeacherAttendanceMenu.scrollIntoViewIfNeeded();
    await dirTeacherAttendanceMenu.evaluate(el => el.click());

    // Verify KPIs (Today mode)
    await expect(page.locator('#kpi-checked-in')).toHaveText('1명'); // 오늘 출근
    await expect(page.locator('#kpi-absent')).toHaveText('7명');     // 오늘 미출근
    await expect(page.locator('#kpi-checked-out')).toHaveText('1명'); // 퇴근 완료
    await expect(page.locator('#kpi-working')).toHaveText('0명');     // 미퇴근

    // Verify 문승현 detailed row exists and has status "퇴근 완료" (Today mode)
    const row = page.locator('tr[data-testid="teacher-row-T1"]');
    await expect(row).toBeVisible();
    await expect(row.locator('td').nth(0)).toHaveText('문승현');
    await expect(row.locator('td').nth(6)).toHaveText('퇴근 완료');

    // Verify that other teachers (with 0 check-ins) are hidden from the detailed table in Today mode
    const rowT2 = page.locator('tr[data-testid="teacher-row-T2"]');
    await expect(rowT2).toHaveCount(0);

    // Verify today's summary section (Task 8: 오늘 모드에서도 강사별 근무시간은 반드시 표시되어야 합니다.)
    const summaryCard = page.locator('.glass-card:has-text("강사별 근무시간")');
    await expect(summaryCard).toBeVisible();
    const sumRowT1 = summaryCard.locator('tr[data-testid="teacher-summary-row-T1"]');
    await expect(sumRowT1).toBeVisible();
    await expect(sumRowT1.locator('td').nth(0)).toHaveText('문승현');
    await expect(sumRowT1.locator('td').nth(1)).toHaveText('피아노');
    await expect(sumRowT1.locator('td').nth(2)).toHaveText('1일');
    await expect(sumRowT1.locator('td').nth(3)).toHaveText('0분');
    await expect(sumRowT1.locator('td').nth(4)).toHaveText('평균 0분');
    await expect(sumRowT1.locator('td').nth(5)).toHaveText('미퇴근 0회');

    // Verify that other teachers (with 0 check-ins) are hidden from the summary table in Today mode
    const sumRowT2 = summaryCard.locator('tr[data-testid="teacher-summary-row-T2"]');
    await expect(sumRowT2).toHaveCount(0);

    // --- STEP 4B: VERIFY RANGE SELECTOR UX & SUMMARY SECTIONS ---
    const periodBtn = page.locator('#ta-period-btn');
    await expect(periodBtn).toBeVisible();
    await expect(page.locator('#ta-period-label')).toHaveText('오늘: 2026-06-03');

    // Toggle Period Popover
    await periodBtn.click();
    const popover = page.locator('#ta-period-popover');
    await expect(popover).toBeVisible();

    // Select "이번주" preset
    const presetWeek = popover.locator('.ta-preset-btn:has-text("이번주")');
    await expect(presetWeek).toBeVisible();
    await presetWeek.click();
    await expect(popover).toBeHidden();

    // Verify label changes (Week starts Mon Jun 1 to Sun Jun 7)
    await expect(page.locator('#ta-period-label')).toHaveText('이번주: 2026-06-01 ~ 2026-06-07');

    // Verify range KPI labels
    await expect(page.locator('#kpi-label-checked-in')).toHaveText('기간 출근');
    await expect(page.locator('#kpi-label-absent')).toHaveText('미출근');
    await expect(page.locator('#kpi-label-checked-out')).toHaveText('퇴근 완료');
    await expect(page.locator('#kpi-label-working')).toHaveText('미퇴근');

    // Verify range KPI values (3 check-ins, 53 absences, 2 check-outs, 1 missed check-out)
    await expect(page.locator('#kpi-checked-in')).toHaveText('3회');
    await expect(page.locator('#kpi-absent')).toHaveText('53회');
    await expect(page.locator('#kpi-checked-out')).toHaveText('2회');
    await expect(page.locator('#kpi-working')).toHaveText('1회');

    // Verify "강사별 근무시간" summary section for "이번주"
    await expect(sumRowT1.locator('td').nth(2)).toHaveText('3일');
    await expect(sumRowT1.locator('td').nth(3)).toHaveText('5시간 30분');
    await expect(sumRowT1.locator('td').nth(4)).toHaveText('평균 2시간 45분');
    await expect(sumRowT1.locator('td').nth(5)).toHaveText('미퇴근 1회');

    // Verify that other teachers (with 0 check-ins) are hidden from the summary table in Week mode
    await expect(summaryCard.locator('tr[data-testid="teacher-summary-row-T2"]')).toHaveCount(0);

    // Verify detailed table logs display (sorted by date desc: June 3, June 2, June 1)
    const detailedTableBody = page.locator('#teacher-attendance-table-body');
    const logsRows = detailedTableBody.locator('tr');
    await expect(logsRows).toHaveCount(3);

    // Row 1: June 3
    const rowJune3 = logsRows.nth(0);
    await expect(rowJune3.locator('td').nth(0)).toHaveText('문승현');
    await expect(rowJune3.locator('td').nth(3)).toContainText('06-03');
    await expect(rowJune3.locator('td').nth(6)).toHaveText('퇴근 완료');

    // Row 2: June 2
    const rowJune2 = logsRows.nth(1);
    await expect(rowJune2.locator('td').nth(0)).toHaveText('문승현');
    await expect(rowJune2.locator('td').nth(3)).toContainText('06-02');
    await expect(rowJune2.locator('td').nth(5)).toHaveText('5시간 30분');
    await expect(rowJune2.locator('td').nth(6)).toHaveText('퇴근 완료');

    // Row 3: June 1 (Missed check-out work hour is displayed as 0시간)
    const rowJune1 = logsRows.nth(2);
    await expect(rowJune1.locator('td').nth(0)).toHaveText('문승현');
    await expect(rowJune1.locator('td').nth(3)).toContainText('06-01');
    await expect(rowJune1.locator('td').nth(4)).toHaveText('-');
    await expect(rowJune1.locator('td').nth(5)).toHaveText('0시간'); // 정책: 미퇴근 일별 근무시간 0시간 표시
    await expect(rowJune1.locator('td').nth(6)).toHaveText('미퇴근');

    // Select "이번달" preset
    await periodBtn.click();
    const presetMonth = popover.locator('.ta-preset-btn:has-text("이번달")');
    await presetMonth.click();
    await expect(page.locator('#ta-period-label')).toHaveText('이번달: 2026-06-01 ~ 2026-06-30');

    // Select "직접선택" (Custom Range)
    await periodBtn.click();
    await popover.locator('#ta-start-date').fill('2026-06-01');
    await popover.locator('#ta-end-date').fill('2026-06-02');
    await popover.locator('#ta-custom-range-apply-btn').click();
    await expect(page.locator('#ta-period-label')).toHaveText('기간: 2026-06-01 ~ 2026-06-02');

    // Verify Custom Range KPIs (2 check-ins, 14 absences, 1 check-out, 1 missed check-out)
    await expect(page.locator('#kpi-checked-in')).toHaveText('2회');
    await expect(page.locator('#kpi-absent')).toHaveText('14회');
    await expect(page.locator('#kpi-checked-out')).toHaveText('1회');
    await expect(page.locator('#kpi-working')).toHaveText('1회');

    // Verify Custom Range summaries for 문승현
    await expect(sumRowT1.locator('td').nth(2)).toHaveText('2일');
    await expect(sumRowT1.locator('td').nth(3)).toHaveText('5시간 30분');
    await expect(sumRowT1.locator('td').nth(4)).toHaveText('평균 5시간 30분');
    await expect(sumRowT1.locator('td').nth(5)).toHaveText('미퇴근 1회');

    // Switch back to "오늘" preset for regression check
    await periodBtn.click();
    const presetToday = popover.locator('.ta-preset-btn:has-text("오늘")');
    await presetToday.click();
    await expect(page.locator('#ta-period-label')).toHaveText('오늘: 2026-06-03');

    // --- STEP 4C: VERIFY INFO TOOLTIP AND DETAILS DRAWER ---
    // 1. Verify Tooltip accessibility & content
    const tooltipContainer = page.locator('.ta-tooltip-container');
    await expect(tooltipContainer).toBeVisible();
    await expect(tooltipContainer).toHaveAttribute('title', '미퇴근 시 총 근무시간에 산정되지 않습니다.');
    await expect(tooltipContainer.locator('.ta-tooltip-text')).toHaveText('미퇴근 시 총 근무시간에 산정되지 않습니다.');

    // Trigger hover on tooltip to ensure it is styled and visible (positions below the header text)
    await tooltipContainer.hover();
    await expect(tooltipContainer.locator('.ta-tooltip-text')).toBeVisible();

    // Verify responsive behavior: on small screen (width <= 480px), custom tooltip is hidden (falls back to native title)
    await page.setViewportSize({ width: 375, height: 667 });
    await tooltipContainer.hover();
    await expect(tooltipContainer.locator('.ta-tooltip-text')).not.toBeVisible();

    // Restore viewport size
    await page.setViewportSize({ width: 1280, height: 720 });

    // 2. Open Details slide Drawer by clicking teacher name link
    await sumRowT1.locator('.ta-teacher-link').click();
    const drawer = page.locator('#ta-drawer-panel');
    await expect(drawer).toHaveClass(/open/);
    await expect(drawer).toBeVisible();

    // 3. Verify Drawer Header profile
    await expect(page.locator('#ta-drawer-name')).toHaveText('문승현');
    await expect(page.locator('#ta-drawer-phone')).toContainText('010-1111-1001');
    await expect(page.locator('#ta-drawer-instrument')).toHaveText('담당: 피아노');
    // Ensure header stats summary (duplicate stats) is removed from the DOM
    await expect(page.locator('#ta-drawer-status-summary')).toHaveCount(0);

    // 4. Verify Drawer Monthly summary cards
    await expect(page.locator('#ta-drawer-monthly-days')).toHaveText('3일');
    await expect(page.locator('#ta-drawer-monthly-hours')).toHaveText('5시간 30분');
    await expect(page.locator('#ta-drawer-monthly-avg')).toHaveText('평균 2시간 45분');
    await expect(page.locator('#ta-drawer-monthly-misses')).toHaveText('미퇴근 1회');

    // 5. Verify Monthly compact Calendar Cells
    await expect(page.locator('#ta-drawer-month-label')).toHaveText('2026년 6월');
    const calendarCells = page.locator('#ta-drawer-calendar-grid > div');
    
    // June 1: Missed check-out (Orange/Yellow layout with 0시간 display, title with detailed times, and data-state="missed")
    const cellJune1 = calendarCells.nth(0);
    await expect(cellJune1).toContainText('1');
    await expect(cellJune1).not.toContainText('→'); // Simplified UI: no Crammed timestamp arrow in cell
    await expect(cellJune1).toContainText('0시간');
    await expect(cellJune1).toHaveAttribute('data-state', 'missed');
    await expect(cellJune1).toHaveAttribute('title', /출근: 10:00 \| 퇴근 누락\(미퇴근\)/);

    // June 2: Completed checkout (Green layout with 5h 30m display, title details, and data-state="completed")
    const cellJune2 = calendarCells.nth(1);
    await expect(cellJune2).toContainText('2');
    await expect(cellJune2).not.toContainText('→'); // Simplified UI
    await expect(cellJune2).toContainText('5시간 30분');
    await expect(cellJune2).toHaveAttribute('data-state', 'completed');
    await expect(cellJune2).toHaveAttribute('title', /출근: 09:00 \| 퇴근: 14:30/);

    // June 3: Today Kiosk checkout (Green layout with 0분 display, title details, and data-state="completed")
    const cellJune3 = calendarCells.nth(2);
    await expect(cellJune3).toContainText('3');
    await expect(cellJune3).not.toContainText('→'); // Simplified UI
    await expect(cellJune3).toContainText('0분');
    await expect(cellJune3).toHaveAttribute('data-state', 'completed');
    await expect(cellJune3).toHaveAttribute('title', /출근: 09:00 \| 퇴근: 09:00/);

    // 6. Test Month Navigation (Prev month/Next month)
    await page.locator('#ta-drawer-month-prev').click();
    await expect(page.locator('#ta-drawer-month-label')).toHaveText('2026년 5월');
    await expect(page.locator('#ta-drawer-monthly-days')).toHaveText('0일');
    await expect(page.locator('#ta-drawer-monthly-hours')).toHaveText('-');
    await expect(page.locator('#ta-drawer-monthly-avg')).toHaveText('평균 -');
    await expect(page.locator('#ta-drawer-monthly-misses')).toHaveText('미퇴근 0회');

    // Restore to June
    await page.locator('#ta-drawer-month-next').click();
    await expect(page.locator('#ta-drawer-month-label')).toHaveText('2026년 6월');

    // 7. Close Drawer
    await page.locator('#ta-drawer-close').click();
    await expect(drawer).not.toHaveClass(/open/);

    // --- STEP 5: REGRESSION TEST FOR STUDENT FLOW ---
    // Go back to Kiosk mode
    const reloadKioskMenu = page.locator('.menu-item[data-view="dir-kiosk-attendance"]');
    await expect(reloadKioskMenu).toBeVisible();
    await reloadKioskMenu.scrollIntoViewIfNeeded();
    await reloadKioskMenu.evaluate(el => el.click());

    // Verify kiosk mode is active
    await expect(page.locator('body')).toHaveClass(/kiosk-mode/);
    await expect(page.locator('.kiosk-key[data-key="1"]')).toBeVisible({ timeout: 5000 });

    // Dynamically insert class for student S1 on today's day of week to ensure attendance displays
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
            id: 'C_E2E_TEMP_TATT',
            studentId: 'S1',
            dayOfWeek: todayDayKo,
            time: '14:00'
          });
          localStorage.setItem(DB_KEY, JSON.stringify(db));
        }
      }
    });

    // Enter S1's PIN '1111'
    await key1.click();
    await key1.click();
    await key1.click();
    await key1.click();

    // Select student 최다은 (S1)
    const studentCard = page.locator('[data-testid="kiosk-student-card-S1"]');
    await expect(studentCard).toBeVisible({ timeout: 5000 });
    await studentCard.click();

    // Verify it routes to step 'select-status' (normal student flow)
    const checkinBtn = page.locator('[data-testid="kiosk-checkin-btn"]');
    await expect(checkinBtn).toBeVisible({ timeout: 5000 });
    await checkinBtn.click();

    // Verify student check-in complete screen
    await expect(wrapper).toContainText('최다은 님');
    await expect(wrapper).toContainText('등원이 완료되었습니다!');

    // Reset kiosk
    await completeResetBtn.click();

    expect(consoleErrors.length).toBe(0);
  });

  test('should support editing teacher attendance logs with validation, confirm dialogue, and history updates', async ({ page }) => {
    // Remove global dialog listener to prevent conflicts
    page.removeAllListeners('dialog');

    // 1. Log in as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // Store initial messages length to verify no side-effects
    const initialMessagesCount = await page.evaluate(() => window.stateStore.db.messages ? window.stateStore.db.messages.length : 0);

    // Inject mock log
    await page.evaluate(() => {
      window.stateStore.db.teacherAttendanceLogs = [
        {
          id: 'tal_test_edit',
          teacherId: 'T1',
          date: '2026-06-02',
          checkInAt: '2026-06-02T09:00:00+09:00',
          checkOutAt: '2026-06-02T14:30:00+09:00',
          source: 'tablet_pin',
          createdAt: '2026-06-02T09:00:00+09:00',
          updatedAt: '2026-06-02T09:00:00+09:00'
        }
      ];
      window.stateStore.db.teacherAttendanceEditLogs = [];
      window.stateStore.saveDB();
    });

    // Navigate to "강사 근태관리" View
    const dirTeacherAttendanceMenu = page.locator('.menu-item[data-view="dir-teacher-attendance"]');
    await expect(dirTeacherAttendanceMenu).toBeVisible();
    await dirTeacherAttendanceMenu.scrollIntoViewIfNeeded();
    await dirTeacherAttendanceMenu.evaluate(el => el.click());

    // Switch to range selector (week) to see detailed logs for June 2
    const periodBtn = page.locator('#ta-period-btn');
    await expect(periodBtn).toBeVisible();
    await periodBtn.click();
    const popover = page.locator('#ta-period-popover');
    const presetWeek = popover.locator('.ta-preset-btn:has-text("이번주")');
    await presetWeek.click();

    // Verify row for June 2 exists
    const row = page.locator('tr[data-testid="teacher-log-row-tal_test_edit"]');
    await expect(row).toBeVisible();

    // Find and click the 수정 button
    const editBtn = row.locator('.ta-edit-btn');
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // Verify modal opened
    const modal = page.locator('.modal-overlay.show');
    await expect(modal).toBeVisible();

    // Verify neutral wording: NO "현재" in the modal
    const modalText = await modal.innerText();
    expect(modalText).not.toContain('현재');

    // Confirm cancel behavior
    // Setup confirm mock to cancel
    page.once('dialog', async dialog => {
      expect(dialog.message()).toBe('강사 근태 기록을 수정할까요?');
      await dialog.dismiss(); // 취소
    });

    // Edit time values
    await modal.locator('#ta-edit-checkin-ampm').selectOption('오전');
    await modal.locator('#ta-edit-checkin-hour').selectOption('9');
    await modal.locator('#ta-edit-checkin-minute').selectOption('17');

    await modal.locator('#ta-edit-checkout-ampm').selectOption('오후');
    await modal.locator('#ta-edit-checkout-hour').selectOption('6');
    await modal.locator('#ta-edit-checkout-minute').selectOption('43');

    // Enter note
    await modal.locator('#ta-edit-reason').fill('단말기 수정 테스트');

    // Click 저장
    await modal.locator('#ta-edit-save-btn').click();

    // Modal should remain open because we clicked cancel in confirm
    await expect(modal).toBeVisible();

    // Verify that the edit logs in db is still empty
    let editLogsCount = await page.evaluate(() => window.stateStore.db.teacherAttendanceEditLogs.length);
    expect(editLogsCount).toBe(0);

    // Confirm save behavior
    page.once('dialog', async dialog => {
      expect(dialog.message()).toBe('강사 근태 기록을 수정할까요?');
      await dialog.accept(); // 확인
    });

    await modal.locator('#ta-edit-save-btn').click();

    // Modal should close
    await expect(modal).toBeHidden();

    // Verify database checkInAt was updated locally and an edit history was created
    const log = await page.evaluate(() => window.stateStore.db.teacherAttendanceLogs.find(l => l.id === 'tal_test_edit'));
    // checkInAt should be 09:17 KST and checkOutAt should be 18:43 KST
    expect(log.checkInAt).toContain('09:17:00');
    expect(log.checkOutAt).toContain('18:43:00');

    editLogsCount = await page.evaluate(() => window.stateStore.db.teacherAttendanceEditLogs.length);
    expect(editLogsCount).toBe(1);

    const editLog = await page.evaluate(() => window.stateStore.db.teacherAttendanceEditLogs[0]);
    expect(editLog.after.checkInAt).toContain('09:17:00');
    expect(editLog.after.checkOutAt).toContain('18:43:00');

    // Verify that KPI and tables updated immediately
    // For T1 completed checkout in June 2: 09:17 ~ 18:43 is 9h 26m
    const summaryCard = page.locator('.glass-card:has-text("강사별 근무시간")');
    await expect(summaryCard).toBeVisible();
    const sumRowT1 = summaryCard.locator('tr[data-testid="teacher-summary-row-T1"]');
    await expect(sumRowT1.locator('td').nth(3)).toHaveText('9시간 26분');

    // Click T1 name to open drawer and check recent history
    await sumRowT1.locator('.ta-teacher-link').click();
    const drawer = page.locator('#ta-drawer-panel');
    await expect(drawer).toBeVisible();

    const historySection = page.locator('#ta-drawer-history-section');
    await expect(historySection).toBeVisible();
    await expect(historySection.locator('#ta-drawer-history-list')).toContainText('사유: 단말기 수정 테스트');

    // Test Validation - Edit again, set checkout time before checkin time
    // Close drawer
    await page.locator('#ta-drawer-close').click();
    
    // Open edit modal again
    await editBtn.click();
    await expect(modal).toBeVisible();

    // Uncheck "퇴근 기록 없음" if it is checked, or keep it enabled.
    // Set checkin to 11:00 AM, checkout to 10:00 AM
    await modal.locator('#ta-edit-checkin-ampm').selectOption('오전');
    await modal.locator('#ta-edit-checkin-hour').selectOption('11');
    await modal.locator('#ta-edit-checkin-minute').selectOption('00');

    await modal.locator('#ta-edit-checkout-ampm').selectOption('오전');
    await modal.locator('#ta-edit-checkout-hour').selectOption('10');
    await modal.locator('#ta-edit-checkout-minute').selectOption('00');

    // Dialog setup for validation alert
    page.once('dialog', async dialog => {
      expect(dialog.message()).toBe('퇴근시각은 출근시각 이후여야 합니다.');
      await dialog.dismiss();
    });

    await modal.locator('#ta-edit-save-btn').click();

    // Modal still open
    await expect(modal).toBeVisible();

    // Close modal via cancel
    await modal.locator('[data-close-modal]').first().click();
    await expect(modal).toBeHidden();

    // Verify messages and alerts remain unaffected
    const messagesCount = await page.evaluate(() => window.stateStore.db.messages ? window.stateStore.db.messages.length : 0);
    expect(messagesCount).toBe(initialMessagesCount);

    expect(consoleErrors.length).toBe(0);
  });

  test('should support teacher lifecycle: default active, resignation, canDelete validations, and conditional physical deletion', async ({ page }) => {
    // 1. Log in as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // 2. Verify migration: default status values of existing teachers
    const migrationCheck = await page.evaluate(() => {
      const teachers = window.stateStore.getTeachers();
      return teachers.every(t => t.employmentStatus === 'active' && t.resignedAt === null && t.resignMemo === '');
    });
    expect(migrationCheck).toBe(true);

    // 3. Verify resignTeacher API
    const resignResult = await page.evaluate(() => {
      const res = window.stateStore.resignTeacher('T2', { resignedAt: '2026-06-10', memo: '이직으로 인한 퇴사' });
      return {
        id: res.id,
        status: res.employmentStatus,
        resignedAt: res.resignedAt,
        memo: res.resignMemo
      };
    });
    expect(resignResult.id).toBe('T2');
    expect(resignResult.status).toBe('resigned');
    expect(resignResult.resignedAt).toBe('2026-06-10');
    expect(resignResult.memo).toBe('이직으로 인한 퇴사');

    // 4. Verify getActiveTeachers API
    const activeCheck = await page.evaluate(() => {
      const activeList = window.stateStore.getActiveTeachers();
      const hasT2 = activeList.some(t => t.id === 'T2');
      const hasT1 = activeList.some(t => t.id === 'T1');
      return { hasT2, hasT1, count: activeList.length };
    });
    expect(activeCheck.hasT2).toBe(false); // T2는 퇴사했으므로 active 목록에 없어야 함
    expect(activeCheck.hasT1).toBe(true);  // T1은 재직 중이므로 있어야 함

    // 5. Verify canDeleteTeacher checks for referenced data
    // Case A: T1 (has attendance logs)
    const t1Check = await page.evaluate(() => {
      // Inject attendance log to make sure T1 is referenced
      window.stateStore.db.teacherAttendanceLogs.push({
        id: 'tal_life_check',
        teacherId: 'T1',
        date: '2026-06-03',
        checkInAt: '2026-06-03T09:00:00+09:00',
        checkOutAt: null,
        source: 'tablet_pin',
        createdAt: '2026-06-03T09:00:00+09:00',
        updatedAt: '2026-06-03T09:00:00+09:00'
      });
      window.stateStore.saveDB();
      return window.stateStore.canDeleteTeacher('T1');
    });
    expect(t1Check.canDelete).toBe(false);
    expect(t1Check.reasons.length).toBeGreaterThan(0);
    expect(t1Check.reasons[0]).toContain('출퇴근 근태 기록이 존재합니다');

    // Case B: T7 (has students)
    const t7Check = await page.evaluate(() => {
      return window.stateStore.canDeleteTeacher('T7');
    });
    expect(t7Check.canDelete).toBe(false);
    expect(t7Check.reasons).toContain('해당 강사가 배정되어 있는 담당 수강생이 존재합니다.');

    // 6. Verify deleteTeacher behaves correctly (both raw deleteTeacher and deleteTeacherIfUnused)
    // Case A: Try deleting T1 (referenced) -> deletion blocked
    const t1DeleteResult = await page.evaluate(() => {
      const beforeCount = window.stateStore.getTeachers().length;
      const resUnused = window.stateStore.deleteTeacherIfUnused('T1');
      const resRaw = window.stateStore.deleteTeacher('T1');
      const afterCount = window.stateStore.getTeachers().length;
      return { resUnused, resRaw, beforeCount, afterCount };
    });
    expect(t1DeleteResult.resUnused.canDelete).toBe(false);
    expect(t1DeleteResult.resUnused.reasons.length).toBeGreaterThan(0);
    expect(t1DeleteResult.resRaw.canDelete).toBe(false);
    expect(t1DeleteResult.resRaw.success).toBe(false);
    expect(t1DeleteResult.resRaw.reasons.length).toBeGreaterThan(0);
    expect(t1DeleteResult.beforeCount).toBe(t1DeleteResult.afterCount); // 강사가 삭제되지 않고 유지되어야 함

    // Case B: Insert fresh teacher with no references -> deletion succeeds
    const newDeleteResult = await page.evaluate(() => {
      // Add a clean teacher
      window.stateStore.db.teachers.push({
        id: 'T_NEW_TEMP',
        name: '신입강사',
        instrument: '피아노',
        phone: '010-9999-9999',
        email: 'newtemp@turing.com',
        color: '#ffffff',
        scheduleNotes: "",
        employmentStatus: 'active',
        resignedAt: null,
        resignMemo: ''
      });
      window.stateStore.saveDB();

      const beforeCount = window.stateStore.getTeachers().length;
      const deleteCheck = window.stateStore.canDeleteTeacher('T_NEW_TEMP');
      const deleteRes = window.stateStore.deleteTeacher('T_NEW_TEMP');
      const afterCount = window.stateStore.getTeachers().length;
      return { deleteCheck, deleteRes, beforeCount, afterCount };
    });
    expect(newDeleteResult.deleteCheck.canDelete).toBe(true);
    expect(newDeleteResult.deleteRes.canDelete).toBe(true);
    expect(newDeleteResult.deleteRes.success).toBe(true);
    expect(newDeleteResult.afterCount).toBe(newDeleteResult.beforeCount - 1);
  });

  test('should support major schedule teacher ID normalization and todayTasks validation', async ({ page }) => {
    // 1. Log in as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // 2. Inject mock schedules (one name-based, one ID-based)
    await page.evaluate(() => {
      window.stateStore.db.majorSchedules = [
        {
          id: 'ms_name_based',
          name: '이름 기반 일정',
          type: 'event',
          eventDate: '2026-06-15',
          dueDate: null,
          ownerId: '정은비', // name-based (legacy)
          place: '원내',
          visible: false,
          participantStudentIds: []
        },
        {
          id: 'ms_id_based',
          name: 'ID 기반 일정',
          type: 'event',
          eventDate: '2026-06-20',
          dueDate: null,
          ownerId: 'T8', // ID-based (new, 'T8' is '정은비')
          place: '원내',
          visible: false,
          participantStudentIds: []
        }
      ];
      window.stateStore.db.todayTasks = [];
      window.stateStore.saveDB();
    });

    // 3. Go to 주요일정관리 view
    const menuItem = page.locator('.menu-item[data-view="dir-major-schedule"]');
    await expect(menuItem).toBeVisible();
    await menuItem.click();

    // Verify page title
    await expect(page.locator('#page-title')).toContainText('주요일정 관리');

    // 4. Verify both display "정은비" in the table
    const rowNameBased = page.locator('#eventBody tr:has-text("이름 기반 일정")');
    await expect(rowNameBased).toBeVisible();
    await expect(rowNameBased.locator('td').nth(5)).toHaveText('정은비');

    const rowIdBased = page.locator('#eventBody tr:has-text("ID 기반 일정")');
    await expect(rowIdBased).toBeVisible();
    await expect(rowIdBased.locator('td').nth(5)).toHaveText('정은비');

    // 5. Open drawer for both to verify display name
    await rowNameBased.click();
    const drawer = page.locator('#drawer');
    await expect(drawer).toHaveClass(/open/);
    await expect(drawer.locator('.detail-item:has-text("담당자") strong')).toHaveText('정은비');
    await page.locator('#btn-drawer-close').click();
    await expect(drawer).not.toHaveClass(/open/);

    await rowIdBased.click();
    await expect(drawer).toHaveClass(/open/);
    await expect(drawer.locator('.detail-item:has-text("담당자") strong')).toHaveText('정은비');
    await page.locator('#btn-drawer-close').click();
    await expect(drawer).not.toHaveClass(/open/);

    // 6. Test canDeleteTeacher checks for majorSchedules (T8 / '정은비')
    let canDeleteCheck = await page.evaluate(() => {
      return window.stateStore.canDeleteTeacher('T8');
    });
    expect(canDeleteCheck.canDelete).toBe(false);
    expect(canDeleteCheck.reasons).toContain('학원 주요 일정에 담당자로 지정되어 있습니다.');

    // 7. Add a new major schedule using the UI and make sure it saves as T8
    const addTrigger = page.locator('button:text-is("일정 추가")');
    await addTrigger.click();
    await expect(drawer).toHaveClass(/open/);

    await page.locator('#form-event-name').fill('UI 등록 일정');
    await page.locator('#form-event-type').selectOption('etc');
    await page.locator('#form-event-date').fill('2026-06-25');
    await page.locator('#form-owner-id').selectOption('정은비'); // Label is 정은비, value is T8
    await page.locator('#btn-form-save').click();
    await expect(drawer).not.toHaveClass(/open/);

    // Check database to ensure it's saved with ownerId 'T8'
    const storedSchedule = await page.evaluate(() => {
      return window.stateStore.db.majorSchedules.find(e => e.name === 'UI 등록 일정');
    });
    expect(storedSchedule.ownerId).toBe('T8');

    // 8. Test canDeleteTeacher todayTasks check
    // Inject todayTask with relatedTeacherIds: ['T8']
    await page.evaluate(() => {
      // First clean up majorSchedules so they don't block deletion
      window.stateStore.db.majorSchedules = [];
      window.stateStore.db.todayTasks.push({
        id: 'task_temp',
        title: '강사 관련 업무',
        relatedTeacherIds: ['T8']
      });
      window.stateStore.saveDB();
    });

    canDeleteCheck = await page.evaluate(() => {
      return window.stateStore.canDeleteTeacher('T8');
    });
    expect(canDeleteCheck.canDelete).toBe(false);
    expect(canDeleteCheck.reasons).toContain('업무 카드(Today Tasks)에 관련 강사로 연결되어 있습니다.');
  });

  test('should support teacher resignation and deletion validations in UI', async ({ page }) => {
    // Remove global dialog listener to prevent conflicts
    page.removeAllListeners('dialog');

    // 1. Log in as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // 2. Navigate to "강사관리" (dir-teachers)
    const staffMenu = page.locator('.menu-item[data-view="dir-teachers"]');
    await expect(staffMenu).toBeVisible();
    await staffMenu.click();

    // Verify heading is visible
    await expect(page.locator('h3:has-text("학원 등록 강사 현황")')).toBeVisible();

    // 3. Test deleting an active referenced teacher (T1: 문승현 has attendance logs)
    // Find row for 문승현
    const rowT1 = page.locator('#teachers-table-body tr:has-text("문승현")');
    await expect(rowT1).toBeVisible();

    // Click Delete button in the table row
    const deleteBtnT1 = rowT1.locator('.delete-teacher-btn');
    await deleteBtnT1.click();

    // Verify deletion blocked modal displays reasons
    const blockedModal = page.locator('.modal-overlay.show');
    await expect(blockedModal).toBeVisible();
    await expect(blockedModal.locator('.modal-title')).toContainText('강사 삭제 불가 안내');
    
    // Assert user-friendly mapped Korean sentences
    await expect(blockedModal.locator('.modal-body')).toContainText('이 강사는 기존 기록과 연결되어 있어 삭제할 수 없습니다.');
    await expect(blockedModal.locator('.modal-body')).toContainText('기록을 보존하기 위해 삭제 대신 퇴사 처리로 관리해 주세요.');
    await expect(blockedModal.locator('.modal-body')).toContainText('연결된 기록');
    await expect(blockedModal.locator('ul')).toContainText('강사 시간표에 등록된 기록이 있습니다.');
    
    // Ensure raw db tables are NOT shown
    const modalContentText = await blockedModal.innerText();
    expect(modalContentText).not.toContain('teacherAttendanceLogs');
    expect(modalContentText).not.toContain('teacherShifts');
    expect(modalContentText).not.toContain('students');
    expect(modalContentText).not.toContain('scheduleSnapshots');
    expect(modalContentText).not.toContain('scheduleOverrides');
    expect(modalContentText).not.toContain('scheduleOperationLogs');
    expect(modalContentText).not.toContain('majorSchedules');
    expect(modalContentText).not.toContain('todayTasks');

    // Click "퇴사 처리로 이동" button on the blocked modal to test transition
    const goToResignBtn = blockedModal.locator('#go-to-resign-btn');
    await expect(goToResignBtn).toBeVisible();
    await goToResignBtn.click();

    // The blocked modal should close, and the resign modal should open
    await expect(blockedModal).toBeHidden();
    const resignModal = page.locator('.modal-overlay.show');
    await expect(resignModal).toBeVisible();
    await expect(resignModal.locator('.modal-title')).toContainText('강사 퇴사 처리');

    // Close the resign modal via the Cancel button to return to the edit form flow
    await resignModal.locator('button:text-is("취소")').click();
    await expect(resignModal).toBeHidden();
    await page.waitForTimeout(500);

    // 4. Click Edit button for T1
    const editBtnT1 = rowT1.locator('.edit-teacher-btn');
    await editBtnT1.click();

    // Form title should change to "강사 정보 수정"
    await expect(page.locator('#form-heading')).toContainText('강사 정보 수정');

    // Resign and Delete buttons should be present in the form buttons container
    const resignBtnForm = page.locator('#resign-teacher-btn');
    const deleteBtnForm = page.locator('#delete-teacher-form-btn');
    await expect(resignBtnForm).toBeVisible();
    await expect(deleteBtnForm).toBeVisible();

    // Verify responsive styling on the form buttons
    await expect(resignBtnForm).toHaveCSS('white-space', 'nowrap');
    await expect(resignBtnForm).toHaveCSS('word-break', 'keep-all');
    await expect(resignBtnForm).toHaveCSS('min-width', '120px');
    await expect(deleteBtnForm).toHaveCSS('white-space', 'nowrap');
    await expect(deleteBtnForm).toHaveCSS('word-break', 'keep-all');
    await expect(deleteBtnForm).toHaveCSS('min-width', '120px');

    // 5. Test Deletion from Form button
    await deleteBtnForm.click();
    await expect(blockedModal).toBeVisible();
    await expect(blockedModal.locator('ul')).toContainText('강사 시간표에 등록된 기록이 있습니다.');
    await blockedModal.locator('[data-close-modal]').first().click();
    await expect(blockedModal).toBeHidden();
    await page.waitForTimeout(500);

    // 6. Test Resign process
    await resignBtnForm.click();

    // Resign modal should open
    await expect(resignModal).toBeVisible();
    await expect(resignModal.locator('.modal-title')).toContainText('강사 퇴사 처리');

    // Fill resignation info
    const dateInput = resignModal.locator('#resign-date-input');
    await dateInput.fill(''); // Clear date to test validation
    
    // Setup confirm for submit
    page.once('dialog', async dialog => {
      expect(dialog.message()).toBe('정말로 문승현 강사를 퇴사 처리하시겠습니까?');
      await dialog.accept(); // Confirm resignation
    });

    await dateInput.fill('2026-06-11');
    await resignModal.locator('#resign-memo-input').fill('개인 사정 이직');
    await resignModal.locator('button[type="submit"]').click();

    // Resign modal should close, form resets to "신규 강사 등록", and T1 is hidden under the default active filter
    await expect(resignModal).toBeHidden();
    await page.waitForTimeout(500);
    await expect(page.locator('#form-heading')).toContainText('신규 강사 등록');

    const updatedRowT1 = page.locator('#teachers-table-body tr:has-text("문승현")');
    await expect(updatedRowT1).toBeHidden(); // T1 should be hidden from active list

    // Switch to resigned filter to see T1
    await page.locator('#teacher-status-filter-group button[data-status="resigned"]').click();
    await expect(updatedRowT1).toBeVisible();
    await expect(updatedRowT1.locator('span:has-text("퇴사")')).toBeVisible();

    // Click Edit button for T1 again to check info banner
    await updatedRowT1.locator('.edit-teacher-btn').click();
    const infoBanner = page.locator('#teacher-info-banner');
    await expect(infoBanner).toBeVisible();
    await expect(infoBanner).toContainText('퇴사한 강사 정보 수정 중');
    await expect(infoBanner).toContainText('퇴사일: 2026-06-11');
    await expect(infoBanner).toContainText('퇴사 사유: 개인 사정 이직');

    // Since they are now resigned, "퇴사 처리" button should NOT be visible in the form
    await expect(page.locator('#resign-teacher-btn')).toHaveCount(0);

    // Cancel edit mode
    await page.locator('#cancel-edit-btn').click();
    await expect(infoBanner).toBeHidden();

    // Switch back to active filter to proceed with registering and deleting a clean teacher
    await page.locator('#teacher-status-filter-group button[data-status="active"]').click();

    // 7. Test deleting a clean teacher (register a new teacher first, then delete them)
    // Fill the add form
    await page.locator('#teacher-name-input').fill('임시강사');
    await page.locator('#teacher-instrument-input').fill('우쿨렐레');
    await page.locator('#teacher-phone-input').fill('010-9999-8888');
    await page.locator('#teacher-email-input').fill('temp_teacher@turing.com');
    await page.locator('button[type="submit"]').click(); // Click 등록 완료

    // Verify new row in the table under active filter
    const tempRow = page.locator('#teachers-table-body tr:has-text("임시강사")');
    await expect(tempRow).toBeVisible();

    // Click Edit to delete via Form button
    await tempRow.locator('.edit-teacher-btn').click();

    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('정말로 임시강사 강사의 정보를 삭제하시겠습니까?');
      await dialog.accept(); // Confirm deletion
    });

    await page.locator('#delete-teacher-form-btn').click();

    // Row should disappear from table, form resets to "신규 강사 등록"
    await expect(tempRow).not.toBeVisible();
    await expect(page.locator('#form-heading')).toContainText('신규 강사 등록');
  });

  test('should support teacher active/resigned status filters and search combination in UI', async ({ page }) => {
    page.removeAllListeners('dialog');

    // 1. Log in as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // 2. Navigate to "강사관리" (dir-teachers)
    const staffMenu = page.locator('.menu-item[data-view="dir-teachers"]');
    await expect(staffMenu).toBeVisible();
    await staffMenu.click();

    // Verify heading is visible
    await expect(page.locator('h3:has-text("학원 등록 강사 현황")')).toBeVisible();

    // 3. Verify status filter group exists and active is selected by default
    const filterGroup = page.locator('#teacher-status-filter-group');
    await expect(filterGroup).toBeVisible();
    const activeBtn = filterGroup.locator('button[data-status="active"]');
    const resignedBtn = filterGroup.locator('button[data-status="resigned"]');
    const allBtn = filterGroup.locator('button[data-status="all"]');

    await expect(activeBtn).toHaveClass(/active/);
    await expect(resignedBtn).not.toHaveClass(/active/);
    await expect(allBtn).not.toHaveClass(/active/);

    // Verify initial count badges on filters
    await expect(activeBtn.locator('#count-active')).toHaveText('(8)');
    await expect(resignedBtn.locator('#count-resigned')).toHaveText('(0)');
    await expect(allBtn.locator('#count-all')).toHaveText('(8)');

    // Verify active teachers list is visible
    await expect(page.locator('#teachers-table-body tr')).toHaveCount(8);

    // 4. Click Resigned filter button
    await resignedBtn.click();
    await expect(resignedBtn).toHaveClass(/active/);
    await expect(activeBtn).not.toHaveClass(/active/);

    // Verify empty state for resigned status
    await expect(page.locator('#teachers-table-body')).toContainText('퇴사 처리된 강사가 없습니다.');

    // 5. Click All filter button
    await allBtn.click();
    await expect(allBtn).toHaveClass(/active/);
    await expect(page.locator('#teachers-table-body tr')).toHaveCount(8);

    // 6. Switch back to Active filter, test search query combination
    await activeBtn.click();
    const searchInput = page.locator('#teacher-search-input');
    await expect(searchInput).toBeVisible();

    // Search for "피아노"
    await searchInput.fill('피아노');
    // Active piano teachers: 문승현, 엄소연, 정은비 (3 teachers)
    await expect(page.locator('#teachers-table-body tr')).toHaveCount(3);
    await expect(page.locator('#teachers-table-body tr:has-text("문승현")')).toBeVisible();
    await expect(page.locator('#teachers-table-body tr:has-text("엄소연")')).toBeVisible();
    await expect(page.locator('#teachers-table-body tr:has-text("정은비")')).toBeVisible();

    // Search for a specific name "성어진"
    await searchInput.fill('성어진');
    await expect(page.locator('#teachers-table-body tr')).toHaveCount(1);
    await expect(page.locator('#teachers-table-body tr:has-text("성어진")')).toBeVisible();

    // Search for non-existing query
    await searchInput.fill('없는강사명');
    await expect(page.locator('#teachers-table-body')).toContainText('검색 결과가 없습니다.');

    // Clear search
    await searchInput.fill('');
    await expect(page.locator('#teachers-table-body tr')).toHaveCount(8);

    // 7. Add a clean teacher, resign them, then physically delete them
    // Register new teacher "테스트강사"
    await page.locator('#teacher-name-input').fill('테스트강사');
    await page.locator('#teacher-instrument-input').fill('첼로');
    await page.locator('#teacher-phone-input').fill('010-5555-5555');
    await page.locator('button[type="submit"]').click();

    // Verify active count increases
    await expect(activeBtn.locator('#count-active')).toHaveText('(9)');
    await expect(resignedBtn.locator('#count-resigned')).toHaveText('(0)');
    await expect(allBtn.locator('#count-all')).toHaveText('(9)');
    await expect(page.locator('#teachers-table-body tr')).toHaveCount(9);

    const testRow = page.locator('#teachers-table-body tr:has-text("테스트강사")');
    await expect(testRow).toBeVisible();

    // Resign "테스트강사"
    await testRow.locator('.edit-teacher-btn').click();
    await expect(page.locator('#form-heading')).toContainText('강사 정보 수정');
    await page.locator('#resign-teacher-btn').click();

    const resignModal = page.locator('.modal-overlay.show');
    await expect(resignModal).toBeVisible();

    page.once('dialog', async dialog => {
      expect(dialog.message()).toBe('정말로 테스트강사 강사를 퇴사 처리하시겠습니까?');
      await dialog.accept();
    });

    await resignModal.locator('#resign-date-input').fill('2026-06-11');
    await resignModal.locator('#resign-memo-input').fill('개인 연구');
    await resignModal.locator('button[type="submit"]').click();
    await expect(resignModal).toBeHidden();
    await page.waitForTimeout(500);

    // Verify they disappeared from active list
    await expect(testRow).toBeHidden();
    await expect(activeBtn.locator('#count-active')).toHaveText('(8)');
    await expect(resignedBtn.locator('#count-resigned')).toHaveText('(1)');
    await expect(allBtn.locator('#count-all')).toHaveText('(9)');

    // Go to Resigned filter, verify they are there
    await resignedBtn.click();
    await expect(testRow).toBeVisible();
    await expect(testRow.locator('span:has-text("퇴사")')).toBeVisible();

    // Click edit on testRow, delete physically (as they have no connected records)
    await testRow.locator('.edit-teacher-btn').click();
    
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('정말로 테스트강사 강사의 정보를 삭제하시겠습니까?');
      await dialog.accept();
    });

    await page.locator('#delete-teacher-form-btn').click();
    await page.waitForTimeout(500);

    // Verify they are physically deleted and counts return to original
    await expect(resignedBtn.locator('#count-resigned')).toHaveText('(0)');
    await expect(activeBtn.locator('#count-active')).toHaveText('(8)');
    await expect(allBtn.locator('#count-all')).toHaveText('(8)');
    await expect(page.locator('#teachers-table-body')).toContainText('퇴사 처리된 강사가 없습니다.');
  });

  test('should not contain double resigned labels like (퇴사) (퇴사) in any major screens', async ({ page }) => {
    // Remove global dialog listener to prevent conflicts
    page.removeAllListeners('dialog');

    // 1. Log in as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // Go to staff view and resign "양지숙" (T4)
    const staffMenu = page.locator('.menu-item[data-view="dir-teachers"]');
    await staffMenu.click();
    
    const row = page.locator('#teachers-table-body tr:has-text("양지숙")');
    await row.locator('.edit-teacher-btn').click();
    await page.locator('#resign-teacher-btn').click();
    const resignModal = page.locator('.modal-overlay.show');
    await resignModal.locator('#resign-date-input').fill('2026-06-11');
    await resignModal.locator('#resign-memo-input').fill('이직');
    
    page.once('dialog', async dialog => {
      await dialog.accept();
    });
    await resignModal.locator('button[type="submit"]').click();
    await page.waitForTimeout(500);

    // Let's navigate through different views and check DOM text
    const views = [
      'dir-major-schedule',
      'dir-students',
      'dir-schedules',
      'dir-attendance-control',
      'dir-teacher-attendance'
    ];

    for (const view of views) {
      const menu = page.locator(`.menu-item[data-view="${view}"]`);
      await menu.click();
      await page.waitForTimeout(500);
      const text = await page.textContent('body');
      expect(text).not.toContain('(퇴사) (퇴사)');
      expect(text).not.toContain('(퇴사)(퇴사)');
    }
  });

  test('should handle retired teacher shifts and student matching filters properly', async ({ page }) => {
    page.removeAllListeners('dialog');

    // 1. Log in as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // Add shift for retired teacher T4 on 2026-05-18 and 2026-06-11 (today) and resign them
    await page.evaluate(() => {
      window.stateStore.saveTeacherShift('T4', '2026-05-18', ['14:00', '14:30']);
      window.stateStore.saveTeacherShift('T4', '2026-06-11', ['14:00', '14:30']);
      window.stateStore.resignTeacher('T4', { resignedAt: '2026-06-11', memo: '이직' });
    });

    // Go to Schedules screen
    await page.locator('.menu-item[data-view="dir-schedules"]').click();
    await page.waitForTimeout(500);

    // 1. Check weekly shift dropdown contains T4 with single resigned label
    const weekSelect = page.locator('#shift-teacher-select-week');
    await expect(weekSelect).toContainText('양지숙 (퇴사)');
    await expect(weekSelect).not.toContainText('양지숙 (퇴사) (퇴사)');

    // 2. Switch to daily shifts and verify T4 is not visible on 2026-06-11 (because retired and has slots but no logs)
    await page.locator('[data-testid="teacher-shift-day-view"]').click();
    await page.locator('[data-testid="teacher-shift-date-input"]').fill('2026-06-11');
    await page.waitForTimeout(500);

    const dayShiftHeader = page.locator('[data-testid="teacher-shift-table"]');
    await expect(dayShiftHeader).not.toContainText('양지숙');

    // 3. Test Student Matching Filter (Problem 2)
    // S1 (최다은) default teacher is T8 (정은비). Resign T8 first.
    await page.evaluate(() => {
      window.stateStore.resignTeacher('T8', { resignedAt: '2026-06-11', memo: '건강사정' });
    });

    // S1 default teacher was T8.
    // In match view for today (2026-06-11), T8 should be visible as filter badge or column since there are classes
    await page.locator('.menu-item[data-view="dir-schedules"]').click();
    await page.locator('#btn-subtab-match').click();
    await page.waitForTimeout(500);

    // Navigate 4 weeks forward to a future week (e.g. week of June 15, 2026) to test future dynamic scheduling
    for (let i = 0; i < 4; i++) {
      await page.locator('#btn-next-week').click();
      await page.waitForTimeout(100);
    }

    // Weekly match view: T8 (정은비) is in filter because S1 has default classes in this week (and S1 was assigned to T8)
    const matchFilterRow = page.locator('#teacher-filter-row');
    await page.locator('#chk-show-resigned-teachers').check();
    await page.waitForTimeout(200);
    await expect(matchFilterRow).toContainText('정은비 (퇴사)');

    // Now update S1's teacher to T1 (active). T8 should disappear from MATCH view filter badges for future/current week
    await page.evaluate(() => {
      const t8Students = ['S1', 'S2', 'S3', 'S4', 'S5', 'S13', 'S21'];
      t8Students.forEach(sid => {
        window.stateStore.updateStudent(sid, { teacherId: 'T1' });
      });
    });
    await page.locator('.menu-item[data-view="dir-schedules"]').click();
    await page.locator('#btn-subtab-match').click();
    await page.waitForTimeout(500);
    await page.locator('#chk-show-resigned-teachers').check();
    await page.waitForTimeout(200);
    await expect(matchFilterRow).not.toContainText('정은비 (퇴사)');

    // 4. Test Student Deletion (Problem 3)
    // Delete student S2 (assigned to T8 in past snapshot/active). S2 should disappear from grid.
    await page.evaluate(() => {
      window.stateStore.deleteStudent('S2');
    });
    await page.locator('.menu-item[data-view="dir-schedules"]').click();
    await page.locator('#btn-subtab-match').click();
    await page.waitForTimeout(500);

    const gridText = await page.textContent('.teacher-student-main');
    expect(gridText).not.toContain('김제나'); // S2 name

    // 5. Test Student Search by Teacher Name (Repair-B Item 1)
    await page.locator('.menu-item[data-view="dir-students"]').click();
    await page.waitForTimeout(500);

    // Create a temporary teacher "테스트333" (resigned) and assign student S22 (윤하은) to them
    await page.evaluate(() => {
      const t = window.stateStore.addTeacher({ name: '테스트333', instrument: '피아노' });
      window.stateStore.resignTeacher(t.id, { resignedAt: '2026-06-11', memo: '이직' });
      window.stateStore.updateStudent('S22', { teacherId: t.id });
    });

    // Search by teacher name
    const searchInput = page.locator('#student-search-input');
    await searchInput.fill('테스트333');
    await page.waitForTimeout(500);

    const studentTable = page.locator('#students-table-body');
    await expect(studentTable).toContainText('윤하은');

    // Clean search
    await searchInput.fill('');
    await page.waitForTimeout(500);

    // 6. Test Daily Match View Empty Shift Filter (Repair-B Item 2)
    await page.locator('.menu-item[data-view="dir-schedules"]').click();
    await page.locator('#btn-subtab-match').click();
    await page.locator('[data-testid="teacher-student-day-view"]').click();
    await page.locator('[data-testid="teacher-student-date-input"]').fill('2026-06-11');
    await page.waitForTimeout(500);

    const dailyMatchTable = page.locator('[data-testid="teacher-student-schedule-table"]');
    await page.locator('#chk-show-resigned-teachers').check();
    await page.waitForTimeout(200);
    await expect(dailyMatchTable).toContainText('양지숙 (퇴사)');

    // Now clear T4's shifts for today (make slots empty)
    await page.evaluate(() => {
      window.stateStore.saveTeacherShift('T4', '2026-06-11', []);
    });

    await page.locator('.menu-item[data-view="dir-schedules"]').click();
    await page.locator('#btn-subtab-match').click();
    await page.waitForTimeout(500);
    // Since T4 has slots: [], they should not show up in the headers anymore
    await expect(dailyMatchTable).not.toContainText('양지숙 (퇴사)');

    // 7. Verify Retired Teacher Daily View Policy (Repair-B Policy Update)
    // T_TARGET (테스트333) is a resigned teacher (created in step 5).
    // Ensure T_TARGET has no students, no shifts, no logs initially.
    const targetTeacherId = await page.evaluate(() => {
      const teacher = window.stateStore.getTeachers().find(t => t.name === '테스트333');
      if (!teacher) throw new Error('테스트333 강사를 찾을 수 없습니다.');
      const tId = teacher.id;
      // Clear T_TARGET's shifts, overrides, classes, and logs for today (2026-06-03)
      window.stateStore.db.teacherShifts = window.stateStore.db.teacherShifts.filter(s => s.teacherId !== tId);
      window.stateStore.db.teacherAttendanceLogs = window.stateStore.db.teacherAttendanceLogs.filter(l => l.teacherId !== tId);
      window.stateStore.db.classes = window.stateStore.db.classes.filter(c => c.teacherId !== tId);
      window.stateStore.db.scheduleSnapshots = window.stateStore.db.scheduleSnapshots.filter(s => s.date !== '2026-06-03');
      // Set S22's teacher back to T1 to ensure T_TARGET has no assigned students
      window.stateStore.updateStudent('S22', { teacherId: 'T1' });
      window.stateStore.saveDB();
      return tId;
    });

    // Sub-test 1: Retired teacher + no students + empty shift (slots: []) -> Hidden everywhere
    await page.evaluate((tId) => {
      window.stateStore.saveTeacherShift(tId, '2026-06-03', []);
    }, targetTeacherId);
    // A. Verify hidden on Teacher attendance daily view
    await page.locator('.menu-item[data-view="dir-teacher-attendance"]').click();
    await page.waitForTimeout(500);
    const attendanceTable = page.locator('#teacher-attendance-table-body');
    await expect(attendanceTable).not.toContainText('테스트333');

    // B. Verify hidden on Teacher-student match daily view
    await page.locator('.menu-item[data-view="dir-schedules"]').click();
    await page.locator('#btn-subtab-match').click();
    await page.locator('[data-testid="teacher-student-day-view"]').click();
    await page.locator('[data-testid="teacher-student-date-input"]').fill('2026-06-03');
    await page.waitForTimeout(500);
    await expect(dailyMatchTable).not.toContainText('테스트333');

    // Sub-test 2: Retired teacher + has active slots -> Visible in Attendance table and Match view
    await page.evaluate((tId) => {
      window.stateStore.saveTeacherShift(tId, '2026-06-03', ['15:00', '15:30']);
    }, targetTeacherId);
    // A. Verify visible in Attendance
    await page.locator('.menu-item[data-view="dir-teacher-attendance"]').click();
    await page.waitForTimeout(500);
    await expect(attendanceTable).toContainText('테스트333 (퇴사)');

    // B. Verify visible in Match view (since slots > 0)
    await page.locator('.menu-item[data-view="dir-schedules"]').click();
    await page.locator('#btn-subtab-match').click();
    await page.locator('[data-testid="teacher-student-day-view"]').click();
    await page.locator('[data-testid="teacher-student-date-input"]').fill('2026-06-03');
    await page.waitForTimeout(500);
    await page.locator('#chk-show-resigned-teachers').check();
    await page.waitForTimeout(200);
    await expect(dailyMatchTable).toContainText('테스트333 (퇴사)');

    // Sub-test 3: Retired teacher + has active student assignment -> Visible in Match view
    // Reset shifts to empty, but add a class snapshot entry for today.
    await page.evaluate((tId) => {
      window.stateStore.saveTeacherShift(tId, '2026-06-03', []);
      window.stateStore.ensureScheduleSnapshotForDate('2026-06-03');
      const snap = window.stateStore.db.scheduleSnapshots.find(s => s.date === '2026-06-03');
      snap.entries.push({
        id: `ENTRY_2026-06-03_S22_${tId}_E2E`,
        studentId: 'S22',
        teacherId: tId,
        startTime: '16:00',
        endTime: '16:30',
        subjectId: '피아노',
        source: 'override'
      });
      window.stateStore.saveDB();
    }, targetTeacherId);
    // A. Verify visible in Match view
    await page.locator('.menu-item[data-view="dir-schedules"]').click();
    await page.locator('#btn-subtab-match').click();
    await page.locator('[data-testid="teacher-student-day-view"]').click();
    await page.locator('[data-testid="teacher-student-date-input"]').fill('2026-06-03');
    await page.waitForTimeout(500);
    await page.locator('#chk-show-resigned-teachers').check();
    await page.waitForTimeout(200);
    await expect(dailyMatchTable).toContainText('테스트333 (퇴사)');

    // B. Verify hidden in Attendance table (since slots are empty and no check-in logs)
    await page.locator('.menu-item[data-view="dir-teacher-attendance"]').click();
    await page.waitForTimeout(500);
    await expect(attendanceTable).not.toContainText('테스트333');

    // Sub-test 4: Retired teacher + no records -> Hidden everywhere
    await page.evaluate((tId) => {
      window.stateStore.db.teacherShifts = window.stateStore.db.teacherShifts.filter(s => s.teacherId !== tId);
      window.stateStore.db.scheduleSnapshots = window.stateStore.db.scheduleSnapshots.filter(s => s.date !== '2026-06-03');
      window.stateStore.saveDB();
    }, targetTeacherId);
    // A. Verify hidden on Teacher attendance
    await page.locator('.menu-item[data-view="dir-teacher-attendance"]').click();
    await page.waitForTimeout(500);
    await expect(attendanceTable).not.toContainText('테스트333');

    // B. Verify hidden on Match view
    await page.locator('.menu-item[data-view="dir-schedules"]').click();
    await page.locator('#btn-subtab-match').click();
    await page.locator('[data-testid="teacher-student-day-view"]').click();
    await page.locator('[data-testid="teacher-student-date-input"]').fill('2026-06-03');
    await page.waitForTimeout(500);
    await expect(dailyMatchTable).not.toContainText('테스트333');

    // Sub-test 5: Retired teacher + stale default snapshot on past date vs current date (Repair-C Verification)
    // 1. Create a default class snapshot on 2026-06-02 (past date) and 2026-06-03 (current date) with S22 under T_TARGET.
    // 2. Set S22's current teacher to T1.
    // 3. Ensure target has no shifts, no logs on both dates.
    await page.evaluate((tId) => {
      window.stateStore.db.teacherShifts = window.stateStore.db.teacherShifts.filter(s => s.teacherId !== tId);
      window.stateStore.db.teacherAttendanceLogs = window.stateStore.db.teacherAttendanceLogs.filter(l => l.teacherId !== tId);
      window.stateStore.db.classes = window.stateStore.db.classes.filter(c => c.teacherId !== tId);
      window.stateStore.db.scheduleSnapshots = window.stateStore.db.scheduleSnapshots.filter(s => s.date !== '2026-06-02' && s.date !== '2026-06-03');

      // Create snapshot on past date (2026-06-02) with source === 'default'
      window.stateStore.ensureScheduleSnapshotForDate('2026-06-02');
      const snapPast = window.stateStore.db.scheduleSnapshots.find(s => s.date === '2026-06-02');
      snapPast.entries.push({
        id: `ENTRY_2026-06-02_S22_${tId}_E2E`,
        studentId: 'S22',
        teacherId: tId,
        startTime: '16:00',
        endTime: '16:30',
        subjectId: '피아노',
        source: 'default'
      });

      // Create snapshot on current date (2026-06-03) with source === 'default'
      window.stateStore.ensureScheduleSnapshotForDate('2026-06-03');
      const snapCurrent = window.stateStore.db.scheduleSnapshots.find(s => s.date === '2026-06-03');
      snapCurrent.entries.push({
        id: `ENTRY_2026-06-03_S22_${tId}_E2E`,
        studentId: 'S22',
        teacherId: tId,
        startTime: '16:00',
        endTime: '16:30',
        subjectId: '피아노',
        source: 'default'
      });

      // Set S22's current teacher to T1 (so T_TARGET is stale)
      window.stateStore.updateStudent('S22', { teacherId: 'T1' });
      window.stateStore.saveDB();
    }, targetTeacherId);

    // A. View 2026-06-02 (past date) -> 테스트333 should be VISIBLE because it is a past date record
    await page.locator('[data-testid="teacher-student-date-input"]').fill('2026-06-02');
    await page.waitForTimeout(500);
    await page.locator('#chk-show-resigned-teachers').check();
    await page.waitForTimeout(200);
    await expect(dailyMatchTable).toContainText('테스트333 (퇴사)');

    // B. View 2026-06-03 (current date) -> 테스트333 should be HIDDEN because it is current/future and snapshot is stale
    await page.locator('[data-testid="teacher-student-date-input"]').fill('2026-06-03');
    await page.waitForTimeout(500);
    await expect(dailyMatchTable).not.toContainText('테스트333');

    // Clean up temporary database modifications
    await page.evaluate((tId) => {
      window.stateStore.db.scheduleSnapshots = window.stateStore.db.scheduleSnapshots.filter(s => s.date !== '2026-06-02' && s.date !== '2026-06-03');
      window.stateStore.db.teachers = window.stateStore.db.teachers.filter(t => t.id !== tId);
      window.stateStore.saveDB();
    }, targetTeacherId);
  });

  test('should support teacher reinstatement / 퇴사 취소 workflow', async ({ page }) => {
    page.removeAllListeners('dialog');

    // 1. Log in as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // Go to staff view
    await page.locator('.menu-item[data-view="dir-teachers"]').click();
    await page.waitForTimeout(500);

    // Pick an active teacher e.g. "문승현" (T1) and verify "퇴사 취소" button is NOT visible
    const rowT1 = page.locator('#teachers-table-body tr:has-text("문승현")');
    await rowT1.locator('.edit-teacher-btn').click();
    await page.waitForTimeout(200);
    await expect(page.locator('#restore-teacher-btn')).not.toBeVisible();
    await expect(page.locator('#resign-teacher-btn')).toBeVisible();

    // Now resign "문승현" first
    await page.locator('#resign-teacher-btn').click();
    const resignModal = page.locator('.modal-overlay.show');
    await resignModal.locator('#resign-date-input').fill('2026-06-11');
    await resignModal.locator('#resign-memo-input').fill('일시퇴사');
    page.once('dialog', async dialog => {
      await dialog.accept();
    });
    await resignModal.locator('button[type="submit"]').click();
    await page.waitForTimeout(500);

    // Set filter to "퇴사" (resigned)
    const resignedBtn = page.locator('#teacher-status-filter-group button[data-status="resigned"]');
    await resignedBtn.click();
    await page.waitForTimeout(200);

    // Open resigned teacher "문승현" details
    const resignedRow = page.locator('#teachers-table-body tr:has-text("문승현")');
    await resignedRow.locator('.edit-teacher-btn').click();
    await page.waitForTimeout(200);

    // Verify "퇴사 취소" button is visible, and "퇴사 처리" button is NOT visible
    await expect(page.locator('#restore-teacher-btn')).toBeVisible();
    await expect(page.locator('#resign-teacher-btn')).not.toBeVisible();

    // Verify info banner is visible with resigned memo/date
    await expect(page.locator('#teacher-info-banner')).toContainText('퇴사한 강사 정보 수정 중');
    await expect(page.locator('#teacher-info-banner')).toContainText('퇴사일: 2026-06-11');
    await expect(page.locator('#teacher-info-banner')).toContainText('퇴사 사유: 일시퇴사');

    // Confirm cancel behavior (clicking "퇴사 취소" and dismissing prompt)
    page.once('dialog', async dialog => {
      expect(dialog.message()).toBe('이 강사를 재직 상태로 되돌릴까요?');
      await dialog.dismiss();
    });
    await page.locator('#restore-teacher-btn').click();
    await page.waitForTimeout(200);

    // Verify status remains resigned
    const teacherBefore = await page.evaluate(() => {
      return window.stateStore.getTeachers().find(t => t.name === '문승현');
    });
    expect(teacherBefore.employmentStatus).toBe('resigned');

    // Confirm accept behavior (clicking "퇴사 취소" and accepting prompt)
    page.once('dialog', async dialog => {
      expect(dialog.message()).toBe('이 강사를 재직 상태로 되돌릴까요?');
      await dialog.accept();
    });
    await page.locator('#restore-teacher-btn').click();
    await page.waitForTimeout(500);

    // Since we were in "퇴사" filter, the restored teacher should disappear from the list
    // and the form should be reset (no restore button visible, heading says "신규 강사 등록")
    await expect(page.locator('#teachers-table-body tr:has-text("문승현")')).not.toBeVisible();
    await expect(page.locator('#form-heading')).toContainText('신규 강사 등록');
    await expect(page.locator('#restore-teacher-btn')).not.toBeVisible();

    // Verify database status in stateStore
    const teacherAfter = await page.evaluate(() => {
      return window.stateStore.getTeachers().find(t => t.name === '문승현');
    });
    expect(teacherAfter.employmentStatus).toBe('active');
    expect(teacherAfter.resignedAt).toBeNull();
    expect(teacherAfter.resignMemo).toBe('');

    // Go to "재직" filter, "문승현" should be visible
    const activeBtn = page.locator('#teacher-status-filter-group button[data-status="active"]');
    await activeBtn.click();
    await page.waitForTimeout(200);
    await expect(page.locator('#teachers-table-body tr:has-text("문승현")')).toBeVisible();

    // Verify the reinstated teacher is included in Student Assign Dropdown select option list
    await page.locator('.menu-item[data-view="dir-students"]').click();
    await page.waitForTimeout(500);

    // Click edit on student "최다은" (S1)
    const studentRow = page.locator('#students-table-body tr:has-text("최다은")');
    await studentRow.locator('.edit-student-btn').click();
    await page.waitForTimeout(200);

    const studentTeacherSelect = page.locator('#modal-student-teacher');
    await expect(studentTeacherSelect).toContainText('문승현');
  });

  test('should support manually adding teacher attendance logs, validating input values, preventing duplicates, and ensuring no side-effects', async ({ page }) => {
    // Dismiss custom dialog logic to handle dialogs natively or with page.on
    page.removeAllListeners('dialog');

    // 1. Log in as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // Store initial messages length to verify no side-effects
    const initialMessagesCount = await page.evaluate(() => window.stateStore.db.messages ? window.stateStore.db.messages.length : 0);

    // Navigate to "강사 근태관리" View
    const dirTeacherAttendanceMenu = page.locator('.menu-item[data-view="dir-teacher-attendance"]');
    await expect(dirTeacherAttendanceMenu).toBeVisible();
    await dirTeacherAttendanceMenu.scrollIntoViewIfNeeded();
    await dirTeacherAttendanceMenu.evaluate(el => el.click());

    // Switch to range selector (week) to see detailed logs for June 2
    const periodBtn = page.locator('#ta-period-btn');
    await expect(periodBtn).toBeVisible();
    await periodBtn.click();
    const popover = page.locator('#ta-period-popover');
    const presetWeek = popover.locator('.ta-preset-btn:has-text("이번주")');
    await presetWeek.click();

    // Verify "근무 추가" button is visible and click it
    const addBtn = page.locator('#ta-add-log-btn');
    await expect(addBtn).toBeVisible();
    await expect(addBtn).toHaveText(/근무 추가/);
    await addBtn.click();

    // Verify modal is shown
    const modal = page.locator('.modal-overlay.show');
    await expect(modal).toBeVisible();

    // Verify resigned teachers are not in the select option
    await page.evaluate(() => {
      window.stateStore.resignTeacher('T2', { resignedAt: '2026-06-01', memo: '퇴사' });
      window.stateStore.saveDB();
    });

    // Re-render modal by closing and opening again to fetch fresh active teachers
    await modal.locator('[data-close-modal]').first().click();
    await expect(modal).toBeHidden();
    await expect(page.locator('#modal-content-area')).toBeEmpty();
    await addBtn.click();
    await expect(modal).toBeVisible();

    const teacherSelect = modal.locator('#ta-add-teacher');
    const optionsText = await teacherSelect.innerText();
    expect(optionsText).not.toContain('김민수');

    // Test Validation - Teacher missing
    await teacherSelect.selectOption('');
    page.once('dialog', async dialog => {
      expect(dialog.message()).toBe('강사를 선택해 주세요.');
      await dialog.dismiss();
    });
    await modal.locator('#ta-add-save-btn').click();

    // Re-open modal to test Date missing validation
    await modal.locator('[data-close-modal]').first().click();
    await expect(modal).toBeHidden();
    await expect(page.locator('#modal-content-area')).toBeEmpty();
    await addBtn.click();
    await expect(modal).toBeVisible();

    // Select T1 (문승현)
    await teacherSelect.selectOption('T1');

    // Test Validation - Date missing
    await modal.locator('#ta-add-date').fill('');
    page.once('dialog', async dialog => {
      expect(dialog.message()).toBe('날짜를 선택해 주세요.');
      await dialog.dismiss();
    });
    await modal.locator('#ta-add-save-btn').click();

    // Re-open modal to perform successful addition
    await modal.locator('[data-close-modal]').first().click();
    await expect(modal).toBeHidden();
    await expect(page.locator('#modal-content-area')).toBeEmpty();
    await addBtn.click();
    await expect(modal).toBeVisible();

    // Select T1 (문승현) again and select date June 2
    await teacherSelect.selectOption('T1');
    await modal.locator('#ta-add-date').fill('2026-06-02');

    // Test Validation - Checkout before checkin
    const noCheckoutCheckbox = modal.locator('#ta-add-no-checkout');
    const checkoutSelectors = modal.locator('#ta-add-checkout-selectors');
    
    // Verify default state (unchecked, selectors visible)
    await expect(noCheckoutCheckbox).not.toBeChecked();
    await expect(checkoutSelectors).toBeVisible();
    
    // Toggle check to verify hide/show behavior
    await noCheckoutCheckbox.check();
    await expect(checkoutSelectors).toBeHidden();
    await noCheckoutCheckbox.uncheck();
    await expect(checkoutSelectors).toBeVisible();
    
    await modal.locator('#ta-add-checkin-ampm').selectOption('오전');
    await modal.locator('#ta-add-checkin-hour').selectOption('11');
    await modal.locator('#ta-add-checkin-minute').selectOption('00');

    await modal.locator('#ta-add-checkout-ampm').selectOption('오전');
    await modal.locator('#ta-add-checkout-hour').selectOption('10');
    await modal.locator('#ta-add-checkout-minute').selectOption('00');

    page.once('dialog', async dialog => {
      expect(dialog.message()).toBe('퇴근시각은 출근시각 이후여야 합니다.');
      await dialog.dismiss();
    });
    await modal.locator('#ta-add-save-btn').click();

    // Success check: manual insert checkIn 09:30 AM, checkOut 06:45 PM
    await modal.locator('#ta-add-checkin-ampm').selectOption('오전');
    await modal.locator('#ta-add-checkin-hour').selectOption('9');
    await modal.locator('#ta-add-checkin-minute').selectOption('30');

    await modal.locator('#ta-add-checkout-ampm').selectOption('오후');
    await modal.locator('#ta-add-checkout-hour').selectOption('6');
    await modal.locator('#ta-add-checkout-minute').selectOption('45');

    await modal.locator('#ta-add-note').fill('E2E 수동 추가 테스트');

    // Save confirm accept
    page.once('dialog', async dialog => {
      expect(dialog.message()).toBe('강사 근무 기록을 추가할까요?');
      await dialog.accept();
    });
    await modal.locator('#ta-add-save-btn').click();
    await expect(modal).toBeHidden();
    await expect(page.locator('#modal-content-area')).toBeEmpty();

    // Verify row added and calculated correctly
    const summaryCard = page.locator('.glass-card:has-text("강사별 근무시간")');
    await expect(summaryCard).toBeVisible();
    const sumRowT1 = summaryCard.locator('tr[data-testid="teacher-summary-row-T1"]');
    await expect(sumRowT1.locator('td').nth(3)).toHaveText('9시간 15분');

    const logInDb = await page.evaluate(() => {
      return window.stateStore.db.teacherAttendanceLogs.find(l => l.teacherId === 'T1' && l.date === '2026-06-02');
    });
    expect(logInDb.source).toBe('director_manual');
    expect(logInDb.note).toBe('E2E 수동 추가 테스트');

    // Test Duplicate prevention
    await addBtn.click();
    await expect(modal).toBeVisible();
    await modal.locator('#ta-add-date').fill('2026-06-02');
    await teacherSelect.selectOption('T1');
    
    let dialogCount = 0;
    page.on('dialog', async dialog => {
      dialogCount++;
      if (dialogCount === 1) {
        expect(dialog.message()).toBe('강사 근무 기록을 추가할까요?');
        await dialog.accept();
      } else if (dialogCount === 2) {
        expect(dialog.message()).toBe('이미 해당 날짜의 근태 기록이 있습니다. 기존 기록을 수정해 주세요.');
        await dialog.dismiss();
      }
    });
    await modal.locator('#ta-add-save-btn').click();
    page.removeAllListeners('dialog');

    await expect(modal).toBeVisible();

    await modal.locator('[data-close-modal]').first().click();
    await expect(modal).toBeHidden();
    await expect(page.locator('#modal-content-area')).toBeEmpty();

    const messagesCount = await page.evaluate(() => window.stateStore.db.messages ? window.stateStore.db.messages.length : 0);
    expect(messagesCount).toBe(initialMessagesCount);
  });
});
