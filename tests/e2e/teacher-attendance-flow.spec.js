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
});
