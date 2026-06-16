import { test, expect } from '@playwright/test';

const mockTime = new Date('2026-06-16T09:00:00+09:00').getTime();
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

test.describe('Parent Portal Communication Flow', () => {
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const mockTime = new Date('2026-06-16T09:00:00+09:00').getTime();
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
      }
    });
    page.on('pageerror', err => {
      consoleErrors.push(err.message);
    });

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

  test('should support communication tabs, display announcements/messages/surveys, and check empty states', async ({ page }) => {
    // 1. Log in as Parent
    const parentBtn = page.locator('#login-overlay .role-btn.student');
    await expect(parentBtn).toBeVisible({ timeout: 5000 });
    await parentBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // Inject mock DB states: communication elements + automatic parentMessages + teacher comments
    await page.evaluate(() => {
      const db = window.stateStore.db;
      db.announcements = [];
      db.messages = [];
      db.surveys = [];
      db.parentMessages = [];
      db.attendance = [];

      // Link parent
      const link = db.parentStudentLinks.find(l => l.parentUserId === 'USR_PAR_DEMO' && l.studentId === 'S1');
      if (!link) {
        db.parentStudentLinks.push({ parentUserId: 'USR_PAR_DEMO', studentId: 'S1' });
      }

      // Add 1 Announcement
      db.announcements.push({
        id: 'AN_MOCK_E2E',
        title: 'E2E 학원 정기 공지사항',
        content: 'E2E 테스트 공지 본문 내용입니다.',
        date: '2026-06-15',
        views: 5
      });

      // Add 1 Message (Individual info)
      db.messages.push({
        id: 'MSG_MOCK_E2E',
        studentId: 'S1',
        title: 'E2E 학생 개별 안내장',
        content: 'E2E 테스트 학생 개별 안내 본문입니다.',
        date: '2026-06-16',
        isRead: false
      });

      // Add 1 Survey
      db.surveys.push({
        id: 'SUR_MOCK_E2E',
        title: 'E2E 학부모 설문 조사',
        description: 'E2E 테스트를 위한 학부모 의견 수집 설문입니다.',
        date: '2026-06-16',
        isActive: true,
        questions: [
          { id: 'Q1', type: 'choice', questionText: 'E2E 설문 질문', options: ['참가', '불참'] }
        ]
      });

      // Add unread parentMessages (Auto attendance & payment logs) - these should be hidden on this view
      db.parentMessages.push({
        id: 'pm_auto_attendance_log',
        studentId: 'S1',
        category: 'attendance',
        type: 'check_in',
        title: '등원 알림',
        body: '최다은 원생이 14:05에 등원했습니다.',
        status: 'unread',
        createdAt: '2026-06-16T14:05:00.000Z'
      });

      db.parentMessages.push({
        id: 'pm_auto_payment_log',
        studentId: 'S1',
        category: 'payment',
        type: 'tuition_billing',
        title: '수강료 수납 안내',
        body: '최다은 원생의 수강료가 청구되었습니다.',
        status: 'unread',
        createdAt: '2026-06-16T14:10:00.000Z'
      });

      // Add 1 Teacher comment (attendance record with a note)
      db.attendance.push({
        id: 'ATT_MOCK_WITH_COMMENT',
        studentId: 'S1',
        date: '2026-06-15',
        time: '14:00',
        status: 'present',
        note: '최다은 원생이 오늘 피아노 연습을 아주 열심히 했습니다. 코드 진행도가 좋습니다.'
      });

      db.attendance.push({
        id: 'ATT_MOCK_NO_COMMENT',
        studentId: 'S1',
        date: '2026-06-14',
        time: '14:00',
        status: 'present',
        note: ''
      });

      window.stateStore.saveDB();
      // Ensure badges trigger update
      if (window.updateParentSidebarBadges) {
        window.updateParentSidebarBadges();
      }
    });

    // 2. Verify Left Menu Sidebar Badges initially
    const commMenu = page.locator('.menu-item[data-view="stu-communication"]');
    await expect(commMenu).toBeVisible();
    
    // Left menu badge should sum announcements (1) + individual messages (1) + surveys (1) = 3
    const commMenuBadge = commMenu.locator('.parent-menu-badge');
    await expect(commMenuBadge).toHaveText('3');

    // Attendance and payment menu items should have their own badges (1 each)
    const attMenuBadge = page.locator('.menu-item[data-view="stu-calendar"] .parent-menu-badge');
    await expect(attMenuBadge).toHaveText('1');
    const billMenuBadge = page.locator('.menu-item[data-view="stu-billing"] .parent-menu-badge');
    await expect(billMenuBadge).toHaveText('1');

    // Journal (선생님 코멘트) menu badge should show 1
    const journalMenu = page.locator('.menu-item[data-view="stu-journal"]');
    await expect(journalMenu).toBeVisible();
    const journalMenuBadge = journalMenu.locator('.parent-menu-badge');
    await expect(journalMenuBadge).toHaveText('1');

    // 3. Navigate to "알림 및 설문" view
    await commMenu.click();

    // Verify page header title is "알림 및 설문"
    const headerTitle = page.locator('#page-title');
    await expect(headerTitle).toHaveText('알림 및 설문');

    // Verify "학부모 메시지함" is NOT visible in sidebar
    await expect(page.locator('#parent-messages-menu-item')).toBeHidden();

    // 4. Verify sub-tab badges initial values
    const tabAnnBadge = page.locator('#tab-stu-ann .tab-badge');
    await expect(tabAnnBadge).toHaveText('1');
    const tabMsgBadge = page.locator('#tab-stu-msg .tab-badge');
    await expect(tabMsgBadge).toHaveText('1');
    const tabSurvBadge = page.locator('#tab-stu-surv .tab-badge');
    await expect(tabSurvBadge).toHaveText('1');

    // 5. Test Announcements detail modal and read badge decrement
    const commContainer = page.locator('#student-communication-content');
    const annCard = commContainer.locator('.announcement-card-item');
    await expect(annCard).toBeVisible();
    // Unread indicator dot should be visible
    await expect(annCard.locator('span[style*="background: var(--danger)"]')).toBeVisible();

    const commonModal = page.locator('#common-modal');
    const modalContent = page.locator('.modal-content');

    await annCard.click();
    // Modal opens
    await expect(commonModal).toHaveClass(/show/);
    await expect(modalContent).toContainText('E2E 학원 정기 공지사항');

    // Close modal
    await modalContent.locator('[data-close-modal]').first().click();
    await expect(commonModal).not.toHaveClass(/show/);

    // Tab badge should disappear/decrease
    await expect(tabAnnBadge).toBeHidden();
    // Left menu badge decreases to 2
    await expect(commMenuBadge).toHaveText('2');

    // 6. Test Individual Messages detail modal and read badge decrement
    const msgTabBtn = page.locator('#tab-stu-msg');
    await msgTabBtn.click();
    
    const msgCard = commContainer.locator('.message-card-item');
    await expect(msgCard).toBeVisible();
    // Unread dot visible
    await expect(msgCard.locator('span[style*="background: var(--danger)"]')).toBeVisible();
    await expect(msgCard).toContainText('읽지 않음');

    await msgCard.click();
    await expect(commonModal).toHaveClass(/show/);
    await expect(modalContent).toContainText('E2E 학생 개별 안내장');

    // Close modal
    await modalContent.locator('[data-close-modal]').first().click();
    await expect(commonModal).not.toHaveClass(/show/);

    // Tab badge should disappear/decrease
    await expect(tabMsgBadge).toBeHidden();
    // Left menu badge decreases to 1
    await expect(commMenuBadge).toHaveText('1');

    // 7. Test Survey details modal and read badge decrement (with submission status unchanged)
    const survTabBtn = page.locator('#tab-stu-surv');
    await survTabBtn.click();

    const survCard = commContainer.locator('.survey-card-item');
    await expect(survCard).toBeVisible();
    // Unread dot visible
    await expect(survCard.locator('span[style*="background: var(--danger)"]')).toBeVisible();
    await expect(survCard).toContainText('설문 참여 대기');

    await survCard.click();
    await expect(commonModal).toHaveClass(/show/);
    await expect(modalContent).toContainText('E2E 학부모 설문 조사');

    // Close modal WITHOUT submitting
    await modalContent.locator('[data-close-modal]').first().click();
    await expect(commonModal).not.toHaveClass(/show/);

    // Tab badge should disappear/decrease
    await expect(tabSurvBadge).toBeHidden();
    // Left menu badge decreases to 0 (badge element removed)
    await expect(commMenuBadge).toBeHidden();

    // Verify submission status remains "설문 참여 대기"
    await expect(survCard).toContainText('설문 참여 대기');

    // 8. Submit survey and verify submission status updates
    await survCard.click();
    await expect(commonModal).toHaveClass(/show/);
    
    // Choose answer option
    await modalContent.locator('input[type="radio"]').first().click();
    // Submit response
    await modalContent.locator('button[type="submit"]').click();
    await expect(commonModal).not.toHaveClass(/show/);

    // Survey card status should now show "제출 완료"
    await expect(survCard).toContainText('제출 완료');

    // 9. Verify automatic parentMessages are not mixed
    await expect(commContainer).not.toContainText('최다은 원생이 14:05에 등원했습니다.');
    await expect(commContainer).not.toContainText('수강료가 청구되었습니다.');

    // 10. Test Teacher Comments detail modal and read badge decrement
    await journalMenu.click();
    const journalHeader = page.locator('#page-title');
    await expect(journalHeader).toHaveText('선생님 피드백 코멘트');

    const commentCard = page.locator('.journal-card-item');
    await expect(commentCard).toBeVisible();
    // Unread dot visible
    await expect(commentCard.locator('.unread-dot')).toBeVisible();

    await commentCard.click();
    await expect(commonModal).toHaveClass(/show/);
    await expect(modalContent).toContainText('선생님 피드백 코멘트');
    await expect(modalContent).toContainText('최다은 원생이 오늘 피아노 연습을 아주 열심히 했습니다.');

    // Close modal
    await modalContent.locator('[data-close-modal]').first().click();
    await expect(commonModal).not.toHaveClass(/show/);

    // Red dot should be gone
    await expect(commentCard.locator('.unread-dot')).toBeHidden();
    // Sidebar badge should be gone
    await expect(journalMenuBadge).toBeHidden();

    // 11. Test Empty States via seed clearing
    // Go back to communication tab for empty checks
    await commMenu.click();
    await expect(headerTitle).toHaveText('알림 및 설문');
    await expect(headerTitle).toBeVisible();

    await page.evaluate(() => {
      const db = window.stateStore.db;
      db.announcements = [];
      db.messages = [];
      db.surveys = [];
      window.stateStore.saveDB();
      window.stateStore.notify('ANNOUNCEMENTS_CHANGED');
      window.stateStore.notify('MESSAGES_CHANGED');
      window.stateStore.notify('SURVEYS_CHANGED');
    });

    // Make sure we select the surveys tab first to check its empty state
    const survTab = page.locator('#tab-stu-surv');
    await survTab.click();
    await expect(commContainer).toContainText('참여할 설문이 없습니다.');
    await expect(commContainer.locator('.fa-square-poll-vertical')).toBeVisible();

    // Check empty state for individual messages
    await page.locator('#tab-stu-msg').click();
    await expect(commContainer).toContainText('아직 받은 안내가 없습니다.');
    await expect(commContainer.locator('.fa-envelope')).toBeVisible();

    // Check empty state for announcements
    await page.locator('#tab-stu-ann').click();
    await expect(commContainer).toContainText('아직 등록된 공지사항이 없습니다.');
    await expect(commContainer.locator('.fa-bullhorn')).toBeVisible();

    expect(consoleErrors.length).toBe(0);
  });
});
