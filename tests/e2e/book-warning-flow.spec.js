import { test, expect } from '@playwright/test';

test.describe('Textbook Warning Life Cycle Flow (Phase 13E-1)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.role-grid').waitFor({ state: 'attached', timeout: 5000 });
  });

  test('should verify book warnings lifecycle, migration, direct assign, check and billing warnings, and sync status', async ({ page }) => {
    // 1. Login as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // Navigate to Today Console
    await page.locator('.menu-item[data-view="dir-today-console"]').click();
    await expect(page.locator('#page-title')).toContainText('오늘 원장 콘솔');

    // 2. Setup mock data in State Store to test the textbook warning lifecycle
    await page.evaluate(() => {
      const db = window.stateStore.db;

      // Clear all existing tasks and payments to test cleanly
      db.todayTasks = [];
      db.payments = [];
      db.studentBooks = [];
      db.bookIssueRequests = [];

      // A. Seed some base data
      const student1 = db.students.find(s => s.id === 'S1');
      if (student1) {
        student1.academyId = 'AC1';
      }
      const student2 = db.students.find(s => s.id === 'S2');
      if (student2) {
        student2.academyId = 'AC1';
      }

      // B. Seed requested bookIssueRequests (requested by a teacher)
      // This should trigger "교재 확인" (book_check) warning
      db.bookIssueRequests.push({
        id: 'BIR-REQ-1',
        studentId: 'S1',
        teacherId: 'T1',
        bookId: 'B1',
        bookNameSnapshot: '세모둥이네꼬마바이엘 1',
        amountSnapshot: 5000,
        status: 'requested',
        requestedAt: '2026-06-13',
        confirmedAt: null,
        paymentRequestedAt: null,
        paidAt: null,
        paymentId: null,
        studentBookId: null,
        memo: '지급 요청합니다.'
      });

      // C. Seed legacy studentBooks data to test migration.
      db.studentBooks.push({
        id: 'SB-LEG-1',
        studentId: 'S1',
        bookId: 'B1',
        regDate: '2026-05-10',
        orderNo: 1,
        paymentId: 'P-LEG-1'
      });
      db.payments.push({
        id: 'P-LEG-1',
        studentId: 'S1',
        amount: 5000,
        month: '2026-05',
        type: 'book',
        status: 'paid',
        invoiceDate: '2026-05-10',
        paidDate: '2026-05-10',
        method: 'cash',
        bookId: 'B1'
      });

      db.studentBooks.push({
        id: 'SB-LEG-2',
        studentId: 'S2',
        bookId: 'B2',
        regDate: '2026-06-12',
        orderNo: 1,
        paymentId: 'P-LEG-2'
      });
      db.payments.push({
        id: 'P-LEG-2',
        studentId: 'S2',
        amount: 5000,
        month: '2026-06',
        type: 'book',
        status: 'unpaid',
        invoiceDate: '2026-06-12',
        paidDate: null,
        method: null,
        bookId: 'B2'
      });

      // Execute migration manually to verify idempotent behavior and correct statuses
      window.stateStore.migrateStudentBooksToIssueRequests();
      
      // Run it again to ensure it is idempotent (no duplicates)
      window.stateStore.migrateStudentBooksToIssueRequests();

      // Trigger recommendation sync
      window.stateStore.syncSystemRecommendations();
    });

    // 3. Verify KPI card counts
    const checkCardCount = page.locator('[data-filter-id="book_check"] .badge');
    const billingCardCount = page.locator('[data-filter-id="book_billing"] .badge');

    await expect(checkCardCount).toContainText('1');
    await expect(billingCardCount).toContainText('1');

    // 4. Click "교재 확인" card to filter and check the row details
    await page.locator('[data-filter-id="book_check"]').click();
    const taskList = page.locator('#tasks-list-container .glass-card');
    await expect(taskList).toHaveCount(1);
    await expect(taskList.first()).toContainText('[교재확인]');
    await expect(taskList.first()).toContainText('지급 요청합니다.');

    // 5. Click "교재 결제 확인" card to filter and check the row details
    await page.locator('[data-filter-id="book_billing"]').click();
    await expect(taskList).toHaveCount(1);
    await expect(taskList.first()).toContainText('[교재결제확인]');
    await expect(taskList.first()).toContainText('교재비 결제 확인이 필요합니다.');

    // 6. Test direct assignment by Director
    await page.evaluate(() => {
      window.stateStore.assignBookToStudent('S1', 'B3', '2026-06-13', 1);
      window.stateStore.syncSystemRecommendations();
    });

    await expect(checkCardCount).toContainText('1');
    await expect(billingCardCount).toContainText('2');

    await expect(taskList).toHaveCount(2);

    const directAssignBIR = await page.evaluate(() => {
      return window.stateStore.getBookIssueRequests().find(r => r.memo === '원장 직접 등록');
    });
    expect(directAssignBIR).toBeDefined();
    expect(directAssignBIR.teacherId).toBeNull();
    expect(directAssignBIR.status).toBe('confirmed');

    // 7. Test automatic sync on paid treatment
    await page.evaluate(() => {
      window.stateStore.payInvoice('P-LEG-2', 'card');
      window.stateStore.syncSystemRecommendations();
    });

    await expect(checkCardCount).toContainText('1');
    await expect(billingCardCount).toContainText('1');
    await expect(taskList).toHaveCount(1);

    const syncedBIR = await page.evaluate(() => {
      return window.stateStore.getBookIssueRequests().find(r => r.paymentId === 'P-LEG-2');
    });
    expect(syncedBIR.status).toBe('paid');
    expect(syncedBIR.paidAt).not.toBeNull();

    // 8. Confirm that no messages or outbound logs were generated
    const hasSideEffects = await page.evaluate(() => {
      const db = window.stateStore.db;
      const newMessages = (db.messages || []).filter(m => m.id.startsWith('MSG-TEST') || (m.title && m.title.includes('교재')));
      const newLogs = (db.outboundMessageLogs || []).filter(l => l.id && l.id.includes('book'));
      return newMessages.length > 0 || newLogs.length > 0;
    });
    expect(hasSideEffects).toBe(false);

    // 9. Test removeStudentBook safety and cancellation
    await page.evaluate(() => {
      // SB-LEG-1 is paid (via P-LEG-1). Trying to remove it should fail (return false).
      const removePaidResult = window.stateStore.removeStudentBook('SB-LEG-1');
      if (removePaidResult !== false) {
        throw new Error('removeStudentBook should block deletion of paid student book record');
      }

      // SB-LEG-2 is paid (we paid it in step 7). Trying to remove it should also fail.
      const removePaidResult2 = window.stateStore.removeStudentBook('SB-LEG-2');
      if (removePaidResult2 !== false) {
        throw new Error('removeStudentBook should block deletion of newly paid student book record');
      }

      // S1 has a direct assigned studentBook. Let's find its ID.
      const directSB = window.stateStore.getStudentBooks().find(sb => sb.paymentId && sb.paymentId.startsWith('P') && sb.paymentId !== 'P-LEG-1' && sb.paymentId !== 'P-LEG-2');
      if (directSB) {
        // It is unpaid. Deleting it should succeed (return true), transition its BIR status to 'cancelled', delete the payment, and clear warnings.
        const removeUnpaidResult = window.stateStore.removeStudentBook(directSB.id);
        if (removeUnpaidResult !== true) {
          throw new Error('removeStudentBook should allow deletion of unpaid student book record');
        }

        // Verify BIR is cancelled
        const cancelledBIR = window.stateStore.getBookIssueRequests().find(r => r.studentBookId === directSB.id);
        if (!cancelledBIR || cancelledBIR.status !== 'cancelled') {
          throw new Error('Associated bookIssueRequest status should be changed to cancelled');
        }

        // Verify payment is deleted
        const paymentExists = window.stateStore.db.payments.some(p => p.id === directSB.paymentId);
        if (paymentExists) {
          throw new Error('Associated unpaid payment record should be deleted');
        }
      }

      window.stateStore.syncSystemRecommendations();
    });

    // The direct assigned book billing warning should now be gone, meaning "교재 결제 확인" count goes down to 0
    await expect(billingCardCount).toContainText('0');
  });
});
