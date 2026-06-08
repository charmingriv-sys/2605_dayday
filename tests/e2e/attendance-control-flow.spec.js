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

      // Mock localStorage to dynamically inject S1 unpaid tuition status for E2E tests
      const DB_KEY = 'turing_academy_db_v3';
      const origGetItem = window.localStorage.getItem.bind(window.localStorage);
      window.localStorage.getItem = (key) => {
        const val = origGetItem(key);
        if (key === DB_KEY && val) {
          try {
            const db = JSON.parse(val);
            if (db.payments && !db.payments.some(p => p.studentId === 'S1' && p.month === '2026-05' && p.type === 'education')) {
              db.payments.push({
                id: 'P_S1_UNPAID_E2E',
                studentId: 'S1',
                amount: 150000,
                month: '2026-05',
                type: 'education',
                status: 'unpaid',
                invoiceDate: '2026-05-10',
                paidDate: null,
                method: null
              });
              const s1 = db.students?.find(s => s.id === 'S1');
              if (s1) {
                s1.paymentStatus = 'unpaid';
              }
              window.localStorage.setItem(DB_KEY, JSON.stringify(db));
              return JSON.stringify(db);
            }
          } catch (e) {}
        }
        return val;
      };

      const origSetItem = window.localStorage.setItem.bind(window.localStorage);
      window.localStorage.setItem = (key, val) => {
        let finalVal = val;
        if (key === DB_KEY && val) {
          try {
            const db = JSON.parse(val);
            if (db.payments && !db.payments.some(p => p.studentId === 'S1' && p.month === '2026-05' && p.type === 'education')) {
              db.payments.push({
                id: 'P_S1_UNPAID_E2E',
                studentId: 'S1',
                amount: 150000,
                month: '2026-05',
                type: 'education',
                status: 'unpaid',
                invoiceDate: '2026-05-10',
                paidDate: null,
                method: null
              });
              const s1 = db.students?.find(s => s.id === 'S1');
              if (s1) {
                s1.paymentStatus = 'unpaid';
              }
              finalVal = JSON.stringify(db);
            }
          } catch (e) {}
        }
        origSetItem(key, finalVal);
      };
    });

    // Navigate and login as director
    await page.goto('/');
    await page.locator('.role-btn.director').click();
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
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
    const periodBtn = page.locator('#ac-period-btn');
    const statusSelect = page.locator('#ac-status-select');
    const instrumentSelect = page.locator('#ac-instrument-select');
    const teacherSelect = page.locator('#ac-teacher-select');
    const searchType = page.locator('#ac-search-type');
    const searchInput = page.locator('#ac-search-input');

    await expect(periodBtn).toBeVisible();
    await expect(statusSelect).toBeVisible();
    await expect(instrumentSelect).toBeVisible();
    await expect(teacherSelect).toBeVisible();
    await expect(searchType).toBeVisible();
    await expect(searchInput).toBeVisible();

    // Verify start/end date inputs inside popover become visible after clicking periodBtn
    await periodBtn.click();
    const startDateInput = page.locator('#ac-start-date');
    const endDateInput = page.locator('#ac-end-date');
    const customRangeApplyBtn = page.locator('#ac-custom-range-apply-btn');
    await expect(startDateInput).toBeVisible();
    await expect(endDateInput).toBeVisible();
    await expect(customRangeApplyBtn).toBeVisible();
    await periodBtn.click(); // Close it again

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

    // Click a student row in the table (최다은 is seeded by default)
    const firstStudentNameText = page.locator('table.custom-table tbody tr .student-name-text').first();
    await expect(firstStudentNameText).toBeVisible();
    
    // Verify name label is rendered as a plain bold text tag (e.g. B tag) and not a button or link
    const tagName = await firstStudentNameText.evaluate(el => el.tagName);
    expect(tagName).toBe('B');

    await firstStudentNameText.click();

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

    // Verify warning text is correct based on real data for 최다은 (결석 잦음, 출결률 저조)
    const warningList = page.locator('#ac-inspector-warning-list');
    await expect(warningList).toContainText('결석 잦음');
    await expect(warningList).toContainText('출결률 저조');
    await expect(warningList).not.toContainText('이상 없음');

    // Verify calendar cell for the current mock day (3rd) is highlighted as today
    const todayCell = page.locator('#ac-inspector-calendar-mini .cal-cell.today');
    await expect(todayCell).toBeVisible();
    await expect(todayCell).toHaveText('3');

    // Verify mini calendar contains present, late, absent classes
    const miniCalendar = page.locator('#ac-inspector-calendar-mini');
    await expect(miniCalendar.locator('.cal-cell.present').first()).toBeVisible();
    await expect(miniCalendar.locator('.cal-cell.late').first()).toBeVisible();
    await expect(miniCalendar.locator('.cal-cell.absent').first()).toBeVisible();

    // Verify at least 1 message history row is rendered (real data for 최다은 MSG1)
    const msgList = page.locator('#ac-inspector-msg-list');
    await expect(msgList).toContainText('양손 프레이징 개별 안내');
    await expect(msgList.locator('.log-item').first()).toBeVisible();

    // Verify at least 1 payment history item is rendered (real data for 최다은 SB1/SB2)
    const paymentBox = page.locator('#ac-inspector-tuition-box');
    await expect(paymentBox).toContainText('꼬마바이엘');
    await expect(paymentBox).toContainText('완납');
    await expect(paymentBox).toContainText('결제요청');

    // Verify badge text cleanliness (no symbols like ✓, !, ×)
    const tableRow = page.locator('table.custom-table tbody tr').first();
    const badgeElement = tableRow.locator('.badge');
    if (await badgeElement.count() > 0) {
      const badgeTextVal = await badgeElement.first().innerText();
      expect(badgeTextVal).not.toContain('✓');
      expect(badgeTextVal).not.toContain('!');
      expect(badgeTextVal).not.toContain('×');
    }

    // Verify mouse cursor pointer on row/name elements
    const firstRowCursor = await tableRow.evaluate(el => window.getComputedStyle(el).cursor);
    expect(firstRowCursor).toBe('pointer');
    const nameCursor = await firstStudentNameText.evaluate(el => window.getComputedStyle(el).cursor);
    expect(nameCursor).toBe('pointer');

    // Verify inspector key text font-sizes
    const sectionTitleFontSize = await page.locator('.section-title h3').first().evaluate(el => window.getComputedStyle(el).fontSize);
    expect(parseFloat(sectionTitleFontSize)).toBeGreaterThanOrEqual(15);
    const tileTimeFontSize = await page.locator('.tile-time').first().evaluate(el => window.getComputedStyle(el).fontSize);
    expect(parseFloat(tileTimeFontSize)).toBeGreaterThanOrEqual(16);
    const tileCountFontSize = await page.locator('.tile-count').first().evaluate(el => window.getComputedStyle(el).fontSize);
    expect(parseFloat(tileCountFontSize)).toBeGreaterThanOrEqual(14);
    const tileStatFontSize = await page.locator('.tile-stat').first().evaluate(el => window.getComputedStyle(el).fontSize);
    expect(parseFloat(tileStatFontSize)).toBeGreaterThanOrEqual(13);
    const miniRowFontSize = await page.locator('.mini-row').first().evaluate(el => window.getComputedStyle(el).fontSize);
    expect(parseFloat(miniRowFontSize)).toBeGreaterThanOrEqual(13);

    // Verify compact board horizontal scroll setup
    const compactBoard = page.locator('#compactBoard');
    await expect(compactBoard).toHaveCSS('display', 'grid');
    await expect(compactBoard).toHaveCSS('grid-auto-flow', 'column');
    await expect(compactBoard).toHaveCSS('overflow-x', 'auto');

    // Verify that "특이사항/사유" or "사유" text is NOT present in the history list of inspector
    const historyList = page.locator('#ac-inspector-history-list');
    await expect(historyList).not.toContainText('사유');
    await expect(historyList).not.toContainText('특이사항');

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

  test('should filter table and compact board by date, status, instrument, teacher, name and member ID', async ({ page }) => {
    // Go to attendance control view
    await page.locator('.menu-item[data-view="dir-attendance-control"]').click();
    await expect(page.locator('#page-title')).toContainText('출결 관제');

    // 1. Assert Daily Tab is active by default
    const dailyTab = page.locator('.ac-tab[data-tab="daily"]');
    await expect(dailyTab).toHaveClass(/active/);

    // 2. Assert status filter option cleanliness (no '미확인' or '하원누락')
    const statusSelect = page.locator('#ac-status-select');
    await expect(statusSelect).toBeVisible();
    const options = await statusSelect.locator('option').allInnerTexts();
    expect(options).not.toContain('미확인 (지연)');
    expect(options).not.toContain('하원 누락');
    expect(options).toContain('예정');
    expect(options).toContain('출석');
    expect(options).toContain('지각');
    expect(options).toContain('결석');

    // 3. Verify that overdue class today default to "지각" (lateness integration)
    // Datepicker value defaults to today (2026-06-03).
    // Let's mock 최다은's Wednesday class time to 08:00 (which is overdue by 09:00 mockTime)
    await page.evaluate(() => {
      const date = '2026-06-03';
      const snapshot = window.stateStore.ensureScheduleSnapshotForDate(date);
      const entry = snapshot.entries.find(e => e.studentId === 'S1');
      if (entry) {
        entry.startTime = '08:00';
        window.stateStore.saveDB();
      }
    });

    // Go to attendance control view again / refresh to load the mocked state
    await page.locator('.menu-item[data-view="dir-attendance-control"]').click();
    await page.waitForTimeout(300);

    const searchType = page.locator('#ac-search-type');
    const searchInput = page.locator('#ac-search-input');
    await searchType.selectOption('name');
    await searchInput.fill('최다은');
    await page.waitForTimeout(300);
    
    const demoRow = page.locator('table.custom-table tbody tr').first();
    await expect(demoRow).toBeVisible();
    await expect(demoRow).toContainText('최다은');
    await expect(demoRow.locator('.badge')).toContainText('지각');

    // Verify that the status badge uses the common soft badge styling class (.badge.warn)
    await expect(demoRow.locator('.badge')).toHaveClass(/badge/);
    await expect(demoRow.locator('.badge')).toHaveClass(/warn/);

    // Reset search
    await searchInput.fill('');
    await page.waitForTimeout(300);

    // 4. Filter by Date (e.g. 2026-06-01 which is Monday)
    await page.locator('#ac-period-btn').click();
    await page.locator('#ac-start-date').fill('2026-06-01');
    await page.locator('#ac-end-date').fill('2026-06-01');
    await page.locator('#ac-custom-range-apply-btn').click();
    await page.waitForTimeout(300);

    // Get initial table row count for Monday
    const initialRowsCount = await page.locator('table.custom-table tbody tr').count();
    expect(initialRowsCount).toBeGreaterThan(0);

    // 5. Filter by Status (e.g. "출석")
    await statusSelect.selectOption('출석');
    await page.waitForTimeout(300);
    const presentRowsCount = await page.locator('table.custom-table tbody tr').count();
    for (let i = 0; i < presentRowsCount; i++) {
      const badgeText = await page.locator('table.custom-table tbody tr').nth(i).locator('.badge').innerText();
      expect(badgeText).toContain('출석');
      await expect(page.locator('table.custom-table tbody tr').nth(i).locator('.badge')).toHaveClass(/good/);
    }

    // Reset status filter
    await statusSelect.selectOption('전체');
    await page.waitForTimeout(300);

    // 6. Filter by Instrument (e.g. "피아노")
    const instrumentSelect = page.locator('#ac-instrument-select');
    await instrumentSelect.selectOption('피아노');
    await page.waitForTimeout(300);
    const pianoRowsCount = await page.locator('table.custom-table tbody tr').count();
    expect(pianoRowsCount).toBeLessThan(initialRowsCount);

    // Reset instrument filter
    await instrumentSelect.selectOption('전체');
    await page.waitForTimeout(300);

    // 7. Filter by Teacher (e.g. "정은비" -> T8)
    const teacherSelect = page.locator('#ac-teacher-select');
    await teacherSelect.selectOption('T8');
    await page.waitForTimeout(300);
    const teacherRowsCount = await page.locator('table.custom-table tbody tr').count();
    expect(teacherRowsCount).toBeLessThan(initialRowsCount);

    // Reset teacher filter
    await teacherSelect.selectOption('전체');
    await page.waitForTimeout(300);

    // 8. Search by Name (triggers instant filtering without Enter)
    await searchType.selectOption('name');
    await searchInput.fill('최다은');
    await page.waitForTimeout(300);
    const nameSearchedCount = await page.locator('table.custom-table tbody tr').count();
    expect(nameSearchedCount).toBe(1);
    await expect(page.locator('table.custom-table tbody tr').first()).toContainText('최다은');

    // 9. Search by Member ID (exact match S1, should not mix S10/S11)
    await searchInput.fill('S1');
    await searchType.selectOption('id');
    await page.waitForTimeout(300);
    const idSearchedCount = await page.locator('table.custom-table tbody tr').count();
    expect(idSearchedCount).toBe(1);
    await expect(page.locator('table.custom-table tbody tr').first()).toContainText('최다은');

    // 10. Search non-existent Member ID
    await searchInput.fill('S999');
    await page.waitForTimeout(300);
    const emptyCount = await page.locator('table.custom-table tbody tr').count();
    expect(emptyCount).toBe(0);

    // 11. Search type toggling immediately re-filters without Enter
    await searchInput.fill('최다은');
    await searchType.selectOption('name');
    await page.waitForTimeout(300);
    const toggleCount = await page.locator('table.custom-table tbody tr').count();
    expect(toggleCount).toBe(1);

    // Reset search
    await searchInput.fill('');
    await page.waitForTimeout(300);
  });

  test('should support student-wise, instrument-wise, and teacher-wise attendance inquiry tabs with active filters', async ({ page }) => {
    // Go to attendance control view
    await page.locator('.menu-item[data-view="dir-attendance-control"]').click();
    await expect(page.locator('#page-title')).toContainText('출결 관제');

    // 1. Click "원생별 조회" tab
    const studentTab = page.locator('.ac-tab[data-tab="student"]');
    await studentTab.click();
    await page.waitForTimeout(300);

    // Set selectedDate to 2026-06-30 to align month range with fake S1 history
    await page.locator('#ac-period-btn').click();
    await page.locator('#ac-start-date').fill('2026-06-30');
    await page.locator('#ac-end-date').fill('2026-06-30');
    await page.locator('#ac-custom-range-apply-btn').click();
    await page.waitForTimeout(300);

    // Set range preset to Month to verify historical stats mapping
    await page.locator('#ac-period-btn').click();
    await page.locator('.ac-preset-btn[data-range="month"]').click();
    await page.waitForTimeout(300);
    
    // Assert student table container is rendered
    const tableHeader = page.locator('table.custom-table thead');
    await expect(tableHeader).toContainText('총수업일수');
    await expect(tableHeader).toContainText('출석률');

    // 2. Test auto name filtering in student tab (without Enter)
    const searchInput = page.locator('#ac-search-input');
    const searchType = page.locator('#ac-search-type');
    await searchType.selectOption('name');
    await searchInput.fill('최다은');
    await page.waitForTimeout(300);
    
    let rowsCount = await page.locator('table.custom-table tbody tr').count();
    expect(rowsCount).toBe(1);
    await expect(page.locator('table.custom-table tbody tr').first()).toContainText('최다은');

    // Verify that the attendance rate is calculated based on plannedCount (9) which is greater than present+late+absent (3+1+4 = 8)
    // present (3) + late (1) = 4. 4 / 9 = 44.44% -> 44%. (Using 3+1+4 = 8 as denominator would yield 50%)
    const firstRow = page.locator('table.custom-table tbody tr').first();
    const cells = firstRow.locator('td');
    await expect(cells.nth(4)).toContainText('9회');
    await expect(cells.nth(5)).toContainText('3회');
    await expect(cells.nth(6)).toContainText('1회');
    await expect(cells.nth(7)).toContainText('1회');
    await expect(cells.nth(8)).toContainText('44%');

    // Test name text is plain bold text B element and NOT button
    const studentNameEl = firstRow.locator('.student-name-text');
    const tagName = await studentNameEl.evaluate(el => el.tagName);
    expect(tagName).toBe('B');

    // 3. Test Member ID exact match filtering in student tab
    await searchInput.fill('S1');
    await searchType.selectOption('id');
    await page.waitForTimeout(300);
    rowsCount = await page.locator('table.custom-table tbody tr').count();
    expect(rowsCount).toBe(1);
    await expect(page.locator('table.custom-table tbody tr').first()).toContainText('최다은');

    // Reset search
    await searchInput.fill('');
    await searchType.selectOption('name');
    await page.waitForTimeout(300);

    // 4. Click "악기/반 별 조회" tab
    const classTab = page.locator('.ac-tab[data-tab="class"]');
    await classTab.click();
    await page.waitForTimeout(300);

    // Assert class group cards are rendered
    const classContainer = page.locator('.class-groups-container');
    await expect(classContainer).toBeVisible();
    const groupCards = page.locator('.class-groups-container .group-card');
    await expect(groupCards.first()).toBeVisible();

    // 5. Test Instrument filter in class tab
    const instrumentSelect = page.locator('#ac-instrument-select');
    await instrumentSelect.selectOption('피아노');
    await page.waitForTimeout(300);
    const pianoGroupCount = await page.locator('.class-groups-container .group-card').count();
    expect(pianoGroupCount).toBe(1);
    await expect(page.locator('.class-groups-container .group-card').first()).toContainText('피아노');

    // Verify piano group stats and structural restoration of card UI
    const pianoCard = page.locator('.class-groups-container .group-card').first();
    await expect(pianoCard).toContainText('피아노');
    await expect(pianoCard).toContainText('출석률');
    await expect(pianoCard).toContainText('예정 105');
    await expect(pianoCard).toContainText('출석 3');
    await expect(pianoCard).toContainText('지각 1');
    await expect(pianoCard).toContainText('결석 13');
    await expect(pianoCard).toContainText('4%');

    const pianoTableCount = await pianoCard.locator('table.custom-table').count();
    expect(pianoTableCount).toBe(0);
    const pianoGroupList = pianoCard.locator('.group-list');
    
    // 1) Verify initially collapsed
    await expect(pianoGroupList).not.toBeVisible();
    const pianoToggleBtn = pianoCard.locator('.toggle-group-btn');
    await expect(pianoToggleBtn).toBeVisible();
    await expect(pianoToggleBtn).toHaveText('명단 펼치기');

    // 2) Expand and verify
    await pianoToggleBtn.click();
    await expect(pianoGroupList).toBeVisible();
    await expect(pianoToggleBtn).toHaveText('명단 접기');
    const pianoGroupStudents = pianoGroupList.locator('.group-student');
    const pianoGroupStudentsCount = await pianoGroupStudents.count();
    expect(pianoGroupStudentsCount).toBeGreaterThanOrEqual(1);

    // 3) Collapse and verify
    await pianoToggleBtn.click();
    await expect(pianoGroupList).not.toBeVisible();
    await expect(pianoToggleBtn).toHaveText('명단 펼치기');

    // Reset instrument filter
    await instrumentSelect.selectOption('전체');
    await page.waitForTimeout(300);

    // 6. Click "강사별 조회" tab
    const teacherTab = page.locator('.ac-tab[data-tab="teacher"]');
    await teacherTab.click();
    await page.waitForTimeout(300);

    // Assert teacher group cards are rendered
    const teacherContainer = page.locator('.teacher-groups-container');
    await expect(teacherContainer).toBeVisible();

    // 7. Test Teacher filter in teacher tab
    const teacherSelect = page.locator('#ac-teacher-select');
    await teacherSelect.selectOption('T8');
    await page.waitForTimeout(300);
    const teacherGroupCount = await page.locator('.teacher-groups-container .group-card').count();
    expect(teacherGroupCount).toBe(1);
    await expect(page.locator('.teacher-groups-container .group-card').first()).toContainText('정은비');

    // Verify teacher group stats and structural restoration of card UI
    const teacherCard = page.locator('.teacher-groups-container .group-card').first();
    await expect(teacherCard).toContainText('정은비');
    await expect(teacherCard).toContainText('출석률');
    await expect(teacherCard).toContainText('예정 63');
    await expect(teacherCard).toContainText('출석 3');
    await expect(teacherCard).toContainText('지각 1');
    await expect(teacherCard).toContainText('결석 7');
    await expect(teacherCard).toContainText('6%');

    const teacherTableCount = await teacherCard.locator('table.custom-table').count();
    expect(teacherTableCount).toBe(0);
    const teacherGroupList = teacherCard.locator('.group-list');

    // 1) Verify initially collapsed
    await expect(teacherGroupList).not.toBeVisible();
    const teacherToggleBtn = teacherCard.locator('.toggle-group-btn');
    await expect(teacherToggleBtn).toBeVisible();
    await expect(teacherToggleBtn).toHaveText('명단 펼치기');

    // 2) Expand and verify
    await teacherToggleBtn.click();
    await expect(teacherGroupList).toBeVisible();
    await expect(teacherToggleBtn).toHaveText('명단 접기');
    const teacherGroupStudents = teacherGroupList.locator('.group-student');
    const teacherGroupStudentsCount = await teacherGroupStudents.count();
    expect(teacherGroupStudentsCount).toBeGreaterThanOrEqual(1);

    // 3) Collapse and verify
    await teacherToggleBtn.click();
    await expect(teacherGroupList).not.toBeVisible();
    await expect(teacherToggleBtn).toHaveText('명단 펼치기');

    // Reset teacher filter
    await teacherSelect.selectOption('전체');
    await page.waitForTimeout(300);

    // 8. Verify status select options in teacher tab (cleanliness check)
    const statusSelect = page.locator('#ac-status-select');
    const options = await statusSelect.locator('option').allInnerTexts();
    expect(options).not.toContain('미확인 (지연)');
    expect(options).not.toContain('하원 누락');
  });

  test('should support student inspector real data integration in all inquiry tabs', async ({ page }) => {
    // Go to attendance control view
    await page.locator('.menu-item[data-view="dir-attendance-control"]').click();
    await expect(page.locator('#page-title')).toContainText('출결 관제');

    const inspectorPanel = page.locator('#ac-inspector-panel');

    // 1. Daily Tab row click
    const firstRowStudent = page.locator('table.custom-table tbody tr .student-name-text').first();
    const studentName = await firstRowStudent.innerText();
    await firstRowStudent.click();
    await expect(inspectorPanel).toHaveClass(/open/);
    await expect(page.locator('#ac-inspector-name')).toHaveText(studentName);
    
    // Verify 30-day mini calendar is rendered and NOT hardcoded (should have 30 cells)
    const calCells = page.locator('#ac-inspector-calendar-mini .cal-cell');
    await expect(calCells).toHaveCount(30);

    // Verify 4-status policy (예정 / 출석 / 지각 / 결석) in stats grid
    const statGrid = page.locator('.ac-stat-grid');
    await expect(statGrid).toContainText('예정 수업');
    await expect(statGrid).toContainText('출석');
    await expect(statGrid).toContainText('지각');
    await expect(statGrid).toContainText('결석');
    await expect(statGrid).toContainText('출석률');

    // Verify history list and messages/payments
    await expect(page.locator('#ac-inspector-history-list')).toBeVisible();
    await expect(page.locator('#ac-inspector-msg-list')).toBeVisible();
    await expect(page.locator('#ac-inspector-tuition-box')).toBeVisible();

    // Close inspector
    await page.locator('#ac-drawer-backdrop').click();
    await expect(inspectorPanel).not.toHaveClass(/open/);

    // 2. Student Tab row click
    await page.locator('.ac-tab[data-tab="student"]').click();
    await page.waitForTimeout(300);
    const studentTabRow = page.locator('table.custom-table tbody tr .student-name-text').first();
    const studentNameFromTab = await studentTabRow.innerText();
    await studentTabRow.click();
    await expect(inspectorPanel).toHaveClass(/open/);
    await expect(page.locator('#ac-inspector-name')).toHaveText(studentNameFromTab);
    
    // Close inspector
    await page.locator('#ac-drawer-backdrop').click();
    await expect(inspectorPanel).not.toHaveClass(/open/);

    // 3. Class Tab student click
    await page.locator('.ac-tab[data-tab="class"]').click();
    await page.waitForTimeout(300);
    // Expand first card group list
    const classCard = page.locator('.class-groups-container .group-card').first();
    await classCard.locator('.toggle-group-btn').click();
    await page.waitForTimeout(100);
    const classStudentLink = classCard.locator('.group-student').first();
    const classStudentName = await classStudentLink.locator('.student-name').innerText();
    await classStudentLink.click();
    await expect(inspectorPanel).toHaveClass(/open/);
    await expect(page.locator('#ac-inspector-name')).toHaveText(classStudentName.trim());

    // Close inspector
    await page.locator('#ac-drawer-backdrop').click();
    await expect(inspectorPanel).not.toHaveClass(/open/);

    // 4. Teacher Tab student click
    await page.locator('.ac-tab[data-tab="teacher"]').click();
    await page.waitForTimeout(300);
    // Expand first card group list
    const teacherCard = page.locator('.teacher-groups-container .group-card').first();
    await teacherCard.locator('.toggle-group-btn').click();
    await page.waitForTimeout(100);
    const teacherStudentLink = teacherCard.locator('.group-student').first();
    const teacherStudentName = await teacherStudentLink.locator('.student-name').innerText();
    await teacherStudentLink.click();
    await expect(inspectorPanel).toHaveClass(/open/);
    await expect(page.locator('#ac-inspector-name')).toHaveText(teacherStudentName.trim());

    // Close inspector
    await page.locator('#ac-drawer-backdrop').click();
    await expect(inspectorPanel).not.toHaveClass(/open/);
  });

  test('should render real warning cards, open inspector on click, and show empty state appropriately', async ({ page }) => {
    // 1. Go to attendance control view
    await page.locator('.menu-item[data-view="dir-attendance-control"]').click();
    await expect(page.locator('#page-title')).toContainText('출결 관제');

    // 2. We can seed some specific warning condition via page.evaluate
    await page.evaluate(() => {
      window.stateStore.db.attendance = [];
      window.stateStore.db.scheduleSnapshots = [];
      
      const date = '2026-06-03';
      const dates = [
        '2026-06-03', '2026-06-01', '2026-05-29', '2026-05-27', '2026-05-25',
        '2026-05-22', '2026-05-20', '2026-05-18'
      ];
      dates.forEach(d => {
        let snap = window.stateStore.db.scheduleSnapshots.find(s => s.date === d);
        if (!snap) {
          snap = window.stateStore.ensureScheduleSnapshotForDate(d);
        }
        const hasEntry = snap.entries.some(e => e.studentId === 'S1');
        if (!hasEntry) {
          snap.entries.push({
            id: `ENTRY_${d}_S1_99`,
            studentId: 'S1',
            teacherId: 'T8',
            startTime: '14:00',
            endTime: '14:30',
            subjectId: '피아노',
            source: 'default'
          });
        }
      });

      window.stateStore.db.attendance = window.stateStore.db.attendance.filter(a => a.studentId !== 'S1');
      window.stateStore.db.attendance.push(
        { id: 'AE1', studentId: 'S1', date: '2026-06-03', status: 'absent', time: '' },
        { id: 'AE2', studentId: 'S1', date: '2026-06-01', status: 'absent', time: '' },
        { id: 'AE3', studentId: 'S1', date: '2026-05-29', status: 'absent', time: '' },
        { id: 'AE4', studentId: 'S1', date: '2026-05-27', status: 'present', time: '14:00' },
        { id: 'AE5', studentId: 'S1', date: '2026-05-25', status: 'present', time: '14:00' },
        { id: 'AE6', studentId: 'S1', date: '2026-05-22', status: 'present', time: '14:00' },
        { id: 'AE7', studentId: 'S1', date: '2026-05-20', status: 'present', time: '14:00' },
        { id: 'AE8', studentId: 'S1', date: '2026-05-18', status: 'present', time: '14:00' }
      );
      window.stateStore.saveDB();
    });

    await page.locator('.menu-item[data-view="dir-attendance-control"]').click();
    await page.waitForTimeout(300);

    const warningList = page.locator('#attendanceWarningList');
    await expect(warningList).toBeVisible();
    const s1WarningRow = page.locator('.warning-row[data-student-id="S1"]');
    await expect(s1WarningRow).toBeVisible();

    const firstWarningText = await s1WarningRow.innerText();
    expect(firstWarningText).toContain('연속 결석');
    expect(firstWarningText).toContain('최근 2회 연속 결석 (비성인)');

    await page.evaluate(() => {
      const s1 = window.stateStore.db.students.find(s => s.id === 'S1');
      if (s1) {
        s1.isAdult = true;
        s1.age = 30;
        s1.parentPhone = '';
      }
      window.stateStore.saveDB();
    });

    // Click refresh button to re-render the view with modified DB state
    await page.locator('#ac-refresh-btn').click();
    await page.waitForTimeout(300);

    const redWarningText = await s1WarningRow.innerText();
    expect(redWarningText).toContain('출결 위험');
    expect(redWarningText).toContain('최근 4주 예정 10회 중 결석 5회, 결석률 50%');

    await s1WarningRow.click();
    const inspectorPanel = page.locator('#ac-inspector-panel');
    await expect(inspectorPanel).toHaveClass(/open/);
    await expect(page.locator('#ac-inspector-name')).toContainText('최다은');

    await page.locator('#ac-drawer-backdrop').click();
    await expect(inspectorPanel).not.toHaveClass(/open/);

    await page.evaluate(() => {
      window.stateStore.db.students = [];
      window.stateStore.saveDB();
    });

    await page.locator('#ac-refresh-btn').click();
    await page.waitForTimeout(300);

    const emptyState = warningList.locator('.warning-empty-state');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('이상 없음');

    // Restore localStorage DB to default to avoid breaking subsequent tests
    await page.evaluate(() => {
      localStorage.removeItem('turing_academy_db_v3');
    });
  });

  test('should verify Phase 9C-5A-Repair-C: period selection popover opacity, range calculations, and quick preset resets', async ({ page }) => {
    // Inject today's absent record for S1 to ensure Urgent Queue has an item
    await page.evaluate(() => {
      window.stateStore.db.attendance = window.stateStore.db.attendance.filter(a => !(a.studentId === 'S1' && a.date === '2026-06-03'));
      window.stateStore.db.attendance.push({
        id: 'AE_TODAY',
        studentId: 'S1',
        date: '2026-06-03',
        status: 'absent',
        time: ''
      });
      window.stateStore.saveDB();
    });

    // Go to attendance control view
    await page.locator('.menu-item[data-view="dir-attendance-control"]').click();
    await expect(page.locator('#page-title')).toContainText('출결 관제');

    // 1. Verify period selection button and popover opening
    const periodBtn = page.locator('#ac-period-btn');
    const periodPopover = page.locator('#ac-period-popover');
    const periodLabel = page.locator('#ac-period-label');

    await expect(periodBtn).toBeVisible();
    await expect(periodPopover).not.toBeVisible();

    // Click to open popover
    await periodBtn.click();
    await expect(periodPopover).toBeVisible();

    // Verify opacity: background-color is solid white and fully opaque (alpha = 1)
    const popoverBg = await periodPopover.evaluate(el => window.getComputedStyle(el).backgroundColor);
    expect(popoverBg).toBe('rgb(255, 255, 255)');

    // Verify mini-calendar and quick presets are visible inside popover
    const calDaysGrid = page.locator('#ac-cal-days-grid');
    const presetsContainer = page.locator('.quick-presets');
    await expect(calDaysGrid).toBeVisible();
    await expect(presetsContainer).toBeVisible();

    // 2. Verify existence of quick presets inside popover
    const todayPreset = presetsContainer.locator('button:text-is("오늘")');
    const weekPreset = presetsContainer.locator('button:text-is("이번주")');
    const lastWeekPreset = presetsContainer.locator('button:text-is("저번주")');
    const monthPreset = presetsContainer.locator('button:text-is("이번달")');
    const lastMonthPreset = presetsContainer.locator('button:text-is("지난달")');

    await expect(todayPreset).toBeVisible();
    await expect(weekPreset).toBeVisible();
    await expect(lastWeekPreset).toBeVisible();
    await expect(monthPreset).toBeVisible();
    await expect(lastMonthPreset).toBeVisible();

    // 3. Click "이번주" and check range label and popover closing
    await weekPreset.click();
    await expect(periodPopover).not.toBeVisible();
    await expect(periodLabel).toContainText('2026-06-01 ~ 2026-06-07');

    // 4. Click "지난달" and check range label
    await periodBtn.click();
    await expect(periodPopover).toBeVisible();
    await lastMonthPreset.click();
    await expect(periodPopover).not.toBeVisible();
    await expect(periodLabel).toContainText('2026-05-01 ~ 2026-05-31');

    // 5. Verify central urgent queue banner text does NOT contain "처리큐"
    const bannerText = page.locator('#urgentBannerText');
    await expect(bannerText).toBeVisible();
    const bannerContent = await bannerText.innerText();
    expect(bannerContent).not.toContain('처리큐');
    expect(bannerContent).toContain('선택 기간 결석');

    // 6. Test Custom Range Selection (e.g. 2026-04-01 ~ 2026-04-30)
    await periodBtn.click();
    await expect(periodPopover).toBeVisible();
    const startDateInput = page.locator('#ac-start-date');
    const endDateInput = page.locator('#ac-end-date');
    const customRangeApplyBtn = page.locator('#ac-custom-range-apply-btn');

    await expect(startDateInput).toBeVisible();
    await expect(endDateInput).toBeVisible();
    await expect(customRangeApplyBtn).toBeVisible();

    // Fill dates and apply custom range
    await startDateInput.fill('2026-04-01');
    await endDateInput.fill('2026-04-30');
    await customRangeApplyBtn.click();

    // Label should update to custom range
    await expect(periodPopover).not.toBeVisible();
    await expect(periodLabel).toContainText('2026-04-01 ~ 2026-04-30');

    // Verify statistics re-calculation (KPI Card value)
    const kpiTotalVal = await page.locator('.metric-card[data-status="전체"] .value').innerText();
    expect(kpiTotalVal).not.toBe('');

    // 7. Verify Custom Range validation (StartDate > EndDate auto correction)
    await periodBtn.click();
    await expect(periodPopover).toBeVisible();
    await startDateInput.fill('2026-05-10');
    await endDateInput.fill('2026-05-01');
    await customRangeApplyBtn.click();
    await expect(periodPopover).not.toBeVisible();
    // End date should be auto-corrected to start date
    await expect(periodLabel).toContainText('2026-05-10 ~ 2026-05-10');

    // 8. Verify quick preset click clears custom range status
    await periodBtn.click();
    await expect(periodPopover).toBeVisible();
    await presetsContainer.locator('button:text-is("이번주")').click();
    await expect(periodPopover).not.toBeVisible();
    await expect(periodLabel).toContainText('2026-05-04 ~ 2026-05-10');

    // 9. Verify parentPhone2 & parentName rendering inside student inspector
    await page.evaluate(() => {
      const s1 = window.stateStore.db.students.find(s => s.id === 'S1');
      if (s1) {
        s1.parentPhone2 = '010-7777-8888';
        s1.parentName = '최학부';
      }
      window.stateStore.saveDB();
    });

    // Refresh views
    await page.locator('#ac-refresh-btn').click();
    await page.waitForTimeout(300);

    // Open student inspector by clicking table row of S1
    await page.locator('tr[data-student-id="S1"] .student-name-text').first().click();
    const inspectorMeta = page.locator('#ac-inspector-meta');
    await expect(inspectorMeta).toContainText('보호자2: 010-7777-8888');
    await expect(inspectorMeta).toContainText('보호자명: 최학부');

    // Close inspector
    await page.locator('#ac-drawer-backdrop').click();

    // Expand board to verify expanded tile dimensions (Repair-B default is collapsed)
    await page.locator('#ac-toggle-board-btn').click();

    // 10. Verify enlarged time-tiles dimensions & styles (10% enlargement)
    const timeTile = page.locator('.time-tile').first();
    await expect(timeTile).toBeVisible();
    const minWidth = await timeTile.evaluate(el => window.getComputedStyle(el).minWidth);
    const minHeight = await timeTile.evaluate(el => window.getComputedStyle(el).minHeight);
    expect(parseFloat(minWidth)).toBeGreaterThanOrEqual(220);
    expect(parseFloat(minHeight)).toBeGreaterThanOrEqual(130);

    // 11. Verify Warning Console evidenceText size
    const evidenceText = page.locator('.warning-evidence').first();
    if (await evidenceText.count() > 0) {
      const evidenceFontSize = await evidenceText.evaluate(el => window.getComputedStyle(el).fontSize);
      expect(parseFloat(evidenceFontSize)).toBeLessThanOrEqual(13);
    }

    // 12. Verify Phase 9C-5A-Repair-D: Warning card UI, severity badge position, and text block structure
    const s1WarningRowInConsole = page.locator('.warning-row[data-student-id="S1"]');
    await expect(s1WarningRowInConsole).toBeVisible();

    // Verify severity label exists inside row as a badge (.warning-severity)
    const severityBadge = s1WarningRowInConsole.locator('.warning-severity');
    await expect(severityBadge).toBeVisible();
    await expect(severityBadge).toContainText('긴급');

    // Verify "긴급" is not placed in the right text block (.warning-rate strong should be attendance rate)
    const rateStrong = s1WarningRowInConsole.locator('.warning-rate strong');
    await expect(rateStrong).toBeVisible();
    const rateText = await rateStrong.innerText();
    expect(rateText).not.toContain('긴급');
    expect(rateText).not.toContain('경고');
    expect(rateText).not.toContain('주의');
    // It should represent percentage rate (e.g. "88%" or some numeric rate)
    expect(rateText).toMatch(/^\d+%/);

    // Verify warning reason and detail are present
    const warningReason = s1WarningRowInConsole.locator('.warning-reason');
    const warningDetail = s1WarningRowInConsole.locator('.warning-detail');
    await expect(warningReason).toBeVisible();
    await expect(warningDetail).toBeVisible();

    // Verify clicking the row opens the student inspector
    await s1WarningRowInConsole.click();
    const warningInspectorPanel = page.locator('#ac-inspector-panel');
    await expect(warningInspectorPanel).toHaveClass(/open/);
    await page.locator('#ac-drawer-backdrop').click(); // close it

    // 13. Verify Phase 9C-5B-2 & Repair-A & B: Late threshold display and integration in Attendance Control
    // Go to Academy Info / Settings View
    await page.locator('.menu-item[data-view="dir-academy-info"]').click();
    await page.locator('#academy-auth-password').fill('0000');
    await page.locator('#btn-submit-academy-auth').click();

    // Change value to 20 mins and save
    const lateThresholdSelect = page.locator('#acad-late-threshold');
    await expect(lateThresholdSelect).toBeVisible();
    await lateThresholdSelect.selectOption('20');
    await page.locator('#academy-info-form button[type="submit"]').click();

    // Go to Attendance Control View
    await page.locator('.menu-item[data-view="dir-attendance-control"]').click();
    await page.waitForTimeout(300);

    // Verify late threshold info pill is present with correct text
    const latePolicyInfo = page.locator('.ac-late-policy-info');
    await expect(latePolicyInfo).toBeVisible();
    await expect(latePolicyInfo).toContainText('현재 지각 기준: 수업 시작 후 20분');

    // Change value to 00 mins (Repair-A) and save
    await page.locator('.menu-item[data-view="dir-academy-info"]').click();
    await page.locator('#academy-auth-password').fill('0000');
    await page.locator('#btn-submit-academy-auth').click();
    await lateThresholdSelect.selectOption('0');
    await page.locator('#academy-info-form button[type="submit"]').click();

    // Go to Attendance Control View
    await page.locator('.menu-item[data-view="dir-attendance-control"]').click();
    await page.waitForTimeout(300);
    await expect(latePolicyInfo).toContainText('현재 지각 기준: 수업 시작 후 00분');

    // Change value to 05 mins (Repair-B) and save
    await page.locator('.menu-item[data-view="dir-academy-info"]').click();
    await page.locator('#academy-auth-password').fill('0000');
    await page.locator('#btn-submit-academy-auth').click();
    await lateThresholdSelect.selectOption('5');
    await page.locator('#academy-info-form button[type="submit"]').click();

    // Go to Attendance Control View
    await page.locator('.menu-item[data-view="dir-attendance-control"]').click();
    await page.waitForTimeout(300);
    await expect(latePolicyInfo).toContainText('현재 지각 기준: 수업 시작 후 05분');

    // Clean up: Restore to default 10 mins
    await page.locator('.menu-item[data-view="dir-academy-info"]').click();
    await page.locator('#academy-auth-password').fill('0000');
    await page.locator('#btn-submit-academy-auth').click();
    await lateThresholdSelect.selectOption('10');
    await page.locator('#academy-info-form button[type="submit"]').click();

    // Go back to Attendance Control View to ensure it restores to 10 mins
    await page.locator('.menu-item[data-view="dir-attendance-control"]').click();
    await page.waitForTimeout(300);
    await expect(latePolicyInfo).toContainText('현재 지각 기준: 수업 시작 후 10분');

    // 14. Verify Phase 9C-5B-3: Quick Actions (Present/Late/Absent) on Attendance Control View
    const studentRow = page.locator('.ac-student-row[data-student-id="S21"]').first();
    await expect(studentRow).toBeVisible();

    const editBtn = studentRow.locator('.ac-edit-btn');
    await expect(editBtn).toBeVisible();

    // Click '출결수정' button to open modal
    await editBtn.click();
    
    const modal = page.locator('#common-modal');
    await expect(modal).toHaveClass(/show/);

    // Click '지각' inside the modal
    const segmentBtns = modal.locator('.segment-btn');
    await segmentBtns.locator('text="지각"').click();

    // Setup dialog listener and click '수정하기'
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('출결 상태를 수정하시겠습니까?');
      dialog.accept();
    });
    await modal.locator('#btn-submit-attendance-edit').click();
    await page.waitForTimeout(450);

    // Verify row status becomes '지각'
    const statusCell = studentRow.locator('td').nth(5); // 6th column
    await expect(statusCell).toContainText('지각');

    // Click '출결수정' again and change to '결석'
    await editBtn.click();
    await expect(modal).toHaveClass(/show/);
    await segmentBtns.locator('text="결석"').click();
    page.once('dialog', dialog => {
      dialog.accept();
    });
    await modal.locator('#btn-submit-attendance-edit').click();
    await page.waitForTimeout(450);
    await expect(statusCell).toContainText('결석');

    // Click '출결수정' again and change to '출석'
    await editBtn.click();
    await expect(modal).toHaveClass(/show/);
    await segmentBtns.locator('text="출석"').click();
    page.once('dialog', dialog => {
      dialog.accept();
    });
    await modal.locator('#btn-submit-attendance-edit').click();
    await page.waitForTimeout(450);
    await expect(statusCell).toContainText('출석');

    // Verify 최다은 (S1) row status change works (Repair-A 최다은 row bug fix)
    const s1Row = page.locator('.ac-student-row[data-student-id="S1"]').first();
    await expect(s1Row).toBeVisible();
    const s1EditBtn = s1Row.locator('.ac-edit-btn');
    await s1EditBtn.click();
    await expect(modal).toHaveClass(/show/);
    await segmentBtns.locator('text="지각"').click();
    page.once('dialog', dialog => {
      dialog.accept();
    });
    await modal.locator('#btn-submit-attendance-edit').click();
    await page.waitForTimeout(450);
    await expect(s1Row.locator('td').nth(5)).toContainText('지각');

    // Test Urgent Queue quick action present
    // Open urgent queue panel
    const queueToggleBtn = page.locator('#ac-urgent-btn');
    await expect(queueToggleBtn).toBeVisible();
    await queueToggleBtn.click();
    
    const queuePanel = page.locator('#ac-urgent-queue-panel');
    await expect(queuePanel).toBeVisible();

    // If there is any item in the queue (e.g. delayed students), try to click '출결수정' button inside the queue
    const queueActionBtn = queuePanel.locator('.ac-queue-edit-btn').first();
    if (await queueActionBtn.count() > 0) {
        // Click edit button in queue
        await queueActionBtn.click();
        await expect(modal).toHaveClass(/show/);
        
        // Select '출석' inside the modal and submit
        await segmentBtns.locator('text="출석"').click();
        page.once('dialog', dialog => {
          dialog.accept();
        });
        await modal.locator('#btn-submit-attendance-edit').click();
        await page.waitForTimeout(450);
    }
    // Close queue panel if still open
    if (await queuePanel.isVisible()) {
        await queueToggleBtn.click();
    }

    // Verify Student-wise view edit button
    const studentTab = page.locator('.ac-tab[data-tab="student"]');
    await studentTab.click();
    await page.waitForTimeout(450);

    const s21StudentRow = page.locator('table.custom-table tbody tr[data-student-id="S21"]').first();
    await expect(s21StudentRow).toBeVisible();
    
    const s21StudentEditBtn = s21StudentRow.locator('.ac-student-edit-btn');
    await expect(s21StudentEditBtn).toBeVisible();
    await s21StudentEditBtn.click();
    await expect(modal).toHaveClass(/show/);
    
    // Change S21 status to '결석' and verify
    await segmentBtns.locator('text="결석"').click();
    page.once('dialog', dialog => {
      dialog.accept();
    });
    await modal.locator('#btn-submit-attendance-edit').click();
    await page.waitForTimeout(450);

    // Switch back to daily view to verify status has indeed been updated to '결석'
    const dailyTab = page.locator('.ac-tab[data-tab="daily"]');
    await dailyTab.click();
    await page.waitForTimeout(450);
    await expect(page.locator('.ac-student-row[data-student-id="S21"] td').nth(5)).toContainText('결석');
  });

  test('should verify Phase 9C-5C requirements: hidden legacy menu, chosung search, column name renames, 4-week date range title, S1 unpaid tuition info, message redirect and details modal dynamic import', async ({ page }) => {
    // 1. Verify "출결 관리" sidebar item is hidden (legacy menu style="display: none;")
    const legacyMenu = page.locator('.menu-item[data-view="dir-attendance"]');
    await expect(legacyMenu).not.toBeVisible();
    
    // Verify "출결 관제" is visible
    const controlMenu = page.locator('.menu-item[data-view="dir-attendance-control"]');
    await expect(controlMenu).toBeVisible();

    // Go to attendance control view
    await controlMenu.click();
    await expect(page.locator('#page-title')).toContainText('출결 관제');

    // 2. Verify daily schedule table headers rename
    const dailyHeader = page.locator('table.custom-table thead').first();
    await expect(dailyHeader).toContainText('이름');
    await expect(dailyHeader).toContainText('악기/반');
    await expect(dailyHeader).not.toContainText('원생이름');
    await expect(dailyHeader).not.toContainText('특이사항/사유');

    // 3. Verify chosung search ("ㅊㄷㅇ" -> 최다은 row)
    const searchInput = page.locator('#ac-search-input');
    const searchType = page.locator('#ac-search-type');
    await searchType.selectOption('name');
    await searchInput.focus();
    await searchInput.pressSequentially('ㅊㄷㅇ', { delay: 50 });
    await page.waitForTimeout(300);
    
    // Verify row count is 1 and name is 최다은
    const rows = page.locator('table.custom-table tbody tr.ac-student-row');
    await expect(rows).toHaveCount(1);
    await expect(rows.first().locator('td').nth(2)).toContainText('최다은');

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(300);

    // 4. Verify student-wise table headers rename
    const studentTab = page.locator('.ac-tab[data-tab="student"]');
    await studentTab.click();
    await page.waitForTimeout(300);

    const studentHeader = page.locator('table.custom-table thead');
    await expect(studentHeader).toContainText('총수업일수');
    await expect(studentHeader).not.toContainText('예정 수업');

    // 5. Open student S1 details inspector drawer (by clicking on "최다은" name or row)
    const s1Row = page.locator('table.custom-table tbody tr[data-student-id="S1"]').first();
    await expect(s1Row).toBeVisible();
    await s1Row.locator('.student-name-text').click();
    
    const inspectorPanel = page.locator('#ac-inspector-panel');
    await expect(inspectorPanel).toHaveClass(/open/);

    // 6. Verify inspector drawer date range title shows "최근 4주 출결 요약 (날짜 ~ 날짜)"
    const historyTitle = page.locator('#ac-inspector-history-section-title');
    await expect(historyTitle).toContainText('최근 4주 출결 요약');
    // Ensure the date pattern is correct (e.g. YYYY-MM-DD ~ YYYY-MM-DD)
    await expect(historyTitle).toContainText(/\d{4}-\d{2}-\d{2} ~ \d{4}-\d{2}-\d{2}/);

    // 7. Verify S1 drawer unpaid tuition box shows unpaid status, 150,000 won, and 2026-05
    const tuitionBox = page.locator('#ac-inspector-tuition-box');
    await expect(tuitionBox).toBeVisible();
    await expect(tuitionBox).toContainText('미납');
    await expect(tuitionBox).toContainText('150,000원');
    await expect(tuitionBox).toContainText('2026년 05월');

    // 8. Verify bottom buttons: "메시지 보내기" and "상세정보" are visible
    const btnMessage = page.locator('#ac-inspector-btn-message');
    const btnDetail = page.locator('#ac-inspector-btn-detail');
    await expect(btnMessage).toBeVisible();
    await expect(btnDetail).toBeVisible();

    // 9. Click "상세정보" and verify student detail modal is displayed, then close it
    await btnDetail.click();
    await expect(inspectorPanel).not.toHaveClass(/open/); // Drawer should be closed
    const detailModal = page.locator('#common-modal');
    await expect(detailModal).toHaveClass(/show/);
    
    // Close detail modal
    await detailModal.locator('.modal-close').click();
    await expect(detailModal).not.toHaveClass(/show/);

    // Reopen drawer to test "메시지 보내기" redirection
    await s1Row.locator('.student-name-text').click();
    await expect(inspectorPanel).toHaveClass(/open/);

    // 10. Click "메시지 보내기" and verify it closes the drawer and redirects to communication view
    await btnMessage.click();
    await expect(inspectorPanel).not.toBeVisible();
    await expect(page.locator('#page-title')).toContainText('학부모 소통 종합 관리');
  });

  test('should verify Phase 9C-5C-Repair-A fixes: tab styling, instant name filtering, exact ID match, table headers sequence, drawer unpaid tuition status class, and message badge nowrap style', async ({ page }) => {
    // Go to attendance control view
    await page.locator('.menu-item[data-view="dir-attendance-control"]').click();
    await expect(page.locator('#page-title')).toContainText('출결 관제');

    // 1. Verify tab button separation / styling
    const tabsContainer = page.locator('.ac-tabs');
    const gap = await tabsContainer.evaluate(el => window.getComputedStyle(el).gap);
    expect(gap).toBe('6px');
    
    const tabsPadding = await tabsContainer.evaluate(el => window.getComputedStyle(el).padding);
    expect(tabsPadding).toBe('4px');

    // 2. Verify daily schedule table headers sequence (요일, 수업시간, 이름, 악기/반, 담당강사, 출결상태, 등원시각, 메시지, 확인/관리)
    const headers = page.locator('table.custom-table thead tr th');
    const expectedHeaders = ['요일', '수업시간', '이름', '악기/반', '담당강사', '출결상태', '등원시각', '메시지', '확인/관리'];
    for (let i = 0; i < expectedHeaders.length; i++) {
        await expect(headers.nth(i)).toHaveText(expectedHeaders[i]);
    }

    // 3. Verify instant name search filtering ("최" -> filters instantly without enter)
    const searchInput = page.locator('#ac-search-input');
    const searchType = page.locator('#ac-search-type');
    
    await searchType.selectOption('name');
    await searchInput.focus();
    await searchInput.fill('');
    await searchInput.pressSequentially('최', { delay: 50 });
    await page.waitForTimeout(300);

    // Verify row count is filtered to only include 최다은
    const filteredRows = page.locator('table.custom-table tbody tr.ac-student-row');
    // Ensure all visible rows contain "최"
    const count = await filteredRows.count();
    for (let i = 0; i < count; i++) {
        const row = filteredRows.nth(i);
        if (await row.isVisible()) {
            await expect(row.locator('td').nth(2)).toContainText('최');
        }
    }

    // 4. Verify exact ID search match (S1 search does not match S10 or others)
    await searchType.selectOption('id');
    await searchInput.focus();
    await searchInput.fill('');
    await searchInput.pressSequentially('S1', { delay: 50 });
    await page.waitForTimeout(300);

    // Verify only S1 is shown
    for (let i = 0; i < count; i++) {
        const row = filteredRows.nth(i);
        const studentId = await row.getAttribute('data-student-id');
        if (studentId === 'S1') {
            await expect(row).toBeVisible();
        } else {
            await expect(row).not.toBeVisible();
        }
    }

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(300);

    // 5. Open student S1 details inspector drawer (by clicking on "최다은" name)
    const s1Row = page.locator('table.custom-table tbody tr[data-student-id="S1"]').first();
    await expect(s1Row).toBeVisible();
    await s1Row.locator('.student-name-text').click();
    
    const inspectorPanel = page.locator('#ac-inspector-panel');
    await expect(inspectorPanel).toHaveClass(/open/);

    // 6. Verify S1 drawer unpaid tuition box shows "미납" text with color #e74c3c, "결제요청" with color #f1c40f, and "완납" with color #2ecc71
    const tuitionBox = page.locator('#ac-inspector-tuition-box');
    await expect(tuitionBox).toBeVisible();
    const unpaidStatusSpan = tuitionBox.locator('span', { hasText: '미납' }).first();
    await expect(unpaidStatusSpan).toBeVisible();
    const statusColor = await unpaidStatusSpan.evaluate(el => window.getComputedStyle(el).color);
    expect(statusColor).toBe('rgb(231, 76, 60)'); // #e74c3c

    const requestedStatusSpan = tuitionBox.locator('span', { hasText: '결제요청' }).first();
    await expect(requestedStatusSpan).toBeVisible();
    const requestedColor = await requestedStatusSpan.evaluate(el => window.getComputedStyle(el).color);
    expect(requestedColor).toBe('rgb(241, 196, 15)'); // #f1c40f

    const paidStatusSpan = tuitionBox.locator('span', { hasText: '완납' }).first();
    await expect(paidStatusSpan).toBeVisible();
    const paidColor = await paidStatusSpan.evaluate(el => window.getComputedStyle(el).color);
    expect(paidColor).toBe('rgb(46, 204, 113)'); // #2ecc71

    // 7. Verify bottom message history "발송완료" nowrap style
    const msgList = page.locator('#ac-inspector-msg-list');
    await expect(msgList).toBeVisible();
    const badges = msgList.locator('.log-item-head span', { hasText: '발송완료' });
    const badgeCount = await badges.count();
    if (badgeCount > 0) {
        const badge = badges.first();
        const whiteSpace = await badge.evaluate(el => window.getComputedStyle(el).whiteSpace);
        expect(whiteSpace).toBe('nowrap');
        const flexShrink = await badge.evaluate(el => window.getComputedStyle(el).flexShrink);
        expect(flexShrink).toBe('0');
    }

    // Close inspector drawer to avoid backdrop overlay blocking tab hover
    await page.locator('#ac-drawer-backdrop').click();
    await expect(inspectorPanel).not.toHaveClass(/open/);

    // 8. Verify Phase 9C-5D: Tab hover styling rule
    const firstTab = page.locator('.ac-tab').first();
    await firstTab.hover();
    const hoverBg = await firstTab.evaluate(el => {
        for (const sheet of document.styleSheets) {
            try {
                for (const rule of sheet.cssRules) {
                    if (rule.selectorText === '.ac-tab:hover') {
                        return rule.style.background;
                    }
                }
            } catch (e) {}
        }
        return '';
    });
    expect(hoverBg).toContain('rgba(9, 132, 227, 0.08)');

    // 9. Verify Phase 9C-5D: Grid layout and scrollbars on compact-board daily summary
    const compactBoard = page.locator('#compactBoard');
    await expect(compactBoard).toBeVisible();
    const boardDisplay = await compactBoard.evaluate(el => window.getComputedStyle(el).display);
    expect(boardDisplay).toBe('grid');
    const boardGridFlow = await compactBoard.evaluate(el => window.getComputedStyle(el).gridAutoFlow);
    expect(boardGridFlow).toBe('column');
    
    const scrollbarHeight = await compactBoard.evaluate(el => {
        for (const sheet of document.styleSheets) {
            try {
                for (const rule of sheet.cssRules) {
                    if (rule.selectorText && rule.selectorText.includes('.compact-board::-webkit-scrollbar')) {
                        return rule.style.height;
                    }
                }
            } catch (e) {}
        }
        return '';
    });
    expect(scrollbarHeight).toBe('10px');

    // 10. Verify Phase 9C-5D: Info Pill text and S2 status update on toggle
    const infoPill = page.locator('.ac-late-policy-info span');
    await expect(infoPill).toBeVisible();
    await expect(infoPill).toContainText('현재 지각 기준: 수업 시작 후');

    const s2Row = page.locator('table.custom-table tbody tr[data-student-id="S2"]').first();
    await expect(s2Row).toBeVisible();
    await expect(s2Row.locator('.badge')).toContainText('지각');

    // Programmatically turn off late detection to verify Info Pill text updates to "미사용"
    await page.evaluate(() => {
        window.stateStore.setLateDetectionEnabled(false);
        const refreshBtn = document.querySelector('#ac-refresh-btn');
        if (refreshBtn) refreshBtn.click();
    });
    await page.waitForTimeout(300);
    await expect(infoPill).toContainText('현재 지각 기준: 미사용');
    await expect(s2Row.locator('.badge')).toContainText('출석');

    // Restore late detection
    await page.evaluate(() => {
        window.stateStore.setLateDetectionEnabled(true);
        const refreshBtn = document.querySelector('#ac-refresh-btn');
        if (refreshBtn) refreshBtn.click();
    });
    await page.waitForTimeout(300);
    await expect(s2Row.locator('.badge')).toContainText('지각');
  });

  test('should verify Phase 9C-5D-Repair-C: collapsible 2-row daily summary board', async ({ page }) => {
    // Go to attendance control view
    await page.locator('.menu-item[data-view="dir-attendance-control"]').click();
    await expect(page.locator('#page-title')).toContainText('출결 관제');

    const toggleBtn = page.locator('#ac-toggle-board-btn');
    await expect(toggleBtn).toBeVisible();
    await expect(toggleBtn).toHaveText('출결요약 펼치기');

    // Get button width before toggle
    const widthBefore = await toggleBtn.evaluate(el => el.getBoundingClientRect().width);

    const compactBoard = page.locator('#compactBoard');
    await expect(compactBoard).toHaveClass(/collapsed/);

    // Verify 2-row layout in collapsed mode (Repair-C)
    const gridFlow = await compactBoard.evaluate(el => window.getComputedStyle(el).gridAutoFlow);
    expect(gridFlow).toBe('column');

    const gridRows = await compactBoard.evaluate(el => window.getComputedStyle(el).gridTemplateRows);
    // Should have 2 rows (e.g. contains two values like "52px 52px" or similar)
    expect(gridRows.split(' ').length).toBe(2);

    // Verify detailed student lists are hidden in collapsed mode
    const miniStudents = page.locator('.mini-students').first();
    if (await miniStudents.count() > 0) {
      await expect(miniStudents).not.toBeVisible();
    }

    // Get collapsed height
    const collapsedHeightStr = await compactBoard.evaluate(el => window.getComputedStyle(el).height);
    const collapsedHeight = parseFloat(collapsedHeightStr);

    // Expand
    await toggleBtn.click();
    await expect(toggleBtn).toHaveText('출결요약 접기');
    await expect(compactBoard).not.toHaveClass(/collapsed/);

    // Get button width after toggle
    const widthAfter = await toggleBtn.evaluate(el => el.getBoundingClientRect().width);
    // Width should be identical (fixed width)
    expect(Math.abs(widthBefore - widthAfter)).toBeLessThan(1);

    // Verify detailed student lists are visible in expanded mode
    if (await miniStudents.count() > 0) {
      await expect(miniStudents).toBeVisible();
    }

    // Get expanded height
    const expandedHeightStr = await compactBoard.evaluate(el => window.getComputedStyle(el).height);
    const expandedHeight = parseFloat(expandedHeightStr);

    expect(expandedHeight).toBeGreaterThan(collapsedHeight);

    // Collapse again
    await toggleBtn.click();
    await expect(toggleBtn).toHaveText('출결요약 펼치기');
    await expect(compactBoard).toHaveClass(/collapsed/);
    
    // Verify detailed student lists are hidden again
    if (await miniStudents.count() > 0) {
      await expect(miniStudents).not.toBeVisible();
    }
  });
});
