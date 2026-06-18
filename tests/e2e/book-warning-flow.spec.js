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
      db.parentMessages = [];

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
    await expect(taskList.first()).toContainText('학부모 안내 및 수납 확인이 필요합니다.');

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

  test('should support director confirmation UI, state transitions, prevention of duplicate payments/studentBooks, and guard clauses', async ({ page }) => {
    // 1. Login as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // Navigate to Today Console
    await page.locator('.menu-item[data-view="dir-today-console"]').click();
    await expect(page.locator('#page-title')).toContainText('오늘 원장 콘솔');

    // 2. Clear DB and setup requested BIR (BIR-REQ-TEST1)
    await page.evaluate(() => {
      const db = window.stateStore.db;
      db.todayTasks = [];
      db.payments = [];
      db.studentBooks = [];
      db.bookIssueRequests = [];
      db.parentMessages = [];

      const student1 = db.students.find(s => s.id === 'S1');
      if (student1) {
        student1.academyId = 'AC1';
      }

      // Ensure parentMessageSettings are enabled for textbook billing & paid messages
      if (!db.settings) db.settings = {};
      db.settings.parentMessageSettings = {
        bookBilling: { messageEnabled: true, pushEnabled: true },
        bookPaid: { messageEnabled: true, pushEnabled: true }
      };

      // Ensure S1 has contact that can receive message
      const contact1 = db.parentContacts ? db.parentContacts.find(c => c.studentId === 'S1' && c.isPrimary) : null;
      if (contact1) {
        contact1.canReceiveMessage = true;
      }

      db.bookIssueRequests.push({
        id: 'BIR-REQ-TEST1',
        studentId: 'S1',
        teacherId: 'T1',
        bookId: 'B1',
        bookNameSnapshot: '세모둥이네꼬마바이엘 1',
        amountSnapshot: 5000,
        status: 'requested',
        requestedAt: new Date().toISOString().slice(0, 10),
        confirmedAt: null,
        paymentRequestedAt: null,
        paidAt: null,
        paymentId: null,
        studentBookId: null,
        memo: 'E2E 교재 승인 테스트'
      });

      window.stateStore.syncSystemRecommendations();
      window.stateStore.saveDB();
    });

    // 3. Verify KPI card counts and visibility of [교재 확인] warning row
    const checkCardCount = page.locator('[data-filter-id="book_check"] .badge');
    const billingCardCount = page.locator('[data-filter-id="book_billing"] .badge');
    await expect(checkCardCount).toContainText('1');
    await expect(billingCardCount).toContainText('0');

    await page.locator('[data-filter-id="book_check"]').click();
    const taskList = page.locator('#tasks-list-container .glass-card');
    await expect(taskList).toHaveCount(1);
    await expect(taskList.first()).toContainText('[교재확인]');

    const confirmBtn = taskList.first().locator('[data-action="confirm-book"]');
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
    await expect(confirmBtn).toHaveText('교재 지급 확인');

    // 4. Test confirm dialog Cancellation (Should not change DB state)
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('이 교재 지급 요청을 확인 처리할까요?');
      await dialog.dismiss(); // Cancel confirm
    });
    await confirmBtn.click();

    // Verify warning still exists and status remains 'requested'
    await expect(checkCardCount).toContainText('1');
    const birAfterCancel = await page.evaluate(() => {
      return window.stateStore.getBookIssueRequests().find(r => r.id === 'BIR-REQ-TEST1');
    });
    expect(birAfterCancel.status).toBe('requested');

    // 5. Test confirm dialog Accept (Should transition status to confirmed and create records)
    page.on('dialog', async dialog => {
      if (dialog.message().includes('이 교재 지급 요청을 확인 처리할까요?')) {
        await dialog.accept();
      } else if (dialog.message().includes('교재 지급 요청이 확인 처리되었습니다.')) {
        await dialog.accept();
      } else {
        await dialog.dismiss();
      }
    });

    await confirmBtn.click();

    // Verify warnings transitioned: book_check should disappear, book_billing should appear
    await expect(checkCardCount).toContainText('0');
    await expect(billingCardCount).toContainText('1');

    // 6. Verify DB changes on confirmed BIR, studentBook and payment creation
    const { confirmedBIR, createdPayment, createdStudentBook, evalDate, billingMessage, studentName, overdueCount } = await page.evaluate(() => {
      const store = window.stateStore;
      const bir = store.getBookIssueRequests().find(r => r.id === 'BIR-REQ-TEST1');
      const p = store.db.payments.find(pm => pm.id === bir.paymentId);
      const sb = store.getStudentBooks().find(s => s.id === bir.studentBookId);
      const eDate = store.db.settings.DAYDAY_DEBUG_EVAL_TIME 
        ? new Date(store.db.settings.DAYDAY_DEBUG_EVAL_TIME).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      const student = store.getStudent('S1');
      const billingMsg = store.db.parentMessages.find(m => m.relatedDomainId === p.id && m.type === 'book_billing');
      const oCount = store.db.parentMessages.filter(m => m.studentId === 'S1' && m.type === 'book_overdue').length;
      return {
        confirmedBIR: bir,
        createdPayment: p,
        createdStudentBook: sb,
        evalDate: eDate,
        billingMessage: billingMsg,
        studentName: student ? student.name : '',
        overdueCount: oCount
      };
    });

    expect(confirmedBIR.status).toBe('confirmed');
    expect(confirmedBIR.confirmedAt).toBe(evalDate);
    expect(confirmedBIR.paymentId).not.toBeNull();
    expect(confirmedBIR.studentBookId).not.toBeNull();

    // Verify created payment detail
    expect(createdPayment).toBeDefined();
    expect(createdPayment.type).toBe('book');
    expect(createdPayment.status).toBe('unpaid');
    expect(createdPayment.amount).toBe(5000);
    expect(createdPayment.studentId).toBe('S1');

    // Verify created studentBook detail
    expect(createdStudentBook).toBeDefined();
    expect(createdStudentBook.bookId).toBe('B1');
    expect(createdStudentBook.studentId).toBe('S1');

    // Verify book_billing parent message detail
    expect(billingMessage).toBeDefined();
    expect(billingMessage.type).toBe('book_billing');
    expect(billingMessage.category).toBe('payment');
    expect(billingMessage.title).toBe(`${studentName} 원생 교재비 수납 안내`);
    expect(billingMessage.body).toContain('세모둥이네꼬마바이엘 1');
    expect(billingMessage.body).toContain('5,000');
    expect(billingMessage.pushRequired).toBe(true);
    expect(billingMessage.pushStatus).toBe('pending');
    expect(billingMessage.dedupeKey).toBe(`BOOK_BILLING_${createdPayment.id}`);

    // Verify book_overdue is NOT created
    expect(overdueCount).toBe(0);

    // 7. Verify safety check: double-execution of confirmBookIssueRequest does not create duplicates
    const countsAfterDoubleSync = await page.evaluate(() => {
      const store = window.stateStore;
      
      // Manually invoke confirmBookIssueRequest again for the same confirmed BIR
      try {
        store.confirmBookIssueRequest('BIR-REQ-TEST1');
      } catch (err) {
        // Should throw error because it is not in 'requested' status anymore
      }

      return {
        birCount: store.getBookIssueRequests().filter(r => r.id === 'BIR-REQ-TEST1').length,
        paymentCount: store.db.payments.filter(pm => pm.studentId === 'S1' && pm.type === 'book').length,
        sbCount: store.getStudentBooks().filter(s => s.studentId === 'S1' && s.bookId === 'B1').length
      };
    });

    // Counts should remain 1, preventing duplicates
    expect(countsAfterDoubleSync.birCount).toBe(1);
    expect(countsAfterDoubleSync.paymentCount).toBe(1);
    expect(countsAfterDoubleSync.sbCount).toBe(1);

    // 7.1 Verify book_paid parentMessage is created when textbook payment is paid
    const { paidMessage, paidStudentName } = await page.evaluate(() => {
      const store = window.stateStore;
      const bir = store.getBookIssueRequests().find(r => r.id === 'BIR-REQ-TEST1');
      const paymentId = bir.paymentId;
      
      // Pay the invoice
      store.payInvoice(paymentId, 'cash');
      
      const student = store.getStudent('S1');
      const paidMsg = store.db.parentMessages.find(m => m.relatedDomainId === paymentId && m.type === 'book_paid');
      
      return {
        paidMessage: paidMsg,
        paidStudentName: student ? student.name : ''
      };
    });
    
    expect(paidMessage).toBeDefined();
    expect(paidMessage.type).toBe('book_paid');
    expect(paidMessage.category).toBe('payment');
    expect(paidMessage.title).toBe(`${paidStudentName} 원생 교재비 수납 완료`);
    expect(paidMessage.body).toContain('세모둥이네꼬마바이엘 1');
    expect(paidMessage.body).toContain('5,000');
    expect(paidMessage.pushRequired).toBe(true);
    expect(paidMessage.pushStatus).toBe('pending');
    expect(paidMessage.dedupeKey).toBe(`BOOK_PAID_${confirmedBIR.paymentId}`);

    // 7.2 Verify duplicate payment status transitions do not generate duplicate book_paid messages
    const paidMessagesCountAfterDuplicate = await page.evaluate(() => {
      const store = window.stateStore;
      const bir = store.getBookIssueRequests().find(r => r.id === 'BIR-REQ-TEST1');
      const paymentId = bir.paymentId;

      // Call updatePayment to 'paid' status again
      store.updatePayment(paymentId, { status: 'paid' });

      return store.db.parentMessages.filter(m => m.relatedDomainId === paymentId && m.type === 'book_paid').length;
    });
    expect(paidMessagesCountAfterDuplicate).toBe(1);

    // 8. Verify guards: cancelled / paid BIR cannot be approved
    const guardsResult = await page.evaluate(() => {
      const store = window.stateStore;
      
      // Seed cancelled BIR
      store.db.bookIssueRequests.push({
        id: 'BIR-CANCELLED-TEST',
        studentId: 'S1',
        teacherId: 'T1',
        bookId: 'B1',
        status: 'cancelled',
        requestedAt: '2026-06-13'
      });

      // Seed paid BIR
      store.db.bookIssueRequests.push({
        id: 'BIR-PAID-TEST',
        studentId: 'S1',
        teacherId: 'T1',
        bookId: 'B1',
        status: 'paid',
        requestedAt: '2026-06-13'
      });
      
      let cancelledError = '';
      let paidError = '';

      try {
        store.confirmBookIssueRequest('BIR-CANCELLED-TEST');
      } catch (err) {
        cancelledError = err.message;
      }

      try {
        store.confirmBookIssueRequest('BIR-PAID-TEST');
      } catch (err) {
        paidError = err.message;
      }

      return { cancelledError, paidError };
    });

    expect(guardsResult.cancelledError).toContain('이미 확인 처리되었거나 대기 중인 요청이 아닙니다.');
    expect(guardsResult.paidError).toContain('이미 확인 처리되었거나 대기 중인 요청이 아닙니다.');

    // 9. Verify no side-effects (no messages/outboundMessageLogs generated)
    const hasSideEffects = await page.evaluate(() => {
      const db = window.stateStore.db;
      const newMessages = (db.messages || []).filter(m => m.title && m.title.includes('교재'));
      const newLogs = (db.outboundMessageLogs || []).filter(l => l.id && l.id.includes('book'));
      return newMessages.length > 0 || newLogs.length > 0;
    });
    expect(hasSideEffects).toBe(false);
  });

  test('should generate book overdue parent messages automatically on system recommendations sync and enforce settings and guards', async ({ page }) => {
    // 1. Login as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // Navigate to Today Console
    await page.locator('.menu-item[data-view="dir-today-console"]').click();
    await expect(page.locator('#page-title')).toContainText('오늘 원장 콘솔');

    // 2. Setup mock data
    await page.evaluate(() => {
      const db = window.stateStore.db;
      db.todayTasks = [];
      db.payments = [];
      db.studentBooks = [];
      db.bookIssueRequests = [];
      db.parentMessages = [];

      // Add test student S1 with dueDay = 10
      const student1 = db.students.find(s => s.id === 'S1');
      if (student1) {
        student1.academyId = 'AC1';
        student1.dueDay = 10;
      }

      // Ensure primary contact can receive message
      const contact1 = db.parentContacts ? db.parentContacts.find(c => c.studentId === 'S1' && c.isPrimary) : null;
      if (contact1) {
        contact1.canReceiveMessage = true;
      }

      // Configure parentMessageSettings
      if (!db.settings) db.settings = {};
      db.settings.parentMessageSettings = {
        bookOverdue: { messageEnabled: true, pushEnabled: true }
      };

      // Set Debug time to 2026-06-12 (past 10th)
      db.settings.DAYDAY_DEBUG_EVAL_TIME = '2026-06-12T12:00:00.000Z';

      // 3. Add unpaid book payment confirmed on 2026-06-08 (before dueDay 10)
      db.payments.push({
        id: 'P-BOOK-OVERDUE-E2E',
        studentId: 'S1',
        amount: 15000,
        month: '2026-06',
        type: 'book',
        status: 'unpaid',
        invoiceDate: '2026-06-08',
        bookId: 'B1'
      });

      window.stateStore.syncSystemRecommendations();
      window.stateStore.saveDB();
    });

    // Verify overdue parent message is created
    const { overdueMessage, studentName } = await page.evaluate(() => {
      const store = window.stateStore;
      const msg = store.db.parentMessages.find(m => m.relatedDomainId === 'P-BOOK-OVERDUE-E2E' && m.type === 'book_overdue');
      const student = store.getStudent('S1');
      return {
        overdueMessage: msg,
        studentName: student ? student.name : ''
      };
    });

    expect(overdueMessage).toBeDefined();
    expect(overdueMessage.type).toBe('book_overdue');
    expect(overdueMessage.category).toBe('payment');
    expect(overdueMessage.title).toBe(`${studentName} 원생 교재비 미수납 안내`);
    expect(overdueMessage.body).toContain('세모둥이네꼬마바이엘 1');
    expect(overdueMessage.body).toContain('15,000');
    expect(overdueMessage.pushRequired).toBe(true);
    expect(overdueMessage.pushStatus).toBe('pending');
    expect(overdueMessage.dedupeKey).toBe('BOOK_OVERDUE_P-BOOK-OVERDUE-E2E');

    // 4. Verify no duplicates on repeating sync
    const duplicateCount = await page.evaluate(() => {
      const store = window.stateStore;
      store.syncSystemRecommendations();
      return store.db.parentMessages.filter(m => m.relatedDomainId === 'P-BOOK-OVERDUE-E2E' && m.type === 'book_overdue').length;
    });
    expect(duplicateCount).toBe(1);

    // 5. Verify no outboundMessageLogs or old messages are created
    const hasSideEffects = await page.evaluate(() => {
      const db = window.stateStore.db;
      const newMessages = (db.messages || []).filter(m => m.title && m.title.includes('교재'));
      const newLogs = (db.outboundMessageLogs || []).filter(l => l.id && l.id.includes('book'));
      return newMessages.length > 0 || newLogs.length > 0;
    });
    expect(hasSideEffects).toBe(false);
  });
});
