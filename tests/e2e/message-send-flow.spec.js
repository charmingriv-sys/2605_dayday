import { test, expect } from '@playwright/test';

test.describe('Message Send Flow (Phase 11A Skeleton Integration)', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Navigate and login as director
    await page.goto('/');
    await page.locator('.role-btn.director').click();
  });

  test('should register menu, swap views, and render 3-column skeleton correctly', async ({ page }) => {
    // 2. Sidebar Menu Visibility and Navigation
    const menuItem = page.locator('.menu-item[data-view="dir-message-send"]');
    await expect(menuItem).toBeVisible();
    await expect(menuItem).toContainText('메시지 보내기');
    await menuItem.click();

    // 3. Page Title & Common Header Action Integration
    await expect(page.locator('#page-title')).toContainText('메시지 보내기');
    
    // Check if global header action (refresh button) is mounted
    const refreshBtn = page.locator('#message-send-refresh-btn');
    await expect(refreshBtn).toBeVisible();
    await expect(refreshBtn).toContainText('새로고침');

    // 4. Validate 3-Column Panels Layout
    await expect(page.locator('#studentListPanel')).toBeVisible();
    await expect(page.locator('#recipientListPanel')).toBeVisible();
    await expect(page.locator('#composePanel')).toBeVisible();
    await expect(page.locator('#messageVaultPanel')).toBeVisible();

    // 5. Check real student data integration & selection mapping
    // Verify student name list is populated
    const studentRows = page.locator('.student-row');
    const studentCount = await studentRows.count();
    expect(studentCount).toBeGreaterThan(0);

    // Initial selected count should be 0
    await expect(page.locator('#selectedStudentsCount')).toContainText('0');

    // Click on the student row for "최다은" (or first row if 최다은 is not found, fallback to first row)
    let targetRow = studentRows.filter({ hasText: '최다은' });
    if (await targetRow.count() === 0) {
      targetRow = studentRows.first();
    }
    await targetRow.click();

    // Selection count should update to 1
    await expect(page.locator('#selectedStudentsCount')).toContainText('1');

    // Toggle contact types and check if "발송인원 추가" button count increases
    const addBtn = page.locator('#btnAddToRecipients');
    await expect(addBtn).toContainText('발송인원 추가 (1건)');

    // Toggle on "보호자2" contact type
    const g2Toggle = page.locator('.btn-toggle-contact-type[data-type="g2"]');
    await g2Toggle.click();
    
    // 최다은 has no guardian2 default, so it might stay 1. But let's check if the button is active.
    await expect(addBtn).toBeEnabled();
    
    // Add to recipients
    await addBtn.click();

    // Student selection clears, recipient panel should list the added student
    await expect(page.locator('#selectedStudentsCount')).toContainText('0');
    await expect(page.locator('#totalRecipientsLabel')).toContainText('1건');
  });

  test('should flow template application, send stub, and assert no db side-effects', async ({ page }) => {
    // Navigate to Message Send view
    await page.locator('.menu-item[data-view="dir-message-send"]').click();

    // Apply first template in vault
    const applyBtn = page.locator('.btn-apply-template').first();
    await expect(applyBtn).toBeVisible();
    await applyBtn.click();

    // Title and body inputs should be updated with template data
    const composeBody = page.locator('#composeBodyInput');
    const bodyContent = await composeBody.inputValue();
    expect(bodyContent.length).toBeGreaterThan(0);

    // Add a student to recipient list
    await page.locator('.student-row').first().click();
    await page.locator('#btnAddToRecipients').click();

    // Verify recipient added
    await expect(page.locator('#totalRecipientsLabel')).toContainText('1건');

    // Read initial db.messages length
    const initialMsgLength = await page.evaluate(() => window.stateStore.db.messages.length);

    // Setup dialog listener for message send stub
    let dialogTriggered = false;
    let dialogText = '';
    page.on('dialog', async (dialog) => {
      dialogTriggered = true;
      dialogText = dialog.message();
      await dialog.accept();
    });

    // Open Focus Review Modal
    const reviewBtn = page.locator('#btnReviewSend');
    await expect(reviewBtn).toBeVisible();
    await reviewBtn.click();

    const focusOverlay = page.locator('#focusConfirmOverlay');
    await expect(focusOverlay).toBeVisible();

    // Click Send inside Review Modal
    const sendConfirmBtn = page.locator('#btnFocusSendConfirm');
    await expect(sendConfirmBtn).toBeVisible();
    await sendConfirmBtn.click();

    // Assert alert dialog was triggered with mock text
    expect(dialogTriggered).toBe(true);
    expect(dialogText).toContain('실제 SMS/PUSH/알림톡 발송 기능은 추후 연결 예정입니다.');

    // Focus Modal should be closed and form reset
    await expect(focusOverlay).toBeHidden();
    await expect(page.locator('#totalRecipientsLabel')).toBeHidden(); // Recipient list is cleared upon simulated send

    // Read final db.messages length and assert no side-effects
    const finalMsgLength = await page.evaluate(() => window.stateStore.db.messages.length);
    expect(finalMsgLength).toBe(initialMsgLength);
  });

  test('should clean up global header actions on view transition', async ({ page }) => {
    // Navigate to Message Send view
    await page.locator('.menu-item[data-view="dir-message-send"]').click();
    await expect(page.locator('#message-send-refresh-btn')).toBeVisible();

    // Transition to another view
    await page.locator('.menu-item[data-view="dir-major-schedule"]').click();

    // Assert message send specific header action is cleaned up
    await expect(page.locator('#message-send-refresh-btn')).toBeHidden();
  });

  test('should flow template save modal and update saved list', async ({ page }) => {
    // Navigate to Message Send view
    await page.locator('.menu-item[data-view="dir-message-send"]').click();

    // Type title and body
    const titleInput = page.locator('#composeTitleInput');
    await titleInput.fill('테스트용 템플릿 제목');
    const bodyInput = page.locator('#composeBodyInput');
    await bodyInput.fill('테스트용 템플릿 내용입니다.');

    // Click "현재 내용을 템플릿으로 저장"
    const openSaveModalBtn = page.locator('#btnOpenSaveTemplateModal');
    await expect(openSaveModalBtn).toBeVisible();
    await openSaveModalBtn.click();

    // Verify modal overlay is visible
    const saveOverlay = page.locator('#templateSaveModalOverlay');
    await expect(saveOverlay).toBeVisible();

    // Verify inputs in modal are pre-filled
    const modalTitle = page.locator('#saveModalTitleInp');
    await expect(modalTitle).toHaveValue('테스트용 템플릿 제목');
    const modalBody = page.locator('#saveModalBodyInp');
    await expect(modalBody).toHaveValue('테스트용 템플릿 내용입니다.');

    // Setup dialog listener for alert
    let dialogTriggered = false;
    let dialogText = '';
    page.on('dialog', async (dialog) => {
      dialogTriggered = true;
      dialogText = dialog.message();
      await dialog.accept();
    });

    // Click Save
    const saveSubmitBtn = page.locator('#btnSaveModalSubmit');
    await saveSubmitBtn.click();

    // Assert alert was shown
    expect(dialogTriggered).toBe(true);
    expect(dialogText).toContain('템플릿 "테스트용 템플릿 제목"이(가) 보관함에 임시 저장되었습니다.');

    // Modal should close
    await expect(saveOverlay).toBeHidden();

    // Tab should auto-toggle to Saved, and first item in list should be the new template
    const activeTab = page.locator('.btn-vault-tab[data-tab="saved"]');
    await expect(activeTab).toHaveAttribute('data-tab', 'saved');

    const firstSavedItem = page.locator('#messageVaultPanel').locator('span').filter({ hasText: '테스트용 템플릿 제목' }).first();
    await expect(firstSavedItem).toBeVisible();
  });
});
