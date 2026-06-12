import { test, expect } from '@playwright/test';

// E2E Navigation Stability Helpers
async function waitForAppReady(page) {
  // Ensure the page container is attached and visible
  await page.locator('#app-root').waitFor({ state: 'attached', timeout: 5000 });
  await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });
}

async function loginAsDirector(page) {
  // Wait for login grid container
  await page.locator('.role-grid').waitFor({ state: 'attached', timeout: 5000 });
  const directorBtn = page.locator('.role-btn.director');
  await expect(directorBtn).toBeVisible({ timeout: 5000 });
  await directorBtn.click();

  // Wait for overlay to hide and main app to load
  await expect(page.locator('#login-overlay')).toBeHidden({ timeout: 5000 });
  await waitForAppReady(page);
}

async function navigateDirectorView(page, viewName) {
  const menuItem = page.locator(`.menu-item[data-view="${viewName}"]`);
  await expect(menuItem).toBeVisible({ timeout: 5000 });
  await menuItem.click();
}

test.describe('Director Teacher Shift Flow Checks', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate with domcontentloaded for stability
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await loginAsDirector(page);
  });

  test('should display weekly shifts, change teacher, and toggle notes panel successfully', async ({ page }) => {
    // Navigate to "강사 출근 및 시간표 관리"
    await navigateDirectorView(page, 'dir-schedules');

    // Assert that the container exists
    await expect(page.locator('.schedules-view-container')).toBeVisible({ timeout: 5000 });

    // Verify weekly view controls exist
    await expect(page.locator('[data-testid="teacher-shift-view-mode"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="teacher-shift-week-view"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="teacher-shift-day-view"]')).toBeVisible({ timeout: 5000 });

    // Verify weekly mode is active by default
    await expect(page.locator('[data-testid="teacher-shift-week-view"]')).toHaveClass(/btn-primary/);

    // Verify table grid and notes panel exist
    await expect(page.locator('[data-testid="teacher-shift-table"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="teacher-shift-notes-panel"]')).toBeVisible({ timeout: 5000 });

    // Click notes toggle to hide the notes panel
    const toggleBtn = page.locator('[data-testid="teacher-shift-notes-toggle"]');
    await expect(toggleBtn).toBeVisible({ timeout: 5000 });
    await toggleBtn.click();

    // Verify notes panel is hidden
    await expect(page.locator('[data-testid="teacher-shift-notes-panel"]')).toBeHidden({ timeout: 5000 });

    // Click notes toggle again to restore visibility
    await toggleBtn.click();
    await expect(page.locator('[data-testid="teacher-shift-notes-panel"]')).toBeVisible({ timeout: 5000 });

    // Change teacher in select filter
    const teacherSelect = page.locator('[data-testid="teacher-shift-teacher-filter"]');
    await expect(teacherSelect).toBeVisible({ timeout: 5000 });
    await teacherSelect.selectOption('T1'); // Change to 문승현

    // Check that header or content changes
    await expect(page.locator('text=문승현 강사 주간 출근표')).toBeVisible({ timeout: 5000 });
  });

  test('should switch to daily shifts view, change date, and apply filters successfully', async ({ page }) => {
    // Navigate to "강사 출근 및 시간표 관리"
    await navigateDirectorView(page, 'dir-schedules');

    // Switch view to daily shifts
    const dayViewBtn = page.locator('[data-testid="teacher-shift-day-view"]');
    await expect(dayViewBtn).toBeVisible({ timeout: 5000 });
    await dayViewBtn.click();

    // Verify day view button is now active
    await expect(dayViewBtn).toHaveClass(/btn-primary/);

    // Verify daily view controls exist
    await expect(page.locator('[data-testid="teacher-shift-date-input"]')).toBeVisible({ timeout: 5000 });
    
    // Check for grid container
    await expect(page.locator('[data-testid="teacher-shift-table"]')).toBeVisible({ timeout: 5000 });

    // Fill new date
    const dateInput = page.locator('[data-testid="teacher-shift-date-input"]');
    await dateInput.fill('2026-05-18');

    // Verify seed shifts rendering - T8 column should show "출근"
    await expect(page.locator('[data-testid="teacher-shift-table"] >> text=정은비')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="teacher-shift-table"] >> text=출근').first()).toBeVisible({ timeout: 5000 });

    // Change daily filter select to "출근 강사만"
    const filterSelect = page.locator('[data-testid="teacher-shift-teacher-filter"]');
    await expect(filterSelect).toBeVisible({ timeout: 5000 });
    await filterSelect.selectOption('active');

    // Verify table filter is applied (T8 and T1 should be visible, others hidden)
    await expect(page.locator('[data-testid="teacher-shift-table"] >> text=정은비')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="teacher-shift-table"] >> text=문승현')).toBeVisible({ timeout: 5000 });
  });

  test('should switch to daily shifts view and render successfully even with resigned teachers present', async ({ page }) => {
    // 1. Resign T4 (양지숙) to simulate retired teacher presence in the database
    await page.evaluate(() => {
      window.stateStore.resignTeacher('T4', { resignedAt: '2026-05-18', memo: '퇴사 테스트' });
    });

    // 2. Navigate to "강사 출근 및 시간표 관리"
    await navigateDirectorView(page, 'dir-schedules');

    // 3. Switch view to daily shifts
    const dayViewBtn = page.locator('[data-testid="teacher-shift-day-view"]');
    await expect(dayViewBtn).toBeVisible({ timeout: 5000 });
    await dayViewBtn.click();

    // 4. Verify day view button is active and table grid is visible
    await expect(dayViewBtn).toHaveClass(/btn-primary/);
    const shiftTable = page.locator('[data-testid="teacher-shift-table"]');
    await expect(shiftTable).toBeVisible({ timeout: 5000 });

    // 5. Fill date '2026-05-20'
    const dateInput = page.locator('[data-testid="teacher-shift-date-input"]');
    await dateInput.fill('2026-05-20');
    await page.waitForTimeout(500);

    // Scenario 1: Retired teacher + no slots + no logs -> HIDDEN in daily shift view
    await page.evaluate(() => {
      // Ensure T4 has empty slots and no logs on 2026-05-20
      window.stateStore.saveTeacherShift('T4', '2026-05-20', []);
      window.stateStore.db.teacherAttendanceLogs = window.stateStore.db.teacherAttendanceLogs.filter(l => l.teacherId !== 'T4' || l.date !== '2026-05-20');
      window.stateStore.saveDB();
    });
    await page.reload();
    await navigateDirectorView(page, 'dir-schedules');
    await expect(dayViewBtn).toBeVisible({ timeout: 5000 });
    await dayViewBtn.click();
    await dateInput.fill('2026-05-20');
    await page.waitForTimeout(500);
    // T4 (양지숙) should be hidden
    await expect(shiftTable).not.toContainText('양지숙');
    // Active teachers (e.g. 정은비 T8) should be visible
    await expect(shiftTable).toContainText('정은비');

    // Scenario 2: Retired teacher + slots.length > 0 + no logs -> HIDDEN in daily shift view
    await page.evaluate(() => {
      window.stateStore.saveTeacherShift('T4', '2026-05-20', ['15:00', '15:30']);
      window.stateStore.saveDB();
    });
    await page.reload();
    await navigateDirectorView(page, 'dir-schedules');
    await expect(dayViewBtn).toBeVisible({ timeout: 5000 });
    await dayViewBtn.click();
    await dateInput.fill('2026-05-20');
    await page.waitForTimeout(500);
    // T4 (양지숙) should be hidden because there are no logs
    await expect(shiftTable).not.toContainText('양지숙');

    // Scenario 3: Retired teacher + has check-in logs -> VISIBLE in daily shift view
    await page.evaluate(() => {
      window.stateStore.db.teacherAttendanceLogs.push({
        id: 'tal_e2e_t4_resigned',
        teacherId: 'T4',
        date: '2026-05-20',
        checkInAt: '2026-05-20T15:00:00+09:00',
        checkOutAt: null,
        source: 'tablet_pin',
        createdAt: '2026-05-20T15:00:00+09:00',
        updatedAt: '2026-05-20T15:00:00+09:00'
      });
      window.stateStore.saveDB();
    });
    await page.reload();
    await navigateDirectorView(page, 'dir-schedules');
    await expect(dayViewBtn).toBeVisible({ timeout: 5000 });
    await dayViewBtn.click();
    await dateInput.fill('2026-05-20');
    await page.waitForTimeout(500);
    // T4 should now be visible because of the log
    await expect(shiftTable).toContainText('양지숙 (퇴사)');
  });

  test('should support hiding resigned teachers by default and toggling their visibility in matching view', async ({ page }) => {
    page.removeAllListeners('dialog');

    // 1. Resign T4 (양지숙) and set up an override class on 2026-05-18 to make them eligible in match view
    await page.evaluate(() => {
      window.stateStore.resignTeacher('T4', { resignedAt: '2026-05-18', memo: '퇴사' });
      window.stateStore.ensureScheduleSnapshotForDate('2026-05-18');
      const snap = window.stateStore.db.scheduleSnapshots.find(s => s.date === '2026-05-18');
      snap.entries.push({
        id: 'ENTRY_2026-05-18_S1_T4_E2E',
        studentId: 'S1',
        teacherId: 'T4',
        startTime: '14:00',
        endTime: '14:30',
        subjectId: '보컬',
        source: 'override'
      });
      window.stateStore.saveDB();
    });

    // 2. Navigate to Schedules View
    await navigateDirectorView(page, 'dir-schedules');
    await page.locator('#btn-subtab-match').click();
    await page.waitForTimeout(500);

    const filterRow = page.locator('#teacher-filter-row');
    const chkShowResigned = page.locator('#chk-show-resigned-teachers');

    // 3. Verify T4 is NOT visible in the filter chips by default
    await expect(filterRow).not.toContainText('양지숙');
    await expect(chkShowResigned).not.toBeChecked();

    // 4. Check "퇴사 강사 보기" toggle
    await chkShowResigned.check();
    await page.waitForTimeout(200);

    // 5. Verify T4 is now visible in the filter chips and displays "(퇴사)" exactly once
    await expect(filterRow).toContainText('양지숙 (퇴사)');
    await expect(filterRow).not.toContainText('양지숙 (퇴사) (퇴사)');

    // 6. Click the T4 filter chip to filter by them
    const t4Chip = filterRow.locator('button:has-text("양지숙")');
    await expect(t4Chip).toHaveAttribute('data-id', 'T4'); // Verify internal data-id is preserved as T4
    await t4Chip.click();
    await page.waitForTimeout(200);

    // 7. Uncheck the "퇴사 강사 보기" toggle
    await chkShowResigned.uncheck();
    await page.waitForTimeout(200);

    // 8. Verify T4 is hidden again and the filter is reset
    await expect(filterRow).not.toContainText('양지숙');
    // In week view, filter reset is verified by student match pills having full opacity (no opacity: 0.12)
    const firstPill = page.locator('.student-match-pill').first();
    const opacity = await firstPill.evaluate(el => window.getComputedStyle(el).opacity);
    expect(opacity).not.toBe('0.12');

    // 9. Switch to Daily Match View
    await page.locator('#btn-match-mode-day').click();
    await page.locator('[data-testid="teacher-student-date-input"]').fill('2026-05-18');
    await page.waitForTimeout(500);

    const dailyMatchTable = page.locator('[data-testid="teacher-student-schedule-table"]');
    const dailyChkShowResigned = page.locator('#chk-show-resigned-teachers');

    // T4 should be hidden by default
    await expect(dailyMatchTable).not.toContainText('양지숙');
    await expect(dailyChkShowResigned).not.toBeChecked();

    // Check "퇴사 강사 보기" in daily view
    await dailyChkShowResigned.check();
    await page.waitForTimeout(200);

    // T4 should be visible now
    await expect(dailyMatchTable).toContainText('양지숙 (퇴사)');
  });

  test('should render weekly match view without crash and check elements', async ({ page }) => {
    // 1. Navigate to Schedules View
    await navigateDirectorView(page, 'dir-schedules');
    
    // 2. Click match subtab
    const matchSubTab = page.locator('#btn-subtab-match');
    await expect(matchSubTab).toBeVisible({ timeout: 5000 });
    await matchSubTab.click();
    await page.waitForTimeout(500);

    // 3. Verify weekly match table is visible
    const matchTable = page.locator('[data-testid="teacher-student-schedule-table"]');
    await expect(matchTable).toBeVisible({ timeout: 5000 });

    // 4. Verify weekly filter row is visible
    const filterRow = page.locator('#teacher-filter-row');
    await expect(filterRow).toBeVisible({ timeout: 5000 });

    // 5. Verify "퇴사 강사 보기" toggle checkbox exists
    const chkShowResigned = page.locator('#chk-show-resigned-teachers');
    await expect(chkShowResigned).toBeVisible({ timeout: 5000 });
  });
});
