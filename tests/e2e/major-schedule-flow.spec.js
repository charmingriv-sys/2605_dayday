import { test, expect } from '@playwright/test';

// NodeJS runner Date mocking to match June 4, 2026 KST (mockup today date)
const mockTime = new Date('2026-06-04T09:00:00+09:00').getTime();
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

test.describe('Director Major Schedule CRUD & Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the browser date to 2026-06-04 09:00:00 KST
    await page.addInitScript(() => {
      const mockTime = new Date('2026-06-04T09:00:00+09:00').getTime();
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

    // Navigate and login as director
    await page.goto('/');
    await page.locator('.role-btn.director').click();
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
  });

  test('should verify major schedule CRUD and layout adjustments', async ({ page }) => {
    // 1. Click "주요일정관리" menu item in the sidebar
    const menuItem = page.locator('.menu-item[data-view="dir-major-schedule"]');
    await expect(menuItem).toBeVisible();
    await menuItem.click();

    // 2. Assert page title has changed to "주요일정 관리"
    const pageTitle = page.locator('#page-title');
    await expect(pageTitle).toBeVisible();
    await expect(pageTitle).toContainText('주요일정 관리');

    // 3. Assert status filter is NOT present
    const statusFilter = page.locator('#statusFilter');
    await expect(statusFilter).not.toBeVisible();

    // 4. Assert "주요일정보기" table columns (no '상태', '미처리', '일자' -> '진행/종료일')
    const eventViewBtn = page.locator('#eventViewBtn');
    await expect(eventViewBtn).toBeVisible();
    await eventViewBtn.click();
    
    const eventHeaders = page.locator('#eventHead th');
    const expectedEventHeaders = ['일정', '구분', '진행/종료일', 'D-day', '포함 원생', '담당자', '공개', '확인'];
    await expect(eventHeaders).toHaveCount(expectedEventHeaders.length);
    for (let i = 0; i < expectedEventHeaders.length; i++) {
        await expect(eventHeaders.nth(i)).toHaveText(expectedEventHeaders[i]);
    }

    // 5. Assert "일정참여학생보기" table columns (no '일자' -> '진행/종료일')
    const participantViewBtn = page.locator('#participantViewBtn');
    await expect(participantViewBtn).toBeVisible();
    await participantViewBtn.click();

    const participantHeaders = page.locator('#eventHead th');
    const expectedParticipantHeaders = ['참여 원생', '관련 일정', '구분', '진행/종료일', 'D-day', '다가오는 수업', '담당자', '메모', '확인'];
    await expect(participantHeaders).toHaveCount(expectedParticipantHeaders.length);
    for (let i = 0; i < expectedParticipantHeaders.length; i++) {
        await expect(participantHeaders.nth(i)).toHaveText(expectedParticipantHeaders[i]);
    }

    // Switch back to event view
    await eventViewBtn.click();

    // 6. Test Adding Major Schedule & validation error display
    const addTrigger = page.locator('button:text-is("일정 추가")');
    await expect(addTrigger).toBeVisible();
    await addTrigger.click();

    const drawer = page.locator('#drawer');
    await expect(drawer).toHaveClass(/open/);

    // Assert 주요정보 입력 text is not present in header
    await expect(drawer.locator('#drawerHead')).not.toContainText('주요정보 입력');

    // Save initially without filling required fields to trigger validation
    const saveBtn = page.locator('#btn-form-save');
    await saveBtn.click();

    // Should display validation error text in drawer
    const errorText = page.locator('#drawer-error-msg');
    await expect(errorText).toBeVisible();
    await expect(errorText).toContainText('필수값을 모두 입력하세요');

    // Fill form fields
    await page.locator('#form-event-name').fill('E2E 테스트 일정');
    await page.locator('#form-event-type').selectOption('etc'); // '기타'
    await page.locator('#form-event-date').fill('2026-06-20');
    await page.locator('#form-due-date').fill('2026-06-15');
    await page.locator('#form-owner-id').selectOption('정은비');
    await page.locator('#form-place').fill('대강당');
    await page.locator('#form-memo').fill('원생 0명 테스트');

    // Verify search input in participant selection
    const searchInput = page.locator('#form-participant-search');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute('placeholder', '원생명, 회원번호, 초성 검색');

    // Initially multiple student checkboxes should be rendered
    const listLabels = page.locator('#form-participants-list label');
    const initialCount = await listLabels.count();
    expect(initialCount).toBeGreaterThan(10);

    // Type "최다은" and check if it filters instantly to 1 label
    await searchInput.fill('최다은');
    await page.waitForTimeout(100);
    await expect(listLabels).toHaveCount(1);
    await expect(listLabels.first()).toContainText('최다은');

    // Check the box for "최다은" (S1)
    const s1Checkbox = page.locator('#form-participants-list input[value="S1"]');
    await s1Checkbox.check();

    // Search with 초성 "ㄱㅅㅎ" (고승현) and verify filtering
    await searchInput.fill('ㄱㅅㅎ');
    await page.waitForTimeout(100);
    await expect(listLabels).toHaveCount(1);
    await expect(listLabels.first()).toContainText('고승현');

    // Clear search and verify original count restored and "최다은" remains checked
    await searchInput.fill('');
    await page.waitForTimeout(100);
    await expect(listLabels).toHaveCount(initialCount);
    await expect(s1Checkbox).toBeChecked();

    // Default visible should be OFF
    const visibleToggle = page.locator('#form-visible-toggle');
    await expect(visibleToggle).toContainText('학부모/원생 공개 OFF');

    // Save with 1 participant (S1)
    await saveBtn.click();
    await expect(drawer).not.toHaveClass(/open/);

    // Assert KPI cards updated: "이번 달 주요 일정" increases (was 6, now 7)
    const kpiEvents = page.locator('#kpiEvents');
    await expect(kpiEvents).toContainText('7');

    // Assert newly created event is rendered in table and strip
    const newEventRow = page.locator('#eventBody tr:has-text("E2E 테스트 일정")');
    await expect(newEventRow).toBeVisible();
    await expect(newEventRow.locator('td').nth(2)).toContainText('6.20(토)'); // eventDate formatted
    await expect(newEventRow.locator('td').nth(6)).toContainText('비공개'); // visible: false

    const newEventCard = page.locator('#eventStrip .event-card:has-text("E2E 테스트 일정")');
    await expect(newEventCard).toBeVisible();
    await expect(newEventCard.locator('.dday')).toContainText('일정 D-16');

    // 7. Verify "기타" filter tab works
    const typeTabs = page.locator('#typeTabs');
    const etcTab = typeTabs.locator('button:text-is("기타")');
    await etcTab.click();
    await expect(page.locator('#eventStrip .event-card')).toHaveCount(1);
    await expect(page.locator('#eventStrip .event-card')).toContainText('E2E 테스트 일정');

    // Reset filter to "전체"
    await typeTabs.locator('button:text-is("전체")').click();

    // 8. Verify updating the event (including visible ON toggle confirm)
    await newEventRow.click(); // Open event detail drawer
    await expect(drawer).toHaveClass(/open/);
    await expect(drawer.locator('#drawerHead')).toContainText('E2E 테스트 일정');

    const editTrigger = page.locator('#btn-drawer-edit');
    await expect(editTrigger).toBeVisible();
    await editTrigger.click(); // Switch to edit mode

    // Check prefilled values
    await expect(page.locator('#form-event-name')).toHaveValue('E2E 테스트 일정');
    await expect(page.locator('#form-event-type')).toHaveValue('etc');
    await expect(page.locator('#form-event-date')).toHaveValue('2026-06-20');
    await expect(page.locator('#form-due-date')).toHaveValue('2026-06-15');
    await expect(page.locator('#form-owner-id')).toHaveValue('정은비');
    await expect(page.locator('#form-place')).toHaveValue('대강당');
    await expect(page.locator('#form-memo')).toHaveValue('원생 0명 테스트');

    // Toggle public visibility to ON. This must trigger confirm dialog.
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('학부모/원생에게 공개 상태로 저장할까요?');
      await dialog.accept();
    });
    await visibleToggle.click();

    await expect(visibleToggle).toContainText('학부모/원생 공개 ON');

    // Edit title
    await page.locator('#form-event-name').fill('E2E 테스트 일정 수정됨');

    // Check checkboxes inside participant list - S1 should already be checked
    const student1Checkbox = page.locator('#form-participants-list input[value="S1"]');
    const student2Checkbox = page.locator('#form-participants-list input[value="S2"]');
    await expect(student1Checkbox).toBeChecked();
    await student2Checkbox.check();

    // Save edit
    await saveBtn.click();
    await expect(drawer).not.toHaveClass(/open/);

    // Verify updated details in table
    const updatedEventRow = page.locator('#eventBody tr:has-text("E2E 테스트 일정 수정됨")');
    await expect(updatedEventRow).toBeVisible();
    await expect(updatedEventRow.locator('td').nth(4)).toContainText('2명'); // 2 participants now
    await expect(updatedEventRow.locator('td').nth(6)).toContainText('학부모 공개');

    // 9. Verify deleting the event
    await updatedEventRow.click(); // Open detail
    await expect(drawer).toHaveClass(/open/);

    const deleteTrigger = page.locator('#btn-drawer-delete');
    await expect(deleteTrigger).toBeVisible();

    // Delete triggers confirm
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('삭제할까요?');
      await dialog.accept();
    });
    await deleteTrigger.click();

    // Drawer should close, row should disappear, and KPI count should reset to 6
    await expect(drawer).not.toHaveClass(/open/);
    await expect(updatedEventRow).not.toBeVisible();
    await expect(kpiEvents).toContainText('6');
  });

  test('should verify student drawer layout, memo CRUD, and footer action buttons', async ({ page }) => {
    // 1. Click "주요일정관리" menu item in the sidebar
    const menuItem = page.locator('.menu-item[data-view="dir-major-schedule"]');
    await expect(menuItem).toBeVisible();
    await menuItem.click();

    // 2. Click "일정참여학생보기" tab
    const participantViewBtn = page.locator('#participantViewBtn');
    await expect(participantViewBtn).toBeVisible();
    await participantViewBtn.click();

    // 3. Click the first row (S1: 최다은) to open student drawer
    const s1Row = page.locator('#eventBody tr:has-text("최다은")').first();
    await expect(s1Row).toBeVisible();
    await s1Row.click();

    const drawer = page.locator('#drawer');
    await expect(drawer).toHaveClass(/open/);

    // 4. Assert first section title is "메모" and "학원 등록 메모" is NOT present
    const firstSectionHeader = drawer.locator('.drawer-section.memo-section h3');
    await expect(firstSectionHeader).toBeVisible();
    await expect(firstSectionHeader).toHaveText('메모');
    await expect(drawer).not.toContainText('학원 등록 메모');

    // Verify upcoming lessons, related events, and 3 footer buttons are present
    const upcomingHeader = drawer.locator('h3:text-is("다가오는 수업")');
    await expect(upcomingHeader).toBeVisible();
    
    const relatedHeader = drawer.locator('h3:text-is("관련 일정")');
    await expect(relatedHeader).toBeVisible();

    const memoBtn = page.locator('#btn-student-memo');
    const lessonBtn = page.locator('#btn-student-lesson');
    const messageBtn = page.locator('#btn-student-message');
    const closeBtn = page.locator('#btn-student-close');

    await expect(memoBtn).toBeVisible();
    await expect(lessonBtn).toBeVisible();
    await expect(messageBtn).toBeVisible();
    await expect(closeBtn).toBeVisible();

    // 5. Test note CRUD inside student drawer
    // A. Click "메모" button to open inline note form
    await memoBtn.click();
    
    const memoForm = drawer.locator('#memo-form-area');
    await expect(memoForm).toBeVisible();

    const memoInput = drawer.locator('#memo-input');
    const memoSaveBtn = drawer.locator('#btn-memo-save');
    const memoError = drawer.locator('#memo-error-msg');

    // Test validation: try to save empty memo
    await memoInput.fill('   ');
    await memoSaveBtn.click();
    await expect(memoError).toBeVisible();
    await expect(memoError).toContainText('메모 내용을 입력해 주세요.');

    // Save valid memo
    await memoInput.fill('E2E 테스트 신규 메모');
    await memoSaveBtn.click();

    // Memo form should hide and list should update instantly
    await expect(memoForm).not.toBeVisible();
    const newMemoItem = drawer.locator('.memo-item:has-text("E2E 테스트 신규 메모")');
    await expect(newMemoItem).toBeVisible();

    // Verify registration date is displayed as bold and is NOT the word "메모"
    const boldHeader = newMemoItem.locator('strong');
    await expect(boldHeader).toHaveText('06-04 09:00');
    await expect(boldHeader).not.toHaveText('메모');

    // B. Edit note
    await newMemoItem.click(); // toggle open memo actions
    const editNoteBtn = newMemoItem.locator('.btn-edit-note');
    await expect(editNoteBtn).toBeVisible();
    await editNoteBtn.click();

    await expect(memoForm).toBeVisible();
    await expect(memoInput).toHaveValue('E2E 테스트 신규 메모');
    await memoInput.fill('E2E 테스트 수정된 메모');
    await memoSaveBtn.click();

    await expect(memoForm).not.toBeVisible();
    const updatedMemoItem = drawer.locator('.memo-item:has-text("E2E 테스트 수정된 메모")');
    await expect(updatedMemoItem).toBeVisible();

    // C. Delete note
    await updatedMemoItem.click(); // toggle open
    const deleteNoteBtn = updatedMemoItem.locator('.btn-delete-note');
    await expect(deleteNoteBtn).toBeVisible();

    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('이 메모를 삭제할까요?');
      await dialog.accept();
    });
    await deleteNoteBtn.click();
    await expect(updatedMemoItem).not.toBeVisible();

    // 6. Verify Lesson Scheduling Button (clicks and triggers alert only)
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('레슨편성 연결 방식은 검토 중입니다.');
      await dialog.accept();
    });
    await lessonBtn.click();

    // Drawer should remain open and active sidebar view should NOT switch
    await expect(drawer).toBeVisible();
    const majorScheduleMenuItem = page.locator('.menu-item[data-view="dir-major-schedule"]');
    await expect(majorScheduleMenuItem).toHaveClass(/active/);

    // 7. Verify Message Button (clicks and triggers alert only)
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('메시지 기능은 추후 학부모 소통 화면과 연결 예정입니다.');
      await dialog.accept();
    });
    await messageBtn.click();

    // Drawer should remain open and active sidebar view should NOT switch
    await expect(drawer).toBeVisible();
    await expect(majorScheduleMenuItem).toHaveClass(/active/);

    // 8. Verify no message side effects (no messages created in database)
    const messagesCount = await page.evaluate(() => {
      return (window.stateStore.db.messages || []).length;
    });
    expect(messagesCount).toBe(2); // Initial seed count is 2

    // Clean up: close the drawer using the close button
    await page.locator('#btn-drawer-close').click();
    await expect(drawer).not.toHaveClass(/open/);
  });

  test('should verify main page search target policies, chosung search, and exact member ID match', async ({ page }) => {
    // 1. Click "주요일정관리" menu item in the sidebar
    const menuItem = page.locator('.menu-item[data-view="dir-major-schedule"]');
    await expect(menuItem).toBeVisible();
    await menuItem.click();

    // Verify main search input placeholder
    const mainSearchInput = page.locator('#searchInput');
    await expect(mainSearchInput).toBeVisible();
    await expect(mainSearchInput).toHaveAttribute('placeholder', '일정명, 장소, 원생명, 초성, 악기, 회원번호, 담당자 검색');

    // Make sure we are in "주요일정보기" (Event View) first
    const eventViewBtn = page.locator('#eventViewBtn');
    await eventViewBtn.click();

    // A. Event Name search: "피아노 콩쿠르"
    await mainSearchInput.fill('피아노 콩쿠르');
    // Expect only "한국청소년 피아노 콩쿠르" to be visible
    await expect(page.locator('#eventBody tr')).toHaveCount(1);
    await expect(page.locator('#eventBody tr')).toContainText('한국청소년 피아노 콩쿠르');

    // B. Place search: "예술의전당"
    await mainSearchInput.fill('예술의전당');
    await expect(page.locator('#eventBody tr')).toHaveCount(1);
    await expect(page.locator('#eventBody tr')).toContainText('한국청소년 피아노 콩쿠르');

    // C. Student Name search: "김제나"
    await mainSearchInput.fill('김제나');
    // 김제나 (S2) participates in "영 첼리스트 콩쿠르" and "6월 결석자 보강 편성"
    await expect(page.locator('#eventBody tr')).toHaveCount(2);
    await expect(page.locator('#eventBody tr').nth(0)).toContainText('6월 결석자 보강 편성');
    await expect(page.locator('#eventBody tr').nth(1)).toContainText('영 첼리스트 콩쿠르');

    // D. Chosung search: "ㅊㄷㅇ" -> 최다은 (S1)
    await mainSearchInput.fill('ㅊㄷㅇ');
    // 최다은 participates in "한국청소년 피아노 콩쿠르" and "여름 정기 음악회"
    await expect(page.locator('#eventBody tr')).toHaveCount(2);
    await expect(page.locator('#eventBody tr').nth(0)).toContainText('한국청소년 피아노 콩쿠르');
    await expect(page.locator('#eventBody tr').nth(1)).toContainText('여름 정기 음악회');

    // E. Instrument search: "오보에" -> 박수호 (S3), 채은재 (S5)
    // S3 -> "예원학교 입시 실기고사", "입시반 학부모 상담 주간"
    // S5 -> "한국청소년 피아노 콩쿠르"
    await mainSearchInput.fill('오보에');
    await expect(page.locator('#eventBody tr')).toHaveCount(3);

    // F. Member ID search (Exact Match priority): "S1"
    await mainSearchInput.fill('S1');
    // If exact match priority is active, only S1 (최다은) is matched, NOT S10 or S11.
    // S1 participates in: "한국청소년 피아노 콩쿠르" and "여름 정기 음악회"
    // S10 and S11 do not participate in any schedules. So if exact match works, we get 2 results.
    await expect(page.locator('#eventBody tr')).toHaveCount(2);
    await expect(page.locator('#eventBody tr').nth(0)).toContainText('한국청소년 피아노 콩쿠르');
    await expect(page.locator('#eventBody tr').nth(1)).toContainText('여름 정기 음악회');

    // G. Verify Search Targets for Owner/Teacher:
    // 1. Owner Name "한지섭" (owner of ev2) -> should match
    await mainSearchInput.fill('한지섭');
    await expect(page.locator('#eventBody tr')).toHaveCount(1);
    await expect(page.locator('#eventBody tr')).toContainText('예원학교 입시 실기고사');

    // 2. Teacher Name "이해원" (teacher of participant student S6 in ev5) -> should match
    await mainSearchInput.fill('이해원');
    await expect(page.locator('#eventBody tr')).toHaveCount(1);
    await expect(page.locator('#eventBody tr')).toContainText('6월 결석자 보강 편성');

    // H. Verify Excluded Search Targets:
    // 1. Event Type "concours" (ev1, ev3 type) -> should not match
    await mainSearchInput.fill('concours');
    await expect(page.locator('#eventBody tr')).toHaveCount(1);
    await expect(page.locator('#eventBody tr')).toContainText('검색 결과가 없습니다.');

    // 2. Event Memo "보호자 확인 필요" (memo of ev1) -> should not match
    await mainSearchInput.fill('보호자 확인 필요');
    await expect(page.locator('#eventBody tr')).toHaveCount(1);
    await expect(page.locator('#eventBody tr')).toContainText('검색 결과가 없습니다.');

    // I. Verify identical filtering on both tabs
    // 1. Search "ㅊㄷㅇ" in Event View
    await mainSearchInput.fill('ㅊㄷㅇ');
    await expect(page.locator('#eventBody tr')).toHaveCount(2); // 2 events

    // 2. Switch to "일정참여학생보기" (Participant View)
    const participantViewBtn = page.locator('#participantViewBtn');
    await participantViewBtn.click();
    // Since we searched for "최다은" (ㅊㄷㅇ), only 최다은 rows should match (2 rows).
    // Event: "한국청소년 피아노 콩쿠르", Student: "최다은"
    // Event: "여름 정기 음악회", Student: "최다은"
    // (Other students in these events like S5 채은재, S4 신지준 should be filtered out from rows)
    await expect(page.locator('#eventBody tr')).toHaveCount(2);
    await expect(page.locator('#eventBody tr').nth(0)).toContainText('최다은');
    await expect(page.locator('#eventBody tr').nth(1)).toContainText('최다은');
    // Ensure it doesn't contain 채은재 or 신지준
    await expect(page.locator('#eventBody')).not.toContainText('채은재');
    await expect(page.locator('#eventBody')).not.toContainText('신지준');

    // 3. Clear search in Participant View
    await mainSearchInput.fill('');
    // Should restore all student-event rows (11 rows)
    await expect(page.locator('#eventBody tr')).toHaveCount(11);
  });
});
