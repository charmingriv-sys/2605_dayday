import { test, expect } from '@playwright/test';

test.describe('Student Attendance Warning Engine E2E Flow', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.role-grid').waitFor({ state: 'attached', timeout: 5000 });
    
    // Inject MockDate class into browser first
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

    // Inject MockDate again since navigation clears the window object
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

  test('should verify all 15 attendance warning rules and today console integration', async ({ page }) => {
    // Navigate to Today Console
    await page.locator('.menu-item[data-view="dir-today-console"]').click();
    await expect(page.locator('#page-title')).toContainText('오늘 원장 콘솔');

    // ----------------------------------------------------
    // Seed Helper function
    // ----------------------------------------------------
    const setupWarningTestState = async (options) => {
      return await page.evaluate((opts) => {
        const fakeNow = new Date(opts.fakeNow);
        window.__mockTime = fakeNow.getTime();

        const store = window.stateStore;
        store.db.todayTasks = [];
        store.db.scheduleSnapshots = [];
        store.db.scheduleOverrides = [];
        store.db.attendance = [];
        store.db.payments = [];

        // Apply settings overrides if specified
        if (opts.settings) {
          Object.assign(store.db.settings, opts.settings);
        }

        // Apply students
        store.db.students = opts.students || [
          { id: 'S1', name: '홍길동', academyId: 'AC1', teacherId: 'T8', instrument: '피아노', defaultClassDuration: 50 }
        ];

        // Seed classes matching students
        store.db.classes = opts.classes || [
          { id: 'C1', studentId: 'S1', dayOfWeek: '토', time: opts.classTime || '14:00' }
        ];

        // Seed attendance logs
        if (opts.attendance) {
          store.db.attendance = opts.attendance;
        }

        // Seed today tasks (resolved/done)
        if (opts.todayTasks) {
          store.db.todayTasks = opts.todayTasks;
        }

        // Isolate majorSchedules warnings
        store.db.majorSchedules = [];

        store.saveDB();

        const y = fakeNow.getFullYear();
        const m = fakeNow.getMonth();
        const d = fakeNow.getDate();
        const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        console.log('todaySchedule for dateStr:', dateStr, store.getTeacherStudentScheduleForDate(dateStr));
        console.log('attendanceList:', store.getAttendance());

        console.log('Fake Now input:', opts.fakeNow);
        console.log('Fake Now object:', fakeNow.toString(), 'MS:', fakeNow.getTime());
        
        const [sh, smin] = (opts.classTime || '14:00').split(':').map(Number);
        const scheduledStartAt = new Date(y, m, d, sh, smin, 0, 0);
        const scheduledEndAt = new Date(scheduledStartAt.getTime() + 50 * 60 * 1000);
        console.log('Scheduled End At:', scheduledEndAt.toString(), 'MS:', scheduledEndAt.getTime());
        console.log('Is fakeNow > scheduledEndAt?', fakeNow.getTime() > scheduledEndAt.getTime());

        store.syncSystemRecommendations(fakeNow);
        
        console.log('Tasks generated:', store.getTodayTasks());
        
        return {
          tasks: store.getTodayTasks(),
          settings: store.db.settings
        };
      }, options);
    };

    const getFakeDateStr = (timeStr) => `2026-06-13T${timeStr}:00`;

    // ----------------------------------------------------
    // Rule 1: 수업 전, 출석 없음 → 워닝 없음
    // ----------------------------------------------------
    let res = await setupWarningTestState({
      fakeNow: getFakeDateStr('13:50'), // 10 mins before class starts
      classTime: '14:00',
      attendance: []
    });
    expect(res.tasks.filter(t => t.source === 'system')).toHaveLength(0);

    // ----------------------------------------------------
    // Rule 2: 수업 시작 후 지각 기준 초과, 수업 종료 전, 출석 없음 → 결석 확인 아님
    // ----------------------------------------------------
    res = await setupWarningTestState({
      fakeNow: getFakeDateStr('14:15'), // class started at 14:00, threshold is 10m, ended at 14:50
      classTime: '14:00',
      settings: { lateDetectionEnabled: true, lateThresholdMinutes: 10, studentAbsenceWarningEnabled: true },
      attendance: []
    });
    // Class ends at 14:50. At 14:15, it's not ended yet.
    expect(res.tasks.filter(t => t.source === 'system' && t.category === 'absent')).toHaveLength(0);

    // ----------------------------------------------------
    // Rule 3: 수업 종료 후, 출석 없음 → 결석 확인 생성
    // ----------------------------------------------------
    res = await setupWarningTestState({
      fakeNow: getFakeDateStr('14:51'), // Class ended at 14:50
      classTime: '14:00',
      settings: { studentAbsenceWarningEnabled: true },
      attendance: []
    });
    let systemTasks = res.tasks.filter(t => t.source === 'system');
    expect(systemTasks).toHaveLength(1);
    expect(systemTasks[0].category).toBe('absent');
    expect(systemTasks[0].title).toBe('[결석 확인] 홍길동 원생 결석 확인 (피아노 14:00 정은비)');
    expect(systemTasks[0].description).toContain('수업이 끝났지만 출석 기록이 없습니다.');

    // ----------------------------------------------------
    // Rule 4: 수업 시작 후 늦게 출석, 수업 종료 전 → 지각 생성
    // ----------------------------------------------------
    res = await setupWarningTestState({
      fakeNow: getFakeDateStr('14:20'), // Class starts at 14:00
      classTime: '14:00',
      settings: { lateDetectionEnabled: true, lateThresholdMinutes: 10 },
      attendance: [
        { studentId: 'S1', date: '2026-06-13', status: 'present', time: '14:12' } // Checked in 12m late
      ]
    });
    systemTasks = res.tasks.filter(t => t.source === 'system');
    expect(systemTasks).toHaveLength(1);
    expect(systemTasks[0].category).toBe('attendance_warning');
    expect(systemTasks[0].title).toBe('[특이출결] 홍길동 원생 지각 (피아노 14:00 정은비)');
    expect(systemTasks[0].description).toContain('지각');

    // ----------------------------------------------------
    // Rule 5: 수업 종료 후 늦게 출석 → 결석 확인 제거, 지각 생성
    // ----------------------------------------------------
    res = await setupWarningTestState({
      fakeNow: getFakeDateStr('15:00'), // Class ended
      classTime: '14:00',
      settings: { lateDetectionEnabled: true, lateThresholdMinutes: 10, studentAbsenceWarningEnabled: true },
      attendance: [
        { studentId: 'S1', date: '2026-06-13', status: 'present', time: '14:15' } // 15m late checkin
      ],
      todayTasks: [
        // Simulate previous open absent task
        {
          id: 'T_ABSENT_PREV',
          organizationId: 'AC1',
          segment: 'academy_director_console',
          source: 'system',
          type: 'attendance',
          category: 'absent',
          status: 'open',
          dedupeKey: 'SYSTEM_RECOMMEND_ABSENT_S1_2026-06-13_14:00'
        }
      ]
    });
    systemTasks = res.tasks.filter(t => t.source === 'system');
    expect(systemTasks.filter(t => t.category === 'absent')).toHaveLength(0);
    expect(systemTasks.filter(t => t.category === 'attendance_warning')).toHaveLength(1);
    expect(systemTasks[0].title).toBe('[특이출결] 홍길동 원생 지각 (피아노 14:00 정은비)');

    // ----------------------------------------------------
    // Rule 6: 정상 출석 후 하원 없음 → 종료시간 + grace 초과 시 하원누락 생성
    // ----------------------------------------------------
    res = await setupWarningTestState({
      fakeNow: getFakeDateStr('15:05'), // Class starts at 14:00, ends at 14:50. Grace 10m -> limit 15:00. Now is 15:05
      classTime: '14:00',
      settings: { studentCheckoutMissingWarningEnabled: true, studentCheckoutMissingGraceMinutes: 10 },
      attendance: [
        { studentId: 'S1', date: '2026-06-13', status: 'present', time: '14:05' } // Checked in 5m late
      ]
    });
    systemTasks = res.tasks.filter(t => t.source === 'system');
    expect(systemTasks).toHaveLength(1);
    expect(systemTasks[0].title).toBe('[특이출결] 홍길동 원생 하원 누락 (피아노 14:00 정은비)');
    expect(systemTasks[0].description).toContain('수업 시간이 종료되었지만 하원 기록이 없습니다.');

    // ----------------------------------------------------
    // Rule 7: 지각 출석 후 하원 없음 → actualCheckInAt + classDuration + grace 초과 시 하원누락 생성
    // ----------------------------------------------------
    res = await setupWarningTestState({
      fakeNow: getFakeDateStr('15:10'),
      classTime: '14:00',
      settings: { lateDetectionEnabled: true, lateThresholdMinutes: 10, studentCheckoutMissingWarningEnabled: true, studentCheckoutMissingGraceMinutes: 10 },
      attendance: [
        { studentId: 'S1', date: '2026-06-13', status: 'present', time: '14:15' } // Late checkin
      ]
    });
    systemTasks = res.tasks.filter(t => t.source === 'system');
    expect(systemTasks).toHaveLength(1);
    // At 15:10, checkoutLimit (15:15) is not exceeded, so only LATE is active
    expect(systemTasks[0].title).toBe('[특이출결] 홍길동 원생 지각 (피아노 14:00 정은비)');

    // Exceeding 15:15 limit
    res = await setupWarningTestState({
      fakeNow: getFakeDateStr('15:20'),
      classTime: '14:00',
      settings: { lateDetectionEnabled: true, lateThresholdMinutes: 10, studentCheckoutMissingWarningEnabled: true, studentCheckoutMissingGraceMinutes: 10 },
      attendance: [
        { studentId: 'S1', date: '2026-06-13', status: 'present', time: '14:15' } // Late checkin
      ]
    });
    systemTasks = res.tasks.filter(t => t.source === 'system');
    expect(systemTasks).toHaveLength(1);
    expect(systemTasks[0].title).toBe('[특이출결] 홍길동 원생 지각 및 하원 누락 (피아노 14:00 정은비)');

    // ----------------------------------------------------
    // Rule 8: 출석 없음 + 하원 없음 → 결석 확인만 생성, 하원누락 없음
    // ----------------------------------------------------
    res = await setupWarningTestState({
      fakeNow: getFakeDateStr('15:30'),
      classTime: '14:00',
      settings: { studentAbsenceWarningEnabled: true, studentCheckoutMissingWarningEnabled: true },
      attendance: []
    });
    systemTasks = res.tasks.filter(t => t.source === 'system');
    expect(systemTasks).toHaveLength(1);
    expect(systemTasks[0].category).toBe('absent');

    // ----------------------------------------------------
    // Rule 9: 정상 출석 + 정상 하원 → 워닝 없음
    // ----------------------------------------------------
    res = await setupWarningTestState({
      fakeNow: getFakeDateStr('15:30'),
      classTime: '14:00',
      settings: { lateDetectionEnabled: true, lateThresholdMinutes: 10, studentAbsenceWarningEnabled: true, studentCheckoutMissingWarningEnabled: true },
      attendance: [
        { studentId: 'S1', date: '2026-06-13', status: 'present', time: '14:02', leavingTime: '14:52' }
      ]
    });
    systemTasks = res.tasks.filter(t => t.source === 'system');
    expect(systemTasks).toHaveLength(0);

    // ----------------------------------------------------
    // Rule 10: 지각 설정 사용 안 함 → 지각 미생성
    // ----------------------------------------------------
    res = await setupWarningTestState({
      fakeNow: getFakeDateStr('14:30'),
      classTime: '14:00',
      settings: { lateDetectionEnabled: false },
      attendance: [
        { studentId: 'S1', date: '2026-06-13', status: 'present', time: '14:20' }
      ]
    });
    systemTasks = res.tasks.filter(t => t.source === 'system');
    expect(systemTasks).toHaveLength(0);

    // ----------------------------------------------------
    // Rule 11: 결석 확인 사용 안 함 → 결석 확인 미생성
    // ----------------------------------------------------
    res = await setupWarningTestState({
      fakeNow: getFakeDateStr('15:00'),
      classTime: '14:00',
      settings: { studentAbsenceWarningEnabled: false },
      attendance: []
    });
    systemTasks = res.tasks.filter(t => t.source === 'system');
    expect(systemTasks).toHaveLength(0);

    // ----------------------------------------------------
    // Rule 12: 하원누락 사용 안 함 → 하원누락 미생성
    // ----------------------------------------------------
    res = await setupWarningTestState({
      fakeNow: getFakeDateStr('15:20'),
      classTime: '14:00',
      settings: { studentCheckoutMissingWarningEnabled: false },
      attendance: [
        { studentId: 'S1', date: '2026-06-13', status: 'present', time: '14:00' }
      ]
    });
    systemTasks = res.tasks.filter(t => t.source === 'system');
    expect(systemTasks).toHaveLength(0);

    // ----------------------------------------------------
    // Rule 13: 0분 설정 → 기준시각 직후 워닝 생성
    // ----------------------------------------------------
    res = await setupWarningTestState({
      fakeNow: getFakeDateStr('14:01'),
      classTime: '14:00',
      settings: { lateDetectionEnabled: true, lateThresholdMinutes: 0 },
      attendance: [
        { studentId: 'S1', date: '2026-06-13', status: 'present', time: '14:01' }
      ]
    });
    systemTasks = res.tasks.filter(t => t.source === 'system');
    expect(systemTasks).toHaveLength(1);
    expect(systemTasks[0].title).toBe('[특이출결] 홍길동 원생 지각 (피아노 14:00 정은비)');

    // ----------------------------------------------------
    // Rule 14: 동일 워닝 중복 생성 방지
    // ----------------------------------------------------
    res = await setupWarningTestState({
      fakeNow: getFakeDateStr('15:00'),
      classTime: '14:00',
      settings: { studentAbsenceWarningEnabled: true },
      attendance: [],
      todayTasks: [
        {
          id: 'T_RESOLVED',
          organizationId: 'AC1',
          segment: 'academy_director_console',
          source: 'system',
          type: 'attendance',
          category: 'absent',
          status: 'done',
          dedupeKey: 'SYSTEM_RECOMMEND_ABSENT_S1_2026-06-13_14:00'
        }
      ]
    });
    systemTasks = res.tasks.filter(t => t.source === 'system' && t.status === 'open');
    expect(systemTasks).toHaveLength(0);

    // ----------------------------------------------------
    // Rule 15: 동일 원생 다중 수업 → KPI는 고유 원생 수, 하단 리스트는 수업 단위 표시
    // ----------------------------------------------------
    res = await setupWarningTestState({
      fakeNow: getFakeDateStr('18:00'),
      settings: { studentAbsenceWarningEnabled: true },
      students: [
        { id: 'S1', name: '홍길동', academyId: 'AC1', teacherId: 'T8', instrument: '피아노', defaultClassDuration: 50 }
      ],
      classes: [
        { id: 'C1', studentId: 'S1', dayOfWeek: '토', time: '14:00' },
        { id: 'C2', studentId: 'S1', dayOfWeek: '토', time: '16:00' }
      ],
      attendance: []
    });

    systemTasks = res.tasks.filter(t => t.source === 'system' && t.status === 'open');
    expect(systemTasks).toHaveLength(2);

    await page.reload();
    
    // Re-inject MockDate after reload!
    await page.evaluate(() => {
      window.__mockTime = new Date('2026-06-13T18:00:00').getTime();
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

    const absentCard = page.locator('.kpi-chip-card[data-filter-id="absent"]');
    await expect(absentCard.locator('.badge')).toContainText('2');

    const listItems = page.locator('#tasks-list-container .glass-card');
    await expect(listItems).toHaveCount(2);
  });
});
