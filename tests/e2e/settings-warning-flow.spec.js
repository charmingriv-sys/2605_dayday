import { test, expect } from '@playwright/test';

test.describe('Academy Warning Policy Settings UI E2E Flow', () => {
  test.beforeEach(async ({ page }) => {
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

  test('should customize, save, and reload student and teacher warning configurations', async ({ page }) => {
    // 1. Log in as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // 2. Navigate to Academy Info / Settings View
    const settingsMenu = page.locator('.menu-item[data-view="dir-academy-info"]');
    await expect(settingsMenu).toBeVisible();
    await settingsMenu.click();

    // 3. Authenticate with System Password (0000)
    const pwInput = page.locator('#academy-auth-password');
    await expect(pwInput).toBeVisible();
    await pwInput.fill('0000');
    
    const authBtn = page.locator('#btn-submit-academy-auth');
    await authBtn.click();

    // 4. Verify 6 Warning Policy Inputs are visible
    const lateCheckbox = page.locator('#acad-late-detection-enabled');
    const lateSelect = page.locator('#acad-late-threshold');
    const lateText = page.locator('#acad-late-threshold-text');

    const absenceCheckbox = page.locator('#acad-student-absence-warning-enabled');
    const absenceText = page.locator('#acad-student-absence-warning-text');

    const checkoutCheckbox = page.locator('#acad-student-checkout-missing-warning-enabled');
    const checkoutSelect = page.locator('#acad-student-checkout-missing-grace-minutes');
    const checkoutText = page.locator('#acad-student-checkout-missing-grace-minutes-text');

    const teacherLateCheckbox = page.locator('#acad-teacher-late-warning-enabled');
    const teacherLateSelect = page.locator('#acad-teacher-late-warning-grace-minutes');
    const teacherLateText = page.locator('#acad-teacher-late-warning-grace-minutes-text');

    const teacherNoShowCheckbox = page.locator('#acad-teacher-no-show-warning-enabled');
    const teacherNoShowSelect = page.locator('#acad-teacher-no-show-warning-grace-minutes');
    const teacherNoShowText = page.locator('#acad-teacher-no-show-warning-grace-minutes-text');

    const teacherCheckoutCheckbox = page.locator('#acad-teacher-checkout-missing-warning-enabled');
    const teacherCheckoutSelect = page.locator('#acad-teacher-checkout-missing-grace-minutes');
    const teacherCheckoutText = page.locator('#acad-teacher-checkout-missing-grace-minutes-text');

    // Default values check
    await expect(lateCheckbox).toBeChecked();
    await expect(lateSelect).toBeEnabled();
    await expect(lateSelect).toHaveValue('10');

    await expect(absenceCheckbox).toBeChecked();
    
    await expect(checkoutCheckbox).toBeChecked();
    await expect(checkoutSelect).toBeEnabled();
    await expect(checkoutSelect).toHaveValue('10');

    await expect(teacherLateCheckbox).toBeChecked();
    await expect(teacherLateSelect).toBeEnabled();
    await expect(teacherLateSelect).toHaveValue('5');

    await expect(teacherNoShowCheckbox).toBeChecked();
    await expect(teacherNoShowSelect).toBeEnabled();
    await expect(teacherNoShowSelect).toHaveValue('10');

    await expect(teacherCheckoutCheckbox).toBeChecked();
    await expect(teacherCheckoutSelect).toBeEnabled();
    await expect(teacherCheckoutSelect).toHaveValue('10');

    // 5. Test Checkbox ON/OFF Select Disable/Enable states
    // Toggle Student Late
    await lateCheckbox.uncheck();
    await expect(lateSelect).toBeDisabled();
    await expect(lateText).toContainText('지각 판정을 사용하지 않습니다.');
    await lateCheckbox.check();
    await expect(lateSelect).toBeEnabled();

    // Toggle Student Checkout Missing
    await checkoutCheckbox.uncheck();
    await expect(checkoutSelect).toBeDisabled();
    await expect(checkoutText).toContainText('하원누락 확인을 사용하지 않습니다.');
    await checkoutCheckbox.check();
    await expect(checkoutSelect).toBeEnabled();

    // Toggle Teacher Late
    await teacherLateCheckbox.uncheck();
    await expect(teacherLateSelect).toBeDisabled();
    await expect(teacherLateText).toContainText('강사 지각 판정을 사용하지 않습니다.');
    await teacherLateCheckbox.check();
    await expect(teacherLateSelect).toBeEnabled();

    // Toggle Teacher No Show
    await teacherNoShowCheckbox.uncheck();
    await expect(teacherNoShowSelect).toBeDisabled();
    await expect(teacherNoShowText).toContainText('강사 미출근 확인을 사용하지 않습니다.');
    await teacherNoShowCheckbox.check();
    await expect(teacherNoShowSelect).toBeEnabled();

    // Toggle Teacher Checkout Missing
    await teacherCheckoutCheckbox.uncheck();
    await expect(teacherCheckoutSelect).toBeDisabled();
    await expect(teacherCheckoutText).toContainText('강사 퇴근누락 확인을 사용하지 않습니다.');
    await teacherCheckoutCheckbox.check();
    await expect(teacherCheckoutSelect).toBeEnabled();

    // 6. Change values to various bounds (0m, 5m, 90m) and toggle some to OFF
    await lateSelect.selectOption('90'); // 90 min
    await absenceCheckbox.uncheck(); // OFF
    await checkoutSelect.selectOption('0'); // 0 min
    await teacherLateSelect.selectOption('90'); // 90 min
    await teacherNoShowCheckbox.uncheck(); // OFF
    await teacherCheckoutSelect.selectOption('0'); // 0 min

    // Save settings
    const saveAcademyBtn = page.locator('#academy-info-form button[type="submit"]');
    await saveAcademyBtn.click();

    // Verify toast or confirmation logic
    await page.waitForTimeout(500);

    // 7. Reload and verify settings persist in UI and stateStore database
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // Go to settings (session persists)
    await settingsMenu.click();
    await pwInput.fill('0000');
    await authBtn.click();

    // Verify UI values persisted
    await expect(lateCheckbox).toBeChecked();
    await expect(lateSelect).toHaveValue('90');

    await expect(absenceCheckbox).not.toBeChecked();

    await expect(checkoutCheckbox).toBeChecked();
    await expect(checkoutSelect).toHaveValue('0');

    await expect(teacherLateCheckbox).toBeChecked();
    await expect(teacherLateSelect).toHaveValue('90');

    await expect(teacherNoShowCheckbox).not.toBeChecked();

    await expect(teacherCheckoutCheckbox).toBeChecked();
    await expect(teacherCheckoutSelect).toHaveValue('0');

    // 8. Directly evaluate stateStore DB settings values
    const dbSettings = await page.evaluate(() => window.stateStore.db.settings);
    expect(dbSettings.lateDetectionEnabled).toBe(true);
    expect(dbSettings.lateThresholdMinutes).toBe(90);
    expect(dbSettings.studentAbsenceWarningEnabled).toBe(false);
    expect(dbSettings.studentCheckoutMissingWarningEnabled).toBe(true);
    expect(dbSettings.studentCheckoutMissingGraceMinutes).toBe(0);
    expect(dbSettings.teacherLateWarningEnabled).toBe(true);
    expect(dbSettings.teacherLateWarningGraceMinutes).toBe(90);
    expect(dbSettings.teacherNoShowWarningEnabled).toBe(false);
    expect(dbSettings.teacherNoShowWarningGraceMinutes).toBe(10); // preserved old val but disabled
    expect(dbSettings.teacherCheckoutMissingWarningEnabled).toBe(true);
    expect(dbSettings.teacherCheckoutMissingGraceMinutes).toBe(0);
  });

  test('should customize, save, and reload parent message and push settings', async ({ page }) => {
    // 1. Log in as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // 2. Navigate to Academy Info / Settings View
    const settingsMenu = page.locator('.menu-item[data-view="dir-academy-info"]');
    await expect(settingsMenu).toBeVisible();
    await settingsMenu.click();

    // 3. Authenticate with System Password (0000)
    const pwInput = page.locator('#academy-auth-password');
    await expect(pwInput).toBeVisible();
    await pwInput.fill('0000');
    
    const authBtn = page.locator('#btn-submit-academy-auth');
    await authBtn.click();

    // 4. Verify parent message settings rows and checkboxes are visible
    const checkInRow = page.locator('.parent-msg-setting-row[data-event="attendanceCheckIn"]');
    await expect(checkInRow).toBeVisible();
    
    const checkInMsgCheckbox = checkInRow.locator('.msg-toggle');
    const checkInPushCheckbox = checkInRow.locator('.push-toggle');

    // Default values check (should be messageEnabled: true, pushEnabled: true)
    await expect(checkInMsgCheckbox).toBeChecked();
    await expect(checkInPushCheckbox).toBeChecked();

    // 5. Test turning OFF messageEnabled -> pushEnabled becomes OFF and disabled
    await checkInMsgCheckbox.uncheck();
    await expect(checkInPushCheckbox).not.toBeChecked();
    await expect(checkInPushCheckbox).toBeDisabled();

    // 6. Test turning ON messageEnabled -> pushEnabled becomes enabled (but still unchecked by default since it was forced off)
    await checkInMsgCheckbox.check();
    await expect(checkInPushCheckbox).toBeEnabled();
    await expect(checkInPushCheckbox).not.toBeChecked();

    // 7. Check push checkbox again
    await checkInPushCheckbox.check();

    // 8. Let's make some non-default changes to verify persistence
    const checkOutRow = page.locator('.parent-msg-setting-row[data-event="attendanceCheckOut"]');
    const checkOutMsgCheckbox = checkOutRow.locator('.msg-toggle');
    const checkOutPushCheckbox = checkOutRow.locator('.push-toggle');

    // Turn off 등원 push
    await checkInPushCheckbox.uncheck();
    // Turn off 하원 message
    await checkOutMsgCheckbox.uncheck();

    // 9. Save settings
    const saveAcademyBtn = page.locator('#academy-info-form button[type="submit"]');
    await saveAcademyBtn.click();

    // Wait for the save operation
    await page.waitForTimeout(500);

    // 10. Reload and verify settings persist
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    await settingsMenu.click();
    await pwInput.fill('0000');
    await authBtn.click();

    // Locate elements again
    const checkInRowReloaded = page.locator('.parent-msg-setting-row[data-event="attendanceCheckIn"]');
    const checkInMsgCheckboxReloaded = checkInRowReloaded.locator('.msg-toggle');
    const checkInPushCheckboxReloaded = checkInRowReloaded.locator('.push-toggle');

    const checkOutRowReloaded = page.locator('.parent-msg-setting-row[data-event="attendanceCheckOut"]');
    const checkOutMsgCheckboxReloaded = checkOutRowReloaded.locator('.msg-toggle');
    const checkOutPushCheckboxReloaded = checkOutRowReloaded.locator('.push-toggle');

    // Verify 등원: messageEnabled: true, pushEnabled: false
    await expect(checkInMsgCheckboxReloaded).toBeChecked();
    await expect(checkInPushCheckboxReloaded).not.toBeChecked();

    // Verify 하원: messageEnabled: false, pushEnabled: false (disabled)
    await expect(checkOutMsgCheckboxReloaded).not.toBeChecked();
    await expect(checkOutPushCheckboxReloaded).not.toBeChecked();
    await expect(checkOutPushCheckboxReloaded).toBeDisabled();

    // 11. Directly evaluate stateStore DB settings values
    const dbParentSettings = await page.evaluate(() => window.stateStore.db.settings.parentMessageSettings);
    expect(dbParentSettings.attendanceCheckIn.messageEnabled).toBe(true);
    expect(dbParentSettings.attendanceCheckIn.pushEnabled).toBe(false);
    expect(dbParentSettings.attendanceCheckOut.messageEnabled).toBe(false);
    expect(dbParentSettings.attendanceCheckOut.pushEnabled).toBe(false);
    expect(dbParentSettings.tuitionBilling.messageEnabled).toBe(true);
    expect(dbParentSettings.tuitionBilling.pushEnabled).toBe(true);
  });

  test('should generate parent messages automatically based on attendance events and settings', async ({ page }) => {
    // 1. Log in as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // 2. Initialize parent contacts and configure settings
    await page.evaluate(() => {
        window.stateStore.db.parentMessages = [];
        window.stateStore.updateParentMessageSettingsBulk({
            attendanceCheckIn: { messageEnabled: true, pushEnabled: true },
            attendanceCheckOut: { messageEnabled: true, pushEnabled: false }
        });
        window.stateStore.saveDB();
    });

    const menuAttendance = page.locator('.menu-item[data-view="dir-attendance-control"]');
    await expect(menuAttendance).toBeVisible();
    await menuAttendance.click();

    // Trigger check-in via stateStore in page context (14:30 triggers late status)
    await page.evaluate(() => {
        window.stateStore.markAttendance('S1', '2026-06-15', 'present', '14:30', 'E2E 등원');
    });

    // Verify parentMessages check_in is created (even with late status)
    let parentMsgs = await page.evaluate(() => window.stateStore.db.parentMessages);
    let checkInMsg = parentMsgs.find(m => m.studentId === 'S1' && m.type === 'check_in');
    expect(checkInMsg).toBeDefined();
    expect(checkInMsg.pushRequired).toBe(true);
    expect(checkInMsg.pushStatus).toBe('pending');
    expect(checkInMsg.title).toContain('최다은 원생 등원 알림');
    expect(checkInMsg.body).toContain('14:30에 등원했습니다.');

    // Trigger check-out (leaveAttendance)
    await page.evaluate(() => {
        window.stateStore.leaveAttendance('S1', '2026-06-15', '15:20');
    });

    parentMsgs = await page.evaluate(() => window.stateStore.db.parentMessages);
    let checkOutMsg = parentMsgs.find(m => m.studentId === 'S1' && m.type === 'check_out');
    expect(checkOutMsg).toBeDefined();
    expect(checkOutMsg.pushRequired).toBe(false);
    expect(checkOutMsg.pushStatus).toBe('not_required');
    expect(checkOutMsg.title).toContain('최다은 원생 하원 알림');
    expect(checkOutMsg.body).toContain('15:20에 하원했습니다.');

    // Test settings OFF -> no message created
    await page.evaluate(() => {
        window.stateStore.updateParentMessageSettingsBulk({
            attendanceCheckIn: { messageEnabled: false, pushEnabled: false }
        });
        window.stateStore.saveDB();
        window.stateStore.markAttendance('S1', '2026-06-16', 'present', '14:40', 'E2E 등원2');
    });

    parentMsgs = await page.evaluate(() => window.stateStore.db.parentMessages);
    let checkInMsg2 = parentMsgs.find(m => m.studentId === 'S1' && m.type === 'check_in' && m.body.includes('14:40'));
    expect(checkInMsg2).toBeUndefined();

    // Verify no outboundMessageLogs or old messages are created by this
    const outboundLogs = await page.evaluate(() => window.stateStore.db.outboundMessageLogs || []);
    expect(outboundLogs.length).toBe(0);

    const oldMessages = await page.evaluate(() => window.stateStore.db.messages || []);
    const attOldMessages = oldMessages.filter(m => m.title && m.title.includes('출결'));
    expect(attOldMessages.length).toBe(0);
  });

  test('should generate parent messages automatically based on tuition events and settings', async ({ page }) => {
    // 1. Log in as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // 2. Initialize parent contacts and configure settings
    await page.evaluate(() => {
        window.stateStore.db.parentMessages = [];
        window.stateStore.db.payments = [];
        
        // Ensure S1 has contact in db
        const s1 = window.stateStore.getStudent('S1');
        if (s1) {
            window.stateStore.upsertParentContact({
                studentId: 'S1',
                slot: 'parent1',
                name: s1.parentName || '최다은보호자',
                relation: 'guardian',
                phone: s1.parentPhone || '010-1234-5678',
                canReceiveMessage: true
            });
        }

        window.stateStore.updateParentMessageSettingsBulk({
            tuitionBilling: { messageEnabled: true, pushEnabled: true },
            tuitionPaid: { messageEnabled: true, pushEnabled: false }
        });
        window.stateStore.saveDB();
    });

    // 3. Create invoice for S1 to trigger tuition_billing
    const invoiceId = await page.evaluate(() => {
        const invoice = window.stateStore.createInvoice('S1', 150000, '2026-06');
        return invoice.id;
    });

    // 4. Verify tuition billing message is created
    let parentMsgs = await page.evaluate(() => window.stateStore.db.parentMessages);
    let billingMsg = parentMsgs.find(m => m.studentId === 'S1' && m.type === 'tuition_billing');
    expect(billingMsg).toBeDefined();
    expect(billingMsg.pushRequired).toBe(true);
    expect(billingMsg.pushStatus).toBe('pending');
    expect(billingMsg.title).toContain('최다은 원생 수강료 수납 안내');
    expect(billingMsg.body).toContain('최다은 원생의 2026년 06월 수강료 150,000원이 청구되었습니다.');

    // 5. Pay invoice to trigger tuition_paid
    await page.evaluate((id) => {
        window.stateStore.payInvoice(id, 'cash');
    }, invoiceId);

    // 6. Verify tuition paid message is created
    parentMsgs = await page.evaluate(() => window.stateStore.db.parentMessages);
    let paidMsg = parentMsgs.find(m => m.studentId === 'S1' && m.type === 'tuition_paid');
    expect(paidMsg).toBeDefined();
    expect(paidMsg.pushRequired).toBe(false);
    expect(paidMsg.pushStatus).toBe('not_required');
    expect(paidMsg.title).toContain('최다은 원생 수강료 수납 완료');
    expect(paidMsg.body).toContain('최다은 원생의 2026년 06월 수강료 150,000원이 수납 완료되었습니다.');

    // 7. Verify deduplication
    const dupCount = await page.evaluate((id) => {
        window.stateStore.triggerPaymentParentMessage(id, 'tuition_paid');
        return window.stateStore.db.parentMessages.filter(m => m.studentId === 'S1' && m.type === 'tuition_paid').length;
    }, invoiceId);
    expect(dupCount).toBe(1);

    // 8. Test settings OFF -> no message created
    await page.evaluate(() => {
        window.stateStore.updateParentMessageSettingsBulk({
            tuitionBilling: { messageEnabled: false, pushEnabled: false }
        });
        window.stateStore.saveDB();
        window.stateStore.createInvoice('S1', 150000, '2026-07');
    });

    parentMsgs = await page.evaluate(() => window.stateStore.db.parentMessages);
    let billingMsg2 = parentMsgs.find(m => m.studentId === 'S1' && m.type === 'tuition_billing' && m.body.includes('2026년 07월'));
    expect(billingMsg2).toBeUndefined();

    // 9. Verify no book payment message is created
    await page.evaluate(() => {
        // push a book payment
        window.stateStore.db.payments.push({
            id: 'P-BOOK-E2E',
            studentId: 'S1',
            amount: 20000,
            month: '2026-06',
            type: 'book',
            status: 'unpaid',
            invoiceDate: '2026-06-15'
        });
        window.stateStore.triggerPaymentParentMessage('P-BOOK-E2E', 'tuition_billing');
        window.stateStore.payInvoice('P-BOOK-E2E', 'cash');
    });

    parentMsgs = await page.evaluate(() => window.stateStore.db.parentMessages);
    let bookMsg = parentMsgs.filter(m => m.relatedDomainId === 'P-BOOK-E2E');
    expect(bookMsg.length).toBe(0);

    // 10. Verify no outboundMessageLogs or old messages are created
    const outboundLogs = await page.evaluate(() => window.stateStore.db.outboundMessageLogs || []);
    expect(outboundLogs.length).toBe(0);

    const oldMessages = await page.evaluate(() => window.stateStore.db.messages || []);
    const billingOldMessages = oldMessages.filter(m => m.title && m.title.includes('수납'));
    expect(billingOldMessages.length).toBe(0);
  });
});
