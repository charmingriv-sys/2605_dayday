import { test, expect } from '@playwright/test';

test.describe('Message Send Flow (Phase 11A Skeleton Integration)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`BROWSER [${msg.type()}]:`, msg.text()));
    page.on('pageerror', err => console.error('BROWSER ERROR:', err));
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
    expect(dialogText).toContain('실제 발송은 아직 연동되지 않았고, 발송이력만 저장되었습니다.');

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

  test('should support manual recipient entry, Excel CSV copy-paste, outbound logs, detail modal, and height alignment', async ({ page }) => {
    // Navigate to Message Send view
    await page.locator('.menu-item[data-view="dir-message-send"]').click();

    // 1. Check direct add modal validation and functionality
    await page.locator('#btnDirectAddStub').click();
    await expect(page.locator('#directAddModalOverlay')).toBeVisible();

    const directName = page.locator('#directAddNameInp');
    const directPhone = page.locator('#directAddPhoneInp');
    const directSubmit = page.locator('#btnDirectAddSubmit');
    const directError = page.locator('#directAddErrorMsg');

    // Mismatched pattern
    await directName.fill('홍길동');
    await directPhone.fill('invalid-phone123!');
    await directSubmit.click();
    await expect(directError).toBeVisible();
    await expect(directError).toContainText('올바른 휴대폰 번호 형식이 아닙니다');

    // Valid number
    await directPhone.fill('010-1234-5678');
    await directSubmit.click();
    await expect(page.locator('#directAddModalOverlay')).toBeHidden();

    // Recipient label should contain 1
    await expect(page.locator('#totalRecipientsLabel')).toContainText('1건');

    // 2. Check excel import copy-paste modal parsing and dedupe
    await page.locator('#btnExcelImportStub').click();
    await expect(page.locator('#excelImportModalOverlay')).toBeVisible();

    const csvContent = `이름,휴대폰번호
김지원,010-1111-2222
박서준,010-3333-4444
홍길동,010-1234-5678`; // duplicate phone number

    await page.locator('#excelImportTextarea').fill(csvContent);
    await page.locator('#btnExcelImportSubmit').click();
    await expect(page.locator('#excelImportModalOverlay')).toBeHidden();

    // Check recipients label has '3건' (1 manual + 2 unique CSV, duplicate excluded by dedupe)
    await expect(page.locator('#totalRecipientsLabel')).toContainText('3건');

    // 3. Confirm send (immediate) creates outbound log stub and resets form without side-effects on db.messages
    const composeTitle = page.locator('#composeTitleInput');
    await composeTitle.fill('E2E 테스트 즉시 발송 제목');
    const composeBody = page.locator('#composeBodyInput');
    await composeBody.fill('이것은 E2E 테스트용으로 생성된 즉시 발송 메시지 본문입니다. 이 메시지 본문은 70글자가 넘어가지 않는 아주 평범한 본문입니다.');

    const initialMsgLength = await page.evaluate(() => window.stateStore.db.messages.length);
    const initialLogLength = await page.evaluate(() => window.stateStore.getOutboundMessageLogs().length);

    // Send immediately
    await page.locator('#btnReviewSend').click();
    await expect(page.locator('#focusConfirmOverlay')).toBeVisible();

    let dialogText1 = '';
    const dialogHandler1 = async (dialog) => {
      dialogText1 = dialog.message();
      await dialog.accept();
    };
    page.on('dialog', dialogHandler1);
    await page.locator('#btnFocusSendConfirm').click();
    page.off('dialog', dialogHandler1);
    
    expect(dialogText1).toContain('실제 발송은 아직 연동되지 않았고, 발송이력만 저장되었습니다.');

    // Assert form reset
    await expect(page.locator('#totalRecipientsLabel')).toBeHidden();
    await expect(composeTitle).toHaveValue('');
    await expect(composeBody).toHaveValue('');

    // Verify database counts
    const finalMsgLength = await page.evaluate(() => window.stateStore.db.messages.length);
    expect(finalMsgLength).toBe(initialMsgLength);

    const finalLogLength = await page.evaluate(() => window.stateStore.getOutboundMessageLogs().length);
    expect(finalLogLength).toBe(initialLogLength + 1);

    // Recent tab should be active
    const activeTab = page.locator('.btn-vault-tab[data-tab="recent"]');
    await expect(activeTab).toBeVisible();

    // Verify recent log card rendering details
    const vaultPanel = page.locator('#messageVaultPanel');
    await expect(vaultPanel.locator('span').filter({ hasText: '즉시' }).first()).toBeVisible();
    await expect(vaultPanel.locator('span').filter({ hasText: 'SMS' }).first()).toBeVisible();
    await expect(vaultPanel.locator('span').filter({ hasText: '3/3명 발송' }).first()).toBeVisible();

    // Verify prohibited terminology
    const panelText = await vaultPanel.innerText();
    expect(panelText).not.toContain('발송완료');
    expect(panelText).not.toContain('실제 발송 미연동');

    // 4. Click group (단체) button and verify modal
    const groupBtn = vaultPanel.locator('.btn-show-recipients-modal').first();
    await expect(groupBtn).toBeVisible();
    await groupBtn.click();

    const detailOverlay = page.locator('#recipientDetailModalOverlay');
    await expect(detailOverlay).toBeVisible();
    await expect(detailOverlay).toContainText('김지원');
    await expect(detailOverlay).toContainText('박서준');
    await expect(detailOverlay).toContainText('홍길동');

    await page.locator('#btnRecipientDetailCloseBtn').click();
    await expect(detailOverlay).toBeHidden();

    // 5. Test scheduled sending
    // Add 1 student
    await page.locator('.student-row').first().click();
    await page.locator('#btnAddToRecipients').click();

    await composeTitle.fill('E2E 테스트 예약 발송 제목');
    await composeBody.fill('이것은 E2E 테스트용으로 생성된 예약 발송 메시지 본문입니다.');

    // Setup dialog expectation
    let dialogText2 = '';
    const dialogHandler2 = async (dialog) => {
      dialogText2 = dialog.message();
      await dialog.accept();
    };
    page.on('dialog', dialogHandler2);
    await page.locator('#btnSendBarReserve').click(); // Clicking reserved send button directly
    page.off('dialog', dialogHandler2);

    expect(dialogText2).toContain('실제 예약발송은 아직 연동되지 않았고, 예약이력만 저장되었습니다.');

    const schedLogLength = await page.evaluate(() => window.stateStore.getOutboundMessageLogs().length);
    expect(schedLogLength).toBe(finalLogLength + 1);

    // Verify recent log card rendering scheduled details
    await expect(vaultPanel.locator('span').filter({ hasText: '예약' }).first()).toBeVisible();
    await expect(vaultPanel.locator('span').filter({ hasText: '1/1명 발송' }).first()).toBeVisible();

    // 6. Verify single recipient display on recent card
    const firstStudentName = "최다은";
    await expect(vaultPanel.locator('span').filter({ hasText: firstStudentName }).first()).toBeVisible();

    // 7. Verify body expansion toggle for long body
    const initialLogsCount = await page.evaluate(() => window.stateStore.getOutboundMessageLogs().length);
    await page.locator('.student-row').first().click();
    await page.locator('#btnAddToRecipients').click();

    const longBodyText = '이것은 70자 이상이 넘는 매우 긴 메시지 본문입니다. 이것은 70자 이상이 넘는 매우 긴 메시지 본문입니다. 이것은 70자 이상이 넘는 매우 긴 메시지 본문입니다. 끝.';
    await composeBody.fill(longBodyText);

    // Setup dialog expectation
    await page.locator('#btnReviewSend').click();
    await expect(page.locator('#focusConfirmOverlay')).toBeVisible();

    let dialogText3 = '';
    const dialogHandler3 = async (dialog) => {
      dialogText3 = dialog.message();
      await dialog.accept();
    };
    page.on('dialog', dialogHandler3);
    await page.locator('#btnFocusSendConfirm').click();
    page.off('dialog', dialogHandler3);

    const afterLongBodyLogsCount = await page.evaluate(() => window.stateStore.getOutboundMessageLogs().length);
    expect(afterLongBodyLogsCount).toBe(initialLogsCount + 1);

    // Verify toggle button in Recent card
    const toggleBtn = vaultPanel.locator('.btn-toggle-body').first();
    await expect(toggleBtn).toBeVisible();
    await expect(toggleBtn).toContainText('전체보기');

    // Click to expand
    await toggleBtn.click();
    await expect(toggleBtn).toContainText('접기');
    await expect(vaultPanel).toContainText('끝.');

    // Click to collapse
    await toggleBtn.click();
    await expect(toggleBtn).toContainText('전체보기');

    // 8. 3rd Column message-send-col-vault Height Alignment Verification
    const composeBox = await page.locator('#composePanel').boundingBox();
    const vaultBox = await page.locator('#messageVaultPanel').boundingBox();
    expect(Math.abs(composeBox.height - vaultBox.height)).toBeLessThan(10); // Heights match within 10px tolerance

    // 9. Cost / pricing text check
    const pageText = await page.innerText('.message-send-root');
    expect(pageText).not.toContain('예상비용');
    expect(pageText).not.toContain('예상 비용');
    expect(pageText).not.toContain('소요비용');
    expect(pageText).not.toContain('단가');
  });
});
