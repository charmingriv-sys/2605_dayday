import { test, expect } from '@playwright/test';

test.describe('Director Schedule Settings and Notes Flow Checks', () => {
  test.beforeEach(async ({ page }) => {
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

  test('should setup schedule settings, teacher notes, and student schedule notes successfully', async ({ page }) => {
    // 1. Log in as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#login-overlay')).toBeHidden({ timeout: 5000 });

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

    // 3.5 Verify Phase 9C-5B-1: Lateness Policy Setup
    const lateThresholdSelect = page.locator('#acad-late-threshold');
    const lateThresholdText = page.locator('#acad-late-threshold-text');
    await expect(lateThresholdSelect).toBeVisible();
    await expect(lateThresholdText).toBeVisible();

    // Default value check (10 mins)
    await expect(lateThresholdSelect).toHaveValue('10');
    await expect(lateThresholdText).toContainText('수업 시작 후 10분 초과 시 지각 처리');

    // Change value to 20 mins
    await lateThresholdSelect.selectOption('20');
    // Verify text updates dynamically on select change
    await expect(lateThresholdText).toContainText('수업 시작 후 20분 초과 시 지각 처리');

    // Submit form to save settings
    const saveAcademyBtn = page.locator('#academy-info-form button[type="submit"]');
    await expect(saveAcademyBtn).toBeVisible();
    await saveAcademyBtn.click();

    // Reload page to verify persistence
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // Re-navigate and re-authenticate to view the saved value
    await settingsMenu.click();
    await expect(pwInput).toBeVisible();
    await pwInput.fill('0000');
    await authBtn.click();

    // Verify value is preserved as 20 mins
    await expect(lateThresholdSelect).toBeVisible();
    await expect(lateThresholdSelect).toHaveValue('20');
    await expect(lateThresholdText).toContainText('수업 시작 후 20분 초과 시 지각 처리');

    // Restore to default 10 mins and save to clean up
    await lateThresholdSelect.selectOption('10');
    await expect(lateThresholdText).toContainText('수업 시작 후 10분 초과 시 지각 처리');
    await saveAcademyBtn.click();

    // 4. Change Schedule Settings via Schedules subtab settings modal
    // Navigate to Schedules first
    const schedulesMenu = page.locator('.menu-item[data-view="dir-schedules"]');
    await expect(schedulesMenu).toBeVisible();
    await schedulesMenu.click();

    const subTabBtn = page.locator('#btn-subtab-match');
    await expect(subTabBtn).toBeVisible({ timeout: 5000 });
    await subTabBtn.click();

    // Click "설정" button to open modal
    const scheduleSettingsBtn = page.locator('#btn-schedule-settings');
    await expect(scheduleSettingsBtn).toBeVisible({ timeout: 5000 });
    await scheduleSettingsBtn.click();

    // Verify settings modal inputs are visible
    const startTimeInput = page.locator('#modal-sched-start-time');
    await expect(startTimeInput).toBeVisible();
    await startTimeInput.fill('15:00');

    const endTimeInput = page.locator('#modal-sched-end-time');
    await endTimeInput.fill('20:00');

    const slotSelect = page.locator('#modal-sched-slot-minutes');
    await slotSelect.selectOption('15');

    // Uncheck Saturday (sat) in days checkboxes
    const satCheckbox = page.locator('input[name="modal-sched-days"][value="sat"]');
    await expect(satCheckbox).toBeChecked();
    await satCheckbox.uncheck();

    // Click save button inside modal
    const saveSettingsBtn = page.locator('#btn-save-schedule-settings');
    await saveSettingsBtn.click();

    // Wait for modal to disappear (since we updated settings)
    await expect(startTimeInput).toBeHidden({ timeout: 5000 });

    // 5. Reload Page and verify settings persistence
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // Go back to Schedules subtab and open settings modal
    await schedulesMenu.click();
    await subTabBtn.click();
    await scheduleSettingsBtn.click();

    // Verify settings values inside modal
    await expect(startTimeInput).toHaveValue('15:00');
    await expect(endTimeInput).toHaveValue('20:00');
    await expect(slotSelect).toHaveValue('15');
    await expect(satCheckbox).not.toBeChecked();

    // Close the settings modal using the 취소 button
    const cancelSettingsBtn = page.locator('#modal-content-area button:has-text("취소")');
    await expect(cancelSettingsBtn).toBeVisible({ timeout: 5000 });
    await cancelSettingsBtn.click();
    await expect(startTimeInput).toBeHidden({ timeout: 5000 });

    // 6. Go to Teacher Management (Staff View)
    const staffMenu = page.locator('.menu-item[data-view="dir-teachers"]');
    await expect(staffMenu).toBeVisible();
    await staffMenu.click();

    // Click edit on the first teacher (T1 문승현)
    const editTeacherBtn = page.locator('.edit-teacher-btn[data-id="T1"]');
    await expect(editTeacherBtn).toBeVisible();
    await editTeacherBtn.click();

    // Fill schedule notes
    const teacherNotesArea = page.locator('#teacher-notes-input');
    await expect(teacherNotesArea).toBeVisible();
    await teacherNotesArea.fill('화요일 16시 출근');

    // Save teacher modifications
    const saveTeacherBtn = page.locator('#teacher-form button[type="submit"]');
    await saveTeacherBtn.click();

    // Reload page to verify persistence
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    
    // Go to Teacher Management
    await staffMenu.click();
    await editTeacherBtn.click();
    await expect(teacherNotesArea).toHaveValue('화요일 16시 출근');

    // 7. Go to Student Management (Members View)
    const membersMenu = page.locator('.menu-item[data-view="dir-students"]');
    await expect(membersMenu).toBeVisible();
    await membersMenu.click();

    // Open register student modal
    const openRegisterModalBtn = page.locator('#btn-add-student');
    await expect(openRegisterModalBtn).toBeVisible();
    await openRegisterModalBtn.click();

    // Fill in required student details
    await page.locator('#modal-student-name').fill('테스트원생');
    await page.locator('#modal-student-teacher').selectOption('T1');
    await page.locator('#modal-student-instrument').selectOption('피아노');
    
    // Address search simulation (skip standard address search to avoid popup)
    await page.evaluate(() => {
      document.querySelector('#modal-student-postcode').value = '12345';
      document.querySelector('#modal-student-address-basic').value = '서울시 강남구';
      document.querySelector('#modal-student-address-detail').value = '101호';
    });

    // Setup student phone
    await page.locator('#modal-student-phone').fill('010-1234-5678');

    // Fill schedule notes in Section 6
    const studentNotesArea = page.locator('#modal-student-schedule-notes');
    await expect(studentNotesArea).toBeVisible();
    await studentNotesArea.fill('매주 목요일 17시 등원');

    // Submit student modal form
    const submitStudentBtn = page.locator('#btn-student-submit');
    await submitStudentBtn.click();

    // Reload page to verify persistence
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Navigate back to members
    await membersMenu.click();

    // Click on '테스트원생' link to open details
    const studentLink = page.locator('.student-name-link', { hasText: '테스트원생' });
    await expect(studentLink).toBeVisible();
    await studentLink.click();

    // Verify scheduleNotes are visible in detailed profile modal
    const detailNotesSection = page.locator('text=6. 시간표 등 일정 특이사항').locator('xpath=following-sibling::div[1]');
    await expect(detailNotesSection).toBeVisible();
    await expect(detailNotesSection).toContainText('매주 목요일 17시 등원');
  });
});
