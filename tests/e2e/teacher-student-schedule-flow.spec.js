import { test, expect } from '@playwright/test';

// E2E Navigation Stability Helpers
async function waitForAppReady(page) {
  await page.locator('#app-root').waitFor({ state: 'attached', timeout: 5000 });
  await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });
}

async function loginAsDirector(page) {
  await page.locator('.role-grid').waitFor({ state: 'attached', timeout: 5000 });
  const directorBtn = page.locator('.role-btn.director');
  await expect(directorBtn).toBeVisible({ timeout: 5000 });
  
  // Evaluation click helper for robustness
  await directorBtn.scrollIntoViewIfNeeded();
  await directorBtn.click();

  await expect(page.locator('#login-overlay')).toBeHidden({ timeout: 5000 });
  await waitForAppReady(page);
}

async function navigateDirectorView(page, viewName) {
  const menuItem = page.locator(`.menu-item[data-view="${viewName}"]`);
  await expect(menuItem).toBeVisible({ timeout: 5000 });
  await menuItem.scrollIntoViewIfNeeded();
  await menuItem.click();
}

test.describe('Director Teacher-Student Schedule Flow Checks', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__DAYDAY_E2E__ = true;
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await loginAsDirector(page);
  });

  test('should verify weekly and daily schedule flow with filters and notes toggle', async ({ page }) => {
    // 1. Navigate to Schedules subtab
    await navigateDirectorView(page, 'dir-schedules');

    // 2. Click "강사-원생 시간표 관리" Subtab Button
    const subTabBtn = page.locator('#btn-subtab-match');
    await expect(subTabBtn).toBeVisible({ timeout: 5000 });
    await subTabBtn.click();

    // 3. Verify Weekly match view elements exist
    await expect(page.locator('[data-testid="teacher-student-schedule-view-mode"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="teacher-student-week-view"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="teacher-student-day-view"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="teacher-student-schedule-table"]')).toBeVisible({ timeout: 5000 });

    // Verify weekly view button is active (has class btn-primary)
    await expect(page.locator('[data-testid="teacher-student-week-view"]')).toHaveClass(/btn-primary/);

    // Verify Notes panel exists
    const notesPanel = page.locator('[data-testid="teacher-student-notes-panel"]');
    await expect(notesPanel).toBeVisible({ timeout: 5000 });

    // Toggle notes panel to hide
    const notesToggle = page.locator('[data-testid="teacher-student-notes-toggle"]');
    await expect(notesToggle).toBeVisible({ timeout: 5000 });
    await notesToggle.click();
    await expect(notesPanel).toBeHidden({ timeout: 5000 });

    // Toggle notes panel to show again
    await notesToggle.click();
    await expect(notesPanel).toBeVisible({ timeout: 5000 });

    // 4. Switch to Daily View
    const dayViewBtn = page.locator('[data-testid="teacher-student-day-view"]');
    await expect(dayViewBtn).toBeVisible({ timeout: 5000 });
    await dayViewBtn.click();

    // Verify day view button is active
    await expect(dayViewBtn).toHaveClass(/btn-primary/);

    // Verify daily view controls exist
    const dateInput = page.locator('[data-testid="teacher-student-date-input"]');
    await expect(dateInput).toBeVisible({ timeout: 5000 });

    // Select date: 2026-05-18 (Monday)
    await dateInput.fill('2026-05-18');

    // Verify table grid exists in daily view
    const table = page.locator('[data-testid="teacher-student-schedule-table"]');
    await expect(table).toBeVisible({ timeout: 5000 });

    // Verify filter elements exist
    const instrumentFilter = page.locator('[data-testid="teacher-student-teacher-filter"]');
    await expect(instrumentFilter).toBeVisible({ timeout: 5000 });

    const activeFilterBtn = page.locator('[data-testid="teacher-student-active-filter"]');
    await expect(activeFilterBtn).toBeVisible({ timeout: 5000 });

    const searchInput = page.locator('[data-testid="teacher-student-search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Verify seed student (최다은) is rendered on Monday in Daily match view under teacher (정은비 T8)
    await expect(table.locator('text=최다은')).toBeVisible({ timeout: 5000 });

    // Filter instrument to "바이올린" (which teacher T1 문승현 teaches)
    await instrumentFilter.selectOption('바이올린');
    
    // Verify T8 정은비 is hidden or "정은비" name is not visible in table header anymore if we search/filter
    await expect(table.locator('text=최다은')).toBeHidden({ timeout: 5000 });

    // Reset filter to "all" and search for "정은비" in searchInput
    await instrumentFilter.selectOption('all');
    await searchInput.fill('정은비');
    
    // Verify piano student 최다은 is back
    await expect(table.locator('text=최다은')).toBeVisible({ timeout: 5000 });

    // Apply Active only filter (당일 수업 강사만)
    await activeFilterBtn.click();
    
    // Active filter button should become active (primary color or state)
    await expect(activeFilterBtn).toHaveClass(/btn-primary/);
  });

  test('should drag and drop student card to another slot, verify state updates, persist on reload, and keep other dates isolated', async ({ page }) => {
    page.on('console', msg => console.log(`BROWSER_LOG: ${msg.text()}`));
    // 1. Navigate to Schedules subtab and turn on daily view
    await navigateDirectorView(page, 'dir-schedules');
    const subTabBtn = page.locator('#btn-subtab-match');
    await expect(subTabBtn).toBeVisible({ timeout: 5000 });
    await subTabBtn.click();

    const dayViewBtn = page.locator('[data-testid="teacher-student-day-view"]');
    await expect(dayViewBtn).toBeVisible({ timeout: 5000 });
    await dayViewBtn.click();

    // 2. Select Date: 2026-05-18 (Monday)
    const dateInput = page.locator('[data-testid="teacher-student-date-input"]');
    await expect(dateInput).toBeVisible({ timeout: 5000 });
    await dateInput.fill('2026-05-18');
    await dateInput.press('Enter');
    
    // 3. Find the card for student "최다은" and target drop cell
    const studentCard = page.locator('[data-testid="teacher-student-schedule-card"]:has-text("최다은")').first();
    await expect(studentCard).toBeVisible({ timeout: 5000 });

    // Target Slot: Teacher T8 (정은비), Time: 15:00
    const targetSlot = page.locator('[data-testid="teacher-student-drop-slot"][data-time="15:00"][data-teacher-id="T8"]').first();
    await expect(targetSlot).toBeVisible({ timeout: 5000 });

    // 4. HTML5 Drag and Drop simulation via page.evaluate (robust for headless tests)
    await page.evaluate(({ cardSelector, slotSelector }) => {
      const cards = Array.from(document.querySelectorAll(cardSelector));
      const cardEl = cards.find(el => el.textContent.includes('최다은'));
      const slotEl = document.querySelector(slotSelector);
      if (!cardEl) {
        throw new Error(`cardEl not found for selector ${cardSelector}. Text content of found cards: ${cards.map(c => c.textContent).join(', ')}`);
      }
      if (!slotEl) {
        throw new Error(`slotEl not found for selector ${slotSelector}`);
      }
      console.log('EVALUATE SLOT DIAGNOSTIC:', {
        slotSelector,
        hasTriggerDrop: typeof slotEl.__triggerDrop,
        slotOuterHTML: slotEl.outerHTML,
        cardText: cardEl.textContent
      });
      const parentCell = cardEl.closest('.match-cell-drop');
      const fromTime = parentCell ? parentCell.dataset.time : '';

      window.__mockDragData = {
        classId: cardEl.dataset.classId || '',
        studentId: cardEl.dataset.studentId || '',
        fromTeacherId: cardEl.dataset.teacherId || '',
        fromStartTime: fromTime || ''
      };

      const mockDataTransfer = {
        getData: (key) => {
          if (key === 'text/class-id') return cardEl.dataset.classId || '';
          if (key === 'text/student-id') return cardEl.dataset.studentId || '';
          if (key === 'text/from-teacher-id') return cardEl.dataset.teacherId || '';
          if (key === 'text/from-time') return fromTime || '';
          return '';
        },
        setData: () => {},
        effectAllowed: 'move',
        dropEffect: 'none'
      };

      // Use test-only drop trigger (E2E bridge) to dispatch mock drop event safely in headless environment
      if (typeof slotEl.__triggerDrop === 'function') {
        slotEl.__triggerDrop({
          preventDefault: () => {},
          dataTransfer: mockDataTransfer
        });
      } else {
        const createDragEvent = (type) => {
          const evt = new Event(type, { bubbles: true, cancelable: true });
          Object.defineProperty(evt, 'dataTransfer', { value: mockDataTransfer });
          return evt;
        };
        cardEl.dispatchEvent(createDragEvent('dragstart'));
        slotEl.dispatchEvent(createDragEvent('dragover'));
        slotEl.dispatchEvent(createDragEvent('drop'));
        cardEl.dispatchEvent(createDragEvent('dragend'));
      }
    }, {
      cardSelector: '[data-testid="teacher-student-schedule-card"]',
      slotSelector: '[data-testid="teacher-student-drop-slot"][data-time="15:00"][data-teacher-id="T8"]'
    });

    // 5. Verify success alert banner
    const statusEl = page.locator('[data-testid="teacher-student-move-status"]');
    await expect(statusEl).toBeVisible({ timeout: 5000 });
    await expect(statusEl).toHaveText(/성공적으로 이동/);

    // 6. Verify student card was repositioned
    const targetSlotCard = targetSlot.locator('text=최다은');
    await expect(targetSlotCard).toBeVisible({ timeout: 5000 });

    // 7. Verify persistence across page reload
    await page.reload({ waitUntil: 'domcontentloaded' });
    const roleGrid = page.locator('.role-grid');
    if (await roleGrid.isVisible()) {
      await loginAsDirector(page);
    } else {
      await waitForAppReady(page);
    }
    await navigateDirectorView(page, 'dir-schedules');
    await page.locator('#btn-subtab-match').click();
    await page.locator('[data-testid="teacher-student-day-view"]').click();
    
    const dateInput2 = page.locator('[data-testid="teacher-student-date-input"]');
    await dateInput2.fill('2026-05-18');
    await dateInput2.press('Enter');

    const targetSlotAfterReload = page.locator('[data-testid="teacher-student-drop-slot"][data-time="15:00"][data-teacher-id="T8"]').first();
    await expect(targetSlotAfterReload.locator('text=최다은')).toBeVisible({ timeout: 5000 });

    // 8. Verify date isolation: Next Monday (2026-05-25) should not be overridden and show default classes
    const dateInput3 = page.locator('[data-testid="teacher-student-date-input"]');
    await dateInput3.fill('2026-05-25');
    await dateInput3.press('Enter');

    // Default slot for 최다은 is T8 (정은비) at 14:00
    const originalSlotNextWeek = page.locator('[data-testid="teacher-student-drop-slot"][data-time="14:00"][data-teacher-id="T8"]').first();
    await expect(originalSlotNextWeek.locator('text=최다은')).toBeVisible({ timeout: 5000 });

    // The destination slot T8 at 15:00 should not contain 최다은
    const targetSlotNextWeek = page.locator('[data-testid="teacher-student-drop-slot"][data-time="15:00"][data-teacher-id="T8"]').first();
    await expect(targetSlotNextWeek.locator('text=최다은')).toBeHidden({ timeout: 5000 });
  });

  test('should verify daily schedule operation logs on drag-and-drop, reload, date change, and panel toggle', async ({ page }) => {
    // 1. Navigate to Schedules subtab and turn on daily view
    await navigateDirectorView(page, 'dir-schedules');
    const subTabBtn = page.locator('#btn-subtab-match');
    await expect(subTabBtn).toBeVisible({ timeout: 5000 });
    await subTabBtn.click();

    const dayViewBtn = page.locator('[data-testid="teacher-student-day-view"]');
    await expect(dayViewBtn).toBeVisible({ timeout: 5000 });
    await dayViewBtn.click();

    // 2. Select Date: 2026-05-18 (Monday)
    const dateInput = page.locator('[data-testid="teacher-student-date-input"]');
    await expect(dateInput).toBeVisible({ timeout: 5000 });
    await dateInput.fill('2026-05-18');
    await dateInput.press('Enter');

    // 3. Verify logs are initially empty
    const emptyLog = page.locator('[data-testid="teacher-student-log-empty"]');
    await expect(emptyLog).toBeVisible({ timeout: 5000 });
    await expect(emptyLog).toHaveText(/시간표 이동 이력이 없습니다/);

    // 4. Find the card for student "최다은" and target drop cell
    const studentCard = page.locator('[data-testid="teacher-student-schedule-card"]:has-text("최다은")').first();
    await expect(studentCard).toBeVisible({ timeout: 5000 });

    // Target Slot: Teacher T8 (정은비), Time: 15:00
    const targetSlot = page.locator('[data-testid="teacher-student-drop-slot"][data-time="15:00"][data-teacher-id="T8"]').first();
    await expect(targetSlot).toBeVisible({ timeout: 5000 });

    // 5. HTML5 Drag and Drop simulation via page.evaluate
    await page.evaluate(({ cardSelector, slotSelector }) => {
      const cards = Array.from(document.querySelectorAll(cardSelector));
      const cardEl = cards.find(el => el.textContent.includes('최다은'));
      const slotEl = document.querySelector(slotSelector);
      if (!cardEl || !slotEl) return;
      const parentCell = cardEl.closest('.match-cell-drop');
      const fromTime = parentCell ? parentCell.dataset.time : '';

      const mockDataTransfer = {
        getData: (key) => {
          if (key === 'text/class-id') return cardEl.dataset.classId || '';
          if (key === 'text/student-id') return cardEl.dataset.studentId || '';
          if (key === 'text/from-teacher-id') return cardEl.dataset.teacherId || '';
          if (key === 'text/from-time') return fromTime || '';
          return '';
        },
        setData: () => {},
        effectAllowed: 'move',
        dropEffect: 'none'
      };

      if (typeof slotEl.__triggerDrop === 'function') {
        slotEl.__triggerDrop({
          preventDefault: () => {},
          dataTransfer: mockDataTransfer
        });
      }
    }, {
      cardSelector: '[data-testid="teacher-student-schedule-card"]',
      slotSelector: '[data-testid="teacher-student-drop-slot"][data-time="15:00"][data-teacher-id="T8"]'
    });

    // 6. Verify success alert banner
    const statusEl = page.locator('[data-testid="teacher-student-move-status"]');
    await expect(statusEl).toBeVisible({ timeout: 5000 });

    // 7. Verify Operation Logs Panel has one log row generated
    const logRow = page.locator('[data-testid="teacher-student-log-row"]').first();
    await expect(logRow).toBeVisible({ timeout: 5000 });
    
    // Check inner details of the log row
    const logStudent = logRow.locator('[data-testid="teacher-student-log-student"]');
    await expect(logStudent).toHaveText('최다은');
    
    const logBefore = logRow.locator('[data-testid="teacher-student-log-before"]');
    await expect(logBefore).toHaveText(/정은비/);
    
    const logAfter = logRow.locator('[data-testid="teacher-student-log-after"]');
    await expect(logAfter).toHaveText(/정은비/);

    // 8. Verify persistence across page reload
    await page.reload({ waitUntil: 'domcontentloaded' });
    const roleGrid = page.locator('.role-grid');
    if (await roleGrid.isVisible()) {
      await loginAsDirector(page);
    } else {
      await waitForAppReady(page);
    }
    await navigateDirectorView(page, 'dir-schedules');
    await page.locator('#btn-subtab-match').click();
    await page.locator('[data-testid="teacher-student-day-view"]').click();
    
    const dateInput2 = page.locator('[data-testid="teacher-student-date-input"]');
    await dateInput2.fill('2026-05-18');
    await dateInput2.press('Enter');

    const logRowAfterReload = page.locator('[data-testid="teacher-student-log-row"]').first();
    await expect(logRowAfterReload).toBeVisible({ timeout: 5000 });
    await expect(logRowAfterReload.locator('[data-testid="teacher-student-log-student"]')).toHaveText('최다은');

    // 9. Verify date isolation
    const dateInput3 = page.locator('[data-testid="teacher-student-date-input"]');
    await dateInput3.fill('2026-05-19');
    await dateInput3.press('Enter');
    
    const emptyLogNextDay = page.locator('[data-testid="teacher-student-log-empty"]');
    await expect(emptyLogNextDay).toBeVisible({ timeout: 5000 });

    // Go back to 2026-05-18
    await dateInput3.fill('2026-05-18');
    await dateInput3.press('Enter');

    // 10. Verify Toggle Log Panel button (show/hide)
    const logToggleBtn = page.locator('[data-testid="teacher-student-log-toggle"]');
    await expect(logToggleBtn).toBeVisible({ timeout: 5000 });
    
    const logPanel = page.locator('[data-testid="teacher-student-log-panel"]');
    await expect(logPanel).toBeVisible({ timeout: 5000 });

    // Hide log panel
    await logToggleBtn.click();
    await expect(logPanel).toBeHidden({ timeout: 5000 });

    // Show log panel
    await logToggleBtn.click();
    await expect(logPanel).toBeVisible({ timeout: 5000 });
  });

  test('should verify print preview modal functionality in match view', async ({ page }) => {
    // 1. Navigate to Schedules subtab and turn on daily view
    await navigateDirectorView(page, 'dir-schedules');
    const subTabBtn = page.locator('#btn-subtab-match');
    await expect(subTabBtn).toBeVisible({ timeout: 5000 });
    await subTabBtn.click();

    // 2. Locate print button
    const printBtn = page.locator('[data-testid="teacher-student-print-preview"]');
    await expect(printBtn).toBeVisible({ timeout: 5000 });

    // 3. Click print button to open modal
    await printBtn.click();

    // 4. Verify print modal is visible and contains expected print elements
    const printModal = page.locator('[data-testid="schedule-print-modal"]');
    await expect(printModal).toBeVisible({ timeout: 5000 });

    const printTitle = printModal.locator('[data-testid="schedule-print-title"]');
    await expect(printTitle).toContainText('강사-원생 수업 시간표');

    const printCloseBtn = printModal.locator('[data-testid="schedule-print-close"]');
    await expect(printCloseBtn).toBeVisible({ timeout: 5000 });

    // 5. Close print modal using robust page.evaluate click
    await page.evaluate(() => {
      const btn = document.getElementById('btn-print-close');
      if (btn) btn.click();
    });
    await expect(printModal).toBeHidden({ timeout: 5000 });
  });
});
