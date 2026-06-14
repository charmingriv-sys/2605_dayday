import { test, expect } from '@playwright/test';

test.describe('Major Schedule Warning Lifecycle Flow (Phase 13F)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.role-grid').waitFor({ state: 'attached', timeout: 5000 });
  });

  test('should verify schedule warnings lifecycle, D-3 criteria, task auto-cleanup, manual done guard, and date change sync', async ({ page }) => {
    // 1. Login as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // Navigate to Today Console
    await page.locator('.menu-item[data-view="dir-today-console"]').click();
    await expect(page.locator('#page-title')).toContainText('오늘 원장 콘솔');

    // 2. Setup mock data in State Store to test the schedule warning lifecycle
    await page.evaluate(() => {
      const db = window.stateStore.db;

      // Clear all existing tasks and major schedules to test cleanly
      db.todayTasks = [];
      db.majorSchedules = [];

      // Set Debug time to 2026-06-14
      if (!db.settings) db.settings = {};
      db.settings.DAYDAY_DEBUG_EVAL_TIME = '2026-06-14T09:00:00.000Z';

      // Seed major schedules:
      // today: 2026-06-14
      db.majorSchedules.push(
        // ev1: D-3 (2026-06-17) -> Should be visible
        {
          id: 'ev-d3',
          type: 'concours',
          name: 'D-3 콩쿠르 일정',
          eventDate: '2026-06-17',
          dueDate: null,
          ownerId: '정은비',
          place: '예술의전당',
          visible: true,
          memo: 'D-3 일정 메모',
          participantStudentIds: ['S1'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        // ev2: D-day (2026-06-14) -> Should be visible
        {
          id: 'ev-dday',
          type: 'exam',
          name: 'D-day 실기고사 일정',
          eventDate: '2026-06-14',
          dueDate: null,
          ownerId: '한지섭',
          place: '원내',
          visible: false, // Should be visible on director console regardless of visible field
          memo: 'D-day 일정 메모',
          participantStudentIds: ['S2'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        // ev3: D-4 (2026-06-18) -> Should NOT be visible yet
        {
          id: 'ev-d4',
          type: 'event',
          name: 'D-4 정기연주회 일정',
          eventDate: '2026-06-18',
          dueDate: null,
          ownerId: '성여진',
          place: '금호아트홀',
          visible: true,
          memo: 'D-4 일정 메모',
          participantStudentIds: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        // ev4: Past event (2026-06-13) -> Should NOT be visible (past events auto-excluded)
        {
          id: 'ev-past',
          type: 'makeup',
          name: '과거 보강 일정',
          eventDate: '2026-06-13',
          dueDate: null,
          ownerId: '윤채린',
          place: '원내',
          visible: true,
          memo: '과거 일정 메모',
          participantStudentIds: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      );

      // Sync system recommendations to load target warnings
      window.stateStore.syncSystemRecommendations(new Date('2026-06-14T09:00:00.000Z'));
    });
    await page.waitForTimeout(1000); // Wait for initialization sync to persist completely

    // Refresh UI by triggering rendering (clicking the menu item again)
    await page.locator('.menu-item[data-view="dir-today-console"]').click();
    await page.waitForTimeout(1000); // Wait for first render DOM to stabilize

    // Verify Schedule KPI Card Count (should be 2: ev-d3, ev-dday)
    const scheduleCard = page.locator('.kpi-chip-card[data-filter-id="schedule"]');
    await expect(scheduleCard).toBeVisible();
    await expect(scheduleCard.locator('.badge')).toHaveText('2');

    // Click the card to filter by schedule category
    await scheduleCard.click();
    await page.waitForTimeout(500);

    // Verify two schedule warnings are displayed in the tasks list
    const taskList = page.locator('#tasks-list-container');
    await expect(taskList.locator('.glass-card')).toHaveCount(2);

    const taskTitles = taskList.locator('.card-title-text');
    await expect(taskTitles.nth(0)).toContainText('[일정확인] D-day 실기고사 일정 D-day');
    await expect(taskTitles.nth(1)).toContainText('[일정확인] D-3 콩쿠르 일정 D-3');

    // Verify description details mapping (Student names, place, ownerId, memo)
    const firstTaskDesc = taskList.locator('.glass-card').nth(0).locator('div[style*="white-space: pre-wrap"]');
    await expect(firstTaskDesc).toContainText('D-day 실기고사 일정 일정이 D-day입니다.');
    await expect(firstTaskDesc).toContainText('• 일정일: 2026-06-14 (원내)');
    await expect(firstTaskDesc).toContainText('• 담당자: 한지섭');
    await expect(firstTaskDesc).toContainText('• 관련 원생: 김제나'); // S2 = 김제나
    await expect(firstTaskDesc).toContainText('• 메모: D-day 일정 메모');

    // 3. Mark the D-3 schedule warning as Done (Manual Done transition)
    const d3TaskCard = taskList.locator('.glass-card', { hasText: 'D-3 콩쿠르 일정' });
    const doneBtn = d3TaskCard.locator('button[data-action="done"]');
    await expect(doneBtn).toBeVisible();
    await doneBtn.click();
    await page.waitForTimeout(1000); // Settle manual done state transition and saveDB

    // After clicking Done, count should decrease to 1
    await expect(scheduleCard.locator('.badge')).toHaveText('1');

    // Verify manual done task persists in 'done' status and does not get recreated on recommendation sync
    await page.evaluate(() => {
      // Re-trigger sync
      window.stateStore.syncSystemRecommendations(new Date('2026-06-14T09:00:00.000Z'));
    });
    await page.waitForTimeout(1000);
    // Click view menu to re-render
    await page.locator('.menu-item[data-view="dir-today-console"]').click();
    await page.waitForTimeout(1000);
    await expect(scheduleCard.locator('.badge')).toHaveText('1');

    // 4. Test date change: Move D-day event to D-5 (2026-06-19) -> Should be auto-removed
    await page.evaluate(() => {
      window.stateStore.updateMajorSchedule('ev-dday', { eventDate: '2026-06-19' }); // D-5 (past the D-3 boundary)
      window.stateStore.syncSystemRecommendations(new Date('2026-06-14T09:00:00.000Z'));
    });
    await page.waitForTimeout(1000); // Wait for stateStore listener and storage write to complete
    // Click view menu to re-render
    await page.locator('.menu-item[data-view="dir-today-console"]').click();
    await page.waitForTimeout(1000);
    await expect(scheduleCard.locator('.badge')).toHaveText('0'); // Done task is hidden, and D-day task is removed.

    // 5. Test date change: Move D-day event back to D-2 (2026-06-16) -> Should reappear
    await page.evaluate(() => {
      window.stateStore.updateMajorSchedule('ev-dday', { eventDate: '2026-06-16' }); // D-2 (within the D-3 boundary)
      window.stateStore.syncSystemRecommendations(new Date('2026-06-14T09:00:00.000Z'));
    });
    await page.waitForTimeout(1000); // Wait for stateStore listener and storage write to complete
    // Click view to re-render
    await page.locator('.menu-item[data-view="dir-today-console"]').click();
    await page.waitForTimeout(1000);
    await expect(scheduleCard.locator('.badge')).toHaveText('1'); // D-2 task is visible again.
  });
});
