import { test, expect } from '@playwright/test';

test.describe('Teacher Attendance Warning Engine E2E Flow', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.role-grid').waitFor({ state: 'attached', timeout: 5000 });
    
    // Inject MockDate class into browser
    await page.evaluate(() => {
      window.__mockTime = new Date('2026-06-13T12:00:00').getTime();
      const OriginalDate = Date;
      class MockDate extends OriginalDate {
        constructor(...args) {
          if (args.length === 0) {
            super(window.__mockTime);
          } else {
            super(...args);
          }
        }
        static now() {
          return window.__mockTime;
        }
      }
      window.Date = MockDate;
      localStorage.clear();
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.role-grid').waitFor({ state: 'attached', timeout: 5000 });

    // Inject MockDate again since navigation clears window
    await page.evaluate(() => {
      window.__mockTime = new Date('2026-06-13T12:00:00').getTime();
      const OriginalDate = Date;
      class MockDate extends OriginalDate {
        constructor(...args) {
          if (args.length === 0) {
            super(window.__mockTime);
          } else {
            super(...args);
          }
        }
        static now() {
          return window.__mockTime;
        }
      }
      window.Date = MockDate;
    });
    
    // Log in as Director
    const directorBtn = page.locator('.role-btn.director');
    await expect(directorBtn).toBeVisible({ timeout: 5000 });
    await directorBtn.click();
    await expect(page.locator('#app-root')).toBeVisible({ timeout: 5000 });
  });

  test('should verify all 15 teacher warning rules and today console integration', async ({ page }) => {
    // Navigate to Today Console
    await page.locator('.menu-item[data-view="dir-today-console"]').click();
    await expect(page.locator('#page-title')).toContainText('오늘 원장 콘솔');

    const setupWarningTestState = async (options) => {
      return await page.evaluate((opts) => {
        const fakeNow = new Date(opts.fakeNow);
        window.__mockTime = fakeNow.getTime();

        const store = window.stateStore;
        store.db.todayTasks = [];
        store.db.teacherShifts = [];
        store.db.teacherAttendanceLogs = [];
        store.db.payments = [];

        // Apply settings overrides if specified
        if (opts.settings) {
          Object.assign(store.db.settings, opts.settings);
        }

        // Apply teachers
        store.db.teachers = opts.teachers || [
          { id: 'T8', name: '성어진', academyId: 'AC1', employmentStatus: 'active' }
        ];

        // Seed teacher shifts
        if (opts.shifts) {
          store.db.teacherShifts = opts.shifts;
        } else if (opts.slots) {
          store.db.teacherShifts = [
            { id: 'TS1', teacherId: 'T8', date: '2026-06-13', slots: opts.slots }
          ];
        }

        // Seed teacher attendance logs
        if (opts.attendanceLogs) {
          store.db.teacherAttendanceLogs = opts.attendanceLogs;
        }

        // Seed today tasks (resolved/done)
        if (opts.todayTasks) {
          store.db.todayTasks = opts.todayTasks;
        }

        // Isolate majorSchedules warnings
        store.db.majorSchedules = [];

        store.saveDB();

        store.syncSystemRecommendations(fakeNow);
        
        return {
          tasks: store.getTodayTasks(),
          settings: store.db.settings
        };
      }, options);
    };

    const getFakeDateStr = (timeStr) => `2026-06-13T${timeStr}:00`;

    // ----------------------------------------------------
    // Rule 1: 출근 시작 전, 출근 없음 → 워닝 없음
    // ----------------------------------------------------
    let res = await setupWarningTestState({
      fakeNow: getFakeDateStr('13:50'), // Before 14:00 shift
      slots: ['14:00', '14:30', '15:00', '15:30', '16:00'],
      attendanceLogs: []
    });
    expect(res.tasks.filter(t => t.source === 'system')).toHaveLength(0);

    // ----------------------------------------------------
    // Rule 2: 출근 시작 + 지각 허용분 초과, 미출근 기준 전, 출근 없음 → 지각 생성
    // ----------------------------------------------------
    res = await setupWarningTestState({
      fakeNow: getFakeDateStr('14:10'), // Late grace 5m -> limit 14:05. NoShow grace 15m -> limit 14:15
      slots: ['14:00', '14:30', '15:00', '15:30', '16:00'],
      settings: { teacherLateWarningEnabled: true, teacherLateGraceMinutes: 5, teacherNoShowWarningEnabled: true, teacherNoShowGraceMinutes: 15 },
      attendanceLogs: []
    });
    let systemTasks = res.tasks.filter(t => t.source === 'system');
    expect(systemTasks).toHaveLength(1);
    expect(systemTasks[0].title).toBe('[특이근태] 성어진 강사 지각');
    expect(systemTasks[0].description).toContain('출근 예정시간보다 늦게 출근했습니다.');

    // ----------------------------------------------------
    // Rule 3: 출근 시작 + 미출근 허용분 초과, 출근 없음 → 미출근 생성, 지각 제외
    // ----------------------------------------------------
    res = await setupWarningTestState({
      fakeNow: getFakeDateStr('14:20'), // Exceeded 14:15 NoShow limit
      slots: ['14:00', '14:30', '15:00', '15:30', '16:00'],
      settings: { teacherLateWarningEnabled: true, teacherLateGraceMinutes: 5, teacherNoShowWarningEnabled: true, teacherNoShowGraceMinutes: 15 },
      attendanceLogs: []
    });
    systemTasks = res.tasks.filter(t => t.source === 'system');
    expect(systemTasks).toHaveLength(1);
    expect(systemTasks[0].title).toBe('[특이근태] 성어진 강사 미출근');
    expect(systemTasks[0].description).toContain('출근 예정시간이 지났지만 출근 기록이 없습니다.');

    // ----------------------------------------------------
    // Rule 4: 미출근 기준 초과 후 늦게 출근 체크 → 미출근 제거, 지각 생성
    // ----------------------------------------------------
    res = await setupWarningTestState({
      fakeNow: getFakeDateStr('14:30'),
      slots: ['14:00', '14:30', '15:00', '15:30', '16:00'],
      settings: { teacherLateWarningEnabled: true, teacherLateGraceMinutes: 5, teacherNoShowWarningEnabled: true, teacherNoShowGraceMinutes: 15 },
      attendanceLogs: [
        { id: 'tal_1', teacherId: 'T8', date: '2026-06-13', checkInAt: getFakeDateStr('14:25'), checkOutAt: null }
      ]
    });
    systemTasks = res.tasks.filter(t => t.source === 'system');
    expect(systemTasks).toHaveLength(1);
    expect(systemTasks[0].title).toBe('[특이근태] 성어진 강사 지각');

    // ----------------------------------------------------
    // Rule 5: 정상 출근 후 퇴근 없음 → 마지막 종료시간 + grace 초과 시 퇴근누락 생성
    // ----------------------------------------------------
    res = await setupWarningTestState({
      fakeNow: getFakeDateStr('16:45'), // End 16:30 + Grace 10m -> limit 16:40
      slots: ['14:00', '14:30', '15:00', '15:30', '16:00'],
      settings: { teacherLateWarningEnabled: true, teacherLateGraceMinutes: 5, teacherCheckoutMissingWarningEnabled: true, teacherCheckoutMissingGraceMinutes: 10 },
      attendanceLogs: [
        { id: 'tal_1', teacherId: 'T8', date: '2026-06-13', checkInAt: getFakeDateStr('13:58'), checkOutAt: null } // Normal checkin
      ]
    });
    systemTasks = res.tasks.filter(t => t.source === 'system');
    expect(systemTasks).toHaveLength(1);
    expect(systemTasks[0].title).toBe('[특이근태] 성어진 강사 퇴근누락');
    expect(systemTasks[0].description).toContain('근무 시간이 종료되었지만 퇴근 기록이 없습니다.');

    // ----------------------------------------------------
    // Rule 6: 지각 출근 후 퇴근 없음 → 지각 + 퇴근누락 처리
    // ----------------------------------------------------
    res = await setupWarningTestState({
      fakeNow: getFakeDateStr('16:45'),
      slots: ['14:00', '14:30', '15:00', '15:30', '16:00'],
      settings: { teacherLateWarningEnabled: true, teacherLateGraceMinutes: 5, teacherCheckoutMissingWarningEnabled: true, teacherCheckoutMissingGraceMinutes: 10 },
      attendanceLogs: [
        { id: 'tal_1', teacherId: 'T8', date: '2026-06-13', checkInAt: getFakeDateStr('14:12'), checkOutAt: null } // Late checkin
      ]
    });
    systemTasks = res.tasks.filter(t => t.source === 'system');
    expect(systemTasks).toHaveLength(1);
    expect(systemTasks[0].title).toBe('[특이근태] 성어진 강사 지각 및 퇴근누락');
    expect(systemTasks[0].description).toContain('늦게 출근했고, 근무 시간이 종료되었지만 퇴근 기록이 없습니다.');

    // ----------------------------------------------------
    // Rule 7: 출근시간관리 설정이 없는 날 출근만 있고 퇴근 없음 → 당일 퇴근누락 미생성
    // ----------------------------------------------------
    res = await setupWarningTestState({
      fakeNow: getFakeDateStr('18:00'),
      shifts: [], // No shift setup today
      settings: { teacherCheckoutMissingWarningEnabled: true, teacherCheckoutMissingGraceMinutes: 10 },
      attendanceLogs: [
        { id: 'tal_1', teacherId: 'T8', date: '2026-06-13', checkInAt: getFakeDateStr('14:00'), checkOutAt: null }
      ]
    });
    systemTasks = res.tasks.filter(t => t.source === 'system');
    expect(systemTasks).toHaveLength(0);

    // ----------------------------------------------------
    // Rule 8: 출근시간관리 설정이 없는 날 출근도 없음 → 워닝 없음
    // ----------------------------------------------------
    res = await setupWarningTestState({
      fakeNow: getFakeDateStr('18:00'),
      shifts: [],
      attendanceLogs: []
    });
    expect(res.tasks.filter(t => t.source === 'system')).toHaveLength(0);

    // ----------------------------------------------------
    // Rule 9: 하루 여러 근무 슬롯 → 마지막 종료시간 기준 1회 퇴근누락
    // ----------------------------------------------------
    res = await setupWarningTestState({
      fakeNow: getFakeDateStr('15:45'), // Exceeds first slot end (15:00 + grace 10m = 15:10), but last is 17:00
      slots: ['14:00', '14:30', '16:00', '16:30'], // Ends 17:00
      settings: { teacherCheckoutMissingWarningEnabled: true, teacherCheckoutMissingGraceMinutes: 10 },
      attendanceLogs: [
        { id: 'tal_1', teacherId: 'T8', date: '2026-06-13', checkInAt: getFakeDateStr('13:55'), checkOutAt: null }
      ]
    });
    expect(res.tasks.filter(t => t.source === 'system' && t.category === 'staff_warning')).toHaveLength(0);

    // Exceeding lastEndTime + grace
    res = await setupWarningTestState({
      fakeNow: getFakeDateStr('17:15'), // Last end 17:00 + grace 10m -> limit 17:10
      slots: ['14:00', '14:30', '16:00', '16:30'],
      settings: { teacherCheckoutMissingWarningEnabled: true, teacherCheckoutMissingGraceMinutes: 10 },
      attendanceLogs: [
        { id: 'tal_1', teacherId: 'T8', date: '2026-06-13', checkInAt: getFakeDateStr('13:55'), checkOutAt: null }
      ]
    });
    systemTasks = res.tasks.filter(t => t.source === 'system' && t.category === 'staff_warning');
    expect(systemTasks).toHaveLength(1);
    expect(systemTasks[0].title).toBe('[특이근태] 성어진 강사 퇴근누락');

    // ----------------------------------------------------
    // Rule 10: 지각 설정 사용 안 함 → 지각 미생성
    // ----------------------------------------------------
    res = await setupWarningTestState({
      fakeNow: getFakeDateStr('14:10'),
      slots: ['14:00', '14:30'],
      settings: { teacherLateWarningEnabled: false },
      attendanceLogs: []
    });
    expect(res.tasks.filter(t => t.source === 'system')).toHaveLength(0);

    // ----------------------------------------------------
    // Rule 11: 미출근 설정 사용 안 함 → 미출근 미생성
    // ----------------------------------------------------
    res = await setupWarningTestState({
      fakeNow: getFakeDateStr('14:20'),
      slots: ['14:00', '14:30'],
      settings: { teacherNoShowWarningEnabled: false, teacherLateWarningEnabled: true }, // Keep late active
      attendanceLogs: []
    });
    systemTasks = res.tasks.filter(t => t.source === 'system');
    expect(systemTasks).toHaveLength(1);
    expect(systemTasks[0].title).toBe('[특이근태] 성어진 강사 지각');

    // ----------------------------------------------------
    // Rule 12: 퇴근누락 설정 사용 안 함 → 퇴근누락 미생성
    // ----------------------------------------------------
    res = await setupWarningTestState({
      fakeNow: getFakeDateStr('16:45'),
      slots: ['14:00', '14:30'],
      settings: { teacherCheckoutMissingWarningEnabled: false },
      attendanceLogs: [
        { id: 'tal_1', teacherId: 'T8', date: '2026-06-13', checkInAt: getFakeDateStr('13:55'), checkOutAt: null }
      ]
    });
    expect(res.tasks.filter(t => t.source === 'system')).toHaveLength(0);

    // ----------------------------------------------------
    // Rule 13: 0분 설정 → 기준시각 직후 워닝 생성
    // ----------------------------------------------------
    res = await setupWarningTestState({
      fakeNow: getFakeDateStr('14:01'),
      slots: ['14:00', '14:30'],
      settings: { teacherLateWarningEnabled: true, teacherLateGraceMinutes: 0 },
      attendanceLogs: []
    });
    systemTasks = res.tasks.filter(t => t.source === 'system');
    expect(systemTasks).toHaveLength(1);
    expect(systemTasks[0].title).toBe('[특이근태] 성어진 강사 지각');

    // ----------------------------------------------------
    // Rule 14: 동일 워닝 중복 생성 방지
    // ----------------------------------------------------
    res = await setupWarningTestState({
      fakeNow: getFakeDateStr('14:20'),
      slots: ['14:00', '14:30'],
      settings: { teacherNoShowWarningEnabled: true, teacherNoShowGraceMinutes: 10 },
      attendanceLogs: [],
      todayTasks: [
        {
          id: 'T_RESOLVED',
          organizationId: 'AC1',
          segment: 'academy_director_console',
          source: 'system',
          type: 'attendance',
          category: 'staff_warning',
          status: 'done',
          dedupeKey: 'SYSTEM_RECOMMEND_STAFF_ABSENT_T8_2026-06-13'
        }
      ]
    });
    systemTasks = res.tasks.filter(t => t.source === 'system' && t.status === 'open');
    expect(systemTasks).toHaveLength(0);

    // ----------------------------------------------------
    // Rule 15: 특이근태 KPI는 고유 강사 수 기준
    // ----------------------------------------------------
    res = await setupWarningTestState({
      fakeNow: getFakeDateStr('14:20'),
      settings: { teacherNoShowWarningEnabled: true, teacherNoShowGraceMinutes: 10 },
      teachers: [
        { id: 'T8', name: '성어진', academyId: 'AC1', employmentStatus: 'active' },
        { id: 'T1', name: '문승현', academyId: 'AC1', employmentStatus: 'active' }
      ],
      shifts: [
        { id: 'TS1', teacherId: 'T8', date: '2026-06-13', slots: ['14:00', '14:30'] },
        { id: 'TS2', teacherId: 'T1', date: '2026-06-13', slots: ['14:00', '14:30'] }
      ],
      attendanceLogs: []
    });

    systemTasks = res.tasks.filter(t => t.source === 'system' && t.status === 'open');
    expect(systemTasks).toHaveLength(2); // Two staff no-show warnings

    await page.reload();

    // Re-inject MockDate after reload!
    await page.evaluate(() => {
      window.__mockTime = new Date('2026-06-13T14:20:00').getTime();
      const OriginalDate = Date;
      class MockDate extends OriginalDate {
        constructor(...args) {
          if (args.length === 0) {
            super(window.__mockTime);
          } else {
            super(...args);
          }
        }
        static now() {
          return window.__mockTime;
        }
      }
      window.Date = MockDate;
    });

    await page.locator('.menu-item[data-view="dir-today-console"]').click();

    const staffWarningCard = page.locator('.kpi-chip-card[data-filter-id="staff_warning"]');
    await expect(staffWarningCard.locator('.badge')).toContainText('2');

    const listItems = page.locator('#tasks-list-container .glass-card');
    await expect(listItems).toHaveCount(2);
  });
});
