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
    expect(tasksListText).toContain('수납확인');
    expect(tasksListText).not.toContain('미수납');

    // 5. Test filtering: 미수납 확인 카드 클릭 시 하단에 미수납만 표시
    await page.locator('.kpi-chip-card[data-filter-id="overdue"]').click();
    tasksListText = await page.locator('#tasks-list-container').innerText();
    expect(tasksListText).toContain('미수납');
    expect(tasksListText).not.toContain('수납확인');

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
});
