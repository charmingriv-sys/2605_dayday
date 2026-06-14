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

      // Seed major schedules (today is 2026-06-14)
      db.majorSchedules.push(
        // ev-multi: Due date D-2 (2026-06-16), Event date D-3 (2026-06-17) -> Should generate 2 tasks
        {
          id: 'ev-multi',
          type: 'concours',
          name: '멀티 일정 테스트',
          dueDate: '2026-06-16',
          eventDate: '2026-06-17',
          ownerId: '정은비',
          place: '예술의전당',
          visible: true,
          memo: '멀티 일정 메모',
          participantStudentIds: ['S1'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        // ev-only-due: Due date D-1 (2026-06-15), Event date D-6 (2026-06-20) -> Should generate only 1 due task
        {
          id: 'ev-only-due',
          type: 'exam',
          name: '마감만 임박 일정',
          dueDate: '2026-06-15',
          eventDate: '2026-06-20',
          ownerId: '한지섭',
          place: '원내',
          visible: true,
          memo: '마감 임박 메모',
          participantStudentIds: ['S2'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        // ev-only-event: Due date D-4 (2026-06-10, past), Event date D-day (2026-06-14) -> Should generate only 1 event task
        {
          id: 'ev-only-event',
          type: 'event',
          name: '진행만 임박 일정',
          dueDate: '2026-06-10',
          eventDate: '2026-06-14',
          ownerId: '성여진',
          place: '금호아트홀',
          visible: true,
          memo: '진행 임박 메모',
          participantStudentIds: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        // ev-none: Due date D-5 (2026-06-19), Event date D-6 (2026-06-20) -> Should NOT generate any tasks
        {
          id: 'ev-none',
          type: 'makeup',
          name: '미래 일정',
          dueDate: '2026-06-19',
          eventDate: '2026-06-20',
          ownerId: '윤채린',
          place: '원내',
          visible: true,
          memo: '미래 일정 메모',
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

    // Verify Schedule KPI Card Count (should be 4 total: ev-multi (2), ev-only-due (1), ev-only-event (1))
    const scheduleCard = page.locator('.kpi-chip-card[data-filter-id="schedule"]');
    await expect(scheduleCard).toBeVisible();
    await expect(scheduleCard.locator('.badge')).toHaveText('4');

    // Click the card to filter by schedule category
    await scheduleCard.click();
    await page.waitForTimeout(500);

    // Verify four schedule warnings are displayed in the tasks list
    const taskList = page.locator('#tasks-list-container');
    await expect(taskList.locator('.glass-card')).toHaveCount(4);

    // Validate text contents & milestone titles (order depends on startAt/dueAt sorting priority)
    // The multi milestones should appear as separate rows
    await expect(taskList.locator('.glass-card:has-text("멀티 일정 테스트 접수마감 일정이 D-2입니다.")')).toBeVisible();
    await expect(taskList.locator('.glass-card:has-text("멀티 일정 테스트 진행/종료일정이 D-3입니다.")')).toBeVisible();
    await expect(taskList.locator('.glass-card:has-text("마감만 임박 일정 접수마감 일정이 D-1입니다.")')).toBeVisible();
    await expect(taskList.locator('.glass-card:has-text("진행만 임박 일정 진행/종료일정이 D-day입니다.")')).toBeVisible();

    // Validate details layout matching description mapping for ev-multi registration deadline
    const multiDueCard = taskList.locator('.glass-card', { hasText: '멀티 일정 테스트 접수마감 일정이 D-2' });
    const multiDueDesc = multiDueCard.locator('div[style*="white-space: pre-wrap"]');
    await expect(multiDueDesc).toContainText('• 일정명: 멀티 일정 테스트');
    await expect(multiDueDesc).toContainText('• 마일스톤 유형: 접수마감');
    await expect(multiDueDesc).toContainText('• D-day 표기: D-2');
    await expect(multiDueDesc).toContainText('• 날짜: 2026-06-16');
    await expect(multiDueDesc).toContainText('• 장소: 예술의전당');
    await expect(multiDueDesc).toContainText('• 담당자: 정은비');
    await expect(multiDueDesc).toContainText('• 관련 원생: 최다은'); // S1 = 최다은
    await expect(multiDueDesc).toContainText('• 메모: 멀티 일정 메모');

    // 3. Mark the ev-multi registration deadline warning as Done (Manual Done transition)
    const doneBtn = multiDueCard.locator('button[data-action="done"]');
    await expect(doneBtn).toBeVisible();
    await doneBtn.click();
    await page.waitForTimeout(1000); // Settle manual done state transition and saveDB

    // Count should decrease to 3
    await expect(scheduleCard.locator('.badge')).toHaveText('3');

    // Verify the other milestone (event_end) task is still open and visible in list
    const multiEventCard = taskList.locator('.glass-card', { hasText: '멀티 일정 테스트 진행/종료일정이 D-3' });
    await expect(multiEventCard).toBeVisible();

    // 4. Test date change: Move event_end date of ev-multi to D-5 (2026-06-19) -> Should be auto-removed
    await page.evaluate(() => {
      window.stateStore.updateMajorSchedule('ev-multi', { eventDate: '2026-06-19' }); // D-5 (past boundary)
      window.stateStore.syncSystemRecommendations(new Date('2026-06-14T09:00:00.000Z'));
    });
    await page.waitForTimeout(1000);
    await page.locator('.menu-item[data-view="dir-today-console"]').click();
    await page.waitForTimeout(1000);

    // Count should decrease to 2 (since event_end task is obsolete and removed, registration deadline is done & hidden)
    await expect(scheduleCard.locator('.badge')).toHaveText('2');

    // 5. Test date change: Move event_end date of ev-multi back to D-1 (2026-06-15) -> Should reappear
    await page.evaluate(() => {
      window.stateStore.updateMajorSchedule('ev-multi', { eventDate: '2026-06-15' }); // D-1
      window.stateStore.syncSystemRecommendations(new Date('2026-06-14T09:00:00.000Z'));
    });
    await page.waitForTimeout(1000);
    await page.locator('.menu-item[data-view="dir-today-console"]').click();
    await page.waitForTimeout(1000);

    // Count should increase back to 3
    await expect(scheduleCard.locator('.badge')).toHaveText('3');
    await expect(taskList.locator('.glass-card:has-text("멀티 일정 테스트 진행/종료일정이 D-1입니다.")')).toBeVisible();
  });
});
