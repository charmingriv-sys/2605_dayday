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
    await expect(sendConfirmBtn).toContainText('발송');
    await sendConfirmBtn.click();

    // Assert alert dialog was triggered with mock text
    expect(dialogTriggered).toBe(true);
    expect(dialogText).toContain('실제 발송은 아직 연동되지 않았고, 발송이력만 저장되었습니다.');

    // Focus Modal should be closed and form NOT reset
    await expect(focusOverlay).toBeHidden();
    await expect(page.locator('#totalRecipientsLabel')).toContainText('1건');


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

  test('should support template CRUD lifecycle, reload persistence, and apply functionality', async ({ page }) => {
    // Navigate to Message Send view
    await page.locator('.menu-item[data-view="dir-message-send"]').click();

    const initialLogsLength = await page.evaluate(() => window.stateStore.getOutboundMessageLogs().length);
    const initialMsgLength = await page.evaluate(() => window.stateStore.db.messages.length);

    // 1. Create a new template
    const titleInput = page.locator('#composeTitleInput');
    await titleInput.fill('E2E CRUD 테스트 템플릿 제목');
    const bodyInput = page.locator('#composeBodyInput');
    await bodyInput.fill('E2E CRUD 테스트 템플릿 내용입니다.');

    // Set method to PUSH to verify it propagates
    const pushBtn = page.locator('.btn-toggle-method[data-method="PUSH"]');
    if (await pushBtn.count() > 0) {
      await pushBtn.click();
    }

    let dialogText = '';
    const saveDialogHandler = async (dialog) => {
      dialogText = dialog.message();
      await dialog.accept();
    };
    page.on('dialog', saveDialogHandler);
    await page.locator('#btnOpenSaveTemplateModal').click();
    await page.locator('#btnSaveModalSubmit').click();
    page.off('dialog', saveDialogHandler);

    expect(dialogText).toContain('템플릿 "E2E CRUD 테스트 템플릿 제목"이(가) 보관함에 임시 저장되었습니다.');

    // Verify template is visible at the top of the saved tab
    const vaultPanel = page.locator('#messageVaultPanel');
    const firstSavedItemTitle = vaultPanel.locator('.template-title').first();
    await expect(firstSavedItemTitle).toContainText('E2E CRUD 테스트 템플릿 제목');

    // 2. Reload and verify persistence
    await page.reload();
    const directorBtn = page.locator('.role-btn.director');
    if (await directorBtn.isVisible()) {
      await directorBtn.click();
    }
    await page.locator('.menu-item[data-view="dir-message-send"]').click();

    // Click saved tab
    await page.locator('.btn-vault-tab[data-tab="saved"]').click();
    
    // Check if the template still exists
    await expect(firstSavedItemTitle).toContainText('E2E CRUD 테스트 템플릿 제목');

    // 3. Apply the template and verify compose form fields
    // First, clear the inputs
    await page.locator('#composeTitleInput').fill('');
    await page.locator('#composeBodyInput').fill('');
    
    // Apply template
    const applyBtn = vaultPanel.locator('.btn-apply-template').first();
    await applyBtn.click();
    
    // Form fields should match the template
    await expect(page.locator('#composeTitleInput')).toHaveValue('E2E CRUD 테스트 템플릿 제목');
    await expect(page.locator('#composeBodyInput')).toHaveValue('E2E CRUD 테스트 템플릿 내용입니다.');
    
    await expect(page.locator('.btn-toggle-method[data-method="PUSH"]')).toHaveCSS('background-color', 'rgb(255, 255, 255)');

    // 4. Edit the template
    const editBtn = vaultPanel.locator('.btn-edit-template').first();
    await editBtn.click();

    const editOverlay = page.locator('#templateEditModalOverlay');
    await expect(editOverlay).toBeVisible();

    const editTitleInp = page.locator('#editModalTitleInp');
    await expect(editTitleInp).toHaveValue('E2E CRUD 테스트 템플릿 제목');
    const editBodyInp = page.locator('#editModalBodyInp');
    await expect(editBodyInp).toHaveValue('E2E CRUD 테스트 템플릿 내용입니다.');

    // Update fields
    await editTitleInp.fill('수정된 템플릿 제목');
    await editBodyInp.fill('수정된 템플릿 내용입니다.');
    
    // Select SMS radio in edit modal
    await page.locator('input[name="editModalMethod"][value="SMS"]').click();

    let editDialogText = '';
    const editDialogHandler = async (dialog) => {
      editDialogText = dialog.message();
      await dialog.accept();
    };
    page.on('dialog', editDialogHandler);
    await page.locator('#btnEditModalSubmit').click();
    page.off('dialog', editDialogHandler);

    expect(editDialogText).toContain('템플릿이 수정되었습니다.');
    await expect(editOverlay).toBeHidden();

    // Verify changes are rendered
    await expect(firstSavedItemTitle).toContainText('수정된 템플릿 제목');
    await expect(vaultPanel.locator('.message-body-container').first()).toContainText('수정된 템플릿 내용입니다.');
    await expect(vaultPanel.locator('span').filter({ hasText: 'SMS' }).first()).toBeVisible();

    // 5. Delete the template
    let deleteConfirmCalled = false;
    const deleteDialogHandler = async (dialog) => {
      deleteConfirmCalled = true;
      expect(dialog.message()).toContain('저장된 메시지 템플릿을 삭제할까요?');
      await dialog.accept();
    };
    page.on('dialog', deleteDialogHandler);
    await vaultPanel.locator('.btn-delete-template').first().click();
    page.off('dialog', deleteDialogHandler);

    expect(deleteConfirmCalled).toBe(true);

    // Verify deleted from list
    await expect(vaultPanel.locator('.template-title').filter({ hasText: '수정된 템플릿 제목' })).toBeHidden();

    // Check empty state
    await expect(vaultPanel).toContainText('저장된 메시지 템플릿이 없습니다.');

    // 6. Side effects checks: outboundMessageLogs or db.messages should NOT have changed
    const finalLogsLength = await page.evaluate(() => window.stateStore.getOutboundMessageLogs().length);
    const finalMsgLength = await page.evaluate(() => window.stateStore.db.messages.length);
    expect(finalLogsLength).toBe(initialLogsLength);
    expect(finalMsgLength).toBe(initialMsgLength);

    // Recommend tab and Recent tab are unaffected
    await page.locator('.btn-vault-tab[data-tab="recommend"]').click();
    await expect(vaultPanel.locator('span').filter({ hasText: '신규 원장 인사' }).first()).toBeVisible();

    // Prohibited words and cost/pricing phrases check
    const pageText = await page.innerText('.message-send-root');
    expect(pageText).not.toContain('예상비용');
    expect(pageText).not.toContain('예상 비용');
    expect(pageText).not.toContain('소요비용');
    expect(pageText).not.toContain('단가');
    expect(pageText).not.toContain('발송완료');
  });

  test('should support manual recipient entry, Excel CSV copy-paste, outbound logs, detail modal, and height alignment', async ({ page }) => {
    // Navigate to Message Send view
    await page.locator('.menu-item[data-view="dir-message-send"]').click();

    // 1. Check direct add modal validation and functionality
    // Verify "번호 직접입력" button text is correct
    await expect(page.locator('#btnDirectAddStub')).toContainText('번호 직접입력');
    await page.locator('#btnDirectAddStub').click();
    await expect(page.locator('#directAddModalOverlay')).toBeVisible();

    // Verify disabled "역할 / 구분" input does not exist
    await expect(page.locator('input[value="직접입력"][disabled]')).toBeHidden();

    const directName = page.locator('#directAddNameInp');
    const directPhone = page.locator('#directAddPhoneInp');
    const directSubmit = page.locator('#btnDirectAddSubmit');
    const directError = page.locator('#directAddErrorMsg');
    const directSuccess = page.locator('#directAddSuccessMsg');

    // Empty phone check
    await directName.fill('홍길동');
    await directPhone.fill('');
    await directSubmit.click();
    await expect(directError).toBeVisible();
    await expect(directError).toContainText('휴대폰 번호를 입력해 주세요.');

    // Mismatched pattern check
    await directPhone.fill('invalid-phone123!');
    await directSubmit.click();
    await expect(directError).toBeVisible();
    await expect(directError).toContainText('숫자와 하이픈만 입력해 주세요.');

    // Digits length error: too short
    await directPhone.fill('010-123');
    await directSubmit.click();
    await expect(directError).toBeVisible();
    await expect(directError).toContainText('올바른 전화번호를 입력해 주세요.');

    // Digits length error: too long
    await directPhone.fill('010-1234-567890');
    await directSubmit.click();
    await expect(directError).toBeVisible();
    await expect(directError).toContainText('올바른 전화번호를 입력해 주세요.');

    // Correct entry: Name + Phone (11 digits, un-hyphenated)
    await directName.fill('홍길동');
    await directPhone.fill('01012345678');
    await directSubmit.click();
    
    // Modal should NOT close, input fields should be cleared, phone focused, success msg visible
    await expect(page.locator('#directAddModalOverlay')).toBeVisible();
    await expect(directSuccess).toBeVisible();
    await expect(directSuccess).toContainText('추가되었습니다.');
    await expect(directName).toHaveValue('');
    await expect(directPhone).toHaveValue('');
    await expect(directPhone).toBeFocused();

    // Duplicate check: add same number (even with hyphens)
    await directName.fill('홍길동중복');
    await directPhone.fill('010-1234-5678');
    await directSubmit.click();
    await expect(directError).toBeVisible();
    await expect(directError).toContainText('이미 추가된 번호입니다.');

    // Correct entry: Phone only (name-less entry, 11 digits, un-hyphenated)
    await directName.fill('');
    await directPhone.fill('01098765432');
    await directSubmit.click();
    await expect(directSuccess).toBeVisible();
    await expect(directSuccess).toContainText('추가되었습니다.');
    await expect(directName).toHaveValue('');
    await expect(directPhone).toHaveValue('');
    await expect(directPhone).toBeFocused();

    // Correct entry: Phone only (10 digits, un-hyphenated)
    await directName.fill('');
    await directPhone.fill('0101234567');
    await directSubmit.click();
    await expect(directSuccess).toBeVisible();
    await expect(directName).toHaveValue('');
    await expect(directPhone).toHaveValue('');
    await expect(directPhone).toBeFocused();

    // Correct entry: Phone only (10 digits Seoul, un-hyphenated)
    await directName.fill('');
    await directPhone.fill('0212345678');
    await directSubmit.click();
    await expect(directSuccess).toBeVisible();
    await expect(directName).toHaveValue('');
    await expect(directPhone).toHaveValue('');
    await expect(directPhone).toBeFocused();

    // Click "완료" button to close modal
    await page.locator('#btnDirectAddDone').click();
    await expect(page.locator('#directAddModalOverlay')).toBeHidden();

    // Recipient label should contain 4 (홍길동 + 3 직접입력)
    await expect(page.locator('#totalRecipientsLabel')).toContainText('4건');

    // Verify recipient cards display with auto-formatted hyphenated phones
    const recipientCards = page.locator('.message-send-recipient-card');
    await expect(recipientCards.filter({ hasText: '홍길동' })).toBeVisible();
    await expect(recipientCards.filter({ hasText: '010-1234-5678' })).toBeVisible();
    await expect(recipientCards.filter({ hasText: '010-9876-5432' })).toBeVisible();
    await expect(recipientCards.filter({ hasText: '010-123-4567' })).toBeVisible();
    await expect(recipientCards.filter({ hasText: '02-1234-5678' })).toBeVisible();

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

    // Check recipients label has '6건' (4 manual + 2 unique CSV, duplicate excluded by dedupe)
    await expect(page.locator('#totalRecipientsLabel')).toContainText('6건');

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

    // Assert form NOT reset (retained)
    await expect(page.locator('#totalRecipientsLabel')).toContainText('6건');
    await expect(composeTitle).toHaveValue('E2E 테스트 즉시 발송 제목');
    await expect(composeBody).toHaveValue('이것은 E2E 테스트용으로 생성된 즉시 발송 메시지 본문입니다. 이 메시지 본문은 70글자가 넘어가지 않는 아주 평범한 본문입니다.');

    // Clear recipients list for the next test step
    await page.locator('#btnClearRecipients').click();


    // Verify database counts
    const finalMsgLength = await page.evaluate(() => window.stateStore.db.messages.length);
    expect(finalMsgLength).toBe(initialMsgLength);

    const finalLogLength = await page.evaluate(() => window.stateStore.getOutboundMessageLogs().length);
    expect(finalLogLength).toBe(initialLogLength + 1);

    // Verify raw values are kept in stateStore / DB
    const lastOutboundLog = await page.evaluate(() => window.stateStore.getOutboundMessageLogs()[0]);
    expect(lastOutboundLog.recipients.some(r => r.name === '홍길동' && r.phone === '01012345678')).toBe(true);
    expect(lastOutboundLog.recipients.some(r => r.name === '직접입력' && r.phone === '01098765432')).toBe(true);
    expect(lastOutboundLog.recipients.some(r => r.name === '직접입력' && r.phone === '0101234567')).toBe(true);
    expect(lastOutboundLog.recipients.some(r => r.name === '직접입력' && r.phone === '0212345678')).toBe(true);

    // Recent tab should be active
    const activeTab = page.locator('.btn-vault-tab[data-tab="recent"]');
    await expect(activeTab).toBeVisible();

    // Verify recent log card rendering details
    const vaultPanel = page.locator('#messageVaultPanel');
    await expect(vaultPanel.locator('span').filter({ hasText: '즉시' }).first()).toBeVisible();
    await expect(vaultPanel.locator('span').filter({ hasText: 'SMS' }).first()).toBeVisible();
    await expect(vaultPanel.locator('span').filter({ hasText: '6/6명 발송' }).first()).toBeVisible();

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
    await expect(detailOverlay).toContainText('직접입력');
    
    // Verify phone formats in detail modal
    await expect(detailOverlay).toContainText('010-1234-5678');
    await expect(detailOverlay).toContainText('010-9876-5432');
    await expect(detailOverlay).toContainText('010-123-4567');
    await expect(detailOverlay).toContainText('02-1234-5678');

    await page.locator('#btnRecipientDetailCloseBtn').click();
    await expect(detailOverlay).toBeHidden();

    // 5. Verify Scheduled Send elements are completely absent (Phase 11G Revert)
    const btnSendBarReserve = page.locator('#btnSendBarReserve');
    await expect(btnSendBarReserve).toBeHidden();

    const btnReserveSend = page.locator('#btnReserveSend');
    await expect(btnReserveSend).toBeHidden();

    const reserveModal = page.locator('#reserveScheduleModalOverlay');
    await expect(reserveModal).toBeHidden();

    const editReserveBtn = page.locator('.btn-edit-reserve');
    await expect(editReserveBtn).toBeHidden();

    const deleteReserveBtn = page.locator('.btn-delete-reserve');
    await expect(deleteReserveBtn).toBeHidden();

    // Check prohibited text presence in page
    const pageContentText = await page.innerText('.message-send-root');
    expect(pageContentText).not.toContain('예약발송');
    expect(pageContentText).not.toContain('예약수정');
    expect(pageContentText).not.toContain('예약삭제');
    expect(pageContentText).not.toContain('예약완료');
    expect(pageContentText).not.toContain('예약 완료');
    expect(pageContentText).not.toContain('가격');
    expect(pageContentText).not.toContain('단가');
    expect(pageContentText).not.toContain('예상비용');
    expect(pageContentText).not.toContain('예상 비용');
    expect(pageContentText).not.toContain('소요비용');

    // 7. Verify body expansion toggle for long body
    const initialLogsCount = await page.evaluate(() => window.stateStore.getOutboundMessageLogs().length);
    await page.locator('.student-row').first().click();
    await page.locator('#btnAddToRecipients').click();

    const longBodyText = '이것은 150자 이상이 넘는 매우 긴 메시지 본문입니다. 이것은 150자 이상이 넘는 매우 긴 메시지 본문입니다. 이것은 150자 이상이 넘는 매우 긴 메시지 본문입니다. 이것은 150자 이상이 넘는 매우 긴 메시지 본문입니다. 이것은 150자 이상이 넘는 매우 긴 메시지 본문입니다. 끝.';
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

  test('should support macro variables and personalized previews (Phase 11D)', async ({ page }) => {
    // Navigate to Message Send view
    await page.locator('.menu-item[data-view="dir-message-send"]').click();

    // 1. Verify #{수업일}, #{미납금액} related UI/options are not present in macro dropdown
    const macroOptions = await page.locator('#macroInsertSelect option').allInnerTexts();
    expect(macroOptions).not.toContain('수업일');
    expect(macroOptions).not.toContain('미납금액');
    expect(macroOptions).not.toContain('미납액');
    expect(macroOptions).not.toContain('납부기한');

    // 2. Select macro #{이름} and check insertion + focus
    const composeBody = page.locator('#composeBodyInput');
    await composeBody.fill('안녕하세요 ');
    
    // Select macro #{이름}
    await page.locator('#macroInsertSelect').selectOption('#{이름}');
    
    // Focus should be kept
    await expect(composeBody).toBeFocused();
    
    // Value should contain the macro
    let bodyVal = await composeBody.inputValue();
    expect(bodyVal).toBe('안녕하세요 #{이름}');

    // 3. Test cursor position insertion: insert #{원생명} between '안녕하세요 ' and '#{이름}'
    // Put cursor after '안녕하세요 ' (length: 6)
    await composeBody.focus();
    await page.evaluate(() => {
      const el = document.getElementById('composeBodyInput');
      el.setSelectionRange(6, 6);
    });
    
    await page.locator('#macroInsertSelect').selectOption('#{원생명}');
    await expect(composeBody).toBeFocused();
    
    bodyVal = await composeBody.inputValue();
    expect(bodyVal).toBe('안녕하세요 #{원생명}#{이름}');

    // Let's add #{학원명} and #{발신번호} as well to verify them
    await composeBody.fill('반갑습니다. #{이름}님, 여기는 #{학원명}입니다. 문의: #{발신번호}');

    // 4. Smartphone preview should display instructions when recipients count is 0
    const phoneFrame = page.locator('.phone-frame');
    await expect(phoneFrame).toContainText('수신자를 추가하면 개인화 미리보기가 표시됩니다.');

    // 5. Add 1 student (e.g. "최다은") and check real-time macro replacement in smartphone preview
    // Select first student
    const studentRows = page.locator('.student-row');
    let targetRow = studentRows.filter({ hasText: '최다은' });
    let studentName = '최다은';
    if (await targetRow.count() === 0) {
      targetRow = studentRows.first();
      studentName = await page.evaluate(() => {
        const students = window.stateStore.getStudents();
        return students[0] ? students[0].name : '최다은';
      });
    }
    await targetRow.click();
    await page.locator('#btnAddToRecipients').click();

    // Smartphone preview should now show "미리보기 대상: [이름]" and replace macro variables
    await expect(phoneFrame).toContainText(`미리보기 대상: ${studentName}`);
    await expect(phoneFrame).not.toContainText('수신자를 추가하면 개인화 미리보기가 표시됩니다.');
    
    const settings = await page.evaluate(() => window.stateStore.getSettings() || {});
    const dbSettings = await page.evaluate(() => window.stateStore.db.settings || {});
    const academyName = settings.academy || dbSettings.academy || "튜링음악학원";
    const senderNumber = await page.locator('#senderNumberSelect').inputValue();

    // Verify preview content matches the expected replaced string
    const expectedReplacedText = `반갑습니다. ${studentName}님, 여기는 ${academyName}입니다. 문의: ${senderNumber}`;
    await expect(phoneFrame).toContainText(expectedReplacedText);
    
    // The original textarea should remain original
    await expect(composeBody).toHaveValue('반갑습니다. #{이름}님, 여기는 #{학원명}입니다. 문의: #{발신번호}');

    // 6. Add second student to verify prev/next navigation
    // Let's add "홍길동" manually
    await page.locator('#btnDirectAddStub').click();
    await page.locator('#directAddNameInp').fill('홍길동');
    await page.locator('#directAddPhoneInp').fill('010-9999-8888');
    await page.locator('#btnDirectAddSubmit').click();
    await page.locator('#btnDirectAddDone').click();

    // Recipients count should be 2
    await expect(page.locator('#totalRecipientsLabel')).toContainText('2건');

    // Smartphone preview toolbar should show prev/next buttons
    const prevBtn = page.locator('#btnPrevPreviewRecipient');
    const nextBtn = page.locator('#btnNextPreviewRecipient');
    await expect(prevBtn).toBeVisible();
    await expect(nextBtn).toBeVisible();

    // Current preview target is first recipient (index 0)
    await expect(phoneFrame).toContainText(`미리보기 대상: ${studentName} (1/2)`);
    await expect(phoneFrame).toContainText(`반갑습니다. ${studentName}님, 여기는 ${academyName}입니다.`);

    // Click next button
    await nextBtn.click();
    
    // Preview target should change to "홍길동" (index 1)
    await expect(phoneFrame).toContainText('미리보기 대상: 홍길동 (2/2)');
    await expect(phoneFrame).toContainText(`반갑습니다. 홍길동님, 여기는 ${academyName}입니다.`);

    // Click prev button
    await prevBtn.click();
    await expect(phoneFrame).toContainText(`미리보기 대상: ${studentName} (1/2)`);

    // 7. Verify template save/apply preserves original macro text
    await page.locator('#btnOpenSaveTemplateModal').click();
    await page.locator('#saveModalTitleInp').fill('매크로 템플릿 테스트');
    // Ensure body contains macros
    await expect(page.locator('#saveModalBodyInp')).toHaveValue('반갑습니다. #{이름}님, 여기는 #{학원명}입니다. 문의: #{발신번호}');
    
    let dialogText = '';
    const dialogHandler = async (dialog) => {
      dialogText = dialog.message();
      await dialog.accept();
    };
    page.on('dialog', dialogHandler);
    await page.locator('#btnSaveModalSubmit').click();
    page.off('dialog', dialogHandler);
    expect(dialogText).toContain('임시 저장되었습니다.');

    // Clear textarea
    await composeBody.fill('');
    
    // Apply saved template
    await page.locator('.btn-vault-tab[data-tab="saved"]').click();
    await page.locator('.btn-apply-template').first().click();

    // Compose textarea should be restored with macro tokens
    await expect(composeBody).toHaveValue('반갑습니다. #{이름}님, 여기는 #{학원명}입니다. 문의: #{발신번호}');

    // 8. Verify instant send stores outbound logs with previewSamples and original body
    const initialLogsLength = await page.evaluate(() => window.stateStore.getOutboundMessageLogs().length);
    const initialMsgLength = await page.evaluate(() => window.stateStore.db.messages.length);

    await page.locator('#btnReviewSend').click();
    await expect(page.locator('#focusConfirmOverlay')).toBeVisible();

    let sendDialogText = '';
    const sendDialogHandler = async (dialog) => {
      sendDialogText = dialog.message();
      await dialog.accept();
    };
    page.on('dialog', sendDialogHandler);
    await page.locator('#btnFocusSendConfirm').click();
    page.off('dialog', sendDialogHandler);

    expect(sendDialogText).toContain('발송이력만 저장되었습니다.');

    // Verify logs count increased but messages count did not
    const finalLogsLength = await page.evaluate(() => window.stateStore.getOutboundMessageLogs().length);
    expect(finalLogsLength).toBe(initialLogsLength + 1);
    const finalMsgLength = await page.evaluate(() => window.stateStore.db.messages.length);
    expect(finalMsgLength).toBe(initialMsgLength);

    // Verify recent log details in DB
    const lastLog = await page.evaluate(() => window.stateStore.getOutboundMessageLogs()[0]);
    expect(lastLog.body).toBe('반갑습니다. #{이름}님, 여기는 #{학원명}입니다. 문의: #{발신번호}');
    expect(lastLog.previewSamples).toBeDefined();
    expect(lastLog.previewSamples.length).toBe(2);
    expect(lastLog.previewSamples[0].recipientName).toBe(studentName);
    expect(lastLog.previewSamples[0].body).toBe(`반갑습니다. ${studentName}님, 여기는 ${academyName}입니다. 문의: ${senderNumber}`);
    expect(lastLog.previewSamples[1].recipientName).toBe('홍길동');
    expect(lastLog.previewSamples[1].body).toBe(`반갑습니다. 홍길동님, 여기는 ${academyName}입니다. 문의: ${senderNumber}`);

    // 9. Verify Recent Tab card delete button and no original toggle button
    const vaultPanel = page.locator('#messageVaultPanel');
    
    // Ensure "원문 보기" is not visible
    const toggleOriginalBtn = vaultPanel.locator('.btn-toggle-original');
    await expect(toggleOriginalBtn).toBeHidden();

    // Ensure "삭제" button is visible
    const deleteLogBtn = vaultPanel.locator('.btn-delete-log').first();
    await expect(deleteLogBtn).toBeVisible();
    await expect(deleteLogBtn).toContainText('삭제');

    // Store state lengths before deletion
    const logsBeforeDel = await page.evaluate(() => window.stateStore.getOutboundMessageLogs().length);
    const messagesBeforeDel = await page.evaluate(() => window.stateStore.db.messages.length);

    // Click Delete -> verify confirm dialog
    let delConfirmTriggered = false;
    let delDialogText = '';
    const delDialogHandler = async (dialog) => {
      delConfirmTriggered = true;
      delDialogText = dialog.message();
      await dialog.accept();
    };
    page.once('dialog', delDialogHandler);
    await deleteLogBtn.click();

    expect(delConfirmTriggered).toBe(true);
    expect(delDialogText).toContain('발송이력을 삭제할까요?');

    // Verify recent log is removed from UI
    await expect(vaultPanel.locator('.message-body-container')).toBeHidden();

    // Verify logs count decreased in DB
    const logsAfterDel = await page.evaluate(() => window.stateStore.getOutboundMessageLogs().length);
    expect(logsAfterDel).toBe(logsBeforeDel - 1);

    // Verify messages count in DB is untouched
    const messagesAfterDel = await page.evaluate(() => window.stateStore.db.messages.length);
    expect(messagesAfterDel).toBe(messagesBeforeDel);
  });

  test('should validate recipients, show correct statistics, exclude invalid items, and block sending if sendable count is 0 (Phase 11E)', async ({ page }) => {
    // 1. 메시지 보내기 화면으로 이동
    await page.locator('.menu-item[data-view="dir-message-send"]').click();

    // 중복 추가 허용을 위해 dedupe 비활성화 -> 단, 직접 입력은 모달 단에서 항시 중복이 제한됨
    await page.locator('#btnToggleDedupe').click();

    // 2. 수신인 추가
    // (1) 정상 수신인 추가 (최다은)
    const studentRows = page.locator('.student-row');
    let targetRow = studentRows.filter({ hasText: '최다은' });
    if (await targetRow.count() === 0) {
      targetRow = studentRows.first();
    }
    await targetRow.click();
    await page.locator('#btnAddToRecipients').click();

    // (2) 직접 입력을 통해 중복 전화번호 추가 시도 (최다은 번호 조회 후 중복 추가 시도) -> 모달에서 차단되어야 함
    const students = await page.evaluate(() => window.stateStore.getStudents());
    const targetStudent = students.find(s => s.name === '최다은') || students[0];
    const targetPhone = targetStudent.parentPhone || targetStudent.phone;
    
    await page.locator('#btnDirectAddStub').click();
    await page.locator('#directAddNameInp').fill('최다은중복');
    await page.locator('#directAddPhoneInp').fill(targetPhone);
    await page.locator('#btnDirectAddSubmit').click();
    await expect(page.locator('#directAddErrorMsg')).toBeVisible();
    await expect(page.locator('#directAddErrorMsg')).toContainText('이미 추가된 번호입니다.');

    // (3) 직접 입력을 통해 짧은 번호 추가 시도 (9자리 미만인 5자리) -> 모달에서 차단되어야 함
    await page.locator('#directAddNameInp').fill('번호오류자');
    await page.locator('#directAddPhoneInp').fill('12345');
    await page.locator('#btnDirectAddSubmit').click();
    await expect(page.locator('#directAddErrorMsg')).toBeVisible();
    await expect(page.locator('#directAddErrorMsg')).toContainText('올바른 전화번호를 입력해 주세요.');

    // (4) 직접 입력을 통해 긴 번호 추가 시도 (11자리 초과인 14자리) -> 모달에서 차단되어야 함
    await page.locator('#directAddNameInp').fill('짧은번호자');
    await page.locator('#directAddPhoneInp').fill('010-1234-567890');
    await page.locator('#btnDirectAddSubmit').click();
    await expect(page.locator('#directAddErrorMsg')).toBeVisible();
    await expect(page.locator('#directAddErrorMsg')).toContainText('올바른 전화번호를 입력해 주세요.');

    // 모달 닫기
    await page.locator('#btnDirectAddDone').click();

    // (5) 수신거부 상태의 학생 강제 주입 (최다은)
    await page.evaluate(() => {
      const students = window.stateStore.db.students;
      const target = students.find(s => s.name === '최다은') || students[0];
      target.optOut = true; // 수신거부 true
      window.stateStore.saveDB();
    });

    // 3. 본문 작성
    await page.locator('#composeBodyInput').fill('수신자 검증 테스트용 메시지 본문입니다.');

    // 4. 즉시발송 클릭하여 검토 모달 열기
    await page.locator('#btnReviewSend').click();
    
    const focusOverlay = page.locator('#focusConfirmOverlay');
    await expect(focusOverlay).toBeVisible();
    await expect(focusOverlay).toContainText('즉시발송 검토');

    // 5. 검토 통계 요약 검증
    // 최다은(수신거부로 제외), 다른 중복/번호오류 수신자는 모달에서 추가 차단됨
    // 따라서 전체 대상은 1명(최다은)이며, 발송 가능 대상은 0명이어야 함
    await expect(focusOverlay).toContainText('전체 대상');
    await expect(focusOverlay).toContainText('발송 가능');
    await expect(page.locator('#focusSendableCount')).toContainText('0명'); // 발송 가능 0명
    await expect(focusOverlay).toContainText('제외 대상');

    // 제외 사유 매핑 검증
    await expect(focusOverlay).toContainText('수신거부');

    // 6. 발송 가능이 0명이므로 [이력 저장] 클릭 시 저장 차단되는지 확인
    let alertTriggered = false;
    let alertMessage = '';
    page.on('dialog', async (dialog) => {
      alertTriggered = true;
      alertMessage = dialog.message();
      await dialog.accept();
    });

    await expect(page.locator('#btnFocusSendConfirm')).toContainText('발송');
    await page.locator('#btnFocusSendConfirm').click();
    expect(alertTriggered).toBe(true);
    expect(alertMessage).toContain('발송 가능 대상이 0명입니다.');

    // 모달은 계속 열려있어야 함
    await expect(focusOverlay).toBeVisible();

    // 7. 모달 닫기
    await page.locator('#btnFocusCancel').click();
    await expect(focusOverlay).toBeHidden();

    // 8. 수신거부 해제 및 올바른 수신자 정상 추가하여 성공 발송 시도
    await page.evaluate(() => {
      const students = window.stateStore.db.students;
      const target = students.find(s => s.name === '최다은') || students[0];
      target.optOut = false; // 수신거부 해제
      window.stateStore.saveDB();
    });

    // 9. 올바른 수신인 직접 입력으로 1명 추가
    await page.locator('#btnDirectAddStub').click();
    await page.locator('#directAddNameInp').fill('홍길동');
    await page.locator('#directAddPhoneInp').fill('010-9876-5432');
    await page.locator('#btnDirectAddSubmit').click();
    await page.locator('#btnDirectAddDone').click();

    // 즉시발송 클릭
    await page.locator('#btnReviewSend').click();
    await expect(focusOverlay).toBeVisible();

    // 발송 가능 대상 2명 (최다은, 홍길동)
    // 제외 대상 0명 (중복/번호오류 등은 모달 단계에서 걸러짐)
    await expect(page.locator('#focusSendableCount')).toContainText('2명'); // 발송 가능 2명
    await expect(focusOverlay).toContainText('0명'); // 제외 대상 0명

    // 10. 최종 이력 저장
    let successAlertTriggered = false;
    let successAlertText = '';
    
    // 이전에 걸었던 dialog 리스너는 자동으로 덮어쓰거나 새로 추가하여 수집
    page.removeAllListeners('dialog');
    page.on('dialog', async (dialog) => {
      successAlertTriggered = true;
      successAlertText = dialog.message();
      await dialog.accept();
    });

    const initialLogsLength = await page.evaluate(() => window.stateStore.getOutboundMessageLogs().length);
    const initialMsgLength = await page.evaluate(() => window.stateStore.db.messages.length);

    await expect(page.locator('#btnFocusSendConfirm')).toContainText('발송');
    await page.locator('#btnFocusSendConfirm').click();
    
    expect(successAlertTriggered).toBe(true);
    expect(successAlertText).toContain('발송이력만 저장되었습니다.');

    // 모달 닫힘 및 최근 탭 이동 확인
    await expect(focusOverlay).toBeHidden();
    const activeTab = page.locator('.btn-vault-tab[data-tab="recent"]');
    await expect(activeTab).toBeVisible();

    // 데이터 검증 (로그 수 1 증가, db.messages 변화 없음)
    const finalLogsLength = await page.evaluate(() => window.stateStore.getOutboundMessageLogs().length);
    expect(finalLogsLength).toBe(initialLogsLength + 1);
    const finalMsgLength = await page.evaluate(() => window.stateStore.db.messages.length);
    expect(finalMsgLength).toBe(initialMsgLength);

    // 로그 내용 세부 검증 (recipients 2건, excludedRecipients 0건)
    const lastLog = await page.evaluate(() => window.stateStore.getOutboundMessageLogs()[0]);
    expect(lastLog.recipients.length).toBe(2);
    expect(lastLog.excludedRecipients.length).toBe(0);
    expect(lastLog.recipientCount).toBe(2);
    expect(lastLog.originalRecipientCount).toBe(2);
    
    // 제외자 사유 매핑 검증 (모두 모달단에서 사전 차단되므로 제외자 없음)
    expect(lastLog.excludedRecipients.length).toBe(0);

    // 폼과 수신자가 지워지지 않고 유지되는지 검증
    await expect(page.locator('#composeBodyInput')).toHaveValue('수신자 검증 테스트용 메시지 본문입니다.');

    // Phase 11E-Repair-C: 보관함 카드 본문 표시 영역 높이 및 레이아웃 검증
    // 1. 추천/저장/최근 탭 카드 스타일의 동일 적용 여부 및 수치 검증 (64px 이상, padding, font-size, line-height)
    const tabs = ['recommend', 'saved', 'recent'];
    for (const tab of tabs) {
      await page.locator(`.btn-vault-tab[data-tab="${tab}"]`).click();
      const container = page.locator('.message-body-container').first();
      if (await container.count() > 0) {
        // min-height가 64px 이상인지 검증
        const minHeight = await container.evaluate(el => el.style.minHeight);
        const minHeightVal = parseInt(minHeight) || 0;
        expect(minHeightVal).toBeGreaterThanOrEqual(64);

        // font-size, line-height, padding 검증
        await expect(container).toHaveCSS('font-size', '13px');
        await expect(container).toHaveCSS('line-height', '19.5px'); // 13px * 1.5 = 19.5px
        await expect(container).toHaveCSS('padding', '10px 14px');
      }
    }
    // 최근 탭으로 복원
    await page.locator('.btn-vault-tab[data-tab="recent"]').click();

    // 2. 3번째 레이어(보관함)와 중앙 메시지 작성 레이어의 높이 균형 검증 (Stretch 형태)
    const vaultBox = await page.locator('#messageVaultPanel').boundingBox();
    const composeBox = await page.locator('#composePanel').boundingBox();
    expect(vaultBox.height).toBeCloseTo(composeBox.height, 0);

    // 3. 긴 메시지가 있어도 레이아웃 깨짐 없이 내부 스크롤이 적용되는지 검증 (overflow-y: auto)
    await expect(page.locator('#vaultListContainer')).toHaveCSS('overflow-y', 'auto');

    // 4. 금지 문구 비노출 검증 (비용 단가 및 발송완료)
    const vaultText = await page.innerText('#messageVaultPanel');
    expect(vaultText).not.toContain('예상비용');
    expect(vaultText).not.toContain('예상 비용');
    expect(vaultText).not.toContain('소요비용');
    expect(vaultText).not.toContain('단가');
    expect(vaultText).not.toContain('발송완료');

    // 5. 긴 메시지 전체보기/접기 기능 작동 검증
    const longCardToggle = page.locator('.btn-toggle-body').first();
    if (await longCardToggle.count() > 0) {
      const initialText = await longCardToggle.innerText();
      expect(initialText).toBe('전체보기');
      await longCardToggle.click();
      await expect(longCardToggle).toHaveText('접기');
      await longCardToggle.click();
      await expect(longCardToggle).toHaveText('전체보기');
    }
  });

  test('should support ad text insertion, settings mapping, alert warning, deduplication and log integration (Phase 11H)', async ({ page }) => {
    // Navigate to Message Send view
    await page.locator('.menu-item[data-view="dir-message-send"]').click();

    // 1. Verify "광고 문구 삽입" button is visible
    const adBtn = page.locator('#btnInsertAdText');
    await expect(adBtn).toBeVisible();

    // Clear settings optOut values to trigger warning alert
    await page.evaluate(() => {
      const settings = window.stateStore.db.settings || {};
      delete settings.optOutNumber;
      delete settings.unsubscribeNumber;
      delete settings.freeOptOutNumber;
      delete settings.smsOptOutNumber;
      delete settings.rejectNumber;
      window.stateStore.saveDB();
    });

    // 2. Click button when no optOutNumber is set -> verify warning alert
    let dialogTriggered = false;
    let dialogText = '';
    const alertHandler = async (dialog) => {
      dialogTriggered = true;
      dialogText = dialog.message();
      await dialog.accept();
    };
    page.once('dialog', alertHandler);
    await adBtn.click();
    
    expect(dialogTriggered).toBe(true);
    expect(dialogText).toContain('무료수신거부 번호가 설정되어 있지 않습니다. 광고성 메시지 발송 전 수신거부 안내 번호를 설정해야 합니다.');

    // Retrieve academyName dynamically to match database settings
    const settings = await page.evaluate(() => window.stateStore.getSettings() || {});
    const academyName = settings.academyName || settings.academy || "튜링음악학원";

    // Body should contain (광고) and fallback academyName, but not opt-out
    const composeBody = page.locator('#composeBodyInput');
    await expect(composeBody).toContainText('(광고)');
    await expect(composeBody).toContainText(academyName);
    await expect(composeBody).not.toContainText('무료수신거부');

    // 3. Clear body, set optOutNumber in settings, and click again
    await composeBody.fill('특별 할인 이벤트 안내입니다.');
    await page.evaluate(() => {
      window.stateStore.db.settings = {
        ...window.stateStore.db.settings,
        optOutNumber: '080-8888-9999'
      };
      window.stateStore.saveDB();
    });

    await adBtn.click();

    // Body should contain (광고), academyName, original content, and footer
    await expect(composeBody).toContainText('(광고)');
    await expect(composeBody).toContainText(academyName);
    await expect(composeBody).toContainText('특별 할인 이벤트 안내입니다.');
    await expect(composeBody).toContainText('무료수신거부 080-8888-9999');

    // 4. Duplicate insertion block check
    const fullTextBefore = await composeBody.inputValue();
    await adBtn.click();
    const fullTextAfter = await composeBody.inputValue();
    expect(fullTextBefore).toBe(fullTextAfter); // No change

    // Count occurrences
    const adCount = (fullTextAfter.match(/\(광고\)/g) || []).length;
    const academyCount = (fullTextAfter.match(new RegExp(academyName, 'g')) || []).length;
    const optOutCount = (fullTextAfter.match(/무료수신거부/g) || []).length;
    expect(adCount).toBe(1);
    expect(academyCount).toBe(1);
    expect(optOutCount).toBe(1);

    // 5. Verify live smartphone preview updates instantly
    const phoneFrame = page.locator('.phone-frame');
    await expect(phoneFrame).toContainText('(광고)');
    await expect(phoneFrame).toContainText(academyName);
    await expect(phoneFrame).toContainText('무료수신거부 080-8888-9999');

    // 6. Template save & apply verification
    await page.locator('#btnOpenSaveTemplateModal').click();
    await page.locator('#saveModalTitleInp').fill('광고 템플릿 테스트');
    
    let saveDialogText = '';
    const saveDialogHandler = async (dialog) => {
      saveDialogText = dialog.message();
      await dialog.accept();
    };
    page.once('dialog', saveDialogHandler);
    await page.locator('#btnSaveModalSubmit').click();
    expect(saveDialogText).toContain('임시 저장되었습니다.');

    // Clear textarea
    await composeBody.fill('');

    // Apply the saved template
    await page.locator('.btn-vault-tab[data-tab="saved"]').click();
    await page.locator('.btn-apply-template').first().click();

    // Verify compose textarea is restored with the full ad text
    await expect(composeBody).toContainText('(광고)');
    await expect(composeBody).toContainText('무료수신거부 080-8888-9999');

    // 7. Verify outbound log logs the ad body, and no db message side-effects
    const initialLogsLength = await page.evaluate(() => window.stateStore.getOutboundMessageLogs().length);
    const initialMsgLength = await page.evaluate(() => window.stateStore.db.messages.length);

    // Add a student to recipient list
    await page.locator('.student-row').first().click();
    await page.locator('#btnAddToRecipients').click();

    // Open review modal
    await page.locator('#btnReviewSend').click();
    const focusOverlay = page.locator('#focusConfirmOverlay');
    await expect(focusOverlay).toBeVisible();
    await expect(focusOverlay).toContainText('(광고)');
    await expect(focusOverlay).toContainText('무료수신거부 080-8888-9999');

    let sendDialogText = '';
    const sendDialogHandler = async (dialog) => {
      sendDialogText = dialog.message();
      await dialog.accept();
    };
    page.once('dialog', sendDialogHandler);
    await page.locator('#btnFocusSendConfirm').click();
    expect(sendDialogText).toContain('발송이력만 저장되었습니다.');

    // Verification
    const finalLogsLength = await page.evaluate(() => window.stateStore.getOutboundMessageLogs().length);
    expect(finalLogsLength).toBe(initialLogsLength + 1);

    const finalMsgLength = await page.evaluate(() => window.stateStore.db.messages.length);
    expect(finalMsgLength).toBe(initialMsgLength);

    const lastLog = await page.evaluate(() => window.stateStore.getOutboundMessageLogs()[0]);
    expect(lastLog.body).toContain('(광고)');
    expect(lastLog.body).toContain('무료수신거부 080-8888-9999');
    expect(lastLog.complianceWarnings).toBeUndefined();

    // Clean up student optOut and other changes to prevent affecting other tests
    await page.evaluate(() => {
      window.stateStore.db.settings = {
        ...window.stateStore.db.settings,
        optOutNumber: '080-1234-5678'
      };
      window.stateStore.saveDB();
    });
  });

  test('should support Guardian 1/2 selection UI with parentContacts and legacy fallbacks (Phase 16O-1)', async ({ page }) => {
    // 1. Configure test student data via evaluate
    await page.evaluate(() => {
      // Find or create test student
      const studentId = 'S_TEST_16O_UI';
      const strucStudentId = 'S_TEST_16O_UI_STRUC';
      const dupStudentId = 'S_TEST_16O_UI_DUP';
      const noPhoneStudentId = 'S_TEST_16O_UI_NOPHONE';

      // Clean up first
      window.stateStore.db.students = window.stateStore.db.students.filter(s => 
        s.id !== studentId && s.id !== strucStudentId && s.id !== dupStudentId && s.id !== noPhoneStudentId
      );
      window.stateStore.db.parentContacts = window.stateStore.db.parentContacts.filter(c => 
        c.studentId !== studentId && c.studentId !== strucStudentId && c.studentId !== dupStudentId && c.studentId !== noPhoneStudentId
      );

      // Add S_TEST_16O_UI ("오원생") with studentPhone and legacy G1/G2 fallbacks
      window.stateStore.db.students.push({
        id: studentId,
        name: '오원생',
        phone: '010-9999-9999',
        parentName: '오보호자1',
        parentPhone: '010-1111-1111',
        parentPhone2: '010-2222-2222',
        parentPhone2Name: '오보호자2',
        instrument: '피아노',
        pay: 'paid',
        school: '테스트초',
        age: 10
      });

      // Add S_TEST_16O_UI_STRUC ("구원생")
      window.stateStore.db.students.push({
        id: strucStudentId,
        name: '구원생',
        phone: '010-7777-1111',
        instrument: '피아노',
        pay: 'paid'
      });
      // G1: valid. G2: canReceiveMessage = false (수신 불가)
      window.stateStore.db.parentContacts.push({
        id: 'pc_struc_g1',
        studentId: strucStudentId,
        slot: 'parent1',
        name: '구보호자1',
        relation: 'mother',
        phone: '010-3333-3333',
        canReceiveMessage: true,
        isPrimary: true
      });
      window.stateStore.db.parentContacts.push({
        id: 'pc_struc_g2',
        studentId: strucStudentId,
        slot: 'parent2',
        name: '구보호자2',
        relation: 'father',
        phone: '010-4444-4444',
        canReceiveMessage: false,
        isPrimary: false
      });

      // Add S_TEST_16O_UI_DUP ("임원생") to check duplicate phone number detection (sharing 010-1111-1111)
      window.stateStore.db.students.push({
        id: dupStudentId,
        name: '임원생',
        phone: '010-7777-2222',
        instrument: '피아노',
        pay: 'paid'
      });
      window.stateStore.db.parentContacts.push({
        id: 'pc_dup_g1',
        studentId: dupStudentId,
        slot: 'parent1',
        name: '임보호자1',
        relation: 'guardian',
        phone: '010-1111-1111', // Duplicate of 오보호자1
        canReceiveMessage: true,
        isPrimary: true
      });

      // Add S_TEST_16O_UI_NOPHONE ("신원생") to check missing phone number detection (연락처 없음)
      window.stateStore.db.students.push({
        id: noPhoneStudentId,
        name: '신원생',
        phone: '010-7777-3333',
        instrument: '피아노',
        pay: 'paid'
      });
      window.stateStore.db.parentContacts.push({
        id: 'pc_no_g1',
        studentId: noPhoneStudentId,
        slot: 'parent1',
        name: '신보호자1',
        relation: 'mother',
        phone: '', // No phone number!
        canReceiveMessage: true,
        isPrimary: true
      });

      window.stateStore.saveDB();
    });

    // Navigate to Message Send view
    await page.locator('.menu-item[data-view="dir-message-send"]').click();

    // 2. Search and select "오원생"
    await page.locator('#studentSearchInput').fill('오원생');
    const rowO = page.locator('.student-row', { hasText: '오원생' });
    await rowO.click();

    // Verify student is selected
    await expect(page.locator('#selectedStudentsCount')).toContainText('1');

    // Verify 3 subrows are visible: "본인", "보호자 1", "보호자 2"
    const guardianRowsO = page.locator('.guardian-row[data-student-id="S_TEST_16O_UI"]');
    await expect(guardianRowsO).toHaveCount(3);

    // Verify G1 is checked by default, while "본인" and G2 are unchecked
    const selfCheck = guardianRowsO.filter({ hasText: '본인' }).locator('.guardian-checkbox');
    const g1Check = guardianRowsO.filter({ hasText: '보호자 1' }).locator('.guardian-checkbox');
    const g2Check = guardianRowsO.filter({ hasText: '보호자 2' }).locator('.guardian-checkbox');

    await expect(selfCheck.locator('svg')).not.toBeVisible();
    await expect(g1Check.locator('svg')).toBeVisible();
    await expect(g2Check.locator('svg')).not.toBeVisible();

    // Toggle "본인" and "보호자 2" check options on by clicking their rows
    await guardianRowsO.filter({ hasText: '본인' }).click();
    await guardianRowsO.filter({ hasText: '보호자 2' }).click();

    // Verify all 3 checkmarks are visible now
    await expect(selfCheck.locator('svg')).toBeVisible();
    await expect(g1Check.locator('svg')).toBeVisible();
    await expect(g2Check.locator('svg')).toBeVisible();

    // Uncheck "보호자 1" by clicking its row
    await guardianRowsO.filter({ hasText: '보호자 1' }).click();
    await expect(g1Check.locator('svg')).not.toBeVisible();

    // Add to recipients (which should add "본인" and "보호자 2")
    await page.locator('#btnAddToRecipients').click();
    await expect(page.locator('#totalRecipientsLabel')).toContainText('2건');

    // Verify card display tags ("본인" and "보호자2")
    const cards = page.locator('.message-send-recipient-card');
    await expect(cards.filter({ hasText: '본인' })).toBeVisible();
    await expect(cards.filter({ hasText: '보호자2' })).toBeVisible();

    // Clear recipients list
    await page.locator('#btnClearRecipients').click();

    // 3. Search and select "구원생" (to verify G2 has "수신 불가" status and is disabled)
    await page.locator('#studentSearchInput').fill('구원생');
    const rowGu = page.locator('.student-row', { hasText: '구원생' });
    await rowGu.click();

    const guardianRowsGu = page.locator('.guardian-row[data-student-id="S_TEST_16O_UI_STRUC"]');
    const g2Gu = guardianRowsGu.filter({ hasText: '보호자 2' });
    await expect(g2Gu.locator('.badge-cannot-receive')).toBeVisible();
    await expect(g2Gu.locator('.badge-cannot-receive')).toContainText('수신 불가');
    await expect(g2Gu.locator('button')).toBeDisabled();

    // Unselect 구원생 to clean selection
    await rowGu.click();

    // 4. Search and select "신원생" (to verify G1 has "연락처 없음" status and is disabled)
    await page.locator('#studentSearchInput').fill('신원생');
    const rowShin = page.locator('.student-row', { hasText: '신원생' });
    await rowShin.click();

    const guardianRowsShin = page.locator('.guardian-row[data-student-id="S_TEST_16O_UI_NOPHONE"]');
    const g1Shin = guardianRowsShin.filter({ hasText: '보호자 1' });
    await expect(g1Shin.locator('.badge-no-contact')).toBeVisible();
    await expect(g1Shin.locator('.badge-no-contact')).toContainText('연락처 없음');
    await expect(g1Shin.locator('button')).toBeDisabled();

    // Unselect 신원생
    await rowShin.click();

    // 5. Search for "원생" to select both "오원생" and "임원생" and test duplicates & deduplication
    await page.locator('#studentSearchInput').fill('원생');
    
    // Select both rows
    const rowOSelect = page.locator('.student-row', { hasText: '오원생' });
    const rowDupSelect = page.locator('.student-row', { hasText: '임원생' });
    await rowOSelect.click();
    await rowDupSelect.click();

    // Verify "동일 번호" warning badge is visible for G1 on both students
    const g1RowO = page.locator('.guardian-row[data-student-id="S_TEST_16O_UI"]').filter({ hasText: '보호자 1' });
    const g1RowDup = page.locator('.guardian-row[data-student-id="S_TEST_16O_UI_DUP"]').filter({ hasText: '보호자 1' });

    await expect(g1RowO.locator('.badge-dup-number')).toBeVisible();
    await expect(g1RowDup.locator('.badge-dup-number')).toBeVisible();

    // Deduplicate checkbox is ON by default. Let's add to recipients.
    await page.locator('#btnAddToRecipients').click();
    // Since both were checked G1 with phone '010-1111-1111', only 1 should be added
    await expect(page.locator('#totalRecipientsLabel')).toContainText('1건');
    await page.locator('#btnClearRecipients').click();

    // Toggle deduplication OFF
    await page.locator('#btnToggleDedupe').click();

    // Select them again
    await rowOSelect.click();
    await rowDupSelect.click();

    // Add to recipients
    await page.locator('#btnAddToRecipients').click();
    // Since dedupe is OFF, both should be added!
    await expect(page.locator('#totalRecipientsLabel')).toContainText('2건');

    // Clean up
    await page.locator('#btnClearRecipients').click();
    await page.locator('#btnToggleDedupe').click(); // Restore default dedupe ON

    // Cleanup db
    await page.evaluate(() => {
      const studentIds = ['S_TEST_16O_UI', 'S_TEST_16O_UI_STRUC', 'S_TEST_16O_UI_DUP', 'S_TEST_16O_UI_NOPHONE'];
      window.stateStore.db.students = window.stateStore.db.students.filter(s => !studentIds.includes(s.id));
      window.stateStore.db.parentContacts = window.stateStore.db.parentContacts.filter(c => !studentIds.includes(c.studentId));
      window.stateStore.saveDB();
    });
  });

  test('should support Send Confirmation Modal before final dispatch (Phase 16O-2)', async ({ page }) => {
    // 1. Configure test student data via evaluate
    await page.evaluate(() => {
      // Find or create test student
      const studentId = 'S_TEST_16O2_UI';
      const strucStudentId = 'S_TEST_16O2_UI_STRUC';
      const dupStudentId = 'S_TEST_16O2_UI_DUP';
      const noPhoneStudentId = 'S_TEST_16O2_UI_NOPHONE';

      // Clean up first
      window.stateStore.db.students = window.stateStore.db.students.filter(s => 
        s.id !== studentId && s.id !== strucStudentId && s.id !== dupStudentId && s.id !== noPhoneStudentId
      );
      window.stateStore.db.parentContacts = window.stateStore.db.parentContacts.filter(c => 
        c.studentId !== studentId && c.studentId !== strucStudentId && c.studentId !== dupStudentId && c.studentId !== noPhoneStudentId
      );

      // Add S_TEST_16O2_UI ("최원생") with studentPhone and legacy G1/G2 fallbacks
      window.stateStore.db.students.push({
        id: studentId,
        name: '최원생',
        phone: '010-9999-9999',
        parentName: '최보호자1',
        parentPhone: '010-1111-1111',
        parentPhone2: '010-2222-2222',
        parentPhone2Name: '최보호자2',
        instrument: '피아노',
        pay: 'paid',
        school: '테스트초',
        age: 10
      });

      // Add S_TEST_16O2_UI_STRUC ("한원생")
      // G1: valid. G2: canReceiveMessage = false (수신 불가)
      window.stateStore.db.students.push({
        id: strucStudentId,
        name: '한원생',
        phone: '010-7777-1111',
        instrument: '피아노',
        pay: 'paid'
      });
      window.stateStore.db.parentContacts.push({
        id: 'pc_struc_g1_16o2',
        studentId: strucStudentId,
        slot: 'parent1',
        name: '한보호자1',
        relation: 'mother',
        phone: '010-3333-3333',
        canReceiveMessage: true,
        isPrimary: true
      });
      window.stateStore.db.parentContacts.push({
        id: 'pc_struc_g2_16o2',
        studentId: strucStudentId,
        slot: 'parent2',
        name: '한보호자2',
        relation: 'father',
        phone: '010-4444-4444',
        canReceiveMessage: false,
        isPrimary: false
      });

      // Add S_TEST_16O2_UI_DUP ("정원생") to check duplicate phone number detection (sharing 010-1111-1111)
      window.stateStore.db.students.push({
        id: dupStudentId,
        name: '정원생',
        phone: '010-7777-2222',
        instrument: '피아노',
        pay: 'paid'
      });
      window.stateStore.db.parentContacts.push({
        id: 'pc_dup_g1_16o2',
        studentId: dupStudentId,
        slot: 'parent1',
        name: '정보호자1',
        relation: 'guardian',
        phone: '010-1111-1111', // Duplicate of 최보호자1
        canReceiveMessage: true,
        isPrimary: true
      });

      // Add S_TEST_16O2_UI_NOPHONE ("진원생") to check missing phone number detection (연락처 없음)
      window.stateStore.db.students.push({
        id: noPhoneStudentId,
        name: '진원생',
        phone: '010-7777-3333',
        instrument: '피아노',
        pay: 'paid'
      });
      window.stateStore.db.parentContacts.push({
        id: 'pc_no_g1_16o2',
        studentId: noPhoneStudentId,
        slot: 'parent1',
        name: '진보호자1',
        relation: 'mother',
        phone: '', // No phone number!
        canReceiveMessage: true,
        isPrimary: true
      });

      window.stateStore.saveDB();
    });

    // Navigate to Message Send view
    await page.locator('.menu-item[data-view="dir-message-send"]').click();

    // Fill message content with macro #{이름}
    const composeBody = page.locator('#composeBodyInput');
    await composeBody.fill('안녕하세요 #{이름} 학생 학부모님.');

    // 1. Search and select "최원생"
    await page.locator('#studentSearchInput').fill('최원생');
    await page.locator('.student-row', { hasText: '최원생' }).click();
    await page.locator('#btnAddToRecipients').click();

    // 2. Search and select "정원생"
    await page.locator('#studentSearchInput').fill('정원생');
    await page.locator('.student-row', { hasText: '정원생' }).click();
    // Before adding, toggle deduplication OFF so we can add duplicate to recipient list
    await page.locator('#btnToggleDedupe').click();
    await page.locator('#btnAddToRecipients').click();
    // Toggle dedupe back ON
    await page.locator('#btnToggleDedupe').click();

    // Let's also programmatically add HanG2 (수신 불가) and JinG1 (연락처 없음) to recipients list to verify exclusion display
    await page.evaluate(() => {
      window.__DAYDAY_TEST_HOOKS__.injectRecipientsForTest([
        {
          name: '한원생',
          guardianName: '한보호자2',
          phone: '010-4444-4444',
          role: '보호자2',
          no: 'S_TEST_16O2_UI_STRUC',
          source: 'student'
        },
        {
          name: '진원생',
          guardianName: '진보호자1',
          phone: '',
          role: '보호자1',
          no: 'S_TEST_16O2_UI_NOPHONE',
          source: 'student'
        }
      ]);
    });

    // Verify recipient panel list label (4건)
    await expect(page.locator('#totalRecipientsLabel')).toContainText('4건');

    // 3. Open Focus Review Modal (Send confirmation modal)
    const initialLogLength = await page.evaluate(() => window.stateStore.getOutboundMessageLogs().length);
    const reviewBtn = page.locator('#btnReviewSend');
    await expect(reviewBtn).toBeVisible();
    await reviewBtn.click();

    const focusOverlay = page.locator('#focusConfirmOverlay');
    await expect(focusOverlay).toBeVisible();

    // Check modal title is "즉시발송 검토"
    await expect(focusOverlay.locator('h3')).toContainText('즉시발송 검토');

    // 4. Verify statistics (dedupe ON)
    // 총 선택 수신자: 4명
    // 실제 발송 예정: 1건 (최보호자1)
    // 중복 병합: 1건 (정보호자1)
    // 발송 제외: 2건 (한보호자2: 수신 불가, 진보호자1: 연락처 없음)
    await expect(focusOverlay.locator('#focusTotalCount')).toContainText('4명');
    await expect(focusOverlay.locator('#focusSendableCount')).toContainText('1명');
    await expect(focusOverlay.locator('#focusDedupeMergedCount')).toContainText('1명');
    await expect(focusOverlay.locator('#focusOtherExcludedCount')).toContainText('2명');

    // Verify recipient list elements
    const items = focusOverlay.locator('.confirm-recipient-item');
    await expect(items).toHaveCount(4);

    // Verify status badges
    const statusBadges = items.locator('.status-badge');
    await expect(statusBadges.filter({ hasText: '발송 예정' })).toHaveCount(1);
    await expect(statusBadges.filter({ hasText: '중복 병합됨' })).toHaveCount(1);
    await expect(statusBadges.filter({ hasText: '발송 제외 (수신 불가)' })).toHaveCount(1);
    await expect(statusBadges.filter({ hasText: '발송 제외 (연락처 없음)' })).toHaveCount(1);

    // 5. Test macro replacement preview (collapsible)
    // Toggle preview of first recipient ("최보호자1" -> student name is "최원생")
    const firstItem = items.filter({ hasText: '최보호자1' });
    const toggleBtn = firstItem.locator('.btn-preview-toggle-item');
    await toggleBtn.click();

    const previewContainer = firstItem.locator('.preview-container-item');
    await expect(previewContainer).toBeVisible();
    // Must contain student name "최원생" instead of guardian "최보호자1"
    await expect(previewContainer).toContainText('안녕하세요 최원생 학생 학부모님.');

    // Close preview
    await toggleBtn.click();
    await expect(previewContainer).toBeHidden();

    // 6. Cancel modal and assert no outbound log is saved
    const cancelBtn = page.locator('#btnFocusCancel');
    await cancelBtn.click();
    await expect(focusOverlay).toBeHidden();

    const midLogLength = await page.evaluate(() => window.stateStore.getOutboundMessageLogs().length);
    expect(midLogLength).toBe(initialLogLength);

    // 7. Toggle dedupe OFF and verify stats change inside modal
    await page.locator('#btnToggleDedupe').click(); // Turn dedupe OFF
    await reviewBtn.click();
    await expect(focusOverlay).toBeVisible();

    // Statistics with dedupe OFF:
    // 총 선택 수신자: 4명
    // 실제 발송 예정: 2건 (최보호자1, 정보호자1)
    // 중복 병합: 0건
    // 발송 제외: 2건 (한보호자2: 수신 불가, 진보호자1: 연락처 없음)
    await expect(focusOverlay.locator('#focusSendableCount')).toContainText('2명');
    await expect(focusOverlay.locator('#focusDedupeMergedCount')).toContainText('0명');
    await expect(focusOverlay.locator('#focusOtherExcludedCount')).toContainText('2명');
    await expect(items.locator('.status-badge').filter({ hasText: '발송 예정' })).toHaveCount(2);

    // 8. Confirm final send and verify logs are written, excluded targets are not sent, and dialog triggered
    let dialogText = '';
    const dialogHandler = async (dialog) => {
      dialogText = dialog.message();
      await dialog.accept();
    };
    page.on('dialog', dialogHandler);
    await page.locator('#btnFocusSendConfirm').click();
    page.off('dialog', dialogHandler);

    expect(dialogText).toContain('실제 발송은 아직 연동되지 않았고, 발송이력만 저장되었습니다.');
    await expect(focusOverlay).toBeHidden();

    // Verify outbound log length increased
    const finalLogLength = await page.evaluate(() => window.stateStore.getOutboundMessageLogs().length);
    expect(finalLogLength).toBe(initialLogLength + 1);

    // Verify log details in stateStore
    const lastLog = await page.evaluate(() => window.stateStore.getOutboundMessageLogs()[0]);
    // 2 sent (dedupe OFF: 최원생, 정원생)
    expect(lastLog.recipients.length).toBe(2);
    expect(lastLog.recipients.some(r => r.name === '최원생' && r.phone === '010-1111-1111')).toBe(true);
    expect(lastLog.recipients.some(r => r.name === '정원생' && r.phone === '010-1111-1111')).toBe(true);

    // 2 excluded (수신 불가, 연락처 없음)
    expect(lastLog.excludedRecipients.length).toBe(2);
    expect(lastLog.excludedRecipients.some(r => r.name === '한원생' && r.reason === '수신 불가')).toBe(true);
    expect(lastLog.excludedRecipients.some(r => r.name === '진원생' && r.reason === '연락처 없음')).toBe(true);

    // Clean up
    await page.locator('#btnClearRecipients').click();
    await page.locator('#btnToggleDedupe').click(); // Restore dedupe ON

    // Cleanup db
    await page.evaluate(() => {
      const studentIds = ['S_TEST_16O2_UI', 'S_TEST_16O2_UI_STRUC', 'S_TEST_16O2_UI_DUP', 'S_TEST_16O2_UI_NOPHONE'];
      window.stateStore.db.students = window.stateStore.db.students.filter(s => !studentIds.includes(s.id));
      window.stateStore.db.parentContacts = window.stateStore.db.parentContacts.filter(c => !studentIds.includes(c.studentId));
      window.stateStore.saveDB();
    });
  });

  test('should support message templates selection, draft generation, and overwrite guards (Phase 16O-3)', async ({ page }) => {
    // 1. Seed database with a test student
    const studentId = 'S_TEST_16O3_UI';
    await page.evaluate((sid) => {
      window.stateStore.db.students.push({
        id: sid,
        name: '유템플',
        phone: '010-7777-5555',
        instrument: '바이올린',
        pay: 'paid'
      });
      window.stateStore.db.parentContacts.push({
        id: 'pc_16o3_g1',
        studentId: sid,
        slot: 'parent1',
        name: '유보호자',
        relation: 'father',
        phone: '010-5555-5555',
        canReceiveMessage: true,
        isPrimary: true
      });
      window.stateStore.saveDB();
    }, studentId);

    // Navigate to Message Send view
    await page.locator('.menu-item[data-view="dir-message-send"]').click();

    // 2. Verify UI elements are visible
    const selectEl = page.locator('#templateTypeSelect');
    const applyBtn = page.locator('#btnApplyTemplateDraft');
    await expect(selectEl).toBeVisible();
    await expect(applyBtn).toBeVisible();

    // Verify variable guide contains text
    await expect(page.locator('text=지원 변수: #{이름}')).toBeVisible();

    // 3. Test applying template draft when body is empty
    await selectEl.selectOption('absent'); // 결석 확인
    await applyBtn.click();

    // Title and Body should be filled
    await expect(page.locator('#composeTitleInput')).toHaveValue('출석 확인 요청');
    await expect(page.locator('#composeBodyInput')).toHaveValue('#{이름} 원생의 수업 출석 기록이 확인되지 않았습니다.\n확인 부탁드립니다.');

    // 4. Test overwrite guard when body is NOT empty - dismiss
    await selectEl.selectOption('consulting'); // 상담 안내
    
    // Set up confirm dialog handler to cancel/dismiss
    const dismissHandler = async (dialog) => {
      expect(dialog.message()).toContain('이미 작성된 본문 내용이 있습니다. 선택한 템플릿 초안으로 덮어쓰시겠습니까?');
      await dialog.dismiss();
    };
    page.once('dialog', dismissHandler);
    await applyBtn.click();

    // Verify title and body are NOT overwritten (remain as 'absent' template)
    await expect(page.locator('#composeTitleInput')).toHaveValue('출석 확인 요청');
    await expect(page.locator('#composeBodyInput')).toContainText('출석 기록이 확인되지 않았습니다');

    // 5. Test overwrite guard when body is NOT empty - accept
    const acceptHandler = async (dialog) => {
      expect(dialog.message()).toContain('이미 작성된 본문 내용이 있습니다. 선택한 템플릿 초안으로 덮어쓰시겠습니까?');
      await dialog.accept();
    };
    page.once('dialog', acceptHandler);
    await applyBtn.click();

    // Verify title and body ARE overwritten (now 'consulting' template)
    await expect(page.locator('#composeTitleInput')).toHaveValue('상담 안내');
    await expect(page.locator('#composeBodyInput')).toHaveValue('#{이름} 원생 관련 상담 안내드립니다.\n확인 부탁드립니다.');

    // 6. Test macro replacement inside confirmation modal
    // Search and select '유템플' student
    await page.locator('#studentSearchInput').fill('유템플');
    await page.locator('.student-row', { hasText: '유템플' }).click();
    await page.locator('#btnAddToRecipients').click();

    // Open Pre-Send Confirmation Modal
    await page.locator('#btnReviewSend').click();
    const focusOverlay = page.locator('#focusConfirmOverlay');
    await expect(focusOverlay).toBeVisible();

    // Toggle preview to check macro replacement
    const recipientCard = focusOverlay.locator('.confirm-recipient-item', { hasText: '유보호자' });
    const togglePreviewBtn = recipientCard.locator('.btn-preview-toggle-item');
    await togglePreviewBtn.click();

    // Preview container should contain replaced macro (원생명 '유템플' instead of '유보호자')
    const previewContainer = recipientCard.locator('.preview-container-item');
    await expect(previewContainer).toBeVisible();
    await expect(previewContainer).toContainText('유템플 원생 관련 상담 안내드립니다.');

    // Close preview & modal
    await togglePreviewBtn.click();
    await page.locator('#btnFocusCancel').click();

    // Cleanup recipients
    await page.locator('#btnClearRecipients').click();

    // Cleanup db
    await page.evaluate((sid) => {
      window.stateStore.db.students = window.stateStore.db.students.filter(s => s.id !== sid);
      window.stateStore.db.parentContacts = window.stateStore.db.parentContacts.filter(c => c.studentId !== sid);
      window.stateStore.saveDB();
    }, studentId);
  });

  test('should support console-to-message handoff integration, specific buttons, auto template mapping, class time parsing, return confirmation, and direct menu reset (Phase 16P-1)', async ({ page }) => {
    const studentId = 'S_TEST_16P_STUDENT';
    const taskIdAbsent = 'TASK_16P_ABSENT';
    const taskIdBookCheck = 'TASK_16P_BOOKCHECK';
    const taskIdBookBilling = 'TASK_16P_BOOKBILLING';
    const taskIdStaff = 'TASK_16P_STAFF';

    // 1. Seed database with test student, parent, and various console tasks
    await page.evaluate(({ sid, tidA, tidB, tidBB, tidS }) => {
      // Clean up first defensively
      window.stateStore.db.students = window.stateStore.db.students.filter(s => s.id !== sid);
      window.stateStore.db.parentContacts = window.stateStore.db.parentContacts.filter(c => c.studentId !== sid);
      window.stateStore.db.todayTasks = window.stateStore.db.todayTasks.filter(t => ![tidA, tidB, tidBB, tidS].includes(t.id));

      window.stateStore.db.students.push({
        id: sid,
        name: '나핸드',
        phone: '010-9988-7766',
        instrument: '피아노',
        pay: 'unpaid'
      });
      window.stateStore.db.parentContacts.push({
        id: 'pc_16p_g1',
        studentId: sid,
        slot: 'parent1',
        name: '나학부모',
        relation: 'mother',
        phone: '010-8877-6655',
        canReceiveMessage: true,
        isPrimary: true
      });

      const todayIso = new Date().toISOString();

      // Absent check task (Handoff target)
      window.stateStore.db.todayTasks.push({
        id: tidA,
        organizationId: '',
        segment: 'academy_director_console',
        domain: 'academy',
        source: 'system',
        type: 'attendance',
        category: 'absent',
        priority: 'today',
        status: 'open',
        dueAt: todayIso,
        startAt: todayIso,
        endAt: todayIso,
        title: '나핸드 원생 결석 확인 필요',
        description: '• 원생명: 나핸드\n• 수업 시간: 14:00 ~ 15:00\n• 담당 강사: 정강사\n• 과목/악기: 피아노\n• 워닝 유형: 결석 확인\n• 간단 사유: 수업 종료 후 출석이 확인되지 않았습니다.',
        relatedStudentIds: [sid],
        dedupeKey: 'SYSTEM_ABSENT_SESSION_TEST_16P',
        visibilityRoles: ['director']
      });

      // Book check task (Non-handoff target)
      window.stateStore.db.todayTasks.push({
        id: tidB,
        organizationId: '',
        segment: 'academy_director_console',
        domain: 'academy',
        source: 'user',
        type: 'book',
        category: 'book_check',
        priority: 'today',
        status: 'open',
        dueAt: todayIso,
        startAt: todayIso,
        endAt: todayIso,
        title: '[교재확인] 나핸드 원생 바이엘1',
        description: '강사가 나핸드 원생에게 바이엘1 지급 승인을 요청했습니다.',
        relatedStudentIds: [sid],
        dedupeKey: 'SYSTEM_RECOMMEND_BOOK_CHECK_TEST_16P',
        visibilityRoles: ['director']
      });

      // Book billing task (Handoff target)
      window.stateStore.db.todayTasks.push({
        id: tidBB,
        organizationId: '',
        segment: 'academy_director_console',
        domain: 'academy',
        source: 'user',
        type: 'book',
        category: 'book_billing',
        priority: 'today',
        status: 'open',
        dueAt: todayIso,
        startAt: todayIso,
        endAt: todayIso,
        title: '[교재결제확인] 나핸드 원생 바이엘1 / 직접 등록',
        description: '학부모 안내 및 수납 확인이 필요합니다.',
        relatedStudentIds: [sid],
        dedupeKey: 'SYSTEM_RECOMMEND_BOOK_BILLING_TEST_16P',
        visibilityRoles: ['director']
      });

      // Staff warning task (Non-handoff target)
      window.stateStore.db.todayTasks.push({
        id: tidS,
        organizationId: '',
        segment: 'academy_director_console',
        domain: 'academy',
        source: 'system',
        type: 'attendance',
        category: 'staff_warning',
        priority: 'today',
        status: 'open',
        dueAt: todayIso,
        startAt: todayIso,
        endAt: todayIso,
        title: '강사 지각 경고',
        description: '강사가 약정 출근 시각보다 늦게 지문 인식했습니다.',
        dedupeKey: 'SYSTEM_RECOMMEND_STAFF_WARNING_TEST_16P',
        visibilityRoles: ['director']
      });

      window.stateStore.saveDB();
    }, { sid: studentId, tidA: taskIdAbsent, tidB: taskIdBookCheck, tidBB: taskIdBookBilling, tidS: taskIdStaff });

    // Navigate to Today Console
    await page.locator('.menu-item[data-view="dir-today-console"]').click();

    // 2. Verify button visibility/invisibility
    const absentCard = page.locator('#tasks-list-container .glass-card', { hasText: '나핸드 원생 결석 확인 필요' });
    const absentMessageBtn = absentCard.locator('button:has-text("메시지 보내기")');
    await expect(absentMessageBtn).toBeVisible();

    const bookCheckCard = page.locator('#tasks-list-container .glass-card', { hasText: '[교재확인] 나핸드 원생 바이엘1' });
    const bookCheckMessageBtn = bookCheckCard.locator('button:has-text("메시지 보내기")');
    await expect(bookCheckMessageBtn).toBeHidden();

    const bookBillingCard = page.locator('#tasks-list-container .glass-card', { hasText: '[교재결제확인] 나핸드 원생 바이엘1' });
    const bookBillingMessageBtn = bookBillingCard.locator('button:has-text("메시지 보내기")');
    await expect(bookBillingMessageBtn).toBeVisible();

    const staffCard = page.locator('#tasks-list-container .glass-card', { hasText: '강사 지각 경고' });
    const staffMessageBtn = staffCard.locator('button:has-text("메시지 보내기")');
    await expect(staffMessageBtn).toBeHidden();

    // 3. Click and trigger Handoff
    await absentMessageBtn.click();

    // Verify active view is Message Send view
    await expect(page.locator('.menu-item[data-view="dir-message-send"]')).toHaveClass(/active/);

    // [Phase 16T-1B] Verify Handoff UX Banner
    const handoffBanner = page.locator('.handoff-banner');
    await expect(handoffBanner).toBeVisible();
    await expect(handoffBanner).toContainText('오늘 원장 콘솔에서 전달된 메시지입니다.');
    await expect(page.locator('.handoff-target-info')).toContainText('나핸드 / 결석 확인');

    // [Phase 16T-1B] Verify Handoff Target Student Row is highlighted and visible in viewport
    const targetRow = page.locator(`.student-item-container[data-id="${studentId}"]`);
    await expect(targetRow).toHaveClass(/handoff-highlight/);
    await expect(targetRow).toBeInViewport();

    // Wait for highlight duration to expire
    await page.waitForTimeout(1600);
    await expect(targetRow).not.toHaveClass(/handoff-highlight/);

    // [Phase 16T-1B] Click "오늘 콘솔로 돌아가기" button
    await page.locator('#btnReturnToTodayConsole').click();

    // Verify we are returned to Today Console
    await expect(page.locator('.menu-item[data-view="dir-today-console"]')).toHaveClass(/active/);

    // Verify target task is still Open (not completed)
    const returnedAbsentCard = page.locator('#tasks-list-container .glass-card', { hasText: '나핸드 원생 결석 확인 필요' });
    await expect(returnedAbsentCard).toBeVisible();
    await expect(returnedAbsentCard.locator('.btn-done')).toBeVisible();

    // [Phase 16T-1B] Enter Message Send directly and verify NO handoff banner and NO highlight
    await page.locator('.menu-item[data-view="dir-message-send"]').click();
    await expect(page.locator('.handoff-banner')).toBeHidden();
    await expect(targetRow).not.toHaveClass(/handoff-highlight/);

    // Now re-trigger handoff to continue the original test flow
    await page.locator('.menu-item[data-view="dir-today-console"]').click();
    await absentMessageBtn.click();
    await expect(page.locator('.menu-item[data-view="dir-message-send"]')).toHaveClass(/active/);

    // 4. Verify selection state and class-time text parsing
    // Checkbox for '나핸드' in the student list should be checked
    const studentRow = page.locator('.student-row', { hasText: '나핸드' });
    const studentCheckIcon = studentRow.locator('.row-checkbox svg');
    await expect(studentCheckIcon).toBeVisible();

    // Guardian 1 contact selection chip should be active
    const contactChipG1 = page.locator('.btn-toggle-contact-type[data-type="g1"] svg');
    await expect(contactChipG1).toBeVisible();
    const contactChipStudent = page.locator('.btn-toggle-contact-type[data-type="student"] svg');
    await expect(contactChipStudent).toBeHidden();
    const contactChipG2 = page.locator('.btn-toggle-contact-type[data-type="g2"] svg');
    await expect(contactChipG2).toBeHidden();

    // Verify draft input fields
    await expect(page.locator('#composeTitleInput')).toHaveValue('출석 확인 요청');
    await expect(page.locator('#composeBodyInput')).toHaveValue('#{이름} 원생의 14:00 ~ 15:00 수업 출석 기록이 확인되지 않았습니다.\n확인 부탁드립니다.');

    // 5. Add to Recipients
    await page.locator('#btnAddToRecipients').click();

    // 6. Focus confirmation modal & dispatch with console return confirmation
    await page.locator('#btnReviewSend').click();
    const focusOverlay = page.locator('#focusConfirmOverlay');
    await expect(focusOverlay).toBeVisible();

    // Set dialog handlers
    const sendDialogHandler = async (dialog) => {
      if (dialog.message().includes('실제 발송은 아직 연동되지 않았고')) {
        await dialog.accept();
      } else if (dialog.message().includes('오늘 원장 콘솔로 돌아가시겠습니까?')) {
        await dialog.accept(); // Confirm return
      }
    };

    page.on('dialog', sendDialogHandler);
    await page.locator('#btnFocusSendConfirm').click();
    await page.waitForTimeout(200); // Wait for routing
    page.off('dialog', sendDialogHandler);

    // 7. Verify we are returned to Today Console
    await expect(page.locator('.menu-item[data-view="dir-today-console"]')).toHaveClass(/active/);

    // 8. Verify target task is still Open (not automatically completed)
    const refreshedAbsentCard = page.locator('#tasks-list-container .glass-card', { hasText: '나핸드 원생 결석 확인 필요' });
    await expect(refreshedAbsentCard).toBeVisible();
    await expect(refreshedAbsentCard.locator('.btn-done')).toBeVisible();

    // 9. Go to Message Send directly and verify preserved state (policy correction)
    await page.locator('.menu-item[data-view="dir-message-send"]').click();

    // Search query or selections should be clean
    const rawHandoffInStorage = await page.evaluate(() => sessionStorage.getItem('dayday_handoff_payload'));
    expect(rawHandoffInStorage).toBeNull();

    // Students selected state should be clear (because adding to recipients cleared the selection)
    const resetStudentRow = page.locator('.student-row', { hasText: '나핸드' });
    const resetStudentCheckIcon = resetStudentRow.locator('.row-checkbox svg');
    await expect(resetStudentCheckIcon).toBeHidden();

    // Title and Body should be preserved (not reset) when direct menu navigation occurs
    await expect(page.locator('#composeTitleInput')).toHaveValue('출석 확인 요청');
    await expect(page.locator('#composeBodyInput')).toHaveValue('#{이름} 원생의 14:00 ~ 15:00 수업 출석 기록이 확인되지 않았습니다.\n확인 부탁드립니다.');
    await expect(page.locator('#totalRecipientsLabel')).toContainText('1건');

    // 10. Cleanup db
    await page.evaluate(({ sid, tidA, tidB, tidBB, tidS }) => {
      window.stateStore.db.students = window.stateStore.db.students.filter(s => s.id !== sid);
      window.stateStore.db.parentContacts = window.stateStore.db.parentContacts.filter(c => c.studentId !== sid);
      window.stateStore.db.todayTasks = window.stateStore.db.todayTasks.filter(t => ![tidA, tidB, tidBB, tidS].includes(t.id));
      window.stateStore.saveDB();
    }, { sid: studentId, tidA: taskIdAbsent, tidB: taskIdBookCheck, tidBB: taskIdBookBilling, tidS: taskIdStaff });
  });

  test('should synchronize checkboxes and recipients list properly on manual clicks', async ({ page }) => {
    // Navigate to Message Send view
    await page.locator('.menu-item[data-view="dir-message-send"]').click();

    const testStudentId = 'test-checkbox-sync-student';
    await page.evaluate(({ sid }) => {
      // Add a test student with both guardians having phone numbers and receive message enabled
      window.stateStore.db.students.push({
        id: sid,
        name: '체크테스트원생',
        phone: '01055554444',
        parentPhone: '01066667777',
        parentPhone2: '01088889999',
        instrument: '피아노',
        fee: 150000,
        age: 10,
        school: '테스트초'
      });
      window.stateStore.db.parentContacts.push(
        { id: sid + '_student', studentId: sid, name: '체크테스트원생', phone: '01055554444', role: 'student', canReceiveMessage: true },
        { id: sid + '_g1', studentId: sid, name: '보호자일', phone: '01066667777', role: 'g1', canReceiveMessage: true },
        { id: sid + '_g2', studentId: sid, name: '보호자이', phone: '01088889999', role: 'g2', canReceiveMessage: true }
      );
      window.stateStore.saveDB();
    }, { sid: testStudentId });

    // Transition away and back to force re-render with new data
    await page.locator('.menu-item[data-view="dir-major-schedule"]').click();
    await page.locator('.menu-item[data-view="dir-message-send"]').click();

    const studentRowLocator = page.locator('.student-row').filter({ hasText: '체크테스트원생' });
    await expect(studentRowLocator).toBeVisible();
    
    // 1. 원생 row 클릭 -> 보호자1만 선택됨
    await studentRowLocator.click();
    
    const g1Checkbox = page.locator(`.guardian-checkbox[data-student-id="${testStudentId}"][data-type="g1"]`);
    const studentCheckbox = page.locator(`.guardian-checkbox[data-student-id="${testStudentId}"][data-type="student"]`);
    const g2Checkbox = page.locator(`.guardian-checkbox[data-student-id="${testStudentId}"][data-type="g2"]`);
    
    await expect(g1Checkbox.locator('svg')).toBeVisible();
    await expect(studentCheckbox.locator('svg')).toBeHidden();
    await expect(g2Checkbox.locator('svg')).toBeHidden();

    // 2. 보호자1 다시 클릭 -> 해제됨
    const g1Row = page.locator(`.guardian-row[data-student-id="${testStudentId}"][data-type="g1"]`);
    await g1Row.click();
    await expect(g1Checkbox.locator('svg')).toBeHidden();
    await expect(page.locator('#selectedStudentsCount')).toContainText('0');

    // 3. 본인 클릭 -> 본인만 추가/해제됨
    // Re-open accordion
    await studentRowLocator.click();
    await expect(g1Checkbox.locator('svg')).toBeVisible();

    const studentContactRow = page.locator(`.guardian-row[data-student-id="${testStudentId}"][data-type="student"]`);
    await studentContactRow.click();
    await expect(studentCheckbox.locator('svg')).toBeVisible();

    // Turn off G1 to test only student is selected
    await g1Row.click();
    await expect(g1Checkbox.locator('svg')).toBeHidden();
    await expect(page.locator('#selectedStudentsCount')).toContainText('1');
    
    // Toggle off student
    await studentContactRow.click();
    await expect(studentCheckbox.locator('svg')).toBeHidden();
    await expect(page.locator('#selectedStudentsCount')).toContainText('0');

    // 4. 보호자2 클릭 -> 보호자2만 추가/해제됨
    // Re-open accordion
    await studentRowLocator.click();
    const g2Row = page.locator(`.guardian-row[data-student-id="${testStudentId}"][data-type="g2"]`);
    await g2Row.click();
    await expect(g2Checkbox.locator('svg')).toBeVisible();

    // Turn off G1
    await g1Row.click();
    await expect(g1Checkbox.locator('svg')).toBeHidden();
    await expect(page.locator('#selectedStudentsCount')).toContainText('1');
    
    // Toggle off G2
    await g2Row.click();
    await expect(g2Checkbox.locator('svg')).toBeHidden();
    await expect(page.locator('#selectedStudentsCount')).toContainText('0');

    // 5. 발송 인원 카드 삭제 -> 해당 체크박스 해제됨
    // Re-open and select G1 & G2
    await studentRowLocator.click();
    await g2Row.click();
    await expect(g1Checkbox.locator('svg')).toBeVisible();
    await expect(g2Checkbox.locator('svg')).toBeVisible();
    await page.locator('#btnAddToRecipients').click();
    
    // 발송 인원에 2건 추가되었는지 확인
    await expect(page.locator('#totalRecipientsLabel')).toContainText('2건');
    
    // 왼쪽 체크박스는 해제되어 있어야 함
    await expect(g1Checkbox.locator('svg')).toBeHidden();
    await expect(g2Checkbox.locator('svg')).toBeHidden();
    
    // 다시 보호자1과 보호자2를 왼쪽에서 체크함 (동기화 확인을 위해 다시 선택하는 것임)
    await studentRowLocator.click();
    await g2Row.click();
    await expect(g1Checkbox.locator('svg')).toBeVisible();
    await expect(g2Checkbox.locator('svg')).toBeVisible();
    
    // 발송 인원 패널에서 보호자1(보호자일) X 버튼 클릭하여 삭제
    const removeG1Btn = page.locator('.btn-remove-recipient[data-key="01066667777|g1"]');
    await removeG1Btn.click();
    
    // 발송 인원이 1건으로 줄어들어야 함
    await expect(page.locator('#totalRecipientsLabel')).toContainText('1건');
    
    // 왼쪽의 보호자1 체크박스는 해제되어야 하고, 보호자2 체크박스는 그대로 유지되어야 함
    await expect(g1Checkbox.locator('svg')).toBeHidden();
    await expect(g2Checkbox.locator('svg')).toBeVisible();

    // 6. 전체 삭제 -> 모든 체크박스 해제됨
    await page.locator('#btnClearRecipients').click();
    
    // 발송 인원이 0건(비표시)이어야 함
    await expect(page.locator('#totalRecipientsLabel')).toBeHidden();
    
    // 모든 체크박스 해제
    await expect(g1Checkbox.locator('svg')).toBeHidden();
    await expect(g2Checkbox.locator('svg')).toBeHidden();

    // Cleanup test data
    await page.evaluate(({ sid }) => {
      window.stateStore.db.students = window.stateStore.db.students.filter(s => s.id !== sid);
      window.stateStore.db.parentContacts = window.stateStore.db.parentContacts.filter(c => c.studentId !== sid);
      window.stateStore.saveDB();
    }, { sid: testStudentId });
  });

  test('should trigger mock provider delivery creation on final send and display success/failure stats in alert', async ({ page }) => {
    // Navigate to Message Send view
    await page.locator('.menu-item[data-view="dir-message-send"]').click();

    // Clear outboundMessageDeliveries to start fresh
    await page.evaluate(() => {
      window.stateStore.db.outboundMessageDeliveries = [];
      window.stateStore.db.parentMessages = [];
      window.stateStore.saveDB();
    });

    // Select the first student row (최다은 or similar) and add
    const studentRows = page.locator('.student-row');
    await studentRows.first().click();
    await page.locator('#btnAddToRecipients').click();

    // Add a manual recipient with test number "010-0000-0000" to trigger mock failure
    await page.locator('#btnDirectAddStub').click();
    await page.locator('#directAddNameInp').fill('실패테스트');
    await page.locator('#directAddPhoneInp').fill('010-0000-0000');
    await page.locator('#btnDirectAddSubmit').click();
    await page.locator('#btnDirectAddDone').click();

    // Verify recipients added (should be 2: one valid student, one mock failure)
    await expect(page.locator('#totalRecipientsLabel')).toContainText('2건');

    // Apply template to ensure body is filled
    const applyBtn = page.locator('.btn-apply-template').first();
    await applyBtn.click();

    // Setup dialog listener to verify alert text
    let dialogTriggered = false;
    let dialogText = '';
    page.on('dialog', async (dialog) => {
      dialogTriggered = true;
      dialogText = dialog.message();
      await dialog.accept();
    });

    // Click Send bar to open confirmation modal
    await page.locator('#btnSendBarDirect').click();

    // Click confirm send
    await page.locator('#btnFocusSendConfirm').click();

    // Verify dialog triggered and has correct text
    expect(dialogTriggered).toBe(true);
    expect(dialogText).toContain('발송 처리 완료: 성공 1건, 실패 1건');
    expect(dialogText).toContain('실제 발송은 아직 연동되지 않았고, 발송이력만 저장되었습니다.');

    // Retrieve database state to verify deliveries
    const deliveries = await page.evaluate(() => window.stateStore.db.outboundMessageDeliveries);
    expect(deliveries.length).toBe(2);
    
    const successDelivery = deliveries.find(d => d.recipientName !== '실패테스트');
    const failDelivery = deliveries.find(d => d.recipientName === '실패테스트');

    expect(successDelivery.status).toBe('sent');
    expect(successDelivery.provider).toBe('mock_sms');
    expect(successDelivery.recipientPhoneMasked).not.toBeNull();
    
    expect(failDelivery.status).toBe('failed');
    expect(failDelivery.failureCode).toBe('MOCK_TEST_FAIL');

    // Click deliveries tab in the vault panel to switch to deliveries tab
    await page.locator('.btn-vault-tab[data-tab="deliveries"]').click();

    // Verify UI rendering of delivery results
    // Deliveries tab should be active
    const activeTab = page.locator('.btn-vault-tab[data-tab="deliveries"]');
    await expect(activeTab).toHaveAttribute('style', /border-bottom: 2.5px solid/);

    const cards = page.locator('.delivery-result-card');
    await expect(cards).toHaveCount(2);

    const failCard = page.locator('.delivery-result-card', { hasText: '실패테스트' });
    await expect(failCard.locator('.delivery-status-badge')).toContainText('실패');
    await expect(failCard.locator('.delivery-failure-reason')).toContainText('테스트용 실패 번호입니다.');
    await expect(failCard.locator('.delivery-recipient-phone')).toContainText('010-****-0000');
    
    // Ensure raw numbers are not shown
    const failCardText = await failCard.innerText();
    expect(failCardText).not.toContain('01000000000');
    expect(failCardText).not.toContain('010-0000-0000');

    const successCard = page.locator('.delivery-result-card').filter({ hasNotText: '실패테스트' });
    await expect(successCard.locator('.delivery-status-badge')).toContainText('성공');
    await expect(successCard.locator('.delivery-recipient-phone')).toContainText('-****-');
    
    const successCardText = await successCard.innerText();
    // Raw number shouldn't be in the innerText
    expect(successCardText).not.toMatch(/010-\d{4}-\d{4}/);
    expect(successCardText).not.toMatch(/010\d{8}/);

    // Filter by "실패"
    await page.locator('.btn-delivery-filter', { hasText: '실패' }).click();
    await expect(cards).toHaveCount(1);
    await expect(failCard).toBeVisible();
    await expect(successCard).not.toBeVisible();

    // Filter by "성공"
    await page.locator('.btn-delivery-filter', { hasText: '성공' }).click();
    await expect(cards).toHaveCount(1);
    await expect(successCard).toBeVisible();
    await expect(failCard).not.toBeVisible();

    // Search by "실패"
    await page.locator('.btn-delivery-filter', { hasText: '전체' }).click();
    await page.locator('#vaultSearchInput').fill('실패');
    await expect(cards).toHaveCount(1);
    await expect(failCard).toBeVisible();

    // Reset search
    await page.locator('#vaultSearchInput').fill('');
    await expect(cards).toHaveCount(2);

    // Verify idempotencyKey, bodyHash, and phoneHash are NOT exposed in the UI
    const containerHtml = await page.locator('#vaultListContainer').innerHTML();
    const successDeliveryObj = deliveries.find(d => d.recipientName !== '실패테스트');
    expect(containerHtml).not.toContain(successDeliveryObj.idempotencyKey);
    expect(containerHtml).not.toContain(successDeliveryObj.bodyHash);
    const phoneHash = successDeliveryObj.idempotencyKey.split('_')[1];
    expect(containerHtml).not.toContain(phoneHash);

    // Verify duplicate delivery creation within the same request context is prevented (Idempotency check - Option A)
    const dbSizeBefore = await page.evaluate(() => window.stateStore.db.outboundMessageDeliveries.length);
    await page.evaluate(() => {
      const db = window.stateStore.db;
      // Get the last outbound request parameters from the last log
      const lastLog = db.outboundMessageLogs[db.outboundMessageLogs.length - 1];
      const outboundRequest = window.stateStore.createOutboundRequest({
        method: lastLog.method,
        senderNumber: lastLog.senderNumber,
        title: lastLog.title,
        body: lastLog.body,
        imageName: lastLog.imageName,
        recipients: lastLog.recipients
      });
      // Attach the same ID and log ID to simulate duplicate trigger
      outboundRequest.id = lastLog.requestId || outboundRequest.id;
      outboundRequest.logId = lastLog.id;

      const providerResult = window.stateStore.sendSmsViaMockProvider(outboundRequest);
      window.stateStore.buildOutboundDeliveries(outboundRequest, providerResult);
    });
    const dbSizeAfter = await page.evaluate(() => window.stateStore.db.outboundMessageDeliveries.length);
    expect(dbSizeAfter).toBe(dbSizeBefore);

    // Ensure parentMessages (학부모 앱 수신메시지) is NOT created
    const parentMessages = await page.evaluate(() => window.stateStore.db.parentMessages);
    expect(parentMessages.length).toBe(0);
  });

  test('should prevent double submission on rapid multiple clicks', async ({ page }) => {
    // Navigate to Message Send view
    await page.locator('.menu-item[data-view="dir-message-send"]').click();

    // Clear outboundMessageLogs and outboundMessageDeliveries
    await page.evaluate(() => {
      window.stateStore.db.outboundMessageLogs = [];
      window.stateStore.db.outboundMessageDeliveries = [];
      window.stateStore.saveDB();
    });

    // Select the first student row and add to recipients
    const studentRows = page.locator('.student-row');
    await studentRows.first().click();
    await page.locator('#btnAddToRecipients').click();

    // Verify recipients added
    await expect(page.locator('#totalRecipientsLabel')).toContainText('1건');

    // Apply template to ensure body is filled
    const applyBtn = page.locator('.btn-apply-template').first();
    await applyBtn.click();

    // Setup dialog listener to track alert counts
    let alertCount = 0;
    page.on('dialog', async (dialog) => {
      alertCount++;
      await dialog.accept();
    });

    // Open confirmation modal
    await page.locator('#btnSendBarDirect').click();

    // Click confirm send rapidly 3 times to simulate double/triple click
    const sendConfirmBtn = page.locator('#btnFocusSendConfirm');
    await expect(sendConfirmBtn).toBeVisible();

    // Click multiple times concurrently to trigger double submit scenarios
    await Promise.all([
      sendConfirmBtn.click(),
      sendConfirmBtn.click({ timeout: 500 }).catch(() => {}),
      sendConfirmBtn.click({ timeout: 500 }).catch(() => {})
    ]);

    // Give it a moment to process
    await page.waitForTimeout(500);

    // Verify dialog was triggered exactly once
    expect(alertCount).toBe(1);

    // Verify database counts
    const logs = await page.evaluate(() => window.stateStore.db.outboundMessageLogs);
    const deliveries = await page.evaluate(() => window.stateStore.db.outboundMessageDeliveries);

    expect(logs.length).toBe(1);
    expect(deliveries.length).toBe(1);

    // Ensure Focus Modal is closed
    await expect(page.locator('#focusConfirmOverlay')).toBeHidden();
  });

  test('should synchronize visual state of contact type toggle buttons on selection and toggle', async ({ page }) => {
    // Navigate to Message Send view
    await page.locator('.menu-item[data-view="dir-message-send"]').click();

    // Get contact type buttons
    const studentBtn = page.locator('.btn-toggle-contact-type[data-type="student"]');
    const g1Btn = page.locator('.btn-toggle-contact-type[data-type="g1"]');
    const g2Btn = page.locator('.btn-toggle-contact-type[data-type="g2"]');

    // Initial state check (g1 is selected by default, others not)
    await expect(g1Btn).toHaveCSS('background-color', 'rgb(234, 241, 254)'); // #eaf1fe
    await expect(g1Btn.locator('span:first-child svg')).toBeVisible();

    await expect(studentBtn).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(studentBtn.locator('span:first-child svg')).toBeHidden();

    // Toggle student button ON
    await studentBtn.click();
    await expect(studentBtn).toHaveCSS('background-color', 'rgb(234, 241, 254)');
    await expect(studentBtn.locator('span:first-child svg')).toBeVisible();

    // Toggle student button OFF
    await studentBtn.click();
    await expect(studentBtn).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(studentBtn.locator('span:first-child svg')).toBeHidden();

    // Toggle g1 button OFF
    await g1Btn.click();
    await expect(g1Btn).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(g1Btn.locator('span:first-child svg')).toBeHidden();
  });
});

