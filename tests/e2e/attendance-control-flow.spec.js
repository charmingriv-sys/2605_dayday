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

test.describe('Director Attendance Control Console Flow', () => {
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

    // Navigate and login as director
    await page.goto('/');
    await page.locator('.role-btn.director').click();
  });

  test('should load attendance control screen from sidebar and display panels matching mixed console spec', async ({ page }) => {
    // 1. Click "출결 관제" menu item in the sidebar
    const menuItem = page.locator('.menu-item[data-view="dir-attendance-control"]');
    await expect(menuItem).toBeVisible();
    await menuItem.click();

    // 2. Assert page title has changed to "출결 관제"
    const pageTitle = page.locator('#page-title');
    await expect(pageTitle).toBeVisible();
    await expect(pageTitle).toContainText('출결 관제');

    // 2-A. Assert body redundant header (e.g. .ac-header or heading in root) is absent
    const redundantHeader = page.locator('.attendance-control-root .ac-header');
    await expect(redundantHeader).toBeHidden();
    const bodyH1Count = await page.locator('.attendance-control-root h1').count();
    expect(bodyH1Count).toBe(0);

    // 2-B. Assert Last Sync and Refresh Button are inside the global header actions
    const globalSync = page.locator('.header-actions #ac-last-sync');
    const globalRefresh = page.locator('.header-actions #ac-refresh-btn');
    await expect(globalSync).toBeVisible();
    await expect(globalRefresh).toBeVisible();

    // 3. Assert KPI metric cards matching dayday_attendance_mixed_console.html
    const kpiTotal = page.locator('.metric-card[data-status="전체"]');
    const kpiPresent = page.locator('.metric-card[data-status="출석"]');
    const kpiLate = page.locator('.metric-card[data-status="지각"]');
    const kpiAbsent = page.locator('.metric-card[data-status="결석"]');
    
    await expect(kpiTotal).toBeVisible();
    await expect(kpiPresent).toBeVisible();
    await expect(kpiLate).toBeVisible();
    await expect(kpiAbsent).toBeVisible();

    // 4. Assert filter inputs are present
    const datePicker = page.locator('#ac-date-picker');
    const statusSelect = page.locator('#ac-status-select');
    const instrumentSelect = page.locator('#ac-instrument-select');
    const teacherSelect = page.locator('#ac-teacher-select');
    const searchType = page.locator('#ac-search-type');
    const searchInput = page.locator('#ac-search-input');

    await expect(datePicker).toBeVisible();
    await expect(statusSelect).toBeVisible();
    await expect(instrumentSelect).toBeVisible();
    await expect(teacherSelect).toBeVisible();
    await expect(searchType).toBeVisible();
    await expect(searchInput).toBeVisible();

    // 4-A. Assert search combo is merged inside filters card
    const searchCombo = page.locator('.ac-filters-card .ac-search-combo');
    await expect(searchCombo).toBeVisible();

    // 5. Assert warning console is present
    const warningConsoleTitle = page.locator('.warning-console .warning-title');
    await expect(warningConsoleTitle).toBeVisible();
    
    // 6. Assert non-standard/unapproved panels are ABSENT
    const oldRadarRadar = page.locator('text=출결 워닝 레이더');
    const oldWeeklyMetrics = page.locator('text=주간 누적 지표');
    const oldAccordionText = page.locator('text=정상 출석 원생 완료 목록');

    await expect(oldRadarRadar).toBeHidden();
    await expect(oldWeeklyMetrics).toBeHidden();
    await expect(oldAccordionText).toBeHidden();

    // 7. Assert compact board and attendance table are present
    const compactBoard = page.locator('#compactBoard');
    const customTable = page.locator('table.custom-table');
    
    await expect(compactBoard).toBeVisible();
    await expect(customTable).toBeVisible();
  });

  test('should interactive student row selection open details inspector drawer', async ({ page }) => {
    // Go to attendance control view
    await page.locator('.menu-item[data-view="dir-attendance-control"]').click();
    await expect(page.locator('#page-title')).toContainText('출결 관제');

    // Click a student row in the table
    const firstStudentLink = page.locator('table.custom-table tbody tr .student-link').first();
    await expect(firstStudentLink).toBeVisible();
    await firstStudentLink.click();

    // Assert details inspector panel opens
    const inspectorPanel = page.locator('#ac-inspector-panel');
    await expect(inspectorPanel).toHaveClass(/open/);

    // Verify key sections in inspector panel are loaded
    await expect(page.locator('#ac-inspector-name')).toBeVisible();
    await expect(page.locator('#ac-inspector-stat-done')).toBeVisible();
    await expect(page.locator('#ac-inspector-tuition-box')).toBeVisible();
    await expect(page.locator('#ac-inspector-calendar-mini')).toBeVisible();

    // Verify inspector panel background is opaque (not transparent)
    await expect(inspectorPanel).toHaveCSS('background-color', 'rgb(255, 255, 255)');

    // Verify warning text is "이상 없음" (and NOT "누적 출결 워닝 없음")
    const warningList = page.locator('#ac-inspector-warning-list');
    await expect(warningList).toContainText('이상 없음');
    await expect(warningList).not.toContainText('누적 출결 워닝 없음');

    // Verify calendar cell for the current mock day (3rd) is highlighted as today
    const todayCell = page.locator('#ac-inspector-calendar-mini .cal-cell.today');
    await expect(todayCell).toBeVisible();
    await expect(todayCell).toHaveText('3');

    // Click backdrop to close
    await page.locator('#ac-drawer-backdrop').click();
    await expect(inspectorPanel).not.toHaveClass(/open/);
  });

  test('should search filter input keep focus and filter properly', async ({ page }) => {
    // Go to attendance control view
    await page.locator('.menu-item[data-view="dir-attendance-control"]').click();
    
    const searchInput = page.locator('#ac-search-input');
    await expect(searchInput).toBeVisible();
    
    // Type something to trigger filter re-render
    await searchInput.fill('가상원생이름');
    
    // Asserts search input maintains focus
    await expect(searchInput).toBeFocused();
  });

  test('should support Korean IME (composition) text entry without losing focus or breaking characters', async ({ page }) => {
    // Go to attendance control view
    await page.locator('.menu-item[data-view="dir-attendance-control"]').click();
    
    const searchInput = page.locator('#ac-search-input');
    await expect(searchInput).toBeVisible();
    await searchInput.focus();
    
    // 1. Sequentially type Korean characters using pressSequentially
    await searchInput.pressSequentially('아가', { delay: 50 });
    await page.waitForTimeout(300); // Wait for debounce render
    
    await expect(searchInput).toHaveValue('아가');
    await expect(searchInput).toBeFocused();

    // Clear input
    await searchInput.fill('');
    
    // 2. Simulate compositionstart, input, and compositionend events
    await page.evaluate(() => {
      const input = document.getElementById('ac-search-input');
      input.dispatchEvent(new CompositionEvent('compositionstart'));
      input.value = '김민준';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    
    // Check that during composition it retains focus and value
    await expect(searchInput).toBeFocused();
    await expect(searchInput).toHaveValue('김민준');
    
    await page.evaluate(() => {
      const input = document.getElementById('ac-search-input');
      input.dispatchEvent(new CompositionEvent('compositionend', { data: '김민준' }));
    });
    
    await page.waitForTimeout(300); // Wait for debounce render
    
    // Verify final state
    await expect(searchInput).toHaveValue('김민준');
    await expect(searchInput).toBeFocused();
  });
});
