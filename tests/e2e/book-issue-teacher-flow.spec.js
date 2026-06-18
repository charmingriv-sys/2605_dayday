import { test, expect } from '@playwright/test';

test.describe('Teacher Book Issue Flow & Duplicate Prevention (Phase 13E-2)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.role-grid').waitFor({ state: 'attached', timeout: 5000 });
  });

  test('should register a book issue request as teacher, verify today console warnings, and block duplicates', async ({ page }) => {
    // 1. Initial State Setup
    await page.evaluate(() => {
      const db = window.stateStore.db;
      db.todayTasks = [];
      db.payments = [];
      db.studentBooks = [];
      db.bookIssueRequests = [];
      
      // Ensure students AC1 mapping
      db.students.forEach(s => {
        s.academyId = 'AC1';
      });

      // Setup:
      // T2 is resigned
      const t2 = db.teachers.find(t => t.id === 'T2');
      if (t2) {
        t2.employmentStatus = 'resigned';
      }

      // T3 has no assigned students
      db.students.forEach(s => {
        if (s.teacherId === 'T3') {
          s.teacherId = 'T1';
        }
      });

      window.stateStore.saveDB();
    });

    // --- CASE 1: Resigned teacher T2 login - book issue card must be hidden ---
    await page.evaluate(() => {
      const demoUser = window.stateStore.db.users.find(u => u.id === 'USR_TEA_DEMO');
      if (demoUser) {
        demoUser.phone = '010-1111-1002'; // T2 phone
      }
      window.stateStore.saveDB();
    });

    await page.locator('.role-btn.teacher').click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });
    await page.locator('.menu-item[data-view="tea-lessons"]').click();
    
    // book-issue-section must be hidden
    await expect(page.locator('#book-issue-section')).toBeHidden();

    // Logout
    await page.locator('#btn-logout').click();
    await page.locator('.role-grid').waitFor({ state: 'attached', timeout: 5000 });

    // --- CASE 2: Teacher T3 with no students - empty state text & disabled select/submit ---
    await page.evaluate(() => {
      const demoUser = window.stateStore.db.users.find(u => u.id === 'USR_TEA_DEMO');
      if (demoUser) {
        demoUser.phone = '010-1111-1003'; // T3 phone
      }
      window.stateStore.saveDB();
    });

    await page.locator('.role-btn.teacher').click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });
    await page.locator('.menu-item[data-view="tea-lessons"]').click();

    // Section visible
    await expect(page.locator('#book-issue-section')).toBeVisible({ timeout: 5000 });
    
    // Select should be disabled and show empty option text
    const studentSelect = page.locator('#book-issue-student-select');
    await expect(studentSelect).toBeDisabled();
    await expect(studentSelect.locator('option')).toHaveText('담당 원생이 없습니다.');

    // Submit button must be disabled
    const submitBtn = page.locator('#book-issue-form button[type="submit"]');
    await expect(submitBtn).toBeDisabled();

    // Logout
    await page.locator('#btn-logout').click();
    await page.locator('.role-grid').waitFor({ state: 'attached', timeout: 5000 });

    // --- CASE 3: Active teacher T1 - register book issue request for S13 ---
    await page.evaluate(() => {
      const db = window.stateStore.db;
      const s13 = db.students.find(s => s.id === 'S13');
      if (s13) s13.teacherId = 'T1';
      
      const demoUser = db.users.find(u => u.id === 'USR_TEA_DEMO');
      if (demoUser) {
        demoUser.phone = '010-1111-1001'; // T1 phone
      }
      window.stateStore.saveDB();
    });

    await page.locator('.role-btn.teacher').click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });
    await page.locator('.menu-item[data-view="tea-lessons"]').click();

    await page.selectOption('#book-issue-student-select', 'S13');
    await page.selectOption('#book-select', 'B1');
    await page.fill('#book-issue-memo', '강사 T1 지급 요청 메모');

    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('교재 지급 요청을 등록하시겠습니까?');
      await dialog.accept();
    });
    await page.locator('#book-issue-form button[type="submit"]').click();

    // Success toast verify
    const successToast = page.locator('.kakaotalk-toast', { hasText: '고승현 원생에게 세모둥이네꼬마바이엘 1 교재 지급 요청이 등록되었습니다.' });
    await expect(successToast).toBeVisible({ timeout: 5000 });

    // Logout
    await page.locator('#btn-logout').click();
    await page.locator('.role-grid').waitFor({ state: 'attached', timeout: 5000 });

    // --- CASE 4: Another active teacher T4 - duplicate check blocks even with different teacher ---
    await page.evaluate(() => {
      const db = window.stateStore.db;
      const s13 = db.students.find(s => s.id === 'S13');
      if (s13) s13.teacherId = 'T4'; // Re-assign S13 to T4
      
      const demoUser = db.users.find(u => u.id === 'USR_TEA_DEMO');
      if (demoUser) {
        demoUser.phone = '010-1111-1004'; // T4 phone
      }
      window.stateStore.saveDB();
    });

    await page.locator('.role-btn.teacher').click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });
    await page.locator('.menu-item[data-view="tea-lessons"]').click();

    await page.selectOption('#book-issue-student-select', 'S13');
    await page.selectOption('#book-select', 'B1');
    await page.fill('#book-issue-memo', '강사 T4 중복 시도');

    page.once('dialog', async dialog => {
      await dialog.accept();
    });
    await page.locator('#book-issue-form button[type="submit"]').click();

    // Verify duplicate error toast
    const errorToast = page.locator('.kakaotalk-toast', { hasText: '동일한 원생에게 동일한 교재가 이미 지급 요청 또는 등록되어 있습니다.' });
    await expect(errorToast).toBeVisible({ timeout: 5000 });

    // Logout
    await page.locator('#btn-logout').click();
    await page.locator('.role-grid').waitFor({ state: 'attached', timeout: 5000 });

    // --- CASE 5: Director Login - Verify Today Console Warning ---
    await page.locator('.role-btn.director').click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });
    await page.locator('.menu-item[data-view="dir-today-console"]').click();
    await expect(page.locator('#page-title')).toContainText('오늘 원장 콘솔');

    const checkCardCount = page.locator('[data-filter-id="book_check"] .badge');
    await expect(checkCardCount).toContainText('1');

    await page.locator('[data-filter-id="book_check"]').click();
    const taskList = page.locator('#tasks-list-container .glass-card');
    await expect(taskList).toHaveCount(1);
    await expect(taskList.first()).toContainText('[교재 지급 확인]');
    await expect(taskList.first()).toContainText('고승현 원생 세모둥이네꼬마바이엘 1');
    await expect(taskList.first()).toContainText('문승현가 고승현 원생에게 세모둥이네꼬마바이엘 1 교재 지급 승인을 요청했습니다. (메모: 강사 T1 지급 요청 메모)');
  });
});
