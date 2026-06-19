/**
 * todayTaskStaffAttendance.js
 * Extracted staff attendance recommendation sync module for Phase 18C
 */

export function syncStaffAttendanceRecommendations(ctx, options) {
    const { parsedNow, y, m, d, dateStr, silent, addValidatedSystemTodayTask } = options;

    if (typeof ctx.getTeachers === 'function' && typeof ctx.getTeacherShifts === 'function' && typeof ctx.getTeacherAttendanceLogs === 'function') {
        const teachers = ctx.getTeachers() || [];
        const shifts = ctx.getTeacherShifts() || [];
        const attendanceLogs = ctx.getTeacherAttendanceLogs() || [];

        // Warning policy settings for teachers
        const settings = ctx.db.settings || {};
        const getSettingValue = (key, legacyGetter, defaultValue) => {
            if (settings[key] !== undefined) {
                const val = settings[key];
                if (typeof val === 'boolean') return val;
                const num = Number(val);
                if (!isNaN(num) && num >= 0 && num <= 90) return num;
            }
            if (typeof legacyGetter === 'function') {
                return legacyGetter();
            }
            return defaultValue;
        };

        const teacherLateWarningEnabled = getSettingValue(
            'teacherLateWarningEnabled',
            ctx.getTeacherLateWarningEnabled ? ctx.getTeacherLateWarningEnabled.bind(ctx) : null,
            true
        );
        const teacherLateGraceMinutes = getSettingValue(
            'teacherLateGraceMinutes',
            ctx.getTeacherLateWarningGraceMinutes ? ctx.getTeacherLateWarningGraceMinutes.bind(ctx) : null,
            5
        );
        const teacherNoShowWarningEnabled = getSettingValue(
            'teacherNoShowWarningEnabled',
            ctx.getTeacherNoShowWarningEnabled ? ctx.getTeacherNoShowWarningEnabled.bind(ctx) : null,
            true
        );
        const teacherNoShowGraceMinutes = getSettingValue(
            'teacherNoShowGraceMinutes',
            ctx.getTeacherNoShowWarningGraceMinutes ? ctx.getTeacherNoShowWarningGraceMinutes.bind(ctx) : null,
            10
        );
        const teacherCheckoutMissingWarningEnabled = getSettingValue(
            'teacherCheckoutMissingWarningEnabled',
            ctx.getTeacherCheckoutMissingWarningEnabled ? ctx.getTeacherCheckoutMissingWarningEnabled.bind(ctx) : null,
            true
        );
        const teacherCheckoutMissingGraceMinutes = getSettingValue(
            'teacherCheckoutMissingGraceMinutes',
            ctx.getTeacherCheckoutMissingGraceMinutes ? ctx.getTeacherCheckoutMissingGraceMinutes.bind(ctx) : null,
            10
        );

        const activeStaffKeys = [];

        teachers.forEach(t => {
            const shiftToday = shifts.find(s => s.teacherId === t.id && s.date === dateStr);
            const logsToday = attendanceLogs.filter(log => log.teacherId === t.id && log.date === dateStr);
            const log = logsToday[0];

            const hasShiftToday = shiftToday && Array.isArray(shiftToday.slots) && shiftToday.slots.length > 0;
            const hasLogToday = !!log;

            // 퇴사 강사 필터링: 퇴사 강사인데 shift 설정도 없고 근태 로그도 없으면 제외
            if (t.employmentStatus === 'resigned' && !hasShiftToday && !hasLogToday) {
                return;
            }

            // 당일 출근시간관리 설정(slots)이 없는 경우:
            // 당일에는 퇴근누락, 지각, 미출근 워닝을 모두 생성하지 않습니다.
            if (!hasShiftToday) {
                return;
            }

            const staffKey = `${t.id}_${dateStr}`;
            activeStaffKeys.push(staffKey);

            // slots 파싱
            const sortedSlots = [...shiftToday.slots].sort();
            const startTimeStr = sortedSlots[0];
            const [sh, smin] = startTimeStr.split(':').map(Number);
            const scheduledStartAt = new Date(y, m, d, sh, smin, 0, 0);

            // lastEndTime 구하기 (가장 마지막 슬롯 시작 시간 + slotMinutes)
            const lastTimeStr = sortedSlots[sortedSlots.length - 1];
            const [eh, emin] = lastTimeStr.split(':').map(Number);
            const lastSlotStartAt = new Date(y, m, d, eh, emin, 0, 0);
            const slotMinutes = (ctx.db.settings && ctx.db.settings.scheduleSlotMinutes) || 30;
            const scheduledEndAt = new Date(lastSlotStartAt.getTime() + slotMinutes * 60 * 1000);

            // 출근 체크 분석
            const hasCheckedIn = log && !!log.checkInAt;
            const hasCheckedOut = log && !!log.checkOutAt;

            let actualCheckInAt = null;
            if (hasCheckedIn) {
                actualCheckInAt = new Date(log.checkInAt);
            }

            let currentWarningState = 'NONE';
            let isLate = false;
            let isNoShow = false;
            let isCheckoutMissing = false;

            // 1) 출근 체크가 없는 경우
            if (!hasCheckedIn) {
                const noShowLimit = new Date(scheduledStartAt.getTime() + teacherNoShowGraceMinutes * 60 * 1000);
                const lateLimit = new Date(scheduledStartAt.getTime() + teacherLateGraceMinutes * 60 * 1000);

                // 미출근 판단
                if (teacherNoShowWarningEnabled && parsedNow.getTime() > noShowLimit.getTime()) {
                    isNoShow = true;
                } 
                // 지각 판단 (미출근 이전)
                else if (teacherLateWarningEnabled && parsedNow.getTime() > lateLimit.getTime()) {
                    isLate = true;
                }
            } 
            // 2) 출근 체크가 있는 경우
            else {
                // 지각 판단
                if (teacherLateWarningEnabled && actualCheckInAt) {
                    const lateLimit = new Date(scheduledStartAt.getTime() + teacherLateGraceMinutes * 60 * 1000);
                    if (actualCheckInAt.getTime() > lateLimit.getTime()) {
                        isLate = true;
                    }
                }

                // 퇴근누락 판단
                if (teacherCheckoutMissingWarningEnabled && !hasCheckedOut) {
                    const checkoutLimit = new Date(scheduledEndAt.getTime() + teacherCheckoutMissingGraceMinutes * 60 * 1000);
                    if (parsedNow.getTime() > checkoutLimit.getTime()) {
                        isCheckoutMissing = true;
                    }
                }
            }

            // 상태 결합
            if (isNoShow) {
                currentWarningState = 'ABSENT';
            } else if (isLate && isCheckoutMissing) {
                currentWarningState = 'LATE_CHECKOUT_MISSING';
            } else if (isLate) {
                currentWarningState = 'LATE';
            } else if (isCheckoutMissing) {
                currentWarningState = 'CHECKOUT_MISSING';
            }

            // dedupe keys & user resolution check
            const warningKeys = [
                `SYSTEM_RECOMMEND_STAFF_ABSENT_${staffKey}`,
                `SYSTEM_RECOMMEND_STAFF_LATE_${staffKey}`,
                `SYSTEM_RECOMMEND_STAFF_CHECKOUT_MISSING_${staffKey}`,
                `SYSTEM_RECOMMEND_STAFF_LATE_CHECKOUT_MISSING_${staffKey}`
            ];
            const targetDedupeKey = currentWarningState !== 'NONE' ? `SYSTEM_RECOMMEND_STAFF_${currentWarningState}_${staffKey}` : null;

            const hasResolvedWarning = targetDedupeKey && ctx.db.todayTasks.some(t => 
                t.source === 'system' && 
                (t.status === 'done' || t.status === 'dismissed') && 
                t.dedupeKey === targetDedupeKey
            );



            // Clear obsolete warnings that are no longer matching the current state
            ctx.db.todayTasks = ctx.db.todayTasks.filter(t => {
                if (t.source === 'system' && t.status === 'open' && t.dedupeKey && warningKeys.includes(t.dedupeKey)) {
                    return t.dedupeKey === targetDedupeKey;
                }
                return true;
            });

            // Add new warning if applicable
            if (currentWarningState !== 'NONE' && !hasResolvedWarning) {
                const isAlreadyOpen = ctx.db.todayTasks.some(t => t.dedupeKey === targetDedupeKey && t.status === 'open');

                if (!isAlreadyOpen) {
                    let title = '';
                    let description = '';
                    let warningTypeLabel = '';
                    let reason = '';
                    let dueAt = scheduledEndAt.toISOString();

                    if (currentWarningState === 'ABSENT') {
                        title = `[특이근태] ${t.name} 강사 미출근`;
                        warningTypeLabel = '미출근';
                        reason = '출근 예정시간이 지났지만 출근 기록이 없습니다.';
                        dueAt = new Date(scheduledStartAt.getTime() + teacherNoShowGraceMinutes * 60 * 1000).toISOString();
                    } else if (currentWarningState === 'LATE') {
                        title = `[특이근태] ${t.name} 강사 지각`;
                        warningTypeLabel = '지각';
                        reason = '출근 예정시간보다 늦게 출근했습니다.';
                        dueAt = new Date(scheduledStartAt.getTime() + teacherLateGraceMinutes * 60 * 1000).toISOString();
                    } else if (currentWarningState === 'CHECKOUT_MISSING') {
                        title = `[특이근태] ${t.name} 강사 퇴근 누락`;
                        warningTypeLabel = '퇴근 누락';
                        reason = '근무 시간이 종료되었지만 퇴근 기록이 없습니다.';
                        dueAt = new Date(scheduledEndAt.getTime() + teacherCheckoutMissingGraceMinutes * 60 * 1000).toISOString();
                    } else if (currentWarningState === 'LATE_CHECKOUT_MISSING') {
                        title = `[특이근태] ${t.name} 강사 지각 및 퇴근 누락`;
                        warningTypeLabel = '지각 + 퇴근 누락';
                        reason = '늦게 출근했고, 근무 시간이 종료되었지만 퇴근 기록이 없습니다.';
                        dueAt = new Date(scheduledEndAt.getTime() + teacherCheckoutMissingGraceMinutes * 60 * 1000).toISOString();
                    }

                    const pad = (n) => String(n).padStart(2, '0');
                    const startHM = startTimeStr;
                    const endHM = `${pad(scheduledEndAt.getHours())}:${pad(scheduledEndAt.getMinutes())}`;
                    const actualCheckInStr = actualCheckInAt ? `${pad(actualCheckInAt.getHours())}:${pad(actualCheckInAt.getMinutes())}` : '기록 없음';
                    const actualCheckOutStr = hasCheckedOut ? '기록 있음' : '기록 없음';

                    description = `• 강사명: ${t.name}\n• 예정 출근시간: ${startHM}\n• 마지막 근무 종료시간: ${endHM}\n• 실제 출퇴근 기록: 출근(${actualCheckInStr}) / 퇴근(${actualCheckOutStr})\n• 워닝 유형: ${warningTypeLabel}\n• 간단 사유: ${reason}`;

                    addValidatedSystemTodayTask(ctx, {
                        organizationId: t.academyId || '',
                        segment: 'academy_director_console',
                        domain: 'academy',
                        source: 'system',
                        type: 'attendance',
                        category: 'staff_warning',
                        priority: 'today',
                        status: 'open',
                        dueAt: dueAt,
                        startAt: scheduledStartAt.toISOString(),
                        endAt: scheduledEndAt.toISOString(),
                        title: title,
                        description: description,
                        relatedTeacherIds: [t.id],
                        dedupeKey: targetDedupeKey,
                        visibilityRoles: ['director'],
                        actionType: 'NAVIGATE',
                        actionPayload: { route: '/staff-attendance', teacherId: t.id }
                    }, { domain: 'staffAttendance', silent });
                }
            }
        });

        // Clean up obsolete staff warnings if schedule cancelled
        ctx.db.todayTasks = ctx.db.todayTasks.filter(t => {
            if (t.source === 'system' && t.status === 'open' && t.dedupeKey) {
                const isStaffWarning = 
                    t.dedupeKey.startsWith('SYSTEM_RECOMMEND_STAFF_ABSENT_') ||
                    t.dedupeKey.startsWith('SYSTEM_RECOMMEND_STAFF_LATE_') ||
                    t.dedupeKey.startsWith('SYSTEM_RECOMMEND_STAFF_CHECKOUT_MISSING_') ||
                    t.dedupeKey.startsWith('SYSTEM_RECOMMEND_STAFF_LATE_CHECKOUT_MISSING_');
                if (isStaffWarning) {
                    const parts = t.dedupeKey.split('_');
                    const dateToken = parts[parts.length - 1];
                    const teacherIdToken = parts[parts.length - 2];
                    const keyToFind = `${teacherIdToken}_${dateToken}`;
                    const hasActiveStaff = activeStaffKeys.includes(keyToFind);
                    if (!hasActiveStaff) {
                        return false;
                    }
                }
            }
            return true;
        });
    }
}
