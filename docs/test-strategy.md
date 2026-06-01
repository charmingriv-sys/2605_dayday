# E2E Test Strategy & Playwright Roadmap

This document outlines the testing architecture and Playwright E2E verification plan for 튜링 (DayDay).

## Automated Test Suites

Currently, Phase 7D-2.5 has established five automated validation checks:
1. **State Injection Smoke Test** (`npm run test:state`): Verifies all crucial stateStore API endpoints exist and are functions.
2. **Supabase Client & Query Adapter Mock Test** (`npm run test:supabase-adapter`): Verifies database query mappings, error fallbacks, tenant safety guards, and write audit logging.
3. **Schedule Override/Snapshot Unit Test** (`npm run test:schedule-override`): Verifies date rules, snapshot isolation, override logs, and cross-date isolation for schedules.
4. **Static Security Credential Scan** (`npm run test:security`): Recursively inspects codebases for exposed API tokens, Private Keys, or `.env` files.
5. **Playwright E2E Browser Test Suite** (`npm run test:e2e`): Fully automates browser instance checks (including daily shifts, drag-and-drop schedule overrides with E2E-only test bridge safety, and role permission navigation).

---

## Playwright E2E Setup

E2E testing simulates native browser interactions using chromium engine drivers.

### 1. Installation Structure
Dependencies are loaded inside the project's root:
```bash
npm install -D @playwright/test
npx playwright install chromium
```

### 2. Playwright Configuration (`playwright.config.js`)
Configured to spawn `node server.js` dynamically on port `3000` to serve the static ESM modules, recycling ports if already running.

### 3. Active E2E Test Scenarios

#### Scenario A: Application Boot & Console Error Check (`tests/e2e/app-load.spec.js`)
- **Actions**:
  1. Open root `/` (`http://localhost:3000`).
  2. Read page title and verify string patterns.
- **Assertions**:
  - Verify page title contains "튜링 음악학원 관리 시스템".
  - Catch all uncaught `pageerror` and `console.error` logs. Fails test if any are emitted.

#### Scenario B: Multi-Role Entry Checks (`tests/e2e/role-entry.spec.js`)
- **Actions**:
  1. Trigger login actions for Director, Teacher, and Student roles on the landing overlay grid.
- **Assertions**:
  - Verify respective sidebar navigation selectors (`#menu-director`, `#menu-teacher`, `#menu-student`) toggle to visible.
  - Verify username label displays (e.g. `김하은 원장`).

#### Scenario C: Director Tab & Modal Check (`tests/e2e/director-flow.spec.js`)
- **Actions**:
  1. Log in as Director.
  2. Navigate to "원생 명부 관리" (`.menu-item[data-view="dir-students"]`).
  3. Click "원생 등록" (Add Student) button.
- **Assertions**:
  - Verify page title reads "원생 명부 관리".
  - Verify the common modal pop-up overlay (`#common-modal`) is visible.
  - Verify modal content form is correctly rendered.

---

#### Scenario D: Student Registration Flow & Persistence (`tests/e2e/student-crud-flow.spec.js`)
- **Actions**:
  1. Log in as Director.
  2. Navigate to "원생 명부 관리" (`.menu-item[data-view="dir-students"]`).
  3. Click "원생 등록" (Add Student) button.
  4. Fill out details (mocking postcode address popup logic) and submit.
  5. Reload the page and log back in.
- **Assertions**:
  - Verify modal closes.
  - Verify student name link is visible in table.
  - Verify data persists correctly after page reload.

#### Scenario E: Tuition Billing & Payment Workflow (`tests/e2e/billing-flow.spec.js`)
- **Actions**:
  1. Log in as Director.
  2. Navigate to "수납 및 결제 현황" (`.menu-item[data-view="dir-payments"]`).
  3. Change month selection to "2026-05".
  4. Locate unpaid record for student "윤하은" (payment record `P7`).
  5. Click "수납 처리" and choose "현금 수납".
  6. Reload the page and log back in.
- **Assertions**:
  - Verify payment row status badge updates to "완납".
  - Verify status change persists as "완납" after page reload.

#### Scenario F: Kiosk Attendance and Parent Sync Flow (`tests/e2e/attendance-parent-flow.spec.js`)
- **Actions**:
  1. Navigate to Kiosk view, touch keypad to input phone/pin for student "곽도현" and check in ("등원").
  2. Log in as Director, navigate to "출결 현황 관리", and verify student is marked as "등원".
  3. Log in as Student/Parent, navigate to Calendar, and verify attendance check-in is logged for today.
- **Assertions**:
  - Verify attendance toast alert shows check-in status.
  - Verify Director attendance table and Parent calendar sync attendance record.

#### Scenario G: Schedule Settings & Notes Flow (`tests/e2e/schedule-setup-flow.spec.js`)
- **Actions**:
  1. Log in as Director, navigate to "학원정보 관리".
  2. Change schedule start time, end time, slot interval, print layout, and select days, then submit.
  3. Reload the page and verify changes persist in Settings UI.
  4. Navigate to "강사 프로필 관리", edit a teacher, input "시간표 및 출퇴근 특이사항", and save.
  5. Navigate to "원생 명부 관리", register/edit student with "시간표 등 일정 특이사항", and verify detail pop-up shows the notes.
- **Assertions**:
  - Verify settings state modifications persist on reload.
  - Verify staff and student scheduleNotes field values are successfully persisted and rendered.

#### Scenario H: Weekly & Daily Teacher Shifts Flow (`tests/e2e/teacher-shift-flow.spec.js`)
- **Actions**:
  1. Log in as Director, navigate to "강사 출근 및 시간표 관리".
  2. Verify that the Weekly shifts view renders by default for the default teacher.
  3. Toggle the notes visibility panel and assert visibility changes.
  4. Select a different teacher from the dropdown, verify that the weekly shifts label changes.
  5. Switch view mode to Daily shifts, fill date input, and verify shifts block rendering.
  6. Apply "Active teachers only" filter to verify rows filtering.
- **Assertions**:
  - Verify stable selectors (`data-testid`) are used for weekly/daily toggles, selects, grid tables, and notes.
  - Verify notes toggling works successfully.
  - Verify date changes and filters correctly affect row listings.

#### Scenario I: Teacher-Student Daily & Weekly Schedules Flow (`tests/e2e/teacher-student-schedule-flow.spec.js`)
- **Actions**:
  1. Log in as Director, navigate to "강사 출근 및 시간표 관리".
  2. Click "강사-원생 시간표 관리" Subtab button.
  3. Verify Weekly match view elements exist, then toggle notes panel visibility.
  4. Switch view mode to Daily Match View, fill date input.
  5. Apply instrument filters, active only filter, and search by teacher name.
- **Assertions**:
  - Verify weekly view button is active by default.
  - Verify student notes toggle panel successfully hides and shows.
  - Verify daily view elements (date input, active only filter, instrument select, search query) are visible.
  - Verify student names mapping matches mock datasets.
  - Verify active filter and instrument/search filters apply correctly to grid table rows.

#### Scenario I-2: Drag-and-Drop Schedule Interaction (`tests/e2e/teacher-student-schedule-flow.spec.js`)
- **Actions**:
  1. Initialize page with `window.__DAYDAY_E2E__ = true` E2E-only test bridge flag.
  2. Switch to Daily Match View, fill date input to '2026-05-18'.
  3. Locate student card for "최다은" and dispatch drop simulation to Teacher T8 (정은비), Time 15:00 slot using the test-only drop trigger.
  4. Verify drag-and-drop success message banner.
  5. Reload the page, log back in (using the session preservation auto-login guard), and verify the student remains in the new slot (Persistence).
  6. Select next week '2026-05-25' and verify the student returns to their default slot (Isolation).
- **Assertions**:
  - Verify success feedback message: "일정이 성공적으로 이동되었습니다."
  - Verify card renders in the target td grid block.
  - Verify that reload does not wipe local state overrides.
  - Verify that other dates remain unaffected by the override.

#### Scenario I-3: Schedule Operation Logs Checks (`tests/e2e/teacher-student-schedule-flow.spec.js`)
- **Actions**:
  1. Switch to Daily Match View, fill date input to '2026-05-18'.
  2. Verify that the operation logs panel is visible by default and shows "시간표 이동 이력이 없습니다" (Empty log indicator).
  3. Drag and drop student "최다은" from 14:00 default slot to 15:00 slot.
  4. Verify that a new log row is created in the panel containing the student name ("최다은"), before teacher ("정은비"), after teacher ("정은비"), and the change reason.
  5. Reload the page, log back in, and verify that the operation log for the day persists correctly.
  6. Switch to '2026-05-19' and verify that the logs panel is empty (Isolation).
  7. Switch back to '2026-05-18' and toggle the log panel visibility using the "이동 이력 숨기기/보이기" button.
- **Assertions**:
  - Verify `data-testid="teacher-student-log-empty"` is visible initially.
  - Verify `data-testid="teacher-student-log-row"` is created with exact student name, before/after states, and action reason after shift.
  - Verify logs persist after page reload.
  - Verify logs for other dates are isolated.
  - Verify the log panel hides/shows correctly on toggle click.

#### Scenario J: Schedule Override/Snapshot Unit Testing (`tests/unit/schedule_override_test.mjs`)
- **Actions**:
  1. Verify future date defaults to database classes dynamic loading without snapshot generation.
  2. Trigger `ensureScheduleSnapshotForDate` and assert snapshot creation.
  3. Alter default classes database and verify previous snapshots are not affected (past data protection).
  4. Call `moveStudentScheduleForDate` and verify target date override mapping, overrides listing, and operation logs creation.
  5. Query another date to confirm that change overrides do not leak to other dates (isolation).

---

## Future E2E Automation Goals (Next Phases)
1. **Print Layout Preview**: Open schedule print preview and check formatting styles for one-per-page vs multi-per-page layouts.
2. **Mobile Overlay Alternative Testing**: Simulate click-based modal interactions for shift moves when mobile screen boundaries prevent drag-and-drop actions.


