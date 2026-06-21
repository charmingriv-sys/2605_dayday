import { test, expect } from '@playwright/test';

test.describe('Billing & Overdue Warnings E2E Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.role-grid').waitFor({ state: 'attached', timeout: 5000 });
  });

  test('should evaluate all billing and overdue policies and verify KPI count alignment', async ({ page }) => {
    // 1. Login as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // Navigate to Today Console
    await page.locator('.menu-item[data-view="dir-today-console"]').click();
    await expect(page.locator('#page-title')).toContainText('오늘 원장 콘솔');

    // 2. Setup mock data in State Store
    await page.evaluate(() => {
      const db = window.stateStore.db;
      
      // Clear all existing tasks and payments to test cleanly
      db.todayTasks = [];
      db.payments = [];
      db.students = db.students || [];

      // Ensure setting for evaluation time is empty first
      if (db.settings) {
        delete db.settings.DAYDAY_DEBUG_EVAL_TIME;
      }

      // Modify students dueDay properties
      // S1 (dueDay: 10) - overdue for current month (today is 13)
      // S2 (dueDay: 13) - billing due today
      // S3 (dueDay: 20) - future billing
      // S4 (dueDay: 10) - past month (2026-05) overdue
      const s1 = db.students.find(s => s.id === 'S1');
      if (s1) { s1.dueDay = 10; s1.academyId = 'AC1'; }
      
      const s2 = db.students.find(s => s.id === 'S2');
      if (s2) { s2.dueDay = 13; s2.academyId = 'AC1'; }
      
      const s3 = db.students.find(s => s.id === 'S3');
      if (s3) { s3.dueDay = 20; s3.academyId = 'AC1'; }
      
      const s4 = db.students.find(s => s.id === 'S4');
      if (s4) { s4.dueDay = 10; s4.academyId = 'AC1'; }

      // 1. 오늘 수납일인 당월 unpaid education -> 수납확인 생성
      db.payments.push({
        id: 'P-TEST-1',
        studentId: 'S2',
        amount: 150000,
        month: '2026-06',
        type: 'education',
        status: 'unpaid',
        invoiceDate: '2026-06-13'
      });

      // 2. 오늘 수납일인 당월 paid education -> 생성 안 함
      db.payments.push({
        id: 'P-TEST-2',
        studentId: 'S22', // S22 dueDay is 12 -> paid and past due -> should not generate anything
        amount: 160000,
        month: '2026-06',
        type: 'education',
        status: 'paid',
        invoiceDate: '2026-06-12',
        paidDate: '2026-06-12'
      });

      // 3. 미래 수납일 unpaid education -> 생성 안 함
      db.payments.push({
        id: 'P-TEST-3',
        studentId: 'S3', // S3 dueDay is 20 -> future billing
        amount: 180000,
        month: '2026-06',
        type: 'education',
        status: 'unpaid',
        invoiceDate: '2026-06-13'
      });

      // 4. 당월 수납일 경과 unpaid education -> 미수납 확인 생성
      db.payments.push({
        id: 'P-TEST-4',
        studentId: 'S1', // S1 dueDay is 10 -> overdue
        amount: 150000,
        month: '2026-06',
        type: 'education',
        status: 'unpaid',
        invoiceDate: '2026-06-10'
      });

      // 5. 과거월 unpaid education -> 미수납 확인 생성
      db.payments.push({
        id: 'P-TEST-5',
        studentId: 'S4', // S4 dueDay is 10 -> past month overdue
        amount: 150000,
        month: '2026-05',
        type: 'education',
        status: 'unpaid',
        invoiceDate: '2026-05-10'
      });

      // 6. 과거월 paid education -> 생성 안 함
      db.payments.push({
        id: 'P-TEST-6',
        studentId: 'S4', 
        amount: 150000,
        month: '2026-04',
        type: 'education',
        status: 'paid',
        invoiceDate: '2026-04-10',
        paidDate: '2026-04-12'
      });

      // 7. type === 'book' unpaid -> 생성 안 함
      db.payments.push({
        id: 'P-TEST-7',
        studentId: 'S1',
        amount: 25000,
        month: '2026-06',
        type: 'book',
        status: 'unpaid',
        invoiceDate: '2026-06-10',
        bookId: 'B1'
      });

      // Fix system recommendation evaluation time to 2026-06-13
      db.settings.DAYDAY_DEBUG_EVAL_TIME = '2026-06-13T12:00:00.000Z';

      // Save and trigger evaluation
      window.stateStore.saveDB();
      window.stateStore.syncSystemRecommendations();
      window.stateStore.notify('TODAY_TASKS_CHANGED', window.stateStore.db.todayTasks);
    });

    // 3. Verify KPI badge count and active tasks
    // overdue count = S1(2026-06 unpaid) + S4(2026-05 unpaid) = 2
    // billing count = S2(2026-06 unpaid due 13th) = 1
    await expect(page.locator('.kpi-chip-card[data-filter-id="billing"] .badge')).toContainText('1');
    await expect(page.locator('.kpi-chip-card[data-filter-id="overdue"] .badge')).toContainText('2');

    // 4. Test filtering: 수납확인 카드 클릭 시 하단에 수납확인만 표시
    await page.locator('.kpi-chip-card[data-filter-id="billing"]').click();
    let tasksListText = await page.locator('#tasks-list-container').innerText();
    expect(tasksListText).toContain('[수납확인]');
    expect(tasksListText).not.toContain('[미수납 확인]');

    // 5. Test filtering: 미수납 확인 카드 클릭 시 하단에 미수납만 표시
    await page.locator('.kpi-chip-card[data-filter-id="overdue"]').click();
    tasksListText = await page.locator('#tasks-list-container').innerText();
    expect(tasksListText).toContain('[미수납 확인]');
    expect(tasksListText).not.toContain('[수납확인]');

    // 6. Test state transition: 수납확인 -> 날짜 경과 후 미수납으로 전환
    // Change evaluation date to 2026-06-14 (S2 billing due 13th is now overdue)
    await page.evaluate(() => {
      window.stateStore.db.settings.DAYDAY_DEBUG_EVAL_TIME = '2026-06-14T12:00:00.000Z';
      window.stateStore.saveDB();
      window.stateStore.syncSystemRecommendations();
      window.stateStore.notify('TODAY_TASKS_CHANGED', window.stateStore.db.todayTasks);
    });

    // Now S2 billing task should disappear from billing(0) and show up as overdue (2 + 1 = 3)
    await expect(page.locator('.kpi-chip-card[data-filter-id="billing"] .badge')).toContainText('0');
    await expect(page.locator('.kpi-chip-card[data-filter-id="overdue"] .badge')).toContainText('3');

    // 7. Test auto invalidation when payment status changes to paid
    await page.evaluate(() => {
      // Find S1 payment ('P-TEST-4') and mark as paid
      const p = window.stateStore.db.payments.find(x => x.id === 'P-TEST-4');
      if (p) {
        p.status = 'paid';
        p.paidDate = '2026-06-14';
      }
      window.stateStore.saveDB();
      window.stateStore.syncSystemRecommendations();
      window.stateStore.notify('TODAY_TASKS_CHANGED', window.stateStore.db.todayTasks);
    });

    // S1 unpaid overdue task should disappear. Overdue count should drop from 3 to 2.
    await expect(page.locator('.kpi-chip-card[data-filter-id="overdue"] .badge')).toContainText('2');

    // 8. Test user manual resolution: 수동 완료한 동일 dedupeKey는 재생성 방지
    // Find S2's overdue task (dedupeKey: `SYSTEM_RECOMMEND_BILLING_UNPAID_P-TEST-1_2026-06`)
    // and manually complete it (status: 'done')
    await page.evaluate(() => {
      const task = window.stateStore.db.todayTasks.find(t => t.dedupeKey === 'SYSTEM_RECOMMEND_BILLING_UNPAID_P-TEST-1_2026-06');
      if (task) {
        task.status = 'done';
        task.completedAt = new Date().toISOString();
      }
      window.stateStore.saveDB();
      window.stateStore.syncSystemRecommendations();
      window.stateStore.notify('TODAY_TASKS_CHANGED', window.stateStore.db.todayTasks);
    });

    // Overdue count should drop from 2 to 1 (since S2's task is resolved/done and thus not active)
    await expect(page.locator('.kpi-chip-card[data-filter-id="overdue"] .badge')).toContainText('1');

    // Re-evaluating should NOT recreate S2's overdue task because it was manually completed
    await page.evaluate(() => {
      window.stateStore.syncSystemRecommendations();
      window.stateStore.notify('TODAY_TASKS_CHANGED', window.stateStore.db.todayTasks);
    });
    await expect(page.locator('.kpi-chip-card[data-filter-id="overdue"] .badge')).toContainText('1');

    // 9. Test KPI count alignment checks: 결석 확인, 특이출결, 특이근태가 고유 인원수가 아니라 task row 수 기준인지 확인
    await page.evaluate(() => {
      // Inject multiple attendance/staff tasks for the same student/teacher
      window.stateStore.db.todayTasks.push({
        id: 'T-ABSENT-1',
        organizationId: '',
        segment: 'academy_director_console',
        domain: 'academy',
        source: 'system',
        type: 'attendance',
        category: 'absent',
        priority: 'today',
        status: 'open',
        title: '결석 확인 1',
        relatedStudentIds: ['S1'],
        createdAt: new Date().toISOString()
      }, {
        id: 'T-ABSENT-2',
        organizationId: '',
        segment: 'academy_director_console',
        domain: 'academy',
        source: 'system',
        type: 'attendance',
        category: 'absent',
        priority: 'today',
        status: 'open',
        title: '결석 확인 2',
        relatedStudentIds: ['S1'], // Same student S1
        createdAt: new Date().toISOString()
      }, {
        id: 'T-ATTWARN-1',
        organizationId: '',
        segment: 'academy_director_console',
        domain: 'academy',
        source: 'system',
        type: 'attendance',
        category: 'attendance_warning',
        priority: 'today',
        status: 'open',
        title: '특이출결 1',
        relatedStudentIds: ['S2'],
        createdAt: new Date().toISOString()
      }, {
        id: 'T-ATTWARN-2',
        organizationId: '',
        segment: 'academy_director_console',
        domain: 'academy',
        source: 'system',
        type: 'attendance',
        category: 'attendance_warning',
        priority: 'today',
        status: 'open',
        title: '특이출결 2',
        relatedStudentIds: ['S2'], // Same student S2
        createdAt: new Date().toISOString()
      }, {
        id: 'T-STAFF-1',
        organizationId: '',
        segment: 'academy_director_console',
        domain: 'academy',
        source: 'system',
        type: 'attendance',
        category: 'staff_warning',
        priority: 'today',
        status: 'open',
        title: '특이근태 1',
        relatedTeacherIds: ['T1'],
        createdAt: new Date().toISOString()
      }, {
        id: 'T-STAFF-2',
        organizationId: '',
        segment: 'academy_director_console',
        domain: 'academy',
        source: 'system',
        type: 'attendance',
        category: 'staff_warning',
        priority: 'today',
        status: 'open',
        title: '특이근태 2',
        relatedTeacherIds: ['T1'], // Same teacher T1
        createdAt: new Date().toISOString()
      });
      window.stateStore.saveDB();
      window.stateStore.notify('TODAY_TASKS_CHANGED', window.stateStore.db.todayTasks);
    });

    // Verify KPI counts match the total task count (2), not the unique student/teacher count (1)
    await expect(page.locator('.kpi-chip-card[data-filter-id="absent"] .badge')).toContainText('2');
    await expect(page.locator('.kpi-chip-card[data-filter-id="attendance_warning"] .badge')).toContainText('2');
    await expect(page.locator('.kpi-chip-card[data-filter-id="staff_warning"] .badge')).toContainText('2');
  });

  test('should generate tuition overdue parent messages automatically on system recommendations sync', async ({ page }) => {
    // 1. Login as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // 2. Setup database, settings, and mock payments
    await page.evaluate(() => {
      const db = window.stateStore.db;
      db.parentMessages = [];
      db.payments = [];
      db.todayTasks = [];

      // Ensure S1 has a contact
      const s1 = window.stateStore.getStudent('S1');
      if (s1) {
        s1.dueDay = 10;
        window.stateStore.upsertParentContact({
          studentId: 'S1',
          slot: 'parent1',
          name: s1.parentName || '최다은보호자',
          relation: 'guardian',
          phone: s1.parentPhone || '010-1234-5678',
          canReceiveMessage: true
        });
      }

      // Ensure S2 has a contact
      const s2 = window.stateStore.getStudent('S2');
      if (s2) {
        s2.dueDay = 13; // due today
        window.stateStore.upsertParentContact({
          studentId: 'S2',
          slot: 'parent1',
          name: s2.parentName || '채은재보호자',
          relation: 'guardian',
          phone: s2.parentPhone || '010-2222-2222',
          canReceiveMessage: true
        });
      }

      window.stateStore.updateParentMessageSettingsBulk({
        tuitionOverdue: { messageEnabled: true, pushEnabled: true }
      });

      // 1. Overdue payment (S1 due 10th, today is 13th)
      db.payments.push({
        id: 'P-OVERDUE-E2E-1',
        studentId: 'S1',
        amount: 150000,
        month: '2026-06',
        type: 'education',
        status: 'unpaid',
        invoiceDate: '2026-06-10'
      });

      // 2. Due today payment (S2 due 13th, today is 13th) -> should not generate overdue message
      db.payments.push({
        id: 'P-DUE-E2E-2',
        studentId: 'S2',
        amount: 160000,
        month: '2026-06',
        type: 'education',
        status: 'unpaid',
        invoiceDate: '2026-06-13'
      });

      // 3. Book payment overdue -> should not generate overdue message
      db.payments.push({
        id: 'P-BOOK-E2E-3',
        studentId: 'S1',
        amount: 25000,
        month: '2026-06',
        type: 'book',
        status: 'unpaid',
        invoiceDate: '2026-06-10'
      });

      // Set eval date
      db.settings.DAYDAY_DEBUG_EVAL_TIME = '2026-06-13T12:00:00.000Z';

      window.stateStore.saveDB();
      window.stateStore.syncSystemRecommendations(new Date('2026-06-13T12:00:00.000Z'));
    });

    // 3. Verify tuition overdue parentMessage is created for S1
    let parentMsgs = await page.evaluate(() => window.stateStore.db.parentMessages);
    let overdueMsg = parentMsgs.find(m => m.studentId === 'S1' && m.type === 'tuition_overdue');
    expect(overdueMsg).toBeDefined();
    expect(overdueMsg.pushRequired).toBe(true);
    expect(overdueMsg.pushStatus).toBe('pending');
    expect(overdueMsg.title).toContain('최다은 원생 수강료 미수납 안내');
    expect(overdueMsg.body).toContain('최다은 원생의 2026년 06월 수강료 150,000원이 아직 수납되지 않았습니다.');

    // 4. Verify due today payment (S2) did not generate overdue message
    let dueMsg = parentMsgs.find(m => m.studentId === 'S2' && m.type === 'tuition_overdue');
    expect(dueMsg).toBeUndefined();

    // 5. Verify book payment did not generate overdue message
    let bookMsg = parentMsgs.find(m => m.relatedDomainId === 'P-BOOK-E2E-3');
    expect(bookMsg).toBeUndefined();

    // 6. Verify deduplication
    const count = await page.evaluate(() => {
      window.stateStore.syncSystemRecommendations(new Date('2026-06-13T12:00:00.000Z'));
      return window.stateStore.db.parentMessages.filter(m => m.studentId === 'S1' && m.type === 'tuition_overdue').length;
    });
    expect(count).toBe(1);

    // 7. Verify no outboundMessageLogs or old messages are created
    const outboundLogs = await page.evaluate(() => window.stateStore.db.outboundMessageLogs || []);
    expect(outboundLogs.length).toBe(0);

    const oldMessages = await page.evaluate(() => window.stateStore.db.messages || []);
    const overdueOldMessages = oldMessages.filter(m => m.title && m.title.includes('미수납'));
    expect(overdueOldMessages.length).toBe(0);

    // 8. Verify paid payment does not generate overdue messages
    await page.evaluate(() => {
      window.stateStore.payInvoice('P-OVERDUE-E2E-1', 'cash');
      // clean parentMessages for S1 overdue and run sync
      window.stateStore.db.parentMessages = window.stateStore.db.parentMessages.filter(m => m.studentId === 'S1' && m.type !== 'tuition_overdue');
      window.stateStore.saveDB();
      window.stateStore.syncSystemRecommendations(new Date('2026-06-13T12:00:00.000Z'));
    });

    parentMsgs = await page.evaluate(() => window.stateStore.db.parentMessages);
    let overdueMsgAfterPaid = parentMsgs.find(m => m.studentId === 'S1' && m.type === 'tuition_overdue');
    expect(overdueMsgAfterPaid).toBeUndefined();
  });

  test('should support student status and payment status filters in billing view with status badges (Phase 17G-7B)', async ({ page }) => {
    // 1. Login as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // Navigate to Billing View
    await page.locator('.menu-item[data-view="dir-payments"]').click();
    await expect(page.locator('#page-title')).toContainText('수납 및 결제 현황');

    // 2. Setup mock data inside State Store
    await page.evaluate(() => {
      const db = window.stateStore.db;
      db.payments = [];
      db.students = db.students || [];

      // S1: attending
      // S2: on_leave (휴원)
      // S3: withdrawn (퇴원)
      const s1 = db.students.find(s => s.id === 'S1');
      if (s1) { s1.status = 'attending'; }
      
      const s2 = db.students.find(s => s.id === 'S2');
      if (s2) { s2.status = 'on_leave'; }
      
      const s3 = db.students.find(s => s.id === 'S3');
      if (s3) { s3.status = 'withdrawn'; }

      // Seed payments for 2026-05 (default billing month)
      db.payments.push(
        {
          id: 'P-FILTER-1',
          studentId: 'S1',
          amount: 100000,
          month: '2026-05',
          type: 'education',
          status: 'paid',
          invoiceDate: '2026-05-10',
          method: 'card'
        },
        {
          id: 'P-FILTER-2',
          studentId: 'S2',
          amount: 200000,
          month: '2026-05',
          type: 'education',
          status: 'unpaid',
          invoiceDate: '2026-05-10'
        },
        {
          id: 'P-FILTER-3',
          studentId: 'S3',
          amount: 300000,
          month: '2026-05',
          type: 'education',
          status: 'unpaid',
          invoiceDate: '2026-05-10'
        },
        {
          id: 'P-FILTER-4',
          studentId: 'S1',
          amount: 50000,
          month: '2026-05',
          type: 'book',
          status: 'unpaid',
          invoiceDate: '2026-05-10'
        },
        {
          id: 'P-FILTER-5',
          studentId: 'S2',
          amount: 30000,
          month: '2026-05',
          type: undefined,
          status: 'unpaid',
          invoiceDate: '2026-05-10'
        }
      );

      window.stateStore.saveDB();
    });

    // Refresh payments display by trigger select change
    await page.locator('#payment-month-select').selectOption('2026-05');
    await page.waitForTimeout(300);

    // 3. Verify status filters exist with default values 'all'
    const studentStatusSelect = page.locator('#payment-student-status-select');
    const paymentStatusSelect = page.locator('#payment-status-select');
    const paymentTypeFilter = page.locator('#payment-type-filter');
    await expect(studentStatusSelect).toBeVisible();
    await expect(paymentStatusSelect).toBeVisible();
    await expect(paymentTypeFilter).toBeVisible();
    await expect(studentStatusSelect).toHaveValue('all');
    await expect(paymentStatusSelect).toHaveValue('all');
    await expect(paymentTypeFilter).toHaveValue('all');

    // 4. Verify info banner is displayed
    const infoBanner = page.locator('.glass-card >> text=수납 및 결제 현황은 전체 이력 기준입니다. 필터 조건에 따라 대시보드 표시와 다를 수 있습니다.');
    await expect(infoBanner).toBeVisible();

    // 5. Verify default summaries calculation (Total: 680,000 / Paid: 100,000 / Unpaid: 580,000)
    const summaryStats = page.locator('#payment-summary-stats');
    await expect(summaryStats).toContainText('680,000원');
    await expect(summaryStats).toContainText('완납: 100,000원');
    await expect(summaryStats).toContainText('미납: 580,000원');

    // 6. Verify row count (5 rows)
    const paymentRows = page.locator('#payments-table-body tr');
    await expect(paymentRows).toHaveCount(5);

    // 7. Verify status badges on rows
    // S2 (on_leave) row should have [휴원] badge
    // S3 (withdrawn) row should have [퇴원] badge
    const s2Row = page.locator('[data-testid="payment-row-P-FILTER-2"]');
    const s3Row = page.locator('[data-testid="payment-row-P-FILTER-3"]');
    await expect(s2Row).toContainText('휴원');
    await expect(s3Row).toContainText('퇴원');

    // 8. Filter by student status: 퇴원생 (withdrawn)
    await studentStatusSelect.selectOption('withdrawn');
    await page.waitForTimeout(300);
    
    // Only S3 row should be visible, row count = 1
    await expect(paymentRows).toHaveCount(1);
    await expect(page.locator('[data-testid="payment-row-P-FILTER-3"]')).toBeVisible();
    
    // Summaries recalculated (Total: 300,000 / Paid: 0 / Unpaid: 300,000)
    await expect(summaryStats).toContainText('300,000원');
    await expect(summaryStats).toContainText('완납: 0원');
    await expect(summaryStats).toContainText('미납: 300,000원');

    // 9. Reset student status filter to 전체 and filter by payment status: 미납 (unpaid)
    await studentStatusSelect.selectOption('all');
    await paymentStatusSelect.selectOption('unpaid');
    await page.waitForTimeout(300);

    // Only S2, S3, S4, S5 rows should be visible, row count = 4
    await expect(paymentRows).toHaveCount(4);
    await expect(page.locator('[data-testid="payment-row-P-FILTER-2"]')).toBeVisible();
    await expect(page.locator('[data-testid="payment-row-P-FILTER-3"]')).toBeVisible();
    await expect(page.locator('[data-testid="payment-row-P-FILTER-4"]')).toBeVisible();
    await expect(page.locator('[data-testid="payment-row-P-FILTER-5"]')).toBeVisible();
    
    // Summaries recalculated (Total: 580,000 / Paid: 0 / Unpaid: 580,000)
    await expect(summaryStats).toContainText('580,000원');
    await expect(summaryStats).toContainText('완납: 0원');
    await expect(summaryStats).toContainText('미납: 580,000원');

    // 10. Filter by both: 퇴원생 + 미납
    await studentStatusSelect.selectOption('withdrawn');
    await page.waitForTimeout(300);

    // Only S3 row should be visible, row count = 1
    await expect(paymentRows).toHaveCount(1);
    await expect(page.locator('[data-testid="payment-row-P-FILTER-3"]')).toBeVisible();
    
    // Summaries recalculated (Total: 300,000 / Paid: 0 / Unpaid: 300,000)
    await expect(summaryStats).toContainText('300,000원');
    await expect(summaryStats).toContainText('완납: 0원');
    await expect(summaryStats).toContainText('미납: 300,000원');

    // 11. Filter by payment status: 완납 (paid)
    await studentStatusSelect.selectOption('all');
    await paymentStatusSelect.selectOption('paid');
    await page.waitForTimeout(300);

    // Only S1 row should be visible, row count = 1
    await expect(paymentRows).toHaveCount(1);
    await expect(page.locator('[data-testid="payment-row-P-FILTER-1"]')).toBeVisible();
    
    // Summaries recalculated (Total: 100,000 / Paid: 100,000 / Unpaid: 0)
    await expect(summaryStats).toContainText('100,000원');
    await expect(summaryStats).toContainText('완납: 100,000원');
    await expect(summaryStats).toContainText('미납: 0원');

    // 12. Regression verification of pay processing action
    // Reset filters to student: all / payment: unpaid
    await studentStatusSelect.selectOption('all');
    await paymentStatusSelect.selectOption('unpaid');
    await page.waitForTimeout(300);

    // Should see P-FILTER-2, P-FILTER-3, P-FILTER-4, P-FILTER-5
    await expect(paymentRows).toHaveCount(4);

    // Click pay processing on S2 row (P-FILTER-2)
    const payBtn = page.locator('[data-testid="payment-row-P-FILTER-2"] .btn-pay-action');
    await expect(payBtn).toBeVisible();
    await payBtn.click();

    // Confirm modal opens, click Card Payment button
    const cardPayModalBtn = page.locator('#modal-pay-card');
    await expect(cardPayModalBtn).toBeVisible();
    await cardPayModalBtn.click();

    // After payment, S2 should disappear from list, remaining 3 rows (P-FILTER-3, P-FILTER-4, P-FILTER-5)
    await page.waitForTimeout(300);
    await expect(paymentRows).toHaveCount(3);
    await expect(page.locator('[data-testid="payment-row-P-FILTER-2"]')).toBeHidden();
    await expect(page.locator('[data-testid="payment-row-P-FILTER-3"]')).toBeVisible();
    await expect(page.locator('[data-testid="payment-row-P-FILTER-4"]')).toBeVisible();
    await expect(page.locator('[data-testid="payment-row-P-FILTER-5"]')).toBeVisible();

    // Summaries recalculated (Total: 380,000 / Paid: 0 / Unpaid: 380,000 for filtered list)
    await expect(summaryStats).toContainText('380,000원');
    await expect(summaryStats).toContainText('완납: 0원');
    await expect(summaryStats).toContainText('미납: 380,000원');

    // 13. Verify payment-type-filter exists with default value 'all'
    await expect(paymentTypeFilter).toBeVisible();
    await expect(paymentTypeFilter).toHaveValue('all');

    // 14. Filter by payment type: 원비 (education)
    // S1(100k paid), S2(200k paid -> won't show in unpaid but let's check with all/all filters)
    await studentStatusSelect.selectOption('all');
    await paymentStatusSelect.selectOption('all');
    await paymentTypeFilter.selectOption('education');
    await page.waitForTimeout(300);

    // Education rows should be visible (P-FILTER-1: paid 100k, P-FILTER-2: paid 200k, P-FILTER-3: unpaid 300k)
    // Note: S2 P-FILTER-2 was marked paid in step 12
    await expect(paymentRows).toHaveCount(3);
    await expect(page.locator('[data-testid="payment-row-P-FILTER-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="payment-row-P-FILTER-2"]')).toBeVisible();
    await expect(page.locator('[data-testid="payment-row-P-FILTER-3"]')).toBeVisible();

    // Summaries recalculated (Total: 600,000 / Paid: 300,000 / Unpaid: 300,000)
    await expect(summaryStats).toContainText('600,000원');
    await expect(summaryStats).toContainText('완납: 300,000원');
    await expect(summaryStats).toContainText('미납: 300,000원');

    // 15. Filter by payment type: 교재비 (book)
    // P-FILTER-4 (50k unpaid)
    await paymentTypeFilter.selectOption('book');
    await page.waitForTimeout(300);

    // Row count should be 1
    await expect(paymentRows).toHaveCount(1);
    await expect(page.locator('[data-testid="payment-row-P-FILTER-4"]')).toBeVisible();

    // Summaries recalculated (Total: 50,000 / Paid: 0 / Unpaid: 50,000)
    await expect(summaryStats).toContainText('50,000원');
    await expect(summaryStats).toContainText('완납: 0원');
    await expect(summaryStats).toContainText('미납: 50,000원');

    // 16. Filter by payment type: 기타 (other)
    // P-FILTER-5 (30k unpaid)
    await paymentTypeFilter.selectOption('other');
    await page.waitForTimeout(300);

    // Row count should be 1
    await expect(paymentRows).toHaveCount(1);
    await expect(page.locator('[data-testid="payment-row-P-FILTER-5"]')).toBeVisible();

    // Summaries recalculated (Total: 30,000 / Paid: 0 / Unpaid: 30,000)
    await expect(summaryStats).toContainText('30,000원');
    await expect(summaryStats).toContainText('완납: 0원');
    await expect(summaryStats).toContainText('미납: 30,000원');

    // 17. Combination filter: 퇴원생 (withdrawn) + 미납 (unpaid) + 원비 (education)
    // P-FILTER-3 (300k unpaid education withdrawn)
    await studentStatusSelect.selectOption('withdrawn');
    await paymentStatusSelect.selectOption('unpaid');
    await paymentTypeFilter.selectOption('education');
    await page.waitForTimeout(300);

    // Row count should be 1
    await expect(paymentRows).toHaveCount(1);
    await expect(page.locator('[data-testid="payment-row-P-FILTER-3"]')).toBeVisible();

    // Summaries recalculated (Total: 300,000 / Paid: 0 / Unpaid: 300,000)
    await expect(summaryStats).toContainText('300,000원');
    await expect(summaryStats).toContainText('완납: 0원');
    await expect(summaryStats).toContainText('미납: 300,000원');

    // Reset payment type filter back to all for subsequent tests
    await paymentTypeFilter.selectOption('all');
    await page.waitForTimeout(300);
  });

  test('should support dashboard withdrawn receivable handoff flow to billing view (Phase 17G-7C)', async ({ page }) => {
    // 1. Login as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#page-title')).toContainText('대시보드');

    // 2. Setup mock data inside State Store
    await page.evaluate(() => {
      const db = window.stateStore.db;
      db.payments = [];
      db.students = db.students || [];

      // S1: attending
      // S2: withdrawn (퇴원)
      const s1 = db.students.find(s => s.id === 'S1');
      if (s1) { s1.status = 'attending'; }
      
      const s2 = db.students.find(s => s.id === 'S2');
      if (s2) { s2.status = 'withdrawn'; }

      // Set current month payment for S2 as unpaid (withdrawn unpaid)
      const currentMonth = new Date().toISOString().slice(0, 7);
      db.payments.push(
        {
          id: 'P-HANDOFF-1',
          studentId: 'S1',
          amount: 150000,
          month: currentMonth,
          type: 'education',
          status: 'unpaid',
          invoiceDate: `${currentMonth}-10`
        },
        {
          id: 'P-HANDOFF-2',
          studentId: 'S2',
          amount: 250000,
          month: currentMonth,
          type: 'education',
          status: 'unpaid',
          invoiceDate: `${currentMonth}-10`
        }
      );

      window.stateStore.saveDB();
      window.stateStore.notify('STUDENTS_CHANGED', db.students);
      window.stateStore.notify('PAYMENTS_CHANGED', db.payments);
    });

    // 3. Verify main unpaid KPI includes both attending and withdrawn unpaid payments (150k + 250k = 400k)
    const unpaidKpiCard = page.locator('.glass-card.metric-card', { hasText: '이번 달 미납 수강료' });
    await expect(unpaidKpiCard.locator('.metric-value')).toContainText('400,000원');

    const withdrawnText = page.locator('#dashboard-withdrawn-unpaid-text');
    await expect(withdrawnText).toBeVisible();
    await expect(withdrawnText).toContainText('퇴원생 미납 포함');

    // 4. Click the text
    await withdrawnText.click();
    await page.waitForTimeout(300);

    // 5. Verify transition to Billing View (dir-payments)
    await expect(page.locator('#page-title')).toContainText('수납 및 결제 현황');

    // Select the current month to load the mocked current month payments
    const currentMonth = new Date().toISOString().slice(0, 7);
    await page.locator('#payment-month-select').selectOption(currentMonth);
    await page.waitForTimeout(300);

    // 6. Verify filters automatically set to: student status = withdrawn, payment status = unpaid
    const studentStatusSelect = page.locator('#payment-student-status-select');
    const paymentStatusSelect = page.locator('#payment-status-select');
    await expect(studentStatusSelect).toHaveValue('withdrawn');
    await expect(paymentStatusSelect).toHaveValue('unpaid');

    // 7. Verify tables rows count = 1 (only S2 with P-HANDOFF-2)
    const paymentRows = page.locator('#payments-table-body tr');
    await expect(paymentRows).toHaveCount(1);
    await expect(page.locator('[data-testid="payment-row-P-HANDOFF-2"]')).toBeVisible();

    // 8. Verify status badges (should contain 퇴원)
    await expect(page.locator('[data-testid="payment-row-P-HANDOFF-2"]')).toContainText('퇴원');

    // 9. Verify summary recalculated (Total: 250,000 / Paid: 0 / Unpaid: 250,000)
    const summaryStats = page.locator('#payment-summary-stats');
    await expect(summaryStats).toContainText('250,000원');
    await expect(summaryStats).toContainText('완납: 0원');
    await expect(summaryStats).toContainText('미납: 250,000원');

    // 10. Verify sessionStorage handoff key is consumed/removed
    const handoffKeyVal = await page.evaluate(() => sessionStorage.getItem('dayday_billing_filter_handoff'));
    expect(handoffKeyVal).toBeNull();

    // 11. Navigate away and back to Payments View through regular menu
    await page.locator('.menu-item[data-view="dir-dashboard"]').click();
    await expect(page.locator('#page-title')).toContainText('대시보드');

    await page.locator('.menu-item[data-view="dir-payments"]').click();
    await expect(page.locator('#page-title')).toContainText('수납 및 결제 현황');

    // 12. Verify filters reset to default (all / all)
    await expect(studentStatusSelect).toHaveValue('all');
    await expect(paymentStatusSelect).toHaveValue('all');
  });

  test('should show preview based on templates in billing view send warning modal and block if missing required fields (Phase 18A-3)', async ({ page }) => {
    // Mock browser Date to 2026-06-13T12:00:00.000Z to align future billing checks
    await page.addInitScript(() => {
      const MockDate = class extends Date {
        constructor(...args) {
          if (args.length === 0) {
            super('2026-06-13T12:00:00.000Z');
          } else {
            super(...args);
          }
        }
      };
      MockDate.now = () => new Date('2026-06-13T12:00:00.000Z').getTime();
      window.Date = MockDate;
    });

    // Reload page to apply mocked Date
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.role-grid').waitFor({ state: 'attached', timeout: 5000 });

    // 1. Login as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // 2. Setup mock data in State Store
    await page.evaluate(() => {
      const db = window.stateStore.db;
      db.payments = [];
      db.students = db.students || [];

      // S1: 최다은 (attending)
      const s1 = db.students.find(s => s.id === 'S1');
      if (s1) {
        s1.status = 'attending';
        s1.dueDay = 10;
        s1.academyId = 'AC1';
      }

      // S3: 이도윤 (attending)
      const s3 = db.students.find(s => s.id === 'S3');
      if (s3) {
        s3.status = 'attending';
        s3.name = '이도윤';
        s3.dueDay = 20;
        s3.academyId = 'AC1';
      }

      // 수강료 미납 payment (이미 납기일이 지난 2026-06-10일 청구 -> tuition_unpaid)
      db.payments.push({
        id: 'P-PREVIEW-TUITION-UNPAID',
        studentId: 'S1',
        amount: 150000,
        month: '2026-06',
        type: 'education',
        status: 'unpaid',
        invoiceDate: '2026-06-10'
      });

      // 수강료 납부 예정 payment (납기일이 미래인 2026-06-20일 청구 -> tuition_due)
      db.payments.push({
        id: 'P-PREVIEW-TUITION-DUE',
        studentId: 'S3',
        amount: 200000,
        month: '2026-06',
        type: 'education',
        status: 'unpaid',
        invoiceDate: '2026-06-20'
      });

      // 교재비 미납 payment (book_unpaid)
      db.payments.push({
        id: 'P-PREVIEW-BOOK-UNPAID',
        studentId: 'S1',
        amount: 30000,
        month: '2026-06',
        type: 'book',
        status: 'unpaid',
        invoiceDate: '2026-06-10',
        bookId: 'B1'
      });

      // 필수 변수 누락 payment (amount = 0)
      db.payments.push({
        id: 'P-PREVIEW-MISSING-FIELD',
        studentId: 'S1',
        amount: 0,
        month: '2026-06',
        type: 'education',
        status: 'unpaid',
        invoiceDate: '2026-06-10'
      });

      // B1 교재 정보 주입
      db.books = db.books || [];
      const hasB1 = db.books.some(b => b.id === 'B1');
      if (!hasB1) {
        db.books.push({
          id: 'B1',
          name: '바이엘 1',
          price: 30000
        });
      }

      // Settings
      db.settings = db.settings || {};
      db.settings.academy = '튜링음악학원';
      db.settings.director = '주재경';
      // Fix evaluation time to 2026-06-13
      db.settings.DAYDAY_DEBUG_EVAL_TIME = '2026-06-13T12:00:00.000Z';

      window.stateStore.saveDB();
    });

    // 수납 및 결제 현황 뷰로 이동
    await page.locator('.menu-item[data-view="dir-payments"]').click();
    await page.waitForTimeout(200);

    // 월 선택을 2026-06으로
    await page.locator('#payment-month-select').selectOption('2026-06');
    await page.waitForTimeout(300);

    // A. 수강료 미납 알림 모달 미리보기 검증 (P-PREVIEW-TUITION-UNPAID)
    const tuitionUnpaidRow = page.locator('[data-testid="payment-row-P-PREVIEW-TUITION-UNPAID"]');
    await expect(tuitionUnpaidRow).toBeVisible();
    await tuitionUnpaidRow.locator('.btn-send-reminder').click();
    await page.locator('#modal-receiver-parent').click();

    // 모달 타이틀 확인
    await expect(page.locator('#common-modal .modal-title')).toContainText('결제 요청 확인');
    // 미리보기 내용 확인
    await expect(page.locator('#common-modal')).toContainText('최다은 학생 보호자님. 튜링음악학원 2026년 6월 원비의 수납 상태는 미납 상태입니다.');
    await page.locator('#common-modal [data-close-modal]').first().click(); // 닫기

    // B. 수강료 납부 예정 알림 모달 미리보기 검증 (P-PREVIEW-TUITION-DUE)
    const tuitionDueRow = page.locator('[data-testid="payment-row-P-PREVIEW-TUITION-DUE"]');
    await expect(tuitionDueRow).toBeVisible();
    await tuitionDueRow.locator('.btn-send-reminder').click();
    await page.locator('#modal-receiver-parent').click();
    await expect(page.locator('#common-modal')).toContainText('이도윤 학생 보호자님. 튜링음악학원 2026년 6월 원비 수납일 안내드립니다.');
    await page.locator('#common-modal [data-close-modal]').first().click(); // 닫기

    // C. 교재비 미납 알림 모달 미리보기 검증 (P-PREVIEW-BOOK-UNPAID)
    const bookUnpaidRow = page.locator('[data-testid="payment-row-P-PREVIEW-BOOK-UNPAID"]');
    await expect(bookUnpaidRow).toBeVisible();
    await bookUnpaidRow.locator('.btn-send-reminder').click();
    await page.locator('#modal-receiver-parent').click();
    await expect(page.locator('#common-modal')).toContainText('바이엘 1 교재비가 아직 납부되지 않았습니다.');
    await page.locator('#common-modal [data-close-modal]').first().click(); // 닫기

    // D. 필수 변수 누락 시 발송 차단 검증 (P-PREVIEW-MISSING-FIELD)
    const missingFieldRow = page.locator('[data-testid="payment-row-P-PREVIEW-MISSING-FIELD"]');
    await expect(missingFieldRow).toBeVisible();
    await missingFieldRow.locator('.btn-send-reminder').click();
    await page.locator('#modal-receiver-parent').click();
    
    // 경고 문구 확인
    await expect(page.locator('#common-modal')).toContainText('필수 정보가 없어 메시지를 만들 수 없습니다.');
    
    // 전송 버튼 disabled 확인
    const confirmBtn = page.locator('#btn-confirm-send-payment');
    await expect(confirmBtn).toBeDisabled();

    // 닫기
    await page.locator('#common-modal [data-close-modal]').first().click();
  });
});

