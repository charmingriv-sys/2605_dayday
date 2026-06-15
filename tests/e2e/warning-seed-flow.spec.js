import { test, expect } from '@playwright/test';

test.describe('Warning Seed Flow E2E Checks', () => {
  test.beforeEach(async ({ page }) => {
    // Mock system date to 2026-06-14 (Sunday) to stabilize the KPI badge counts against weekday schedule changes
    await page.addInitScript(() => {
      const mockDate = new Date('2026-06-14T12:00:00');
      const OriginalDate = Date;
      globalThis.Date = class extends OriginalDate {
        constructor(...args) {
          if (args.length === 0) {
            return new OriginalDate(mockDate.getTime());
          }
          return new OriginalDate(...args);
        }
        static now() {
          return mockDate.getTime();
        }
      };
    });
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.role-grid').waitFor({ state: 'attached', timeout: 5000 });
  });

  test('should manage warning seed tools via local storage flag and enforce safety/guards', async ({ page }) => {
    // 1. By default, seedWarningDemoData and clearWarningDemoData must be undefined
    let isSeedDefined = await page.evaluate(() => typeof window.seedWarningDemoData !== 'undefined');
    let isClearDefined = await page.evaluate(() => typeof window.clearWarningDemoData !== 'undefined');
    expect(isSeedDefined).toBe(false);
    expect(isClearDefined).toBe(false);

    // 2. Set localStorage flag and reload
    await page.evaluate(() => {
      localStorage.setItem('DAYDAY_DEBUG_WARNING_SEED', 'enabled');
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.role-grid').waitFor({ state: 'attached', timeout: 5000 });

    // Login as director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // Navigate to Today Console
    await page.locator('.menu-item[data-view="dir-today-console"]').click();
    await expect(page.locator('#page-title')).toContainText('오늘 원장 콘솔');

    // Verify functions are defined after reload
    isSeedDefined = await page.evaluate(() => typeof window.seedWarningDemoData === 'function');
    isClearDefined = await page.evaluate(() => typeof window.clearWarningDemoData === 'function');
    expect(isSeedDefined).toBe(true);
    expect(isClearDefined).toBe(true);

    // Setup window alert and confirm mocking
    await page.evaluate(() => {
      window._confirmReturnValue = true;
      window._confirmCallCount = 0;
      window._alertCallCount = 0;
      window._alertLastMessage = "";

      window.confirm = (msg) => {
        window._confirmCallCount++;
        return window._confirmReturnValue;
      };

      window.alert = (msg) => {
        window._alertCallCount++;
        window._alertLastMessage = msg;
      };
    });

    // Capture initial counts
    const getCountValue = async (cardSelector) => {
      const text = await page.locator(`${cardSelector} .badge`).innerText();
      return parseInt(text.trim(), 10) || 0;
    };

    const initialAbsent = await getCountValue('.kpi-chip-card[data-filter-id="absent"]');
    const initialAttWarn = await getCountValue('.kpi-chip-card[data-filter-id="attendance_warning"]');
    const initialStaffWarn = await getCountValue('.kpi-chip-card[data-filter-id="staff_warning"]');

    // 3. Test Seed Confirm Cancel -> DB should not change, backup should not exist
    await page.evaluate(() => {
      window._confirmReturnValue = false;
      window._confirmCallCount = 0;
      window.seedWarningDemoData();
    });

    let currentAbsent = await getCountValue('.kpi-chip-card[data-filter-id="absent"]');
    expect(currentAbsent).toBe(initialAbsent);
    let hasBackup = await page.evaluate(() => !!window.__daydayWarningSeedBackup);
    expect(hasBackup).toBe(false);

    // 4. Test Seed Confirm Accept -> DB changed, backup created
    await page.evaluate(() => {
      window._confirmReturnValue = true;
      window._confirmCallCount = 0;
      window.seedWarningDemoData();
    });

    await expect(page.locator('.kpi-chip-card[data-filter-id="absent"] .badge')).toContainText(String(initialAbsent + 1));
    await expect(page.locator('.kpi-chip-card[data-filter-id="attendance_warning"] .badge')).toContainText(String(initialAttWarn + 2));
    await expect(page.locator('.kpi-chip-card[data-filter-id="staff_warning"] .badge')).toContainText(String(initialStaffWarn + 4));

    hasBackup = await page.evaluate(() => !!window.__daydayWarningSeedBackup);
    expect(hasBackup).toBe(true);

    // Verify lower task queue lists containing seed items
    // Filter by staff warning first
    await page.locator('.kpi-chip-card[data-filter-id="staff_warning"]').click();
    let tasksListText = await page.locator('#tasks-list-container').innerText();
    expect(tasksListText).toContain('디버그강사지각');
    expect(tasksListText).toContain('디버그강사미출근');
    expect(tasksListText).toContain('디버그강사퇴근누락');
    expect(tasksListText).toContain('디버그강사지각퇴근누락');

    // Filter by student warnings
    await page.locator('.kpi-chip-card[data-filter-id="attendance_warning"]').click();
    tasksListText = await page.locator('#tasks-list-container').innerText();
    expect(tasksListText).toContain('디버그지각');
    expect(tasksListText).toContain('디버그지각하원누락');

    // Filter by absent
    await page.locator('.kpi-chip-card[data-filter-id="absent"]').click();
    tasksListText = await page.locator('#tasks-list-container').innerText();
    expect(tasksListText).toContain('디버그결석');

    // 5. Test seed duplicate execution -> block and show alert, original backup should be preserved
    const backupBefore = await page.evaluate(() => window.__daydayWarningSeedBackup);
    await page.evaluate(() => {
      window._alertCallCount = 0;
      window._alertLastMessage = "";
      window.seedWarningDemoData();
    });
    const alertCount = await page.evaluate(() => window._alertCallCount);
    const alertMessage = await page.evaluate(() => window._alertLastMessage);
    expect(alertCount).toBe(1);
    expect(alertMessage).toContain("이미 주입된 검수용 데이터가 존재합니다");
    const backupAfter = await page.evaluate(() => window.__daydayWarningSeedBackup);
    expect(backupAfter).toBe(backupBefore); // original backup preserved

    // 6. Test Clear Confirm Cancel -> DB should not change, backup still exists
    await page.evaluate(() => {
      window._confirmReturnValue = false;
      window._confirmCallCount = 0;
      window.clearWarningDemoData();
    });
    await expect(page.locator('.kpi-chip-card[data-filter-id="absent"] .badge')).toContainText(String(initialAbsent + 1));
    hasBackup = await page.evaluate(() => !!window.__daydayWarningSeedBackup);
    expect(hasBackup).toBe(true);

    // 7. Test Clear Confirm Accept -> DB restored, backup removed
    await page.evaluate(() => {
      window._confirmReturnValue = true;
      window._confirmCallCount = 0;
      window.clearWarningDemoData();
    });

    await expect(page.locator('.kpi-chip-card[data-filter-id="absent"] .badge')).toContainText(String(initialAbsent));
    await expect(page.locator('.kpi-chip-card[data-filter-id="attendance_warning"] .badge')).toContainText(String(initialAttWarn));
    await expect(page.locator('.kpi-chip-card[data-filter-id="staff_warning"] .badge')).toContainText(String(initialStaffWarn));

    hasBackup = await page.evaluate(() => !!window.__daydayWarningSeedBackup);
    expect(hasBackup).toBe(false);

    // Under local storage flag = enabled, functions must still exist even after clear
    isSeedDefined = await page.evaluate(() => typeof window.seedWarningDemoData === 'function');
    isClearDefined = await page.evaluate(() => typeof window.clearWarningDemoData === 'function');
    expect(isSeedDefined).toBe(true);
    expect(isClearDefined).toBe(true);

    // 8. Test duplicate clear when no backup -> block and show alert
    await page.evaluate(() => {
      window._alertCallCount = 0;
      window._alertLastMessage = "";
      window.clearWarningDemoData();
    });
    const alertCountClear = await page.evaluate(() => window._alertCallCount);
    const alertMessageClear = await page.evaluate(() => window._alertLastMessage);
    expect(alertCountClear).toBe(1);
    expect(alertMessageClear).toContain("복원할 백업 데이터가 없습니다");

    // 9. Test Flag removal and reload -> functions should be undefined
    await page.evaluate(() => {
      localStorage.removeItem('DAYDAY_DEBUG_WARNING_SEED');
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.role-grid').waitFor({ state: 'attached', timeout: 5000 });

    isSeedDefined = await page.evaluate(() => typeof window.seedWarningDemoData !== 'undefined');
    isClearDefined = await page.evaluate(() => typeof window.clearWarningDemoData !== 'undefined');
    expect(isSeedDefined).toBe(false);
    expect(isClearDefined).toBe(false);
  });
});
