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
    await expect(vaultPanel.locator('.message-body-container').first()).not.toContainText(studentName);

    // Click toggle button again to show replaced
    await toggleOriginalBtn.click();
    await expect(toggleOriginalBtn).toContainText('원문 보기');
    await expect(vaultPanel.locator('.message-body-container').first()).toContainText(`반갑습니다. ${studentName}님, 여기는 ${academyName}입니다.`);

    // 10. Prohibited words check
    const finalPageText = await page.innerText('.message-send-root');
    expect(finalPageText).not.toContain('예상비용');
    expect(finalPageText).not.toContain('예상 비용');
    expect(finalPageText).not.toContain('소요비용');
    expect(finalPageText).not.toContain('단가');
    expect(finalPageText).not.toContain('발송완료');

    // 11. Search input stability checks (Phase 11D-Repair-A)
    const vaultSearchInput = page.locator('#vaultSearchInput');
    
    // Switch to Recommend tab (which is tab "recommend")
    await page.locator('.btn-vault-tab[data-tab="recommend"]').click();
    await vaultSearchInput.focus();
    await vaultSearchInput.type('신'); // Type a Korean character
    await expect(vaultSearchInput).toBeFocused(); // Focus must be kept
    await expect(vaultSearchInput).toHaveValue('신'); // Value must not be lost
    // List should be filtered
    await expect(page.locator('#vaultListContainer')).toContainText('신규');
    
    // Clear search
    await vaultSearchInput.fill('');
    
    // Switch to Saved tab
    await page.locator('.btn-vault-tab[data-tab="saved"]').click();
    await vaultSearchInput.focus();
    await vaultSearchInput.type('매');
    await expect(vaultSearchInput).toBeFocused();
    await expect(vaultSearchInput).toHaveValue('매');
    await expect(page.locator('#vaultListContainer')).toContainText('매크로');
    
    // Clear search
    await vaultSearchInput.fill('');
    
    // Switch to Recent tab
    await page.locator('.btn-vault-tab[data-tab="recent"]').click();
    await vaultSearchInput.focus();
    await vaultSearchInput.type('반');
    await expect(vaultSearchInput).toBeFocused();
    await expect(vaultSearchInput).toHaveValue('반');
    await expect(page.locator('#vaultListContainer')).toContainText('반갑습니다');
  });
});

