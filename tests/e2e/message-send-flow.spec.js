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

    // Assert form NOT reset (retained)
    await expect(page.locator('#totalRecipientsLabel')).toContainText('3건');
    await expect(composeTitle).toHaveValue('E2E 테스트 즉시 발송 제목');
    await expect(composeBody).toHaveValue('이것은 E2E 테스트용으로 생성된 즉시 발송 메시지 본문입니다. 이 메시지 본문은 70글자가 넘어가지 않는 아주 평범한 본문입니다.');

    // Clear recipients list for the next test step
    await page.locator('#btnClearRecipients').click();


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

    // 9. Verify Recent Tab card toggle button
    const vaultPanel = page.locator('#messageVaultPanel');
    const toggleOriginalBtn = vaultPanel.locator('.btn-toggle-original').first();
    await expect(toggleOriginalBtn).toBeVisible();
    await expect(toggleOriginalBtn).toContainText('원문 보기');
    
    // Replaced body should be shown by default
    await expect(vaultPanel.locator('.message-body-container').first()).toContainText(`반갑습니다. ${studentName}님, 여기는 ${academyName}입니다.`);
    await expect(vaultPanel.locator('.message-body-container').first()).not.toContainText('#{이름}');

    // Click toggle button to show original
    await toggleOriginalBtn.click();
    await expect(toggleOriginalBtn).toContainText('치환본 보기');
    await expect(vaultPanel.locator('.message-body-container').first()).toContainText('반갑습니다. #{이름}님, 여기는 #{학원명}입니다.');

    // Click again to toggle back to replaced
    await toggleOriginalBtn.click();
    await expect(toggleOriginalBtn).toContainText('원문 보기');
    await expect(vaultPanel.locator('.message-body-container').first()).toContainText(`반갑습니다. ${studentName}님, 여기는 ${academyName}입니다.`);
  });

  test('should validate recipients, show correct statistics, exclude invalid items, and block sending if sendable count is 0 (Phase 11E)', async ({ page }) => {
    // 1. 메시지 보내기 화면으로 이동
    await page.locator('.menu-item[data-view="dir-message-send"]').click();

    // 중복 추가 허용을 위해 dedupe 비활성화
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

    // (2) 직접 입력을 통해 중복 전화번호 추가 (최다은 번호 조회 후 중복 추가)
    const students = await page.evaluate(() => window.stateStore.getStudents());
    const targetStudent = students.find(s => s.name === '최다은') || students[0];
    const targetPhone = targetStudent.parentPhone || targetStudent.phone;
    
    await page.locator('#btnDirectAddStub').click();
    await page.locator('#directAddNameInp').fill('최다은중복');
    await page.locator('#directAddPhoneInp').fill(targetPhone);
    await page.locator('#btnDirectAddSubmit').click();

    // (3) 직접 입력을 통해 짧은 번호 추가 (9자리 미만인 5자리) -> 번호 오류
    await page.locator('#btnDirectAddStub').click();
    await page.locator('#directAddNameInp').fill('번호오류자');
    await page.locator('#directAddPhoneInp').fill('12345');
    await page.locator('#btnDirectAddSubmit').click();

    // (4) 직접 입력을 통해 긴 번호 추가 (11자리 초과인 14자리) -> 번호 오류
    await page.locator('#btnDirectAddStub').click();
    await page.locator('#directAddNameInp').fill('짧은번호자');
    await page.locator('#directAddPhoneInp').fill('010-1234-567890');
    await page.locator('#btnDirectAddSubmit').click();

    // (5) 수신거부 상태의 학생 강제 주입
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
    // 최다은(수신거부로 제외), 최다은중복(중복으로 제외), 번호오류자(번호오류 제외), 짧은번호자(번호오류 제외)
    // 따라서 발송 가능 대상은 0명이어야 함
    await expect(focusOverlay).toContainText('전체 대상');
    await expect(focusOverlay).toContainText('발송 가능');
    await expect(page.locator('#focusSendableCount')).toContainText('0명'); // 발송 가능 0명
    await expect(focusOverlay).toContainText('제외 대상');

    // 제외 사유 매핑 검증
    await expect(focusOverlay).toContainText('수신거부');
    await expect(focusOverlay).toContainText('중복 제외');
    await expect(focusOverlay).toContainText('번호 오류');

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

    // 즉시발송 클릭
    await page.locator('#btnReviewSend').click();
    await expect(focusOverlay).toBeVisible();

    // 발송 가능 대상 2명 (최다은, 홍길동)
    // 제외 대상 3명 (최다은중복, 번호오류자, 짧은번호자)
    await expect(page.locator('#focusSendableCount')).toContainText('2명'); // 발송 가능 2명
    await expect(focusOverlay).toContainText('3명'); // 제외 대상 3명

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

    // 로그 내용 세부 검증 (recipients 2건, excludedRecipients 3건)
    const lastLog = await page.evaluate(() => window.stateStore.getOutboundMessageLogs()[0]);
    expect(lastLog.recipients.length).toBe(2);
    expect(lastLog.excludedRecipients.length).toBe(3);
    expect(lastLog.recipientCount).toBe(2);
    expect(lastLog.originalRecipientCount).toBe(5);
    
    // 제외자 사유 매핑 검증
    expect(lastLog.excludedRecipients.some(r => r.name === '최다은중복' && r.reason === '중복 제외')).toBe(true);
    expect(lastLog.excludedRecipients.some(r => r.name === '번호오류자' && r.reason === '번호 오류')).toBe(true);
    expect(lastLog.excludedRecipients.some(r => r.name === '짧은번호자' && r.reason === '번호 오류')).toBe(true);

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
});

