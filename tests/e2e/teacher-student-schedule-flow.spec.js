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
});
