import { test, expect } from '@playwright/test';

test.describe('Student Detail Message Recipient Handoff Flow (Phase 18A-4)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`BROWSER [${msg.type()}]:`, msg.text()));
    page.on('pageerror', err => console.error('BROWSER ERROR:', err));
    // 1. Navigate and login as director
    await page.goto('/');
    await page.locator('.role-btn.director').click();
  });

  test('should handoff to message view from student detail with empty body and template null', async ({ page }) => {
    // 1. Ensure students S3 (withdrawn) and S4 (on_leave) are initialized properly
    await page.evaluate(() => {
      const s3 = window.stateStore.getStudent('S3');
      if (s3) {
        s3.status = 'withdrawn';
        s3.name = '이도윤';
      }
      const s4 = window.stateStore.getStudent('S4');
      if (s4) {
        s4.status = 'on_leave';
        s4.name = '김우진';
      }
      const s1 = window.stateStore.getStudent('S1');
      if (s1) {
        s1.status = 'attending';
        s1.name = '최다은';
      }
      window.stateStore.saveDB();
    });

    // 2. Navigate to Student Management
    await page.locator('.menu-item[data-view="dir-students"]').click();
    await page.waitForTimeout(600); // 렌더링 대기

    // 3. Open detail modal for S1 (최다은)
    const rowS1 = page.locator('.student-name-link', { hasText: '최다은' }).first();
    await rowS1.click();
    await page.waitForTimeout(300);

    // Detail modal should be open (Common Modal overlay)
    await expect(page.locator('#common-modal')).toBeVisible();

    // 4. Click "메시지 보내기" button in detail modal footer
    const sendMessageBtn = page.locator('#btn-send-message-from-detail');
    await expect(sendMessageBtn).toBeVisible();
    await sendMessageBtn.click();
    await page.waitForTimeout(600); // 전환 및 모달 닫기 대기

    // Modal should be hidden
    await expect(page.locator('#common-modal')).not.toHaveClass(/show/);

    // 5. Verify transition to Message Send View
    await expect(page.locator('#page-title')).toContainText('메시지 보내기');

    // 6. Verify recipient-only condition: body and title empty, selected template null/general check
    const composeTitle = page.locator('#composeTitleInput');
    const composeBody = page.locator('#composeBodyInput');
    await expect(composeTitle).toHaveValue('');
    await expect(composeBody).toHaveValue('');

    // selectedTemplateKey should be null or template dropdown not selected
    const templateSelect = page.locator('#templateSelect');
    if (await templateSelect.count() > 0) {
      await expect(templateSelect).toHaveValue('');
    }

    // 7. Verify student selection and add recipient
    const addToRecipientsBtn = page.locator('#btnAddToRecipients');
    await expect(addToRecipientsBtn).toBeEnabled();
    await expect(addToRecipientsBtn).toContainText('발송인원 추가 (1건)');
    await addToRecipientsBtn.click();
    await page.waitForTimeout(300);

    // Recipient list should show the parent of 최다은
    const recipientCard = page.locator('.message-send-recipient-card');
    await expect(recipientCard).toBeVisible();
    await expect(recipientCard).toContainText('최다은');
  });

  test('should display [퇴원] / [휴원] badge when handoff is executed for withdrawn/on_leave students', async ({ page }) => {
    // 1. Initialize S3 as withdrawn and S4 as on_leave
    await page.evaluate(() => {
      const s3 = window.stateStore.getStudent('S3');
      if (s3) {
        s3.status = 'withdrawn';
        s3.name = '이도윤';
      }
      const s4 = window.stateStore.getStudent('S4');
      if (s4) {
        s4.status = 'on_leave';
        s4.name = '김우진';
      }
      window.stateStore.saveDB();
    });

    // 2. Navigate to Student Management
    await page.locator('.menu-item[data-view="dir-students"]').click();
    await page.waitForTimeout(600);

    // 3. Open detail modal for S3 (이도윤)
    // 퇴원생 필터 선택
    const statusFilter = page.locator('#student-status-filter');
    if (await statusFilter.count() > 0) {
      await statusFilter.selectOption('discharged');
      await page.waitForTimeout(600);
    }
    
    const rowS3 = page.locator('.student-name-link', { hasText: '이도윤' }).first();
    await rowS3.click();
    await page.waitForTimeout(300);

    // Click "메시지 보내기"
    await page.locator('#btn-send-message-from-detail').click();
    await page.waitForTimeout(600);

    // Add to recipients
    await page.locator('#btnAddToRecipients').click();
    await page.waitForTimeout(300);

    // Verify [퇴원] badge inside recipient card list
    const withdrawnBadge = page.locator('.status-badge-withdrawn');
    await expect(withdrawnBadge).toBeVisible();
    await expect(withdrawnBadge).toContainText('[퇴원]');

    // Navigate to Student Management again to test S4 (휴원생)
    await page.locator('.menu-item[data-view="dir-students"]').click();
    await page.waitForTimeout(600);

    // 재원생 필터 선택 (휴원생은 withdrawn이 아니므로 재원생에 속함)
    if (await statusFilter.count() > 0) {
      await statusFilter.selectOption('active');
      await page.waitForTimeout(600);
    }

    const rowS4 = page.locator('.student-name-link', { hasText: '김우진' }).first();
    await rowS4.click();
    await page.waitForTimeout(300);

    // Click "메시지 보내기"
    await page.locator('#btn-send-message-from-detail').click();
    await page.waitForTimeout(600);

    // Add to recipients
    await page.locator('#btnAddToRecipients').click();
    await page.waitForTimeout(300);

    // Verify [휴원] badge inside recipient card list
    const onLeaveBadge = page.locator('.status-badge-on-leave');
    await expect(onLeaveBadge).toBeVisible();
    await expect(onLeaveBadge).toContainText('[휴원]');
  });
});
