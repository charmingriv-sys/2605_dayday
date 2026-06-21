import { test, expect } from '@playwright/test';

test.describe('Student Status Management Flow', () => {
  const testStudentName = `E2E_Status_Student_${Date.now()}`;
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.error('Browser console.error:', msg.text());
      }
    });
    page.on('pageerror', err => {
      consoleErrors.push(err.message);
      console.error('Browser pageerror:', err.message);
    });

    // Clear localStorage to ensure a clean default state
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.role-grid').waitFor({ state: 'attached', timeout: 5000 });
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.role-grid').waitFor({ state: 'attached', timeout: 5000 });
  });

  test('should manage student status from attending to on_leave and withdrawn', async ({ page }) => {
    // 1. Log in as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // 2. Navigate to Student Management Tab
    await page.locator('.menu-item[data-view="dir-students"]').click();
    await expect(page.locator('#page-title')).toContainText('원생 명부 관리');

    // 3. Click Add Student Button
    await page.locator('#btn-add-student').click();
    await expect(page.locator('#common-modal')).toBeVisible();

    // 4. Fill in basic details
    await page.locator('#modal-student-name').fill(testStudentName);
    await page.locator('#modal-student-phone-status').selectOption('none');
    await page.locator('#modal-student-parent-phone').fill('010-1234-5678');

    // Address Kakao Mocking
    await page.evaluate(() => {
      window.kakao = {
        Postcode: function(options) {
          return {
            open: () => {
              if (options && options.oncomplete) {
                options.oncomplete({
                  zonecode: '06543',
                  roadAddress: '서울시 서초구 반포동 123-4'
                });
              }
            }
          };
        }
      };
    });
    await page.locator('#btn-modal-student-address-search').click();
    await page.locator('#modal-student-address-detail').fill('101동 202호');
    await page.locator('#modal-student-address-detail').evaluate(el => {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await page.locator('#modal-student-instrument').selectOption({ index: 1 });
    await page.locator('#modal-student-teacher').selectOption({ index: 1 });
    await page.locator('#modal-student-due-day').fill('10');
    await page.locator('#modal-student-fee').fill('150000');

    // Submit form (registers as attending by default)
    await page.locator('#btn-student-submit').click();
    await expect(page.locator('#common-modal')).not.toHaveClass(/show/);
    await page.waitForTimeout(400);

    // 5. Verify registered student is in list with NO status badges
    const row = page.locator('tr', { has: page.locator(`.student-name-link:has-text("${testStudentName}")`) });
    await expect(row).toBeVisible();
    await expect(row.locator('.badge-danger:has-text("퇴원")')).not.toBeVisible();
    await expect(row.locator('.badge-warning:has-text("휴원")')).not.toBeVisible();

    // 6. Click student name link to open detail modal
    await row.locator('.student-name-link').click();
    await expect(page.locator('#common-modal')).toBeVisible();

    // 7. Click Status Change button in detail modal
    const changeStatusBtn = page.locator('#btn-change-status-from-detail');
    await expect(changeStatusBtn).toBeVisible();
    await changeStatusBtn.click();

    // Verify status change modal elements
    const statusSelect = page.locator('#modal-student-status');
    await expect(statusSelect).toBeVisible();
    await expect(statusSelect).toHaveValue('attending');

    // Change status to "on_leave" (휴원)
    await statusSelect.selectOption('on_leave');

    const leaveStartDateInput = page.locator('#modal-student-leave-start-date');
    const leaveEndDateInput = page.locator('#modal-student-leave-end-date');
    await expect(leaveStartDateInput).toBeVisible();
    await expect(leaveEndDateInput).toBeVisible();

    // 7.1. Validation test: Set end date earlier than start date
    await leaveStartDateInput.fill('2026-06-10');
    await leaveEndDateInput.fill('2026-06-05');

    let validationAlertMsg = '';
    const dateValidationDialogPromise = new Promise(resolve => {
      page.once('dialog', async dialog => {
        validationAlertMsg = dialog.message();
        await dialog.accept();
        resolve();
      });
    });

    await page.locator('#btn-status-submit').click();
    await dateValidationDialogPromise;
    expect(validationAlertMsg).toContain('휴원 종료일은 휴원 시작일보다 빠를 수 없습니다.');

    // 7.2. Set PAST dates: 2026-06-02 to 2026-06-10 (9 days)
    // (Relative to today 2026-06-19, this is in the past and should not show under "현재 휴원 기간")
    await leaveStartDateInput.fill('2026-06-02');
    await leaveEndDateInput.fill('2026-06-10');

    // Handle confirm dialog for on_leave transition
    let dialogMessage = '';
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      console.log('Dialog popped:', dialogMessage);
      await dialog.accept();
    });

    await page.locator('#btn-status-submit').click();
    await page.waitForTimeout(400);
    expect(dialogMessage).toContain('휴원');

    // Verify detail modal re-opened, and since the period is in the past,
    // "현재 휴원 기간" is NOT displayed, but "휴원 이력" IS displayed.
    const detailModal = page.locator('#common-modal');
    await expect(detailModal).toContainText('원생 상태');
    await expect(detailModal).toContainText('휴원');
    await expect(detailModal).not.toContainText('현재 휴원 기간');
    await expect(detailModal).toContainText('휴원 이력');
    await expect(detailModal).toContainText('휴원 2026-06-02 ~ 2026-06-10 (9일)');

    // 8. Overlap collision block test: Try registering 2026-06-01 to 2026-06-05 (overlaps with 06-02 ~ 06-10)
    await changeStatusBtn.click();
    await statusSelect.selectOption('on_leave');
    await leaveStartDateInput.fill('2026-06-01');
    await leaveEndDateInput.fill('2026-06-05');

    let overlapAlertMsg = '';
    const overlapDialogPromise = new Promise(resolve => {
      page.once('dialog', async dialog => {
        overlapAlertMsg = dialog.message();
        await dialog.accept();
        resolve();
      });
    });

    await page.locator('#btn-status-submit').click();
    await overlapDialogPromise;
    expect(overlapAlertMsg).toContain('이미 등록된 휴원 기간과 겹칩니다.');

    // 9. Edit leave period: click edit next to 2026-06-02 ~ 2026-06-10
    const editPeriodBtn = page.locator('.edit-period-btn').first();
    await expect(editPeriodBtn).toBeVisible();
    await editPeriodBtn.click();

    // Verify fields populated
    await expect(leaveStartDateInput).toHaveValue('2026-06-02');
    await expect(leaveEndDateInput).toHaveValue('2026-06-10');

    // Change to 2026-06-03 to 2026-06-09 (7 days) and save
    await leaveStartDateInput.fill('2026-06-03');
    await leaveEndDateInput.fill('2026-06-09');

    await page.locator('#btn-status-submit').click();
    await page.waitForTimeout(400);

    // Verify detail modal re-opened and updated history is displayed
    await expect(detailModal).toContainText('휴원 2026-06-03 ~ 2026-06-09 (7일)');

    // 10. Register another non-overlapping leave period: 2026-07-15 to 2026-07-25 (11 days)
    await changeStatusBtn.click();
    await statusSelect.selectOption('on_leave');
    await leaveStartDateInput.fill('2026-07-15');
    await leaveEndDateInput.fill('2026-07-25');

    await page.locator('#btn-status-submit').click();
    await page.waitForTimeout(400);

    // Verify both are present in history
    await expect(detailModal).toContainText('휴원 2026-07-15 ~ 2026-07-25 (11일)');
    await expect(detailModal).toContainText('휴원 2026-06-03 ~ 2026-06-09 (7일)');

    // 10.1 Delete period: delete 2026-06-03 ~ 2026-06-09
    await changeStatusBtn.click();
    const deleteBtn = page.locator('.delete-period-btn').first();
    await expect(deleteBtn).toBeVisible();

    let deleteConfirmMsg = '';
    page.once('dialog', async dialog => {
      deleteConfirmMsg = dialog.message();
      await dialog.accept();
    });
    await deleteBtn.click();
    await page.waitForTimeout(300);
    expect(deleteConfirmMsg).toContain('삭제하시겠습니까?');

    // Cancel out of status modal to return to detail modal
    await page.locator('#btn-status-cancel').click();
    await page.waitForTimeout(400);

    // Verify only the 07-15 ~ 07-25 period remains
    await expect(detailModal).toContainText('휴원 2026-07-15 ~ 2026-07-25 (11일)');
    await expect(detailModal).not.toContainText('휴원 2026-06-03 ~ 2026-06-09 (7일)');

    // 11. Change status to "withdrawn" (퇴원) and verify that withdrawal date overlapping with leave period is ALLOWED
    await changeStatusBtn.click();
    await statusSelect.selectOption('withdrawn');

    const withdrawalDateInput = page.locator('#modal-student-withdrawal-date');
    await expect(withdrawalDateInput).toBeVisible();
    
    // Set withdrawal date overlapping with active leave: 2026-07-20
    await withdrawalDateInput.fill('2026-07-20');

    let withdrawnDialogMsg = '';
    page.once('dialog', async dialog => {
      withdrawnDialogMsg = dialog.message();
      await dialog.accept();
    });

    await page.locator('#btn-status-submit').click();
    await page.waitForTimeout(400);
    expect(withdrawnDialogMsg).toContain('퇴원은 삭제가 아니며 기존 이력은 보존됩니다.');

    // Detail modal re-opened, verify withdrawal date AND remaining leave history is fully preserved!
    await expect(detailModal).toContainText('퇴원일');
    await expect(detailModal).toContainText('2026-07-20');
    await expect(detailModal).toContainText('휴원 이력');
    await expect(detailModal).toContainText('휴원 2026-07-15 ~ 2026-07-25 (11일)');
    await expect(detailModal).not.toContainText('휴원 2026-06-03 ~ 2026-06-09');

    // Close detail modal
    await page.locator('.modal-close').first().click();
    await expect(detailModal).not.toHaveClass(/show/);
    await page.waitForTimeout(400);

    // 12. Verify student list row status badge
    // By default (active filter), the student is not shown
    await expect(row).not.toBeVisible();

    // Change filter status to "all"
    await page.locator('#student-status-filter').selectOption('all');
    await expect(row).toBeVisible();
    await expect(row.locator('.badge-danger:has-text("퇴원")')).toBeVisible();

    // 13. Reload page to verify persistence
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const isAppVisible = await page.locator('#app-root').isVisible();
    if (!isAppVisible) {
      const reloadDirectorBtn = page.locator('.role-btn.director');
      await expect(reloadDirectorBtn).toBeVisible({ timeout: 5000 });
      await reloadDirectorBtn.click();
    }
    await page.locator('.menu-item[data-view="dir-students"]').click();
    await page.locator('#student-status-filter').selectOption('all');

    await expect(row).toBeVisible();
    await expect(row.locator('.badge-danger:has-text("퇴원")')).toBeVisible();

    // Re-verify detail modal
    await row.locator('.student-name-link').click();
    await expect(detailModal).toBeVisible();
    await expect(detailModal).toContainText('퇴원일');
    await expect(detailModal).toContainText('2026-07-20');
    await expect(detailModal).toContainText('휴원 이력');
    await expect(detailModal).toContainText('휴원 2026-07-15 ~ 2026-07-25 (11일)');
    await expect(detailModal).not.toContainText('휴원 2026-06-03 ~ 2026-06-09');

    // Close detail modal
    await page.locator('.modal-close').first().click();

    // 14. Navigate to Dashboard and Verify KPI metrics
    await page.locator('.menu-item[data-view="dir-dashboard"]').click();
    await page.locator('.metric-card').first().waitFor({ state: 'visible', timeout: 5000 });

    const attendingCard = page.locator('.metric-card', { hasText: '재원생 수' });
    await expect(attendingCard).toBeVisible();
    await expect(attendingCard.locator('.metric-sublabel')).toContainText('휴원');
    await expect(attendingCard.locator('.metric-sublabel')).toContainText('퇴원');

    const unpaidCard = page.locator('.metric-card', { hasText: '이번 달 미납 수강료' });
    await expect(unpaidCard).toBeVisible();
    await expect(unpaidCard.locator('.metric-sublabel')).toContainText('퇴원생 미납 포함');

    expect(consoleErrors.length).toBe(0);
  });

  test('should return to student details modal from subviews on cancel/close', async ({ page }) => {
    // 1. Log in as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // 2. Navigate to Student Management Tab
    await page.locator('.menu-item[data-view="dir-students"]').click();
    await expect(page.locator('#page-title')).toContainText('원생 명부 관리');

    // 3. Click the first student name link in the table to open details modal
    const firstStudentLink = page.locator('.student-name-link').first();
    await expect(firstStudentLink).toBeVisible();
    await firstStudentLink.click();

    const detailModal = page.locator('#common-modal');
    await expect(detailModal).toBeVisible();
    await expect(detailModal).toContainText('원생 상세 정보');

    // --- Subview 1: Edit Student Modal ---
    const editBtn = page.locator('#btn-edit-student-from-detail');
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // Verify Edit Modal is open
    await expect(page.locator('#student-modal-form')).toBeVisible();

    // Click Cancel button in edit modal
    const cancelEditBtn = page.locator('#btn-edit-student-cancel');
    await expect(cancelEditBtn).toBeVisible();
    await cancelEditBtn.click();

    // Verify returned back to Student Details Modal
    await expect(detailModal).toBeVisible();
    await expect(detailModal).toContainText('원생 상세 정보');

    // --- Subview 2: Status Change Modal ---
    const changeStatusBtn = page.locator('#btn-change-status-from-detail');
    await expect(changeStatusBtn).toBeVisible();
    await changeStatusBtn.click();

    // Verify Status Modal is open
    await expect(page.locator('#modal-student-status')).toBeVisible();

    // Click Cancel button in status modal
    const cancelStatusBtn = page.locator('#btn-status-cancel');
    await expect(cancelStatusBtn).toBeVisible();
    await cancelStatusBtn.click();

    // Verify returned back to Student Details Modal
    await expect(detailModal).toBeVisible();
    await expect(detailModal).toContainText('원생 상세 정보');

    // --- Subview 3: Parent Preview Modal ---
    const previewBtn = page.locator('#btn-preview-parent-view');
    await expect(previewBtn).toBeVisible();
    await previewBtn.click();

    // Verify Preview Modal is open
    await expect(page.locator('#smartphone-content-container')).toBeVisible();

    // Click Close (닫기) button in parent preview modal
    const closePreviewBtn = page.locator('#btn-close-parent-preview');
    await expect(closePreviewBtn).toBeVisible();
    await closePreviewBtn.click();

    // Verify returned back to Student Details Modal
    await expect(detailModal).toBeVisible();
    await expect(detailModal).toContainText('원생 상세 정보');

    // --- Subview 4: NTS Certificate Print Modal ---
    const ntsBtn = page.locator('#btn-nts-certificate');
    await expect(ntsBtn).toBeVisible();
    await ntsBtn.click();

    // Verify NTS Modal is open
    await expect(page.locator('#nts-input-form')).toBeVisible();

    // Click Cancel (취소) button in NTS modal
    const cancelNtsBtn = page.locator('#btn-cancel-nts-print');
    await expect(cancelNtsBtn).toBeVisible();
    await cancelNtsBtn.click();

    // Verify returned back to Student Details Modal
    await expect(detailModal).toBeVisible();
    await expect(detailModal).toContainText('원생 상세 정보');

    // Close the detail modal completely using the header close button
    const closeDetailModalBtn = page.locator('.modal-close').first();
    await expect(closeDetailModalBtn).toBeVisible();
    await closeDetailModalBtn.click();

    // Verify modal is completely closed
    await expect(detailModal).not.toHaveClass(/show/);

    expect(consoleErrors.length).toBe(0);
  });

  test('should automatically return student status from on_leave to attending after end date passes, and skip withdrawn status', async ({ page }) => {
    // 1. Log in as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // 2. Setup: Modify students directly in browser store
    await page.evaluate(() => {
      window.stateStore.db.scheduleSnapshots = [];

      // S1: on_leave, leave periods ended (2026-06-01 ~ 2026-06-10), today 2026-06-15 -> should return to attending
      const s1 = window.stateStore.db.students.find(s => s.id === 'S1');
      if (s1) {
        s1.status = 'on_leave';
        s1.leavePeriods = [{ startDate: '2026-06-01', endDate: '2026-06-10' }];
      }

      // S2: on_leave, leave period active (2026-06-01 ~ 2026-06-30), today 2026-06-15 -> should remain on_leave
      const s2 = window.stateStore.db.students.find(s => s.id === 'S2');
      if (s2) {
        s2.status = 'on_leave';
        s2.leavePeriods = [{ startDate: '2026-06-01', endDate: '2026-06-30' }];
      }

      // S3: on_leave, multiple leave periods (A: 06-01~06-10, B: 06-20~06-30), today 06-15 -> should return to attending
      const s3 = window.stateStore.db.students.find(s => s.id === 'S3');
      if (s3) {
        s3.status = 'on_leave';
        s3.leavePeriods = [
          { startDate: '2026-06-01', endDate: '2026-06-10' },
          { startDate: '2026-06-20', endDate: '2026-06-30' }
        ];
      }

      // S4: withdrawn, leave periods ended (2026-06-01 ~ 2026-06-10), today 06-15 -> should remain withdrawn
      const s4 = window.stateStore.db.students.find(s => s.id === 'S4');
      if (s4) {
        s4.status = 'withdrawn';
        s4.leavePeriods = [{ startDate: '2026-06-01', endDate: '2026-06-10' }];
      }

      window.stateStore.saveDB();
    });

    // 3. Trigger normalization by calling getStudents() inside page
    await page.evaluate(() => {
      // Mock DAYDAY_DEBUG_EVAL_TIME to 2026-06-15
      window.stateStore.db.settings.DAYDAY_DEBUG_EVAL_TIME = '2026-06-15T10:00:00';
      // Reset caching to trigger return logic
      window.stateStore._lastAutoReturnDate = null;
      window.stateStore.getStudents();
    });

    // 4. Assert updated student statuses
    const statuses = await page.evaluate(() => {
      const db = window.stateStore.db;
      return {
        s1Status: db.students.find(s => s.id === 'S1')?.status,
        s2Status: db.students.find(s => s.id === 'S2')?.status,
        s3Status: db.students.find(s => s.id === 'S3')?.status,
        s4Status: db.students.find(s => s.id === 'S4')?.status,
        s1LeavePeriods: db.students.find(s => s.id === 'S1')?.leavePeriods
      };
    });

    expect(statuses.s1Status).toBe('attending');
    expect(statuses.s2Status).toBe('on_leave');
    expect(statuses.s3Status).toBe('attending');
    expect(statuses.s4Status).toBe('withdrawn');
    // Ensure leavePeriods are preserved
    expect(statuses.s1LeavePeriods).toEqual([{ startDate: '2026-06-01', endDate: '2026-06-10' }]);
  });

  test('should verify enrollment adapter compatibility functions', async ({ page }) => {
    // 1. Log in as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // 2. Perform validations on stateStore adapter functions inside browser context
    const adapterResults = await page.evaluate(() => {
      const store = window.stateStore;
      
      const student = store.getStudent('S1');
      if (!student) return { error: 'S1 not found' };

      // Set/Override properties for safe validation
      student.instrument = '피아노';
      student.teacherId = 'T8';
      student.fee = 150000;
      student.dueDay = 10;
      student.defaultClassDuration = 50;

      const legacy = store.getLegacyEnrollmentFromStudent(student);
      const enrollments = store.getStudentEnrollments('S1');
      const primary = store.getPrimaryEnrollment('S1');
      const byId = store.getEnrollmentById('legacy-S1');
      
      const teacherNameFormatted = store.formatEnrollmentTeacherName(legacy);
      const isActive = store.isEnrollmentActive(legacy);

      return {
        legacy,
        enrollments,
        primary,
        byId,
        teacherNameFormatted,
        isActive
      };
    });

    expect(adapterResults.error).toBeUndefined();
    
    // Validate legacy adapter mapping
    const legacy = adapterResults.legacy;
    expect(legacy.id).toBe('legacy-S1');
    expect(legacy.studentId).toBe('S1');
    expect(legacy.subject).toBe('피아노');
    expect(legacy.instrument).toBe('피아노');
    expect(legacy.teacherId).toBe('T8');
    expect(legacy.fee).toBe(150000);
    expect(legacy.dueDay).toBe(10);
    expect(legacy.defaultClassDuration).toBe(50);
    expect(legacy.source).toBe('legacy');
    expect(legacy.isLegacy).toBe(true);

    // Validate list retrieval
    expect(adapterResults.enrollments.length).toBe(1);
    expect(adapterResults.enrollments[0].id).toBe('legacy-S1');

    // Validate primary
    expect(adapterResults.primary.id).toBe('legacy-S1');

    // Validate getEnrollmentById
    expect(adapterResults.byId.id).toBe('legacy-S1');

    // Validate formatEnrollmentTeacherName ('정은비' -> '정은비T')
    expect(adapterResults.teacherNameFormatted).toBe('정은비T');

    // Validate isEnrollmentActive
    expect(adapterResults.isActive).toBe(true);
  });

  test('should display 수강중인 과목 section and cards in student detail modal', async ({ page }) => {
    // 1. Log in as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // 2. Navigate to Student Management Tab
    await page.locator('.menu-item[data-view="dir-students"]').click();
    await expect(page.locator('#page-title')).toContainText('원생 명부 관리');

    // 3. Click first student name link to open detail modal
    const firstStudentLink = page.locator('.student-name-link').first();
    await expect(firstStudentLink).toBeVisible();
    await firstStudentLink.click();
    await expect(page.locator('#common-modal')).toBeVisible();

    const detailModal = page.locator('#common-modal');
    
    // 4. Verify “수강중인 과목” section and description text
    await expect(detailModal).toContainText('수강중인 과목');
    await expect(detailModal).toContainText('기존 등록 정보는 수강과목 카드로 표시됩니다.');

    // 5. Verify legacy flat data displays as virtual enrollment card
    await expect(detailModal).toContainText('월정액');
    await expect(detailModal).toContainText('기본 수업 시간');

    // 6. Verify "수강과목 추가" button is visible
    const addEnrollmentBtn = detailModal.locator('#btn-add-enrollment');
    await expect(addEnrollmentBtn).toBeVisible();
    
    // 7. Click to open the Course Add Modal
    await addEnrollmentBtn.click();
    await page.waitForTimeout(200);

    // Verify modal title
    await expect(detailModal).toContainText('수강과목 추가 등록');

    // Verify default billing type is monthly and sections display properly
    const monthlyRadio = detailModal.locator('input[name="enrollment-billing-type"][value="monthly"]');
    await expect(monthlyRadio).toBeChecked();
    await expect(detailModal.locator('#section-monthly-fields')).toBeVisible();
    await expect(detailModal.locator('#section-session-fields')).toBeHidden();

    // Change billing type to session
    await detailModal.locator('input[name="enrollment-billing-type"][value="session"]').check();
    await expect(detailModal.locator('#section-monthly-fields')).toBeHidden();
    await expect(detailModal.locator('#section-session-fields')).toBeVisible();

    // Verify session pass info text
    await expect(detailModal.locator('#section-session-fields')).toContainText('차감 기준: 출석/지각 확정 시');

    // Select subject and teacher
    await detailModal.locator('#enrollment-subject').selectOption('피아노');
    await detailModal.locator('#enrollment-teacher').selectOption('T8');

    // 8. Test Session Pass Validation: Remaining count > Total count
    await detailModal.locator('#enrollment-total-count').fill('10');
    await detailModal.locator('#enrollment-remaining-count').fill('15');

    let alertMsg = '';
    page.once('dialog', async dialog => {
      alertMsg = dialog.message();
      await dialog.accept();
    });
    await detailModal.locator('#btn-submit-enrollment-modal').click();
    expect(alertMsg).toBe('잔여 횟수는 총 횟수를 초과할 수 없습니다.');

    // 9. Correct the inputs and click submit (actual save for session_pass)
    await detailModal.locator('#enrollment-remaining-count').fill('10');

    let saveAlertMsg = '';
    page.once('dialog', async dialog => {
      saveAlertMsg = dialog.message();
      await dialog.accept();
    });
    await detailModal.locator('#btn-submit-enrollment-modal').click();
    await page.waitForTimeout(400);
    expect(saveAlertMsg).toBe('수강과목이 추가되었습니다.');

    // Verify details modal is restored and updated with new course card
    await expect(detailModal).toBeVisible();
    await expect(detailModal).toContainText('수강중인 과목');
    await expect(detailModal).toContainText('횟수제 수강권');
    await expect(detailModal).toContainText('피아노');
    
    // Since formal enrollment is created, legacy fallback is not shown.
    await expect(detailModal).not.toContainText('수업 방식: 월정액'); // legacy fallback card disappeared!

    // Verify db.enrollments and db.sessionPasses state inside browser context
    const stateCheck = await page.evaluate(() => {
      const store = window.stateStore;
      const studentId = store.db.students.filter(s => !s.isDeleted)[0]?.id;
      if (!studentId) return { error: 'Student not found' };

      const enrollments = store.getStudentEnrollments(studentId);
      const sessionPasses = store.db.sessionPasses || [];
      const student = store.getStudent(studentId);

      return {
        enrollments,
        sessionPassesCount: sessionPasses.length,
        studentFlatFields: {
          instrument: student.instrument,
          fee: student.fee
        }
      };
    });

    expect(stateCheck.error).toBeUndefined();
    expect(stateCheck.enrollments.length).toBe(1);
    expect(stateCheck.enrollments[0].courseType).toBe('session_pass');
    expect(stateCheck.enrollments[0].ticketName).toBe('횟수제 수강권');
    expect(stateCheck.enrollments[0].totalSessions).toBe(10);
    expect(stateCheck.enrollments[0].remainingSessions).toBe(10);
    expect(stateCheck.studentFlatFields.instrument).toBe('피아노');
    expect(stateCheck.sessionPassesCount).toBe(0);

    // Close modal
    await page.locator('[data-close-modal]').first().click();
    await expect(page.locator('#common-modal')).not.toHaveClass(/show/);
  });

  test('should verify db.enrollments Storage APIs', async ({ page }) => {
    // 1. Log in as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // 2. Execute validations on stateStore APIs inside browser context
    const testResults = await page.evaluate(() => {
      const store = window.stateStore;

      // 0. Ensure clean enrollment collection
      store.ensureEnrollmentsCollection();
      
      // Filter out S1 enrollments to start clean
      store.db.enrollments = store.db.enrollments.filter(e => e.studentId !== 'S1');
      store.saveDB();

      const results = {};

      // 1. createEnrollment
      const createRes1 = store.createEnrollment('S1', {
        subjectName: '바이올린',
        courseType: 'monthly',
        fee: 200000,
        dueDay: 15,
        defaultDurationMinutes: 60,
        startDate: '2026-06-01'
      });
      results.createRes1 = createRes1;
      
      const createdId = createRes1.data.id;

      // 2. getStudentEnrollments (should return formal list, not legacy fallback)
      const listAfterCreate = store.getStudentEnrollments('S1');
      results.listAfterCreateLength = listAfterCreate.length;
      results.listAfterCreateSource = listAfterCreate[0]?.source;
      results.listAfterCreateId = listAfterCreate[0]?.id;

      // 3. getPrimaryEnrollment
      const primaryAfterCreate = store.getPrimaryEnrollment('S1');
      results.primaryAfterCreateId = primaryAfterCreate?.id;
      results.primaryAfterCreateSubject = primaryAfterCreate?.subjectName;

      // 4. Student Flat Field Mirroring
      const studentS1 = store.getStudent('S1');
      results.mirroredFlatFields = {
        instrument: studentS1.instrument,
        fee: studentS1.fee,
        dueDay: studentS1.dueDay,
        defaultClassDuration: studentS1.defaultClassDuration,
        className: studentS1.className,
        classGroup: studentS1.classGroup
      };

      // 5. Legacy Update / Delete restriction
      const legacyUpdateRes = store.updateEnrollment('legacy-S1', { fee: 999999 });
      results.legacyUpdateRes = legacyUpdateRes;
      results.studentFeeAfterLegacyUpdate = store.getStudent('S1').fee;

      const legacyDeleteRes = store.deleteEnrollment('legacy-S1');
      results.legacyDeleteRes = legacyDeleteRes;

      // 6. updateEnrollment
      const updateRes = store.updateEnrollment(createdId, { fee: 250000 });
      results.updateRes = updateRes;
      results.mirroredFeeAfterUpdate = store.getStudent('S1').fee;

      // 7. deleteEnrollment (soft delete)
      const deleteRes = store.deleteEnrollment(createdId);
      results.deleteRes = deleteRes;
      
      const dbRecord = store.db.enrollments.find(e => e.id === createdId);
      results.softDeletedStatus = dbRecord?.status;
      results.hasDeletedAt = !!dbRecord?.deletedAt;

      // 8. getStudentEnrollments when all are archived (should return empty list, NOT fallback to legacy)
      const listAfterDelete = store.getStudentEnrollments('S1');
      results.listAfterDeleteLength = listAfterDelete.length;
      
      // 9. Flat fields should be preserved even when primary enrollment is gone
      const studentS1AfterDelete = store.getStudent('S1');
      results.mirroredFeeAfterDelete = studentS1AfterDelete.fee;

      // 10. getPrimaryEnrollment priority test
      store.db.enrollments = store.db.enrollments.filter(e => e.studentId !== 'S1');
      
      const resSess = store.createEnrollment('S1', {
        subjectName: '첼로',
        courseType: 'session_pass',
        status: 'attending',
        startDate: '2026-06-10',
        fee: 300000
      });
      const idSess = resSess.data.id;
      
      const resMonth = store.createEnrollment('S1', {
        subjectName: '피아노',
        courseType: 'monthly',
        status: 'attending',
        startDate: '2026-06-05',
        fee: 180000
      });
      const idMonth = resMonth.data.id;

      const resEnded = store.createEnrollment('S1', {
        subjectName: '플루트',
        courseType: 'monthly',
        status: 'ended',
        startDate: '2026-06-20',
        fee: 150000
      });
      const idEnded = resEnded.data.id;

      const primaryPriority1 = store.getPrimaryEnrollment('S1');
      results.primaryPriority1Id = primaryPriority1?.id;
      results.primaryPriority1Subject = primaryPriority1?.subjectName;

      store.deleteEnrollment(idMonth);

      const primaryPriority2 = store.getPrimaryEnrollment('S1');
      results.primaryPriority2Id = primaryPriority2?.id;
      results.primaryPriority2Subject = primaryPriority2?.subjectName;

      // 11. ID Generation Scanning (scan ENR_숫자 pattern)
      store.db.enrollments.push({
        id: 'ENR_150',
        studentId: 'S2',
        source: 'manual',
        status: 'attending',
        courseType: 'monthly',
        createdAt: new Date().toISOString()
      });
      store.saveDB();

      const newIdRes = store.createEnrollment('S1', {
        subjectName: '기타',
        courseType: 'monthly'
      });
      results.newIdGenerated = newIdRes.data.id;

      return results;
    });

    // Asserts
    expect(testResults.createRes1.ok).toBe(true);
    expect(testResults.createRes1.data.id).toMatch(/^ENR_\d+$/);

    expect(testResults.listAfterCreateLength).toBe(1);
    expect(testResults.listAfterCreateSource).toBe('manual');
    expect(testResults.listAfterCreateId).toBe(testResults.createRes1.data.id);

    expect(testResults.primaryAfterCreateId).toBe(testResults.createRes1.data.id);
    expect(testResults.primaryAfterCreateSubject).toBe('바이올린');

    // Flat field mirroring check
    expect(testResults.mirroredFlatFields.instrument).toBe('바이올린');
    expect(testResults.mirroredFlatFields.fee).toBe(200000);
    expect(testResults.mirroredFlatFields.dueDay).toBe(15);
    expect(testResults.mirroredFlatFields.defaultClassDuration).toBe(60);

    // Legacy update/delete check
    expect(testResults.legacyUpdateRes.ok).toBe(false);
    expect(testResults.legacyUpdateRes.reason).toBe('legacy_readonly');
    expect(testResults.studentFeeAfterLegacyUpdate).toBe(200000);

    expect(testResults.legacyDeleteRes.ok).toBe(false);
    expect(testResults.legacyDeleteRes.reason).toBe('legacy_readonly');

    // updateEnrollment check
    expect(testResults.updateRes.ok).toBe(true);
    expect(testResults.updateRes.data.fee).toBe(250000);
    expect(testResults.mirroredFeeAfterUpdate).toBe(250000);

    // deleteEnrollment check
    expect(testResults.deleteRes.ok).toBe(true);
    expect(testResults.softDeletedStatus).toBe('archived');
    expect(testResults.hasDeletedAt).toBe(true);

    // Empty list on all archived, no legacy fallback
    expect(testResults.listAfterDeleteLength).toBe(0);

    // Flat fields preserved
    expect(testResults.mirroredFeeAfterDelete).toBe(250000);

    // Primary priority checks
    expect(testResults.primaryPriority1Subject).toBe('피아노');
    expect(testResults.primaryPriority2Subject).toBe('플루트');

    // ID generation scanning check
    expect(testResults.newIdGenerated).toBe('ENR_151');
  });

  test('should verify monthly course add and save integration', async ({ page }) => {
    // 1. Log in as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // 2. Navigate to Student Tab
    await page.locator('.menu-item[data-view="dir-students"]').click();
    await expect(page.locator('#page-title')).toContainText('원생 명부 관리');

    // 3. Click first student name link to open details modal
    const firstStudentLink = page.locator('.student-name-link').first();
    await expect(firstStudentLink).toBeVisible();
    await firstStudentLink.click();
    await expect(page.locator('#common-modal')).toBeVisible();

    const detailModal = page.locator('#common-modal');
    
    // 4. Click 수강과목 추가
    const addEnrollmentBtn = detailModal.locator('#btn-add-enrollment');
    await expect(addEnrollmentBtn).toBeVisible();
    await addEnrollmentBtn.click();
    await page.waitForTimeout(200);

    // 5. Verify and fill in monthly course details
    await expect(detailModal).toContainText('수강과목 추가 등록');
    await detailModal.locator('#enrollment-subject').selectOption('피아노');
    await detailModal.locator('#enrollment-teacher').selectOption('T8');
    await detailModal.locator('#enrollment-fee').fill('180000');
    await detailModal.locator('#enrollment-due-day').fill('25');

    // 6. Submit form and verify alert
    let saveAlertMsg = '';
    page.once('dialog', async dialog => {
      saveAlertMsg = dialog.message();
      await dialog.accept();
    });
    await detailModal.locator('#btn-submit-enrollment-modal').click();
    await page.waitForTimeout(400);
    expect(saveAlertMsg).toBe('수강과목이 추가되었습니다.');

    // 7. Verify modal restored and displays new card
    await expect(detailModal).toBeVisible();
    await expect(detailModal).toContainText('수강중인 과목');
    await expect(detailModal).toContainText('월정액');
    await expect(detailModal).toContainText('피아노');

    // 8. Verify state store inside browser context
    const stateCheck = await page.evaluate(() => {
      const store = window.stateStore;
      const studentId = store.db.students[0]?.id;
      if (!studentId) return { error: 'No student found' };

      const enrollments = store.getStudentEnrollments(studentId);
      const student = store.getStudent(studentId);

      return {
        enrollments,
        studentFlatFields: {
          instrument: student.instrument,
          fee: student.fee,
          dueDay: student.dueDay
        }
      };
    });

    expect(stateCheck.error).toBeUndefined();
    expect(stateCheck.enrollments.length).toBe(1);
    expect(stateCheck.enrollments[0].courseType).toBe('monthly');
    expect(stateCheck.enrollments[0].fee).toBe(180000);
    expect(stateCheck.enrollments[0].dueDay).toBe(25);
    expect(stateCheck.studentFlatFields.instrument).toBe('피아노');
    expect(stateCheck.studentFlatFields.fee).toBe(180000);
    expect(stateCheck.studentFlatFields.dueDay).toBe(25);

    // Close modal
    await page.locator('[data-close-modal]').first().click();
    await expect(page.locator('#common-modal')).not.toHaveClass(/show/);
  });

  test('should verify db.classes schedule helper APIs', async ({ page }) => {
    // 1. Log in as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });

    // 2. Perform validations on stateStore helper functions inside browser context
    const testResults = await page.evaluate(() => {
      const store = window.stateStore;

      // Ensure fresh state for testing
      store.ensureEnrollmentsCollection();
      
      // Filter out test student enrollments/classes to start clean
      store.db.enrollments = store.db.enrollments.filter(e => e.studentId !== 'S1');
      store.db.classes = store.db.classes.filter(c => c.studentId !== 'S1');
      
      // S1 student flat field mock settings
      const student = store.getStudent('S1');
      if (student) {
        student.instrument = '드럼';
        student.teacherId = 'T8';
        student.defaultClassDuration = 45;
      }
      
      store.saveDB();

      const results = {};

      // Test 1: getClassEnrollment on legacy
      // legacy class (no enrollmentId)
      const legacyClass = { id: 'C999', studentId: 'S1', dayOfWeek: '화', time: '15:00' };
      const legacyEnrollment = store.getClassEnrollment(legacyClass);
      results.legacyEnrollment = {
        id: legacyEnrollment?.id,
        subject: legacyEnrollment?.subject,
        source: legacyEnrollment?.source,
        isLegacy: legacyEnrollment?.isLegacy
      };

      // Test 2: createClassForEnrollment with legacy enrollment - should block
      const legacyCreateRes = store.createClassForEnrollment('legacy-S1', { dayOfWeek: '목', time: '17:00' });
      results.legacyCreateRes = legacyCreateRes;

      // Test 3: createClassForEnrollment with invalid/non-existent enrollment - should block
      const invalidCreateRes = store.createClassForEnrollment('non-existent-id', { dayOfWeek: '목', time: '17:00' });
      results.invalidCreateRes = invalidCreateRes;

      // Test 4: createClassForEnrollment with a valid formal enrollment
      const formalEnrollmentRes = store.createEnrollment('S1', {
        subjectName: '바이올린',
        courseType: 'monthly',
        fee: 220000,
        dueDay: 10,
        defaultDurationMinutes: 60,
        teacherId: 'T8',
        startDate: '2026-06-01'
      });
      const formalEnrollmentId = formalEnrollmentRes.data.id;
      results.formalEnrollmentId = formalEnrollmentId;

      // Now create class for this formal enrollment
      const classRes1 = store.createClassForEnrollment(formalEnrollmentId, {
        dayOfWeek: '화',
        time: '14:00',
        durationMinutes: 60,
        teacherId: 'T8'
      });
      results.class1 = classRes1.ok ? {
        id: classRes1.data.id,
        studentId: classRes1.data.studentId,
        enrollmentId: classRes1.data.enrollmentId,
        dayOfWeek: classRes1.data.dayOfWeek,
        time: classRes1.data.time,
        durationMinutes: classRes1.data.durationMinutes,
        teacherId: classRes1.data.teacherId
      } : null;

      // Test 5: getClassEnrollment on formal class
      const formalClassEnrollment = store.getClassEnrollment(classRes1.data);
      results.formalClassEnrollment = {
        id: formalClassEnrollment?.id,
        subjectName: formalClassEnrollment?.subjectName,
        source: formalClassEnrollment?.source
      };

      // Test 6: Fallbacks in createClassForEnrollment (e.g. use enrollment's teacherId and durationMinutes when omitted)
      const classRes2 = store.createClassForEnrollment(formalEnrollmentId, {
        dayOfWeek: '목',
        time: '16:00'
      });
      results.class2 = classRes2.ok ? {
        id: classRes2.data.id,
        durationMinutes: classRes2.data.durationMinutes,
        teacherId: classRes2.data.teacherId
      } : null;

      // Test 7: Sorting and listing
      store.createClassForEnrollment(formalEnrollmentId, { dayOfWeek: '화', time: '10:00' });
      store.createClassForEnrollment(formalEnrollmentId, { dayOfWeek: '월', time: '13:00' });

      const sortedClassesByEnrollment = store.getClassesByEnrollmentId(formalEnrollmentId);
      results.sortedClassesByEnrollment = sortedClassesByEnrollment.map(c => `${c.dayOfWeek} ${c.time}`);

      const sortedClassesByStudent = store.getClassesByStudentId('S1');
      results.sortedClassesByStudent = sortedClassesByStudent.map(c => `${c.dayOfWeek} ${c.time}`);

      // Test 8: replaceClassesForEnrollment
      const replaceRes = store.replaceClassesForEnrollment(formalEnrollmentId, [
        { dayOfWeek: '수', time: '11:00', durationMinutes: 50 },
        { dayOfWeek: '금', time: '15:00' }
      ]);
      results.replaceRes = {
        ok: replaceRes.ok,
        archivedCount: replaceRes.archivedCount,
        createdCount: replaceRes.created?.length
      };

      // Check current non-archived classes for formalEnrollmentId
      const activeClassesAfterReplace = store.getClassesByEnrollmentId(formalEnrollmentId);
      results.activeClassesAfterReplace = activeClassesAfterReplace.map(c => `${c.dayOfWeek} ${c.time}`);

      // Check all classes including archived (options.includeArchived = true)
      const allClassesAfterReplace = store.getClassesByEnrollmentId(formalEnrollmentId, { includeArchived: true });
      results.allClassesAfterReplaceLength = allClassesAfterReplace.length;
      results.archivedClassesCount = allClassesAfterReplace.filter(c => c.status === 'archived').length;

      // Test 9: replaceClassesForEnrollment on legacy - should block
      const legacyReplaceRes = store.replaceClassesForEnrollment('legacy-S1', [
        { dayOfWeek: '토', time: '10:00' }
      ]);
      results.legacyReplaceRes = legacyReplaceRes;

      return results;
    });

    // Asserts
    expect(testResults.legacyEnrollment.id).toBe('legacy-S1');
    expect(testResults.legacyEnrollment.source).toBe('legacy');
    expect(testResults.legacyEnrollment.isLegacy).toBe(true);

    expect(testResults.legacyCreateRes.ok).toBe(false);
    expect(testResults.legacyCreateRes.reason).toBe('invalid_enrollment');

    expect(testResults.invalidCreateRes.ok).toBe(false);
    expect(testResults.invalidCreateRes.reason).toBe('invalid_enrollment');

    expect(testResults.class1).not.toBeNull();
    expect(testResults.class1.id).toMatch(/^C\d+$/);
    expect(testResults.class1.studentId).toBe('S1');
    expect(testResults.class1.enrollmentId).toBe(testResults.formalEnrollmentId);
    expect(testResults.class1.dayOfWeek).toBe('화');
    expect(testResults.class1.time).toBe('14:00');
    expect(testResults.class1.durationMinutes).toBe(60);
    expect(testResults.class1.teacherId).toBe('T8');

    expect(testResults.formalClassEnrollment.id).toBe(testResults.formalEnrollmentId);
    expect(testResults.formalClassEnrollment.source).toBe('manual');
    expect(testResults.formalClassEnrollment.subjectName).toBe('바이올린');

    // Fallbacks check
    expect(testResults.class2.durationMinutes).toBe(60); // from enrollment
    expect(testResults.class2.teacherId).toBe('T8'); // from enrollment

    // Sorting check (월 13:00, 화 10:00, 화 14:00, 목 16:00)
    expect(testResults.sortedClassesByEnrollment).toEqual([
      '월 13:00',
      '화 10:00',
      '화 14:00',
      '목 16:00'
    ]);
    expect(testResults.sortedClassesByStudent).toEqual([
      '월 13:00',
      '화 10:00',
      '화 14:00',
      '목 16:00'
    ]);

    // Replace check
    expect(testResults.replaceRes.ok).toBe(true);
    expect(testResults.replaceRes.archivedCount).toBe(4);
    expect(testResults.replaceRes.createdCount).toBe(2);

    expect(testResults.activeClassesAfterReplace).toEqual([
      '수 11:00',
      '금 15:00'
    ]);
    expect(testResults.allClassesAfterReplaceLength).toBe(6); // 4 archived + 2 active
    expect(testResults.archivedClassesCount).toBe(4);

    expect(testResults.legacyReplaceRes.ok).toBe(false);
    expect(testResults.legacyReplaceRes.reason).toBe('invalid_enrollment');
  });
});
