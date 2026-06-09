import { test, expect } from '@playwright/test';

// NodeJS runner Date mocking to match June 4, 2026 KST (mockup today date)
const mockTime = new Date('2026-06-04T09:00:00+09:00').getTime();
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

test.describe('Director Major Schedule Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the browser date to 2026-06-04 09:00:00 KST
    await page.addInitScript(() => {
      const mockTime = new Date('2026-06-04T09:00:00+09:00').getTime();
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
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
  });

  test('should verify Phase 10A requirements: sidebar navigation, header, 1-column layout, KPIs, event strip, filters, table tabs, and drawers stubs', async ({ page }) => {
    // 1. Click "주요일정관리" menu item in the sidebar
    const menuItem = page.locator('.menu-item[data-view="dir-major-schedule"]');
    await expect(menuItem).toBeVisible();
    await menuItem.click();

    // 2. Assert page title has changed to "주요일정 관리"
    const pageTitle = page.locator('#page-title');
    await expect(pageTitle).toBeVisible();
    await expect(pageTitle).toHaveCount(1);
    await expect(pageTitle).toContainText('주요일정 관리');

    // 3. Assert local header does NOT exist in dashboard content (no duplicate header)
    const localHeader = page.locator('#dashboard-content header');
    await expect(localHeader).not.toBeVisible();

    // 3b. Assert global header actions are mounted
    const lastSync = page.locator('#major-schedule-last-sync');
    const refreshBtn = page.locator('#major-schedule-refresh-btn');
    await expect(lastSync).toBeVisible();
    await expect(lastSync).toContainText('마지막 동기화 16:40');
    await expect(refreshBtn).toBeVisible();
    await expect(refreshBtn).toContainText('새로고침');

    // Verify style/class structure consistency with attendance control
    await expect(lastSync).toHaveClass(/major-schedule-clock/);
    await expect(refreshBtn).toHaveClass(/btn btn-primary/);

    // Test refresh button updates the last sync time
    await refreshBtn.click();
    await page.waitForTimeout(100);
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    await expect(lastSync).toContainText(`마지막 동기화 ${hh}:${mm}`);

    // 4. Assert KPI metric cards
    const kpiEvents = page.locator('#kpiEvents');
    const kpiDeadline = page.locator('#kpiDeadline');
    const kpiLessons = page.locator('#kpiLessons');
    
    await expect(kpiEvents).toContainText('6'); // Total active events
    await expect(kpiDeadline).toContainText('3'); // Events with deadline in 7 days (D-3, D-5, D-7)
    await expect(kpiLessons).toContainText('4'); // Today's lessons targets

    // 5. Assert horizontal event card strip is rendered
    const eventStrip = page.locator('#eventStrip');
    await expect(eventStrip).toBeVisible();
    
    // There should be 6 event cards
    const cards = eventStrip.locator('.event-card');
    await expect(cards).toHaveCount(6);
    
    // Check second event card details (ev1: 한국청소년 피아노 콩쿠르, D-10)
    const targetCard = cards.nth(1);
    await expect(targetCard.locator('.type-chip')).toContainText('콩쿠르');
    await expect(targetCard.locator('.dday')).toContainText('일정 D-10');
    await expect(targetCard.locator('.event-title')).toContainText('한국청소년 피아노 콩쿠르');
    await expect(targetCard.locator('.event-due-box')).toHaveClass(/urgent/);
    await expect(targetCard.locator('.event-due-box')).toContainText('D-3');

    // 6. Assert "다가오는 수업 정보" stack is NOT present (1-column wide content grid layout)
    const upcomingLessonsCard = page.locator('.side-stack');
    await expect(upcomingLessonsCard).not.toBeVisible();
    
    const contentGrid = page.locator('.content-grid');
    const gridStyle = await contentGrid.evaluate(el => window.getComputedStyle(el).gridTemplateColumns);
    // Since side-stack is removed, content grid should not have "minmax(0, 1fr) 330px" (two cols). It should be a single column.
    expect(gridStyle).not.toContain('330px');

    // 7. Assert filters bar
    const typeTabs = page.locator('#typeTabs');
    const statusFilter = page.locator('#statusFilter');
    const ownerFilter = page.locator('#ownerFilter');
    const searchInput = page.locator('#searchInput');

    await expect(typeTabs).toBeVisible();
    await expect(statusFilter).toBeVisible();
    await expect(ownerFilter).toBeVisible();
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute('placeholder', '일정명, 학생명 검색');

    // 8. Test type tabs filtering (Click "콩쿠르" and assert cards count updates)
    const concoursTab = typeTabs.locator('button:text-is("콩쿠르")');
    await concoursTab.click();
    await expect(cards).toHaveCount(2); // Only "한국청소년 피아노 콩쿠르" and "영 첼리스트 콩쿠르"

    // Click "전체" to reset
    const allTab = typeTabs.locator('button:text-is("전체")');
    await allTab.click();
    await expect(cards).toHaveCount(6);

    // 9. Test search filter (Input "이서윤" and check filtered rows)
    await searchInput.fill('이서윤');
    await page.waitForTimeout(100);
    // When searching for 이서윤, only events involving 이서윤 should remain
    await expect(page.locator('#eventBody tr')).toHaveCount(2); // "한국청소년 피아노 콩쿠르", "여름 정기 음악회"

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(100);

    // 10. Verify View Tabs transition and Columns
    const eventViewBtn = page.locator('#eventViewBtn');
    const participantViewBtn = page.locator('#participantViewBtn');
    const tableViewHelp = page.locator('#tableViewHelp');

    await expect(eventViewBtn).toHaveClass(/active/);
    await expect(tableViewHelp).toContainText('일정 단위로 마감/공개/참여 원생을 봅니다.');

    // Assert main table headers in event view
    const eventHeaders = page.locator('#eventHead th');
    const expectedEventHeaders = ['일정', '구분', '일자', 'D-day', '포함 원생', '미처리', '담당자', '공개', '상태', '확인'];
    for (let i = 0; i < expectedEventHeaders.length; i++) {
        await expect(eventHeaders.nth(i)).toHaveText(expectedEventHeaders[i]);
    }

    // Switch to participant view
    await participantViewBtn.click();
    await expect(participantViewBtn).toHaveClass(/active/);
    await expect(tableViewHelp).toContainText('원생 단위로 관련 일정과 다가오는 수업 정보를 봅니다.');

    // Assert main table headers in participant view
    const participantHeaders = page.locator('#eventHead th');
    const expectedParticipantHeaders = ['참여 원생', '관련 일정', '구분', '일자', 'D-day', '다가오는 수업', '담당자', '메모', '확인'];
    for (let i = 0; i < expectedParticipantHeaders.length; i++) {
        await expect(participantHeaders.nth(i)).toHaveText(expectedParticipantHeaders[i]);
    }

    // Switch back to event view
    await eventViewBtn.click();

    // 11. Test Drawers
    const drawer = page.locator('#drawer');
    const backdrop = page.locator('#drawerBackdrop');
    await expect(drawer).not.toHaveClass(/open/);
    await expect(backdrop).not.toBeVisible();

    // Open Event Drawer by clicking the target card (second card)
    await targetCard.click();
    await expect(drawer).toHaveClass(/open/);
    await expect(backdrop).toBeVisible();
    await expect(drawer.locator('#drawerHead')).toContainText('한국청소년 피아노 콩쿠르');
    
    // Close Drawer
    await backdrop.click();
    await expect(drawer).not.toHaveClass(/open/);

    // Open Student Drawer by switching to participant view and clicking the first row
    await participantViewBtn.click();
    const firstRow = page.locator('#eventBody tr').first();
    await firstRow.click();
    await expect(drawer).toHaveClass(/open/);
    await expect(drawer.locator('#drawerHead')).toContainText('박도현');

    // Close Student Drawer
    await page.locator('.drawer-close').click();
    await expect(drawer).not.toHaveClass(/open/);

    // Switch back to event view and click "일정 추가"
    await eventViewBtn.click();
    await page.locator('button:text-is("일정 추가")').click();
    await expect(drawer).toHaveClass(/open/);
    await expect(drawer.locator('#drawerHead')).toContainText('일정 추가');

    // Close Create Drawer
    await page.locator('.drawer-close').click();
    await expect(drawer).not.toHaveClass(/open/);

    // 12. Verify cleanup on page transition
    const todayConsoleMenu = page.locator('.menu-item[data-view="dir-today-console"]');
    await expect(todayConsoleMenu).toBeVisible();
    await todayConsoleMenu.click();
    
    // Verify that the global header actions for major schedule are removed
    await expect(page.locator('#major-schedule-global-header-actions')).not.toBeVisible();

    // 13. Verify switching back and forth between Major Schedule and Attendance Control
    // Go to Attendance Control view
    const attendanceMenu = page.locator('.menu-item[data-view="dir-attendance-control"]');
    await expect(attendanceMenu).toBeVisible();
    await attendanceMenu.click();

    // Verify Attendance Control actions are mounted and Major Schedule actions are not
    const acRefreshBtn = page.locator('#ac-refresh-btn');
    await expect(acRefreshBtn).toBeVisible();
    await expect(page.locator('#major-schedule-refresh-btn')).not.toBeVisible();

    // Go back to Major Schedule view
    const majorScheduleMenu = page.locator('.menu-item[data-view="dir-major-schedule"]');
    await expect(majorScheduleMenu).toBeVisible();
    await majorScheduleMenu.click();

    // Verify Major Schedule actions are restored and Attendance Control actions are removed
    await expect(page.locator('#major-schedule-refresh-btn')).toBeVisible();
    await expect(page.locator('#ac-refresh-btn')).not.toBeVisible();
  });
});
