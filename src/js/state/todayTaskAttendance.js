/**
 * todayTaskAttendance.js
 * Extracted student attendance recommendation sync module for Phase 18B
 */

export function syncStudentAttendanceRecommendations(ctx, options) {
    const { parsedNow, y, m, d, dateStr, silent, addValidatedSystemTodayTask } = options;

    if (typeof ctx.getTeacherStudentScheduleForDate === 'function' && typeof ctx.getAttendance === 'function') {
        const todaySchedule = ctx.getTeacherStudentScheduleForDate(dateStr) || [];
        const attendanceList = ctx.getAttendance() || [];

        // Warning policy settings
        const lateDetectionEnabled = typeof ctx.getLateDetectionEnabled === 'function' ? ctx.getLateDetectionEnabled() : true;
        const lateThresholdMinutes = typeof ctx.getLateThresholdMinutes === 'function' ? ctx.getLateThresholdMinutes() : 10;
        const studentAbsenceWarningEnabled = typeof ctx.getStudentAbsenceWarningEnabled === 'function' ? ctx.getStudentAbsenceWarningEnabled() : true;
        const studentCheckoutMissingWarningEnabled = typeof ctx.getStudentCheckoutMissingWarningEnabled === 'function' ? ctx.getStudentCheckoutMissingWarningEnabled() : true;
        const studentCheckoutMissingGraceMinutes = typeof ctx.getStudentCheckoutMissingGraceMinutes === 'function' ? ctx.getStudentCheckoutMissingGraceMinutes() : 10;

        const activeSessionKeys = [];

        todaySchedule.forEach(entry => {
            const sessionKey = `${entry.studentId}_${dateStr}_${entry.time}`;
            activeSessionKeys.push(sessionKey);

            // 2.2 Calculate schedule timings
            const student = typeof ctx.getStudent === 'function' ? ctx.getStudent(entry.studentId) : null;
            const studentName = student ? student.name : '원생';
            const [sh, smin] = entry.time.split(':').map(Number);
            const scheduledStartAt = new Date(y, m, d, sh, smin, 0, 0);
            const duration = entry.classDuration || (student ? student.defaultClassDuration : 50) || 50;
            const scheduledEndAt = new Date(scheduledStartAt.getTime() + duration * 60 * 1000);

            // 2.3 Retrieve attendance details
            const att = attendanceList.find(a => a.studentId === entry.studentId && a.date === dateStr && (a.classTime === entry.time || !a.classTime));
            const hasAttendance = att && att.status !== 'none';

            // 2.4 State transition warning evaluation
            let currentWarningState = 'NONE';
            let checkoutLimit = null;

            if (!hasAttendance) {
                // 수업 종료 후 출석이 없으면 결석 확인 대상
                if (studentAbsenceWarningEnabled && parsedNow.getTime() > scheduledEndAt.getTime()) {
                    currentWarningState = 'ABSENT';
                }
            } else if (att.status !== 'absent') {
                // 출석한 경우
                let isLate = false;
                let actualCheckInAt = null;

                if (lateDetectionEnabled && att.time) {
                    const [actH, actM] = att.time.split(':').map(Number);
                    actualCheckInAt = new Date(y, m, d, actH, actM, 0, 0);
                    const lateLimit = new Date(scheduledStartAt.getTime() + lateThresholdMinutes * 60 * 1000);
                    // 지각 판단 (초과 시)
                    if (actualCheckInAt.getTime() > lateLimit.getTime()) {
                        isLate = true;
                    }
                }

                let isCheckoutMissing = false;
                // 하원이 찍혀있지 않을 때만 하원누락 대상
                if (studentCheckoutMissingWarningEnabled && !att.leavingTime) {
                    // 기준 종료 시각 산정
                    if (isLate && actualCheckInAt) {
                        checkoutLimit = new Date(actualCheckInAt.getTime() + (duration + studentCheckoutMissingGraceMinutes) * 60 * 1000);
                    } else {
                        checkoutLimit = new Date(scheduledStartAt.getTime() + (duration + studentCheckoutMissingGraceMinutes) * 60 * 1000);
                    }

                    if (parsedNow.getTime() > checkoutLimit.getTime()) {
                        isCheckoutMissing = true;
                    }
                }

                // 상태 결합
                if (isLate && isCheckoutMissing) {
                    currentWarningState = 'LATE_CHECKOUT_MISSING';
                } else if (isLate) {
                    currentWarningState = 'LATE';
                } else if (isCheckoutMissing) {
                    currentWarningState = 'CHECKOUT_MISSING';
                }
            }

            // 2.4.1 Calculate dedupe keys and check if already resolved by user
            const warningKeys = [
                `SYSTEM_RECOMMEND_ABSENT_${sessionKey}`,
                `SYSTEM_RECOMMEND_LATE_${sessionKey}`,
                `SYSTEM_RECOMMEND_CHECKOUT_MISSING_${sessionKey}`,
                `SYSTEM_RECOMMEND_LATE_CHECKOUT_MISSING_${sessionKey}`
            ];
            const targetDedupeKey = currentWarningState !== 'NONE' ? `SYSTEM_RECOMMEND_${currentWarningState}_${sessionKey}` : null;

            const hasResolvedWarning = targetDedupeKey && ctx.db.todayTasks.some(t => 
                t.source === 'system' && 
                (t.status === 'done' || t.status === 'dismissed') && 
                t.dedupeKey === targetDedupeKey
            );

            // 2.5 Clear obsolete warnings that are no longer matching the current state
            ctx.db.todayTasks = ctx.db.todayTasks.filter(t => {
                if (t.source === 'system' && t.status === 'open' && t.dedupeKey && warningKeys.includes(t.dedupeKey)) {
                    // Keep only if it matches the newly evaluated target state
                    return t.dedupeKey === targetDedupeKey;
                }
                return true;
            });

            // 2.6 Add new warning if applicable and not already created or resolved by user
            if (currentWarningState !== 'NONE' && !hasResolvedWarning) {
                const isAlreadyOpen = ctx.db.todayTasks.some(t => t.dedupeKey === targetDedupeKey && t.status === 'open');
                if (!isAlreadyOpen) {
                    let title = '';
                    let description = '';
                    let category = 'attendance_warning';
                    let dueAt = scheduledEndAt.toISOString();
                    let warningTypeLabel = '';
                    let reason = '';

                    if (currentWarningState === 'ABSENT') {
                        category = 'absent';
                        title = `[결석 확인] ${studentName} 원생 결석 확인`;
                        warningTypeLabel = '결석 확인';
                        reason = '수업이 끝났지만 출석 기록이 없습니다.';
                        dueAt = scheduledEndAt.toISOString();
                    } else if (currentWarningState === 'LATE') {
                        title = `[특이출결] ${studentName} 원생 지각`;
                        warningTypeLabel = '지각';
                        reason = '수업 시작 후 출석했습니다.';
                        dueAt = new Date(scheduledStartAt.getTime() + lateThresholdMinutes * 60 * 1000).toISOString();
                    } else if (currentWarningState === 'CHECKOUT_MISSING') {
                        title = `[특이출결] ${studentName} 원생 하원 누락`;
                        warningTypeLabel = '하원 누락';
                        reason = '수업 시간이 종료되었지만 하원 기록이 없습니다.';
                        dueAt = checkoutLimit ? checkoutLimit.toISOString() : scheduledEndAt.toISOString();
                    } else if (currentWarningState === 'LATE_CHECKOUT_MISSING') {
                        title = `[특이출결] ${studentName} 원생 지각 및 하원 누락`;
                        warningTypeLabel = '지각 + 하원 누락';
                        reason = '지각 출석 후 수업 시간이 종료되었지만 하원 기록이 없습니다.';
                        dueAt = checkoutLimit ? checkoutLimit.toISOString() : scheduledEndAt.toISOString();
                    }

                    const startHM = entry.time;
                    const pad = (n) => String(n).padStart(2, '0');
                    const endHM = entry.endTime || `${pad(scheduledEndAt.getHours())}:${pad(scheduledEndAt.getMinutes())}`;
                    const teacher = entry.teacherId ? (typeof ctx.getTeacher === 'function' ? ctx.getTeacher(entry.teacherId) : null) : null;
                    const teacherName = teacher ? teacher.name : '미지정';
                    const instrument = student ? (student.instrument || '미지정') : '미지정';

                    description = `• 원생명: ${studentName}\n• 수업 시간: ${startHM} ~ ${endHM}\n• 담당 강사: ${teacherName}\n• 과목/악기: ${instrument}\n• 워닝 유형: ${warningTypeLabel}\n• 간단 사유: ${reason}`;

                    addValidatedSystemTodayTask(ctx, {
                        organizationId: student ? (student.academyId || '') : '',
                        segment: 'academy_director_console',
                        domain: 'academy',
                        source: 'system',
                        type: 'attendance',
                        category: category,
                        priority: 'today',
                        status: 'open',
                        dueAt: dueAt,
                        startAt: scheduledStartAt.toISOString(),
                        endAt: scheduledEndAt.toISOString(),
                        title: title,
                        description: description,
                        relatedStudentIds: [entry.studentId],
                        relatedTeacherIds: [entry.teacherId].filter(Boolean),
                        dedupeKey: targetDedupeKey,
                        visibilityRoles: ['director'],
                        actionType: 'NAVIGATE',
                        actionPayload: { route: '/attendance', studentId: entry.studentId }
                    }, { domain: 'studentAttendance', silent });
                }
            }
        });

        // 3. Clean up warnings for cancelled schedules or changed teachers
        ctx.db.todayTasks = ctx.db.todayTasks.filter(t => {
            if (t.source === 'system' && t.status === 'open' && t.dedupeKey) {
                const isStudentWarning = 
                    t.dedupeKey.startsWith('SYSTEM_RECOMMEND_ABSENT_') ||
                    t.dedupeKey.startsWith('SYSTEM_RECOMMEND_LATE_') ||
                    t.dedupeKey.startsWith('SYSTEM_RECOMMEND_CHECKOUT_MISSING_') ||
                    t.dedupeKey.startsWith('SYSTEM_RECOMMEND_LATE_CHECKOUT_MISSING_');
                    
                if (isStudentWarning) {
                    const hasActiveSchedule = activeSessionKeys.some(key => t.dedupeKey.includes(key));
                    if (!hasActiveSchedule) {
                        return false; // Obsolete session warning removed
                    }
                }
            }
            return true;
        });
    }
}
