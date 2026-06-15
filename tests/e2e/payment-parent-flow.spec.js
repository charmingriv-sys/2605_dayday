import { test, expect } from '@playwright/test';

// NodeJS runner Date mocking to match browser mockTime
const mockTime = new Date('2026-06-15T09:00:00+09:00').getTime();
const OriginalDate = Date;
class MockDate extends OriginalDate {
  constructor(...args) {
    if (args.length === 0) {
      super(mockTime);
    } else {
      super(...args);
    }
  }
  static now() {
    return mockTime;
  }
}
global.Date = MockDate;

test.describe('Parent Portal Payment and Billing Flow', () => {
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    // Mock the date to 2026-06-15 09:00:00 KST
    await page.addInitScript(() => {
      const mockTime = new Date('2026-06-15T09:00:00+09:00').getTime();
      const OriginalDate = Date;
      class MockDate extends OriginalDate {
        constructor(...args) {
          if (args.length === 0) {
            super(mockTime);
          } else {
            super(...args);
          }
        }
        static now() {
          return mockTime;
        }
      }
      window.Date = MockDate;
      window.__DAYDAY_E2E__ = true;
    });

    consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.error('Browser console.error:', msg.text());
      } else {
        console.log('Browser console.log:', msg.text());
      }
    });
    page.on('pageerror', err => {
      consoleErrors.push(err.message);
      console.error('Browser pageerror:', err.message);
    });

    // Dismiss alert dialogs gracefully
    page.on('dialog', async dialog => {
      console.log('--- E2E Alert dialog popped up: ---', dialog.message());
      await dialog.dismiss();
    });

    // Clear local storage for clean default state
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.role-grid').waitFor({ state: 'attached', timeout: 5000 });
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.role-grid').waitFor({ state: 'attached', timeout: 5000 });
  });

  test('should support tabs, display education & book payments, handle details modal & message read synch', async ({ page }) => {
    // 1. Log in as Parent (S1)
    const parentBtn = page.locator('#login-overlay .role-btn.student');
    await expect(parentBtn).toBeVisible({ timeout: 5000 });
    await parentBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // Inject mock payments and parentMessages for S1
    await page.evaluate(() => {
      const db = window.stateStore.db;
      db.payments = [];
      db.parentMessages = [];

      // Link USR_PAR_DEMO to S1
      const link = db.parentStudentLinks.find(l => l.parentUserId === 'USR_PAR_DEMO' && l.studentId === 'S1');
      if (!link) {
        db.parentStudentLinks.push({
          id: 'L_E2E_PAR_S1',
          parentUserId: 'USR_PAR_DEMO',
          studentId: 'S1'
        });
      }

      // Add student details for S1
      const student = db.students.find(s => s.id === 'S1');
      if (student) {
        student.dueDay = 15;
        student.name = '최다은';
      }

      // 1. Unpaid Education
      db.payments.push({
        id: 'P_MOCK_EDU_UNPAID',
        studentId: 'S1',
        amount: 150000,
        month: '2026-06',
        type: 'education',
        status: 'unpaid',
        invoiceDate: '2026-06-05'
      });

      // 2. Requested Book
      db.payments.push({
        id: 'P_MOCK_BOOK_REQ',
        studentId: 'S1',
        amount: 25000,
        month: '2026-06',
        type: 'book',
        status: 'requested',
        invoiceDate: '2026-06-10',
        bookId: 'B_MOCK_E2E'
      });

      // Add the book
      db.books.push({
        id: 'B_MOCK_E2E',
        name: 'E2E 테스트 교재'
      });

      // 3. Paid Education
      db.payments.push({
        id: 'P_MOCK_EDU_PAID',
        studentId: 'S1',
        amount: 150000,
        month: '2026-05',
        type: 'education',
        status: 'paid',
        invoiceDate: '2026-05-05',
        paidDate: '2026-05-14',
        method: 'card'
      });

      // Add unread parent message for unpaid payment to check badge behavior
      db.parentMessages.push({
        id: 'M_MOCK_UNREAD_EDU',
        studentId: 'S1',
        parentContactId: 'PC_S1_1',
        parentSlot: 'parent1',
        recipientName: '최다은 학부모',
        recipientPhone: '010-9999-1111',
        category: 'payment',
        type: 'tuition_billing',
        title: '수강료 수납 안내',
        body: '최다은 원생의 2026년 06월 수강료 150,000원이 청구되었습니다.',
        status: 'unread',
        createdAt: '2026-06-05T09:00:00.000Z',
        dedupeKey: 'TUITION_BILLING_P_MOCK_EDU_UNPAID'
      });

      window.stateStore.saveDB();
    });

    // Navigate to "수강료 납부" tab
    const billingMenu = page.locator('.menu-item[data-view="stu-billing"]');
    await expect(billingMenu).toBeVisible();
    await billingMenu.click();

    // Verify sidebar does not contain "학부모 메시지함"
    const sidebar = page.locator('.sidebar');
    await expect(sidebar.locator('text=학부모 메시지함')).not.toBeVisible();

    // Verify Tab headers are visible
    const unpaidTabBtn = page.locator('#btn-tab-unpaid');
    const paidTabBtn = page.locator('#btn-tab-paid');
    await expect(unpaidTabBtn).toBeVisible();
    await expect(paidTabBtn).toBeVisible();

    // Unpaid tab should be active by default and unread count badge should NOT be visible
    await expect(unpaidTabBtn).toHaveClass(/btn-primary/);
    await expect(unpaidTabBtn.locator('.badge-unread-count')).not.toBeVisible();

    // Check unpaid billing list content
    const unpaidTable = page.locator('[data-testid="parent-billing-table"]');
    await expect(unpaidTable).toBeVisible();

    // Row 1: Unpaid Education
    const rowEdu = unpaidTable.locator('tr[data-id="P_MOCK_EDU_UNPAID"]');
    await expect(rowEdu).toBeVisible();
    await expect(rowEdu.locator('td').nth(0)).toContainText('수강료');
    await expect(rowEdu.locator('td').nth(1)).toContainText('최다은');
    await expect(rowEdu.locator('td').nth(2)).toContainText('2026년 06월');
    await expect(rowEdu.locator('td').nth(3)).toContainText('150,000원');
    await expect(rowEdu.locator('td').nth(4)).toContainText('2026-06-15'); // dueDay = 15
    await expect(rowEdu.locator('td').nth(5)).toContainText('미수납');
    // Unread badge "알림 확인 전" should NOT be visible on Row Edu
    await expect(rowEdu.locator('text=알림 확인 전')).not.toBeVisible();

    // Row 2: Requested Book
    const rowBook = unpaidTable.locator('tr[data-id="P_MOCK_BOOK_REQ"]');
    await expect(rowBook).toBeVisible();
    await expect(rowBook.locator('td').nth(0)).toContainText('교재비');
    await expect(rowBook.locator('td').nth(2)).toContainText('2026-06-10');
    await expect(rowBook.locator('td').nth(3)).toContainText('25,000원');
    await expect(rowBook.locator('td').nth(4)).toContainText('2026-06-15'); // invoice 6-10 < due 6-15 -> due 6-15
    await expect(rowBook.locator('td').nth(5)).toContainText('결제 대기');

    // Verify that the message is initially unread in stateStore
    const isUnreadBefore = await page.evaluate(() => {
      const msg = window.stateStore.db.parentMessages.find(m => m.id === 'M_MOCK_UNREAD_EDU');
      return msg ? msg.status : null;
    });
    expect(isUnreadBefore).toBe('unread');

    // Click rowEdu to open detail modal and mark message as read
    await rowEdu.click();

    // Detail Modal verification
    const modal = page.locator('#common-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.modal-title')).toContainText('청구 및 수납 상세 정보');
    await expect(modal.locator('.modal-body')).toContainText('최다은');
    await expect(modal.locator('.modal-body')).toContainText('150,000원');
    await expect(modal.locator('.modal-body')).toContainText('2026년 06월');
    await expect(modal.locator('.modal-body')).toContainText('2026-06-15');
    await expect(modal.locator('.modal-body')).toContainText('수강료 청구서');

    // Close modal
    await modal.locator('[data-close-modal]').first().click();
    await expect(modal).not.toHaveClass(/show/);
    await page.waitForTimeout(400);

    // After closing modal, the unread message for S1 should be read
    const isUnreadAfter = await page.evaluate(() => {
      const msg = window.stateStore.db.parentMessages.find(m => m.id === 'M_MOCK_UNREAD_EDU');
      return msg ? msg.status : null;
    });
    expect(isUnreadAfter).toBe('read');
    await expect(rowEdu.locator('text=알림 확인 전')).not.toBeVisible();

    // Switch to Paid tab
    await paidTabBtn.click();
    await expect(paidTabBtn).toHaveClass(/btn-primary/);
    await expect(unpaidTabBtn).toHaveClass(/btn-secondary/);

    // Row Paid Education
    const rowPaidEdu = unpaidTable.locator('tr[data-id="P_MOCK_EDU_PAID"]');
    await expect(rowPaidEdu).toBeVisible();
    await expect(rowPaidEdu.locator('td').nth(0)).toContainText('수강료');
    await expect(rowPaidEdu.locator('td').nth(1)).toContainText('최다은');
    await expect(rowPaidEdu.locator('td').nth(2)).toContainText('2026년 05월');
    await expect(rowPaidEdu.locator('td').nth(3)).toContainText('150,000원');
    await expect(rowPaidEdu.locator('td').nth(4)).toContainText('2026-05-14'); // paidDate
    await expect(rowPaidEdu.locator('td').nth(5)).toContainText('신용카드'); // method

    // Click paid row to check modal content
    await rowPaidEdu.click();
    await expect(modal).toBeVisible();
    await expect(modal.locator('.modal-body')).toContainText('납부 완료일: 2026-05-14');
    await expect(modal.locator('.modal-body')).toContainText('결제 수단: 신용카드');
    await modal.locator('[data-close-modal]').first().click();
  });

  test('should display empty states properly when no payment data exists', async ({ page }) => {
    // 1. Log in as Parent (S1)
    const parentBtn = page.locator('#login-overlay .role-btn.student');
    await expect(parentBtn).toBeVisible({ timeout: 5000 });
    await parentBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // Empty payments database for S1
    await page.evaluate(() => {
      const db = window.stateStore.db;
      db.payments = [];
      db.parentMessages = [];
      window.stateStore.saveDB();
    });

    // Navigate to "수강료 납부" tab
    const billingMenu = page.locator('.menu-item[data-view="stu-billing"]');
    await expect(billingMenu).toBeVisible();
    await billingMenu.click();

    // Verify unpaid empty message
    const emptyUnpaid = page.locator('text=현재 납부할 내역이 없습니다.');
    await expect(emptyUnpaid).toBeVisible();

    // Switch to Paid tab
    const paidTabBtn = page.locator('#btn-tab-paid');
    await paidTabBtn.click();

    // Verify paid empty message
    const emptyPaid = page.locator('text=아직 납부 완료 내역이 없습니다.');
    await expect(emptyPaid).toBeVisible();
  });
});
